// pages/api/handlers/pengaturan.js
import { fsList, fsSet, COL } from '../../../lib/firestore.js'
import { loadPengaturan, invalidatePengaturanCache, savePengaturanItem, logActivity } from '../../../lib/utils.js'
import { hasPermission } from '../../../lib/auth.js'

export async function getPengaturan(data) {
  const session = data._session
  if (!hasPermission(session, 'getPengaturan')) return { success: false, message: 'Akses ditolak.' }
  try {
    const obj = await loadPengaturan()
    return { success: true, data: obj }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getPengaturanPublik(data) {
  try {
    const obj = await loadPengaturan()
    // Hanya field publik (tidak ada credentials)
    const pub = { nama_sekolah: obj.nama_sekolah || '', logo_url: obj.logo_url || '' }
    return { success: true, data: pub }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getPengaturanPublikSiswa(data) {
  try {
    const obj = await loadPengaturan()
    const pub = {
      nama_sekolah    : obj.nama_sekolah || '',
      logo_url        : obj.logo_url || '',
      izinkan_review  : obj.izinkan_review || 'true',
      tampil_kunci    : obj.tampil_kunci || 'false',
      sembunyikan_nilai: obj.sembunyikan_nilai || 'false',
      izinkan_lanjut  : obj.izinkan_lanjut || 'false'
    }
    return { success: true, data: pub }
  } catch(e) { return { success: false, message: e.message } }
}

export async function savePengaturan(data) {
  const session = data._session
  if (!hasPermission(session, 'savePengaturan')) return { success: false, message: 'Akses ditolak.' }
  const pengaturan = data.pengaturan || {}
  try {
    const ops = Object.entries(pengaturan).map(([key, value]) => ({
      type: 'set', collection: COL.PENGATURAN, docId: key,
      data: { key, value: String(value), deskripsi: '' }
    }))
    const { fsBatchWrite } = await import('../../../lib/firestore.js')
    if (ops.length > 0) await fsBatchWrite(ops)
    invalidatePengaturanCache()
    logActivity('SAVE_PENGATURAN', session.username, 'Update pengaturan: ' + Object.keys(pengaturan).join(', '))
    return { success: true, message: 'Pengaturan berhasil disimpan.' }
  } catch(e) { return { success: false, message: e.message } }
}
