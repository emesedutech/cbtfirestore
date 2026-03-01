// lib/utils.js
// Utilities – pengganti GAS: generateId, logActivity, cache in-memory, loadPengaturan, dll.
import { v4 as uuidv4 } from 'uuid'
import { fsSet, fsList, fsQuery, fsGet, fsBatchWrite, COL } from './firestore.js'

// ── ID Generator ───────────────────────────────────────────────
export function generateId(prefix = '') {
  const rand = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()
  return prefix ? `${prefix}_${rand}` : rand
}

// ── Log Activity ───────────────────────────────────────────────
// Buffer log flush (mirip _flushLogs GAS)
let _logBuffer = []

export function logActivity(action, actor, detail = '') {
  _logBuffer.push({
    id_log    : generateId('LOG'),
    action,
    actor,
    detail,
    timestamp : new Date().toISOString()
  })
}

export function logError(fn, err) {
  _logBuffer.push({
    id_log    : generateId('ERR'),
    action    : 'ERROR_' + fn,
    actor     : 'SYSTEM',
    detail    : String(err?.message || err),
    timestamp : new Date().toISOString()
  })
}

export async function flushLogs() {
  if (_logBuffer.length === 0) return
  const toFlush = [..._logBuffer]
  _logBuffer    = []
  try {
    const ops = toFlush.map(l => ({
      type      : 'set',
      collection: COL.LOG,
      docId     : l.id_log,
      data      : l
    }))
    await fsBatchWrite(ops)
  } catch (_) { /* log gagal tidak boleh crash app */ }
}

// ── In-Memory Cache (per-request; Next.js Edge/Serverless tidak ada shared memory) ──
// Untuk shared cache antar request gunakan Firestore atau Upstash Redis.
// Di sini pakai Map sederhana (process-level – efektif di dev, di production terbatas).
const _cache = new Map()

export function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.exp) { _cache.delete(key); return null }
  return entry.value
}

export function cachePut(key, value, ttlSeconds = 300) {
  _cache.set(key, { value, exp: Date.now() + ttlSeconds * 1000 })
}

export function cacheDelete(key) {
  _cache.delete(key)
}

// ── Load Pengaturan (flatten key→value dari koleksi pengaturan) ──
let _pengCache     = null
let _pengCacheExp  = 0

export async function loadPengaturan() {
  if (_pengCache && Date.now() < _pengCacheExp) return _pengCache
  try {
    const docs = await fsList(COL.PENGATURAN, 200)
    const obj  = {}
    docs.forEach(d => { obj[d.key || d._id] = d.value || '' })
    _pengCache    = obj
    _pengCacheExp = Date.now() + 60_000 // 60 detik
    return obj
  } catch { return {} }
}

export function invalidatePengaturanCache() {
  _pengCache   = null
  _pengCacheExp = 0
}

export async function savePengaturanItem(key, value, deskripsi = '') {
  await fsSet(COL.PENGATURAN, key, { key, value: String(value), deskripsi })
  invalidatePengaturanCache()
}

// ── Hitung Nilai ───────────────────────────────────────────────
export const TIPE_SOAL_ORDER = [
  'Pilihan Ganda', 'Pilihan Ganda Kompleks', 'Benar/Salah',
  'Menjodohkan', 'Isian Singkat', 'Uraian'
]

export function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return Math.abs(h)
}

export function seededShuffle(arr, seed) {
  const r = [...arr]
  let s = seed
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

export function acakSoalBerdasarkanTipe(soalList, id_siswa, kode_paket) {
  const seed   = hashSeed(String(id_siswa) + '_' + kode_paket)
  const groups = {}
  TIPE_SOAL_ORDER.forEach(t => { groups[t] = [] })
  const unknown = []
  soalList.forEach(s => {
    const t = s.tipe_soal || 'Pilihan Ganda'
    if (groups[t] !== undefined) groups[t].push(s)
    else unknown.push(s)
  })
  const result = []
  TIPE_SOAL_ORDER.forEach((t, idx) => {
    if (groups[t].length > 0) result.push(...seededShuffle(groups[t], seed + idx * 100003))
  })
  if (unknown.length > 0) result.push(...seededShuffle(unknown, seed + 999999))
  return result
}

// ── Helper getSiswaById ────────────────────────────────────────
export async function getSiswaById(id_siswa) {
  try {
    const doc = await fsGet(COL.SISWA, id_siswa)
    if (doc) return doc
    // Fallback: query
    const docs = await fsQuery(COL.SISWA, [{ field: 'id_siswa', op: '==', value: id_siswa }])
    return docs[0] || null
  } catch { return null }
}

// ── Password hashing (re-export from auth) ────────────────────
import bcrypt from 'bcryptjs'
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

// ── updateJumlahSoalPaket ──────────────────────────────────────
export async function updateJumlahSoalPaket(kode_paket) {
  try {
    const soalList = await fsQuery(COL.SOAL, [{ field: 'kode_paket', op: '==', value: kode_paket }])
    const { fsUpdate } = await import('./firestore.js')
    await fsUpdate(COL.PAKET, kode_paket, { jumlah_soal: soalList.length, updated_at: new Date().toISOString() })
  } catch (_) {}
}
