// pages/api/handlers/lisensi.js
// ================================================================
// Sistem Lisensi NPSN – Pengganti EmesCBTLicense GAS Library
// © Emes EduTech
//
// CARA KERJA (identik dengan library GAS asli):
//   1. Admin isi NPSN di halaman Pengaturan
//   2. NPSN tersimpan di Firestore koleksi 'pengaturan'
//   3. validate(npsn) cek NPSN ke koleksi 'lisensi_sekolah'
//   4. Kembalikan nama_sekolah resmi dari database (bukan input user)
//   5. Nama di dokumen cetak = dari database ini
//
// DATABASE LISENSI (Firestore — hanya developer yang bisa edit):
//   Koleksi : lisensi_sekolah
//   DocId   : npsn (string, misal '20400015')
//   Field   : npsn | nama_sekolah | status | tgl_expired
//
// Cara kelola database lisensi:
//   → node scripts/import-lisensi.js daftar.csv   (bulk import dari CSV)
//   → POST /api/lisensi-admin                      (CRUD via API)
// ================================================================

import { fsGet } from '../../../lib/firestore.js'
import { loadPengaturan, savePengaturanItem, logActivity, cacheGet, cachePut } from '../../../lib/utils.js'

const COL_LISENSI     = 'lisensi_sekolah'
const LICENSE_CACHE_TTL = 300 // 5 menit — sama persis dengan GAS asli

// ================================================================
// validate(npsn)
// Fungsi utama — identik dengan EmesCBTLicense.validate(npsn) di GAS.
//
// GAS asli:
//   1. Buka Spreadsheet rahasia via LICENSE_SHEET_ID
//   2. Cari baris dengan npsn yang cocok
//   3. Cek kolom status & tgl_expired
//   4. Return { valid, npsn, nama_sekolah }
//
// Versi Firestore ini:
//   1. fsGet('lisensi_sekolah', npsn) — docId = npsn
//   2. Cek field status & tgl_expired
//   3. Return { valid, npsn, nama_sekolah } — struktur identik
// ================================================================
export async function validate(npsn) {
  const n = String(npsn || '').trim()
  if (!n) return _result('', '[TIDAK BERLISENSI]', false)

  // Cek cache dulu — identik dengan CacheService.getScriptCache() di GAS
  const cacheKey = 'lic_' + n
  const cached   = cacheGet(cacheKey)
  if (cached) return cached

  let result
  try {
    const doc = await fsGet(COL_LISENSI, n)

    if (!doc) {
      // NPSN tidak ada di database → tidak berlisensi
      result = _result(n, '[TIDAK BERLISENSI]', false)

    } else {
      const status = String(doc.status || 'aktif').toLowerCase().trim()

      if (status !== 'aktif') {
        // Status nonaktif/suspended → tidak berlisensi
        result = _result(n, '[TIDAK BERLISENSI]', false)

      } else if (doc.tgl_expired && new Date() > new Date(doc.tgl_expired)) {
        // Lisensi sudah expired → tidak berlisensi
        result = _result(n, '[TIDAK BERLISENSI]', false)

      } else {
        // Valid → kembalikan nama resmi dari database
        result = _result(n, String(doc.nama_sekolah || ''), true)
      }
    }

  } catch (e) {
    // Error Firestore → fallback tidak berlisensi (sama dengan GAS catch)
    result = _result(n, '[TIDAK BERLISENSI]', false)
  }

  // Simpan ke cache — identik dengan cache.put() di GAS
  cachePut(cacheKey, result, LICENSE_CACHE_TTL)
  return result
}

// Helper — identik dengan _result() di GAS
function _result(npsn, nama_sekolah, valid) {
  return { valid, npsn, nama_sekolah }
}

// ================================================================
// Handler: simpanNPSN — dipanggil dari admin panel
// ================================================================
export async function simpanNPSN(data) {
  const session = data._session
  if (session.role !== 'admin') return { success: false, message: 'Akses ditolak.' }

  const npsn = (data.npsn || '').trim()
  if (!npsn) return { success: false, message: 'NPSN tidak boleh kosong.' }

  const lic = await validate(npsn)

  await savePengaturanItem('npsn', npsn, 'NPSN sekolah')
  logActivity('SIMPAN_NPSN', session.username, `Simpan NPSN: ${npsn} → valid: ${lic.valid}`)

  return {
    success     : true,
    valid       : lic.valid,
    nama_sekolah: lic.nama_sekolah,
    npsn        : lic.npsn,
    message     : lic.valid
      ? 'NPSN valid. Nama sekolah: ' + lic.nama_sekolah
      : 'NPSN tidak terdaftar dalam daftar lisensi Emes EduTech.'
  }
}

// ================================================================
// Handler: statusLisensi — dipanggil dari getInitData & admin panel
// ================================================================
export async function statusLisensi(data) {
  const session = data._session
  if (!session || session.role === 'siswa') return { success: false, message: 'Akses ditolak.' }

  const peng = await loadPengaturan()
  const npsn = peng.npsn || ''
  const lic  = await validate(npsn)

  return {
    success         : true,
    libraryAvailable: true,   // selalu true — sudah built-in, tidak perlu library eksternal
    data: {
      valid       : lic.valid,
      nama_sekolah: lic.nama_sekolah,
      npsn        : lic.npsn
    }
  }
}
