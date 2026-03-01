// lib/firestore.js
// Helper Firestore – pengganti fungsi fs* di GAS (fsGet, fsSet, fsList, dll)
import { getFirestore } from './firebase.js'

// ── Nama Koleksi ────────────────────────────────────────────────
export const COL = {
  SISWA     : 'siswa',
  SOAL      : 'soal',
  PAKET     : 'paket',
  SESI      : 'sesi',
  NILAI     : 'nilai',
  PENGATURAN: 'pengaturan',
  ADMIN     : 'admin_users',
  LOG       : 'log_activity',
  FAQ       : 'faq',
  CHAT      : 'chat',
  SESSION   : 'sessions'
}

export const TIPE_SOAL_ORDER = [
  'Pilihan Ganda', 'Pilihan Ganda Kompleks', 'Benar/Salah',
  'Menjodohkan', 'Isian Singkat', 'Uraian'
]

// ── Operasi Dokumen ─────────────────────────────────────────────

/** Baca 1 dokumen. Kembalikan null jika tidak ada. */
export async function fsGet(collection, docId) {
  const db  = getFirestore()
  const ref = db.collection(collection).doc(String(docId))
  const snap = await ref.get()
  if (!snap.exists) return null
  return { _id: snap.id, ...snap.data() }
}

/** Tulis/replace 1 dokumen (merge: false → overwrite penuh). */
export async function fsSet(collection, docId, data) {
  const db = getFirestore()
  await db.collection(collection).doc(String(docId)).set(data)
}

/** Update field tertentu saja (partial update). */
export async function fsUpdate(collection, docId, data) {
  const db = getFirestore()
  await db.collection(collection).doc(String(docId)).update(data)
}

/** Hapus 1 dokumen. */
export async function fsDelete(collection, docId) {
  const db = getFirestore()
  await db.collection(collection).doc(String(docId)).delete()
}

/** Ambil semua dokumen di koleksi (dengan limit opsional). */
export async function fsList(collection, limitNum = 1000) {
  const db   = getFirestore()
  const snap = await db.collection(collection).limit(limitNum).get()
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }))
}

/**
 * Query sederhana – mendukung array filter:
 * [{ field, op, value }, ...]  op: '==' | '<' | '>' | '<=' | '>=' | 'in'
 */
export async function fsQuery(collection, filters = [], limitNum = 1000) {
  const db  = getFirestore()
  let ref   = db.collection(collection)
  for (const f of filters) {
    ref = ref.where(f.field, f.op, f.value)
  }
  const snap = await ref.limit(limitNum).get()
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }))
}

/**
 * Batch write – array operasi:
 * [{ type: 'set'|'update'|'delete', collection, docId, data? }]
 * Firestore max 500 per batch → otomatis di-chunk
 */
export async function fsBatchWrite(ops) {
  const db    = getFirestore()
  const CHUNK = 500
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch()
    ops.slice(i, i + CHUNK).forEach(op => {
      const ref = db.collection(op.collection).doc(String(op.docId))
      if (op.type === 'set')    batch.set(ref, op.data)
      else if (op.type === 'update') batch.update(ref, op.data)
      else if (op.type === 'delete') batch.delete(ref)
    })
    await batch.commit()
  }
}
