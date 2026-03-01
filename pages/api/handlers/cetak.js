// pages/api/handlers/cetak.js
import { fsGet, fsList, fsQuery, COL } from '../../../lib/firestore.js'
import { loadPengaturan } from '../../../lib/utils.js'
import { hasPermission } from '../../../lib/auth.js'

export async function getDataDaftarHadir(data) {
  const session = data._session
  if (!hasPermission(session, 'getDataDaftarHadir')) return { success: false, message: 'Akses ditolak.' }
  const { kode_paket } = data
  try {
    const [paket, siswaDocs, peng] = await Promise.all([
      fsGet(COL.PAKET, kode_paket),
      fsList(COL.SISWA, 5000),
      loadPengaturan()
    ])
    const siswaList = siswaDocs
      .filter(s => {
        if (!paket || !paket.kelas_target || paket.kelas_target.trim() === '') return true
        const kelas = paket.kelas_target.split(',').map(k => k.trim().toLowerCase())
        if (kelas.includes('semua') || kelas.includes('all')) return true
        return kelas.includes((s.kelas || '').trim().toLowerCase())
      })
      .sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
    return { success: true, paket, siswa: siswaList, pengaturan: peng }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getDataBeritaAcara(data) {
  const session = data._session
  if (!hasPermission(session, 'getDataBeritaAcara')) return { success: false, message: 'Akses ditolak.' }
  const { kode_paket } = data
  try {
    const [paket, nilai, peng] = await Promise.all([
      fsGet(COL.PAKET, kode_paket),
      fsQuery(COL.NILAI, [{ field: 'kode_paket', op: '==', value: kode_paket }]),
      loadPengaturan()
    ])
    return { success: true, paket, nilai, pengaturan: peng }
  } catch(e) { return { success: false, message: e.message } }
}
