// lib/firebase.js
// ================================================================
// Firestore via REST API — tanpa firebase-admin SDK
// Tidak ada gRPC, tidak ada protobufjs, tidak ada opentelemetry.
// Bekerja 100% di Vercel serverless dengan fetch() biasa.
//
// Auth: Google Service Account → JWT → OAuth2 access token
// Endpoint: https://firestore.googleapis.com/v1/projects/{id}/databases/(default)/documents
// ================================================================

import { SignJWT, importPKCS8 } from 'jose'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// Cache access token in-memory (berlaku 1 jam, kita cache 55 menit)
let _token = null
let _tokenExpiry = 0

async function getAccessToken() {
  if (_token && Date.now() < _tokenExpiry) return _token

  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL
  const privateKeyPem = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  const privateKey = await importPKCS8(privateKeyPem, 'RS256')

  const now = Math.floor(Date.now() / 1000)
  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/datastore'
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Gagal mendapat access token: ' + JSON.stringify(data))

  _token = data.access_token
  _tokenExpiry = Date.now() + 55 * 60 * 1000
  return _token
}

// ── Konversi Firestore value format → JS value ────────────────
function fromFirestore(fields = {}) {
  const obj = {}
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = decodeValue(v)
  }
  return obj
}

function decodeValue(v) {
  if (v.stringValue  !== undefined) return v.stringValue
  if (v.integerValue !== undefined) return Number(v.integerValue)
  if (v.doubleValue  !== undefined) return v.doubleValue
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.nullValue    !== undefined) return null
  if (v.timestampValue !== undefined) return v.timestampValue
  if (v.arrayValue   !== undefined) return (v.arrayValue.values || []).map(decodeValue)
  if (v.mapValue     !== undefined) return fromFirestore(v.mapValue.fields || {})
  return null
}

// ── Konversi JS value → Firestore value format ────────────────
function toFirestore(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = encodeValue(v)
  }
  return fields
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number') {
    if (Number.isInteger(v))         return { integerValue: String(v) }
    return { doubleValue: v }
  }
  if (typeof v === 'string')         return { stringValue: v }
  if (Array.isArray(v))              return { arrayValue: { values: v.map(encodeValue) } }
  if (typeof v === 'object')         return { mapValue: { fields: toFirestore(v) } }
  return { stringValue: String(v) }
}

// ── HTTP helpers ──────────────────────────────────────────────
async function req(method, path, body) {
  const token = await getAccessToken()
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Firestore ${method} ${path} → ${res.status}: ${JSON.stringify(err)}`)
  }
  if (res.status === 204) return {}
  return res.json()
}

// ── Public API (identik dengan firebase-admin Firestore) ──────

export async function fsGet(collection, docId) {
  const data = await req('GET', `/${collection}/${docId}`)
  if (!data || !data.fields) return null
  return fromFirestore(data.fields)
}

export async function fsSet(collection, docId, obj) {
  const fields = toFirestore(obj)
  await req('PATCH', `/${collection}/${docId}`, { fields })
  return true
}

export async function fsUpdate(collection, docId, obj) {
  // PATCH dengan updateMask hanya update field yang diberikan
  const fields = toFirestore(obj)
  const mask   = Object.keys(obj).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const token  = await getAccessToken()
  const res = await fetch(`${BASE_URL}/${collection}/${docId}?${mask}`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  })
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(JSON.stringify(e)) }
  return true
}

export async function fsDelete(collection, docId) {
  await req('DELETE', `/${collection}/${docId}`)
  return true
}

export async function fsList(collection, { limit = 100, orderBy = null } = {}) {
  let path = `/${collection}?pageSize=${limit}`
  if (orderBy) path += `&orderBy=${orderBy}`
  const data = await req('GET', path)
  if (!data || !data.documents) return []
  return data.documents.map(doc => {
    const obj = fromFirestore(doc.fields || {})
    // Tambah _id dari nama dokumen
    obj._id = doc.name.split('/').pop()
    return obj
  })
}

export async function fsQuery(collection, filters = [], { limit = 500, orderBy = null } = {}) {
  const token = await getAccessToken()

  const structuredQuery = {
    from: [{ collectionId: collection }],
    limit
  }

  if (filters.length > 0) {
    const fieldFilters = filters.map(([field, op, value]) => ({
      fieldFilter: {
        field: { fieldPath: field },
        op: opMap[op] || op,
        value: encodeValue(value)
      }
    }))

    structuredQuery.where = fieldFilters.length === 1
      ? fieldFilters[0]
      : { compositeFilter: { op: 'AND', filters: fieldFilters } }
  }

  if (orderBy) {
    structuredQuery.orderBy = [{ field: { fieldPath: orderBy }, direction: 'ASCENDING' }]
  }

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery })
    }
  )

  const rows = await res.json()
  if (!Array.isArray(rows)) return []
  return rows
    .filter(r => r.document)
    .map(r => {
      const obj = fromFirestore(r.document.fields || {})
      obj._id = r.document.name.split('/').pop()
      return obj
    })
}

export async function fsBatchWrite(ops) {
  // ops: [{ type: 'set'|'delete', collection, docId, data }]
  const token = await getAccessToken()
  const CHUNK = 500
  for (let i = 0; i < ops.length; i += CHUNK) {
    const writes = ops.slice(i, i + CHUNK).map(op => {
      if (op.type === 'delete') {
        return { delete: `${BASE_URL.replace('/documents','')}/documents/${op.collection}/${op.docId}`.replace('//documents','/documents') }
      }
      const name = `projects/${PROJECT_ID}/databases/(default)/documents/${op.collection}/${op.docId}`
      return { update: { name, fields: toFirestore(op.data || {}) } }
    })
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
      {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes })
      }
    )
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error('batchWrite error: ' + JSON.stringify(e)) }
  }
  return true
}

const opMap = {
  '==': 'EQUAL', '!=': 'NOT_EQUAL',
  '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL',
  'in': 'IN', 'not-in': 'NOT_IN', 'array-contains': 'ARRAY_CONTAINS'
}
