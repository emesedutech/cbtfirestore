// pages/api/handlers/soal.js
import { fsGet, fsList, fsSet, fsUpdate, fsDelete, fsQuery, fsBatchWrite, COL } from '../../../lib/firestore.js'
import { generateId, logActivity, updateJumlahSoalPaket, cacheDelete } from '../../../lib/utils.js'
import { hasPermission } from '../../../lib/auth.js'

export async function getSoalList(data) {
  const session = data._session
  if (!hasPermission(session, 'getSoalList')) return { success: false, message: 'Akses ditolak.' }
  try {
    const { kode_paket, search, page = 1, limit = 50 } = data
    let docs
    if (kode_paket) {
      docs = await fsQuery(COL.SOAL, [{ field: 'kode_paket', op: '==', value: kode_paket }])
    } else {
      docs = await fsList(COL.SOAL, 10000)
    }
    if (search) {
      const q = search.toLowerCase()
      docs = docs.filter(d => (d.pertanyaan || '').toLowerCase().includes(q))
    }
    const total = docs.length
    const start = (page - 1) * limit
    return { success: true, data: docs.slice(start, start + limit), total, page, limit }
  } catch(e) { return { success: false, message: e.message } }
}

export async function saveSoal(data) {
  const session = data._session
  if (!hasPermission(session, 'saveSoal')) return { success: false, message: 'Akses ditolak.' }
  const s = data.soal
  if (!s || !s.kode_paket) return { success: false, message: 'Kode paket wajib diisi.' }
  try {
    const isNew = !s.kode_soal
    const docId = s.kode_soal || generateId('SL')
    const now   = new Date().toISOString()
    const obj   = { ...s, kode_soal: docId, updated_at: now }
    if (isNew) obj.created_at = now
    await fsSet(COL.SOAL, docId, obj)
    await updateJumlahSoalPaket(s.kode_paket)
    logActivity('SAVE_SOAL', session.username, (isNew ? 'Tambah' : 'Edit') + ' soal: ' + docId)
    return { success: true, kode_soal: docId }
  } catch(e) { return { success: false, message: e.message } }
}

export async function deleteSoal(data) {
  const session = data._session
  if (!hasPermission(session, 'deleteSoal')) return { success: false, message: 'Akses ditolak.' }
  const { kode_soal, kode_paket } = data
  try {
    await fsDelete(COL.SOAL, kode_soal)
    if (kode_paket) await updateJumlahSoalPaket(kode_paket)
    logActivity('DELETE_SOAL', session.username, 'Hapus soal: ' + kode_soal)
    return { success: true, message: 'Soal berhasil dihapus.' }
  } catch(e) { return { success: false, message: e.message } }
}

export async function importSoal(data) {
  const session = data._session
  if (!hasPermission(session, 'importSoal')) return { success: false, message: 'Akses ditolak.' }
  const { rows, kode_paket } = data
  if (!kode_paket) return { success: false, message: 'Kode paket wajib diisi.' }
  try {
    const now = new Date().toISOString()
    const ops = (rows || []).map(r => {
      const docId = generateId('SL')
      return { type: 'set', collection: COL.SOAL, docId, data: { ...r, kode_soal: docId, kode_paket, created_at: now, updated_at: now } }
    })
    await fsBatchWrite(ops)
    await updateJumlahSoalPaket(kode_paket)
    logActivity('IMPORT_SOAL', session.username, 'Import ' + ops.length + ' soal ke paket ' + kode_paket)
    return { success: true, message: ops.length + ' soal berhasil diimport.' }
  } catch(e) { return { success: false, message: e.message } }
}
