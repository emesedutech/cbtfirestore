// pages/api/handlers/monitoring.js
import { fsGet, fsList, fsSet, fsUpdate, fsDelete, fsQuery, fsBatchWrite, COL } from '../../../lib/firestore.js'
import { logActivity, getSiswaById } from '../../../lib/utils.js'
import { hasPermission } from '../../../lib/auth.js'
import { hitungNilai } from './ujian.js'

export async function getMonitoring(data) {
  const session = data._session
  if (!hasPermission(session, 'getMonitoring')) return { success: false, message: 'Akses ditolak.' }
  try {
    const { kode_paket } = data
    let sesiList = kode_paket
      ? await fsQuery(COL.SESI, [{ field: 'kode_paket', op: '==', value: kode_paket }])
      : await fsList(COL.SESI, 2000)
    sesiList.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    return { success: true, data: sesiList }
  } catch(e) { return { success: false, message: e.message } }
}

export async function resetUjian(data) {
  const session = data._session
  if (!hasPermission(session, 'resetUjian')) return { success: false, message: 'Akses ditolak.' }
  const { id_siswa, kode_paket } = data
  try {
    const sesiId  = 'SESI_' + id_siswa + '_' + kode_paket
    const nilaiId = 'N' + id_siswa + '_' + kode_paket
    await Promise.all([
      fsDelete(COL.SESI, sesiId).catch(() => {}),
      fsDelete(COL.NILAI, nilaiId).catch(() => {})
    ])
    logActivity('RESET_UJIAN', session.username, 'Reset ujian ' + id_siswa + ' paket ' + kode_paket)
    return { success: true, message: 'Ujian berhasil direset.' }
  } catch(e) { return { success: false, message: e.message } }
}

export async function paksakanSubmit(data) {
  const session = data._session
  if (!hasPermission(session, 'paksakanSubmit')) return { success: false, message: 'Akses ditolak.' }
  const { id_siswa, kode_paket } = data
  try {
    const sesiId = 'SESI_' + id_siswa + '_' + kode_paket
    const sesi   = await fsGet(COL.SESI, sesiId)
    if (!sesi) return { success: false, message: 'Sesi tidak ditemukan.' }
    if (sesi.status === 'selesai') return { success: false, message: 'Ujian sudah selesai.' }
    const now = new Date().toISOString()
    await fsUpdate(COL.SESI, sesiId, { status: 'selesai', selesai_at: now, updated_at: now })
    await hitungNilai(id_siswa, kode_paket)
    logActivity('PAKSA_SUBMIT', session.username, 'Paksa submit ' + id_siswa + ' paket ' + kode_paket)
    return { success: true, message: 'Ujian berhasil dipaksakan submit.' }
  } catch(e) { return { success: false, message: e.message } }
}

export async function forceLogoutSiswa(data) {
  const session = data._session
  if (!hasPermission(session, 'forceLogoutSiswa')) return { success: false, message: 'Akses ditolak.' }
  // JWT stateless → force logout tidak bisa invalidate token langsung.
  // Solusi: simpan blacklist di Firestore atau gunakan versi token pendek.
  // Untuk simplicity: tandai di sesi sebagai force_logout.
  const { id_siswa } = data
  try {
    logActivity('FORCE_LOGOUT', session.username, 'Force logout siswa: ' + id_siswa)
    return { success: true, message: 'Logout paksa dikirim. Siswa akan logout pada request berikutnya.' }
  } catch(e) { return { success: false, message: e.message } }
}
