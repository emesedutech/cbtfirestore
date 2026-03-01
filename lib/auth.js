// lib/auth.js
// Autentikasi, sesi JWT, RBAC – pengganti session GAS (CacheService + PropertiesService)
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { fsGet, fsList, fsSet, fsDelete, fsQuery, COL } from './firestore.js'

const JWT_SECRET  = process.env.JWT_SECRET || 'emescbt_fallback_secret_change_me'
const JWT_EXPIRES = '12h'

// ── RBAC Permission Map (persis sama dengan versi GAS) ──────────
const PERMISSIONS = {
  admin: [
    'getDashboard','getInitData',
    'getSiswaList','getSiswaUntukKartu','saveSiswa','deleteSiswa','importSiswa',
    'getSoalList','saveSoal','deleteSoal','importSoal',
    'getPaketList','savePaket','deletePaket','duplikasiPaket',
    'generateTokenUjian','hapusTokenUjian','validasiTokenUjian',
    'getNilaiList','getHasilDetail','exportNilai','exportNilaiExcel',
    'getPengaturan','savePengaturan',
    'getMonitoring','resetUjian','paksakanSubmit','forceLogoutSiswa',
    'getLogActivity','getLogStats','clearLog',
    'getAdminUserList','saveAdminUser','deleteAdminUser',
    'backupData','resetDatabase',
    'getFAQ','saveFAQ','deleteFAQ','chatbotAnswer',
    'uploadImageToDrive',
    'getDataDaftarHadir','getDataBeritaAcara',
    'getAnalisaButir','getUraianUntukKoreksi','simpanSkorUraian',
    'sendChatMessage','getChatMessages','getChatSiswaList','markChatRead',
    'simpanNPSN','statusLisensi'
  ],
  proktor: [
    'getDashboard','getInitData',
    'getSiswaList','getSiswaUntukKartu',
    'getSoalList',
    'getPaketList',
    'getNilaiList','getHasilDetail','exportNilai','exportNilaiExcel',
    'getPengaturan',
    'getMonitoring','resetUjian','paksakanSubmit','forceLogoutSiswa',
    'getLogActivity','getLogStats',
    'getDataDaftarHadir','getDataBeritaAcara',
    'getAnalisaButir',
    'sendChatMessage','getChatMessages','getChatSiswaList','markChatRead',
    'statusLisensi','chatbotAnswer','validasiTokenUjian'
  ],
  siswa: [
    'getSesiUjian','getSoalUjian','autosaveJawaban','submitUjian',
    'getHasilUjian','getHasilUjianV2','getProgressSiswa',
    'getInfoPaketUntukKonfirmasi','getReviewJawaban',
    'sendChatMessage','getChatMessages',
    'chatbotAnswer','getPengaturanPublikSiswa'
  ]
}

export function hasPermission(session, action) {
  if (!session) return false
  const role  = session.role || 'siswa'
  const perms = PERMISSIONS[role] || []
  return perms.includes(action)
}

// ── JWT ────────────────────────────────────────────────────────

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// ── Password ───────────────────────────────────────────────────

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

export async function comparePassword(plain, hashed) {
  // Support plain-text password (migrasi dari GAS yang simpan plain)
  if (plain === hashed) return true
  try { return await bcrypt.compare(plain, hashed) } catch { return false }
}

// ── Login Siswa ────────────────────────────────────────────────

export async function loginSiswa({ username, password }) {
  const docs = await fsQuery(COL.SISWA, [{ field: 'username', op: '==', value: username }])
  const siswa = docs[0]
  if (!siswa) return { success: false, message: 'Username tidak ditemukan.' }
  if (siswa.status === 'nonaktif') return { success: false, message: 'Akun dinonaktifkan.' }

  const ok = await comparePassword(password, siswa.password)
  if (!ok) return { success: false, message: 'Password salah.' }

  const token = signToken({
    role    : 'siswa',
    id_siswa: siswa.id_siswa || siswa._id,
    username: siswa.username,
    nama    : siswa.nama,
    kelas   : siswa.kelas
  })
  return {
    success : true,
    token,
    nama    : siswa.nama,
    kelas   : siswa.kelas,
    id_siswa: siswa.id_siswa || siswa._id
  }
}

// ── Login Admin ────────────────────────────────────────────────

export async function loginAdmin({ username, password }) {
  const doc = await fsGet(COL.ADMIN, username)
  if (!doc) {
    // Fallback: cari lewat query (jika docId bukan username)
    const docs = await fsQuery(COL.ADMIN, [{ field: 'username', op: '==', value: username }])
    if (!docs[0]) return { success: false, message: 'Username admin tidak ditemukan.' }
    const adm = docs[0]
    if (adm.status === 'nonaktif') return { success: false, message: 'Akun dinonaktifkan.' }
    const ok = await comparePassword(password, adm.password)
    if (!ok) return { success: false, message: 'Password salah.' }
    const token = signToken({ role: adm.role || 'admin', username: adm.username, nama: adm.nama })
    return { success: true, token, nama: adm.nama, role: adm.role || 'admin' }
  }
  if (doc.status === 'nonaktif') return { success: false, message: 'Akun dinonaktifkan.' }
  const ok = await comparePassword(password, doc.password)
  if (!ok) return { success: false, message: 'Password salah.' }
  const token = signToken({ role: doc.role || 'admin', username: doc.username, nama: doc.nama })
  return { success: true, token, nama: doc.nama, role: doc.role || 'admin' }
}

// ── Validate Session dari token ────────────────────────────────

export function validateSession(token) {
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  return payload // { role, username/id_siswa, nama, ... }
}
