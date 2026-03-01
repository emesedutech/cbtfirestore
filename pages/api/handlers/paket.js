// pages/api/handlers/paket.js
import { fsGet, fsList, fsSet, fsUpdate, fsDelete, fsQuery, fsBatchWrite, COL } from '../../../lib/firestore.js'
import { generateId, logActivity } from '../../../lib/utils.js'
import { hasPermission } from '../../../lib/auth.js'

export async function getPaketList(data) {
  const session = data._session
  if (!hasPermission(session, 'getPaketList')) return { success: false, message: 'Akses ditolak.' }
  try {
    const docs = await fsList(COL.PAKET, 1000)
    docs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return { success: true, data: docs }
  } catch(e) { return { success: false, message: e.message } }
}

export async function savePaket(data) {
  const session = data._session
  if (!hasPermission(session, 'savePaket')) return { success: false, message: 'Akses ditolak.' }
  const p = data.paket
  if (!p?.nama_paket) return { success: false, message: 'Nama paket wajib diisi.' }
  try {
    const isNew = !p.kode_paket
    const docId = p.kode_paket || generateId('PKT')
    const now   = new Date().toISOString()
    const obj   = { ...p, kode_paket: docId, updated_at: now }
    if (isNew) obj.created_at = now
    await fsSet(COL.PAKET, docId, obj)
    logActivity('SAVE_PAKET', session.username, (isNew ? 'Tambah' : 'Edit') + ' paket: ' + p.nama_paket)
    return { success: true, kode_paket: docId }
  } catch(e) { return { success: false, message: e.message } }
}

export async function deletePaket(data) {
  const session = data._session
  if (!hasPermission(session, 'deletePaket')) return { success: false, message: 'Akses ditolak.' }
  try {
    await fsDelete(COL.PAKET, data.kode_paket)
    logActivity('DELETE_PAKET', session.username, 'Hapus paket: ' + data.kode_paket)
    return { success: true, message: 'Paket berhasil dihapus.' }
  } catch(e) { return { success: false, message: e.message } }
}

export async function duplikasiPaket(data) {
  const session = data._session
  if (!hasPermission(session, 'duplikasiPaket')) return { success: false, message: 'Akses ditolak.' }
  const { kode_paket, nama_baru } = data
  try {
    const paket = await fsGet(COL.PAKET, kode_paket)
    if (!paket) return { success: false, message: 'Paket tidak ditemukan.' }
    const newKode  = generateId('PKT')
    const now      = new Date().toISOString()
    const newPaket = { ...paket, _id: undefined, kode_paket: newKode,
      nama_paket: nama_baru || paket.nama_paket + ' (Kopi)',
      status: 'nonaktif', created_at: now, updated_at: now }
    delete newPaket._id
    await fsSet(COL.PAKET, newKode, newPaket)
    // Duplikasi soal
    const soalList = await fsQuery(COL.SOAL, [{ field: 'kode_paket', op: '==', value: kode_paket }])
    const ops = soalList.map(s => {
      const newId = generateId('SL')
      const ns = { ...s, _id: undefined, kode_soal: newId, kode_paket: newKode, created_at: now, updated_at: now }
      delete ns._id
      return { type: 'set', collection: COL.SOAL, docId: newId, data: ns }
    })
    if (ops.length > 0) await fsBatchWrite(ops)
    logActivity('DUPLIKASI_PAKET', session.username, 'Duplikasi paket ' + kode_paket + ' → ' + newKode)
    return { success: true, kode_paket_baru: newKode }
  } catch(e) { return { success: false, message: e.message } }
}

// ── Token Ujian ────────────────────────────────────────────────

export async function generateTokenUjian(data) {
  const session = data._session
  if (!hasPermission(session, 'generateTokenUjian')) return { success: false, message: 'Akses ditolak.' }
  const { kode_paket } = data
  try {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let token = ''
    for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)]
    await fsUpdate(COL.PAKET, kode_paket, { token_ujian: token, updated_at: new Date().toISOString() })
    logActivity('GEN_TOKEN', session.username, 'Generate token paket: ' + kode_paket)
    return { success: true, token }
  } catch(e) { return { success: false, message: e.message } }
}

export async function hapusTokenUjian(data) {
  const session = data._session
  if (!hasPermission(session, 'hapusTokenUjian')) return { success: false, message: 'Akses ditolak.' }
  try {
    await fsUpdate(COL.PAKET, data.kode_paket, { token_ujian: '', updated_at: new Date().toISOString() })
    return { success: true, message: 'Token berhasil dihapus.' }
  } catch(e) { return { success: false, message: e.message } }
}

export async function validasiTokenUjian(data) {
  const { kode_paket, token } = data
  try {
    const paket = await fsGet(COL.PAKET, kode_paket)
    if (!paket) return { success: false, message: 'Paket tidak ditemukan.' }
    if (!paket.token_ujian) return { success: true } // tidak ada token = bebas
    if (String(paket.token_ujian).toUpperCase() === String(token).toUpperCase()) return { success: true }
    return { success: false, message: 'Token ujian salah.' }
  } catch(e) { return { success: false, message: e.message } }
}
