// pages/api/handlers/admin.js
import { fsGet, fsList, fsSet, fsUpdate, fsDelete, fsQuery, fsBatchWrite, COL } from '../../../lib/firestore.js'
import { generateId, logActivity, loadPengaturan, getSiswaById, hashPassword } from '../../../lib/utils.js'
import { getPaketList } from './paket.js'
import { getPengaturan } from './pengaturan.js'
import { statusLisensi } from './lisensi.js'

// ── Dashboard ─────────────────────────────────────────────────
export async function getDashboard(data) {
  const session = data._session
  try {
    const [siswa, soal, paket, nilai, sesi] = await Promise.all([
      fsList(COL.SISWA, 1),
      fsList(COL.SOAL, 1),
      fsList(COL.PAKET, 1),
      fsList(COL.NILAI, 1),
      fsList(COL.SESI, 1)
    ])
    // Hitung dengan count (lebih efisien tapi Firestore count butuh SDK v9.x)
    // Untuk kompatibilitas, kita ambil data nyata tapi limit supaya tidak lambat
    const [allSiswa, allSoal, allPaket, allNilai, allSesiAktif] = await Promise.all([
      fsList(COL.SISWA, 5000),
      fsList(COL.SOAL, 5000),
      fsList(COL.PAKET, 500),
      fsList(COL.NILAI, 5000),
      fsQuery(COL.SESI, [{ field: 'status', op: '==', value: 'aktif' }], 500)
    ])
    return {
      success: true,
      stats: {
        total_siswa     : allSiswa.length,
        total_soal      : allSoal.length,
        total_paket     : allPaket.length,
        total_nilai     : allNilai.length,
        siswa_aktif_ujian: allSesiAktif.length
      }
    }
  } catch(e) {
    return { success: false, message: e.message }
  }
}

// ── Init Data (gabungkan beberapa request jadi 1) ─────────────
export async function getInitData(data) {
  const [lic, pkt, peng] = await Promise.all([
    statusLisensi(data).catch(() => ({})),
    getPaketList(data).catch(() => ({ data: [] })),
    getPengaturan(data).catch(() => ({ data: {} }))
  ])
  return {
    success   : true,
    lisensi   : lic.success ? { libraryAvailable: lic.libraryAvailable, data: lic.data } : {},
    paketList : pkt.success ? pkt.data : [],
    pengaturan: peng.success ? peng.data : {}
  }
}

// ── Admin Users ───────────────────────────────────────────────

export async function getAdminUserList(data) {
  const session = data._session
  if (session.role !== 'admin') return { success: false, message: 'Akses ditolak.' }
  try {
    const docs = await fsList(COL.ADMIN, 200)
    // Jangan kirim password ke client
    return { success: true, data: docs.map(d => ({ ...d, password: '***' })) }
  } catch(e) { return { success: false, message: e.message } }
}

export async function saveAdminUser(data) {
  const session = data._session
  if (session.role !== 'admin') return { success: false, message: 'Akses ditolak.' }
  const u = data.user
  if (!u || !u.username) return { success: false, message: 'Username wajib diisi.' }
  try {
    const isNew = !(await fsGet(COL.ADMIN, u.username))
    const now   = new Date().toISOString()
    const hashed = u.password && u.password !== '***'
      ? await hashPassword(u.password)
      : (isNew ? await hashPassword('admin123') : undefined)
    const obj = { username: u.username, nama: u.nama || u.username, role: u.role || 'admin', status: u.status || 'aktif', updated_at: now }
    if (isNew) obj.created_at = now
    if (hashed) obj.password = hashed
    if (isNew) await fsSet(COL.ADMIN, u.username, obj)
    else {
      const existing = await fsGet(COL.ADMIN, u.username)
      await fsSet(COL.ADMIN, u.username, { ...existing, ...obj })
    }
    logActivity('SAVE_ADMIN', session.username, (isNew ? 'Tambah' : 'Edit') + ' admin: ' + u.username)
    return { success: true }
  } catch(e) { return { success: false, message: e.message } }
}

export async function deleteAdminUser(data) {
  const session = data._session
  if (session.role !== 'admin') return { success: false, message: 'Akses ditolak.' }
  if (data.username === 'admin') return { success: false, message: 'Tidak bisa menghapus akun admin utama.' }
  try {
    await fsDelete(COL.ADMIN, data.username)
    logActivity('DELETE_ADMIN', session.username, 'Hapus admin: ' + data.username)
    return { success: true }
  } catch(e) { return { success: false, message: e.message } }
}

// ── Backup Data ───────────────────────────────────────────────

export async function backupData(data) {
  const session = data._session
  if (session.role !== 'admin') return { success: false, message: 'Akses ditolak.' }
  try {
    const [siswa, soal, paket, nilai, pengaturan, admin] = await Promise.all([
      fsList(COL.SISWA, 10000),
      fsList(COL.SOAL, 50000),
      fsList(COL.PAKET, 1000),
      fsList(COL.NILAI, 10000),
      fsList(COL.PENGATURAN, 200),
      fsList(COL.ADMIN, 100)
    ])
    logActivity('BACKUP', session.username, 'Backup data dilakukan')
    return { success: true, data: { siswa, soal, paket, nilai, pengaturan, admin, timestamp: new Date().toISOString() } }
  } catch(e) { return { success: false, message: e.message } }
}

// ── Reset Database ────────────────────────────────────────────

export async function resetDatabase(data) {
  const session = data._session
  if (session.role !== 'admin') return { success: false, message: 'Akses ditolak.' }
  if (data.konfirmasi !== 'RESET') return { success: false, message: 'Konfirmasi tidak valid.' }
  try {
    const [sesiDocs, nilaiDocs] = await Promise.all([
      fsList(COL.SESI, 10000),
      fsList(COL.NILAI, 10000)
    ])
    const ops = [
      ...sesiDocs.map(d => ({ type: 'delete', collection: COL.SESI, docId: d._id })),
      ...nilaiDocs.map(d => ({ type: 'delete', collection: COL.NILAI, docId: d._id }))
    ]
    if (ops.length > 0) await fsBatchWrite(ops)
    logActivity('RESET_DB', session.username, 'Reset database dilakukan')
    return { success: true, message: 'Database berhasil direset.' }
  } catch(e) { return { success: false, message: e.message } }
}
