// pages/api/handlers/nilai.js
import { fsGet, fsList, fsQuery, COL } from '../../../lib/firestore.js'
import { hasPermission } from '../../../lib/auth.js'

export async function getNilaiList(data) {
  const session = data._session
  if (!hasPermission(session, 'getNilaiList')) return { success: false, message: 'Akses ditolak.' }
  try {
    const { kode_paket, search, page = 1, limit = 50 } = data
    let docs = kode_paket
      ? await fsQuery(COL.NILAI, [{ field: 'kode_paket', op: '==', value: kode_paket }])
      : await fsList(COL.NILAI, 10000)
    if (search) {
      const q = search.toLowerCase()
      docs = docs.filter(d => (d.nama_siswa || '').toLowerCase().includes(q))
    }
    docs.sort((a, b) => (a.nama_siswa || '').localeCompare(b.nama_siswa || ''))
    const total = docs.length
    const start = (page - 1) * limit
    return { success: true, data: docs.slice(start, start + limit), total, page, limit }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getHasilDetail(data) {
  const session = data._session
  if (!hasPermission(session, 'getHasilDetail')) return { success: false, message: 'Akses ditolak.' }
  const { id_siswa, kode_paket } = data
  try {
    const nilaiId = 'N' + id_siswa + '_' + kode_paket
    const nilai   = await fsGet(COL.NILAI, nilaiId)
    if (!nilai) return { success: false, message: 'Data nilai tidak ditemukan.' }
    return { success: true, data: nilai }
  } catch(e) { return { success: false, message: e.message } }
}

export async function exportNilai(data) {
  const session = data._session
  if (!hasPermission(session, 'exportNilai')) return { success: false, message: 'Akses ditolak.' }
  try {
    const { kode_paket } = data
    const docs = kode_paket
      ? await fsQuery(COL.NILAI, [{ field: 'kode_paket', op: '==', value: kode_paket }])
      : await fsList(COL.NILAI, 10000)
    docs.sort((a, b) => (a.nama_siswa || '').localeCompare(b.nama_siswa || ''))
    return { success: true, data: docs }
  } catch(e) { return { success: false, message: e.message } }
}

// exportNilaiExcel: sama, frontend yang format ke Excel
export const exportNilaiExcel = exportNilai
