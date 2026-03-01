// pages/api/handlers/siswa.js
import { fsGet, fsList, fsSet, fsUpdate, fsDelete, fsQuery, fsBatchWrite, COL } from '../../../lib/firestore.js'
import { generateId, logActivity, hashPassword } from '../../../lib/utils.js'
import { hasPermission } from '../../../lib/auth.js'

export async function getSiswaList(data) {
  const session = data._session
  if (!hasPermission(session, 'getSiswaList')) return { success: false, message: 'Akses ditolak.' }
  try {
    let docs = await fsList(COL.SISWA, 5000)
    const { search, kelas, page = 1, limit = 50 } = data
    if (search) {
      const q = search.toLowerCase()
      docs = docs.filter(d =>
        (d.nama || '').toLowerCase().includes(q) ||
        (d.username || '').toLowerCase().includes(q) ||
        (d.nis || '').toLowerCase().includes(q)
      )
    }
    if (kelas) docs = docs.filter(d => d.kelas === kelas)
    docs.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
    const total = docs.length
    const start = (page - 1) * limit
    return { success: true, data: docs.slice(start, start + limit), total, page, limit }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getSiswaUntukKartu(data) {
  const session = data._session
  if (!hasPermission(session, 'getSiswaUntukKartu')) return { success: false, message: 'Akses ditolak.' }
  try {
    const docs = await fsList(COL.SISWA, 5000)
    docs.sort((a, b) => (a.kelas || '').localeCompare(b.kelas || '') || (a.nama || '').localeCompare(b.nama || ''))
    return { success: true, data: docs }
  } catch(e) { return { success: false, message: e.message } }
}

export async function saveSiswa(data) {
  const session = data._session
  if (!hasPermission(session, 'saveSiswa')) return { success: false, message: 'Akses ditolak.' }
  const s = data.siswa
  if (!s || !s.nama || !s.username) return { success: false, message: 'Nama dan username wajib diisi.' }
  try {
    const isNew = !s.id_siswa
    const docId = s.id_siswa || generateId('SW')
    const now   = new Date().toISOString()
    // Hash password jika ada
    let pw = s.password
    if (pw && pw !== '***') pw = await hashPassword(pw)
    else if (isNew) pw = await hashPassword(s.username) // default: username sebagai password
    else {
      const existing = await fsGet(COL.SISWA, docId)
      pw = existing?.password || await hashPassword(s.username)
    }
    const obj = { ...s, id_siswa: docId, password: pw, updated_at: now }
    if (isNew) obj.created_at = now
    await fsSet(COL.SISWA, docId, obj)
    logActivity('SAVE_SISWA', session.username, (isNew ? 'Tambah' : 'Edit') + ' siswa: ' + s.nama)
    return { success: true, id_siswa: docId }
  } catch(e) { return { success: false, message: e.message } }
}

export async function deleteSiswa(data) {
  const session = data._session
  if (!hasPermission(session, 'deleteSiswa')) return { success: false, message: 'Akses ditolak.' }
  try {
    await fsDelete(COL.SISWA, data.id_siswa)
    logActivity('DELETE_SISWA', session.username, 'Hapus siswa: ' + data.id_siswa)
    return { success: true, message: 'Siswa berhasil dihapus.' }
  } catch(e) { return { success: false, message: e.message } }
}

export async function importSiswa(data) {
  const session = data._session
  if (!hasPermission(session, 'importSiswa')) return { success: false, message: 'Akses ditolak.' }
  const rows = data.rows || []
  if (rows.length === 0) return { success: false, message: 'Data kosong.' }
  try {
    const now = new Date().toISOString()
    const ops = await Promise.all(rows.map(async r => {
      const docId = r.id_siswa || generateId('SW')
      const pw    = r.password ? await hashPassword(r.password) : await hashPassword(r.username || docId)
      return {
        type: 'set', collection: COL.SISWA, docId,
        data: { ...r, id_siswa: docId, password: pw, created_at: now, updated_at: now }
      }
    }))
    await fsBatchWrite(ops)
    logActivity('IMPORT_SISWA', session.username, 'Import ' + rows.length + ' siswa')
    return { success: true, message: rows.length + ' siswa berhasil diimport.' }
  } catch(e) { return { success: false, message: e.message } }
}
