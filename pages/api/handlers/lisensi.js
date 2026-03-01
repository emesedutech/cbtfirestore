// pages/api/handlers/lisensi.js
// ================================================================
// Lisensi NPSN
// Pada versi GAS, validasi NPSN dilakukan oleh library EmesCBTLicense.
// Di fullstack ini, Anda dapat mengintegrasikan logika validasi sendiri
// (misalnya cek ke API Kemendikbud, atau database lisensi internal).
// Sementara ini: simpan NPSN saja, tandai sebagai "manual check".
// ================================================================
import { fsGet, COL } from '../../../lib/firestore.js'
import { loadPengaturan, savePengaturanItem, logActivity } from '../../../lib/utils.js'

/**
 * Ganti fungsi ini dengan logika validasi NPSN Anda.
 * Bisa: fetch ke API Kemendikbud, cek database lisensi, dsb.
 */
async function validateNPSN(npsn) {
  // TODO: implementasikan validasi NPSN sesuai kebutuhan
  // Contoh integrasi: https://api-sekolah-indonesia.vercel.app/sekolah?npsn={npsn}
  try {
    const res = await fetch(`https://api-sekolah-indonesia.vercel.app/sekolah?npsn=${npsn}`)
    if (!res.ok) return { valid: false, nama_sekolah: '', npsn }
    const json = await res.json()
    if (json && json.dataSekolah && json.dataSekolah.length > 0) {
      const sekolah = json.dataSekolah[0]
      return { valid: true, nama_sekolah: sekolah.sekolah || '', npsn }
    }
    return { valid: false, nama_sekolah: '', npsn }
  } catch {
    // Fallback jika API tidak tersedia: anggap valid
    return { valid: true, nama_sekolah: '[Nama Sekolah]', npsn, fallback: true }
  }
}

export async function simpanNPSN(data) {
  const session = data._session
  if (session.role !== 'admin') return { success: false, message: 'Akses ditolak.' }
  const npsn = (data.npsn || '').trim()
  if (!npsn) return { success: false, message: 'NPSN tidak boleh kosong.' }

  const lic = await validateNPSN(npsn)
  await savePengaturanItem('npsn', npsn, 'NPSN sekolah')
  logActivity('SIMPAN_NPSN', session.username, 'Simpan NPSN: ' + npsn)

  return {
    success     : true,
    valid       : lic.valid,
    nama_sekolah: lic.nama_sekolah,
    npsn        : lic.npsn,
    message     : lic.valid
      ? 'NPSN valid. Nama sekolah: ' + lic.nama_sekolah
      : 'NPSN tidak ditemukan di database.'
  }
}

export async function statusLisensi(data) {
  const session = data._session
  if (!session || session.role === 'siswa') return { success: false, message: 'Akses ditolak.' }
  const peng = await loadPengaturan()
  const npsn = peng.npsn || ''
  const lic  = npsn ? await validateNPSN(npsn) : { valid: false, nama_sekolah: '', npsn: '' }
  return {
    success         : true,
    libraryAvailable: true,
    data: {
      valid       : lic.valid,
      nama_sekolah: lic.nama_sekolah,
      npsn        : lic.npsn
    }
  }
}
