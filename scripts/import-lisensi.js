#!/usr/bin/env node
// scripts/import-lisensi.js
// ================================================================
// Bulk import daftar lisensi NPSN dari CSV ke Firestore
// Pengganti: mengisi Sheet 'lisensi' di Spreadsheet rahasia GAS
//
// Format CSV (header wajib persis sama dengan Spreadsheet GAS asli):
//   npsn,nama_sekolah,status,tgl_expired
//   20400015,SMA Negeri 1 Pontianak,aktif,2026-12-31
//   20400016,SMP Negeri 2 Singkawang,aktif,
//   20400017,SD Negeri 3 Mempawah,nonaktif,
//
// Kolom tgl_expired boleh kosong (berarti tidak ada batas waktu)
// Status: aktif | nonaktif
//
// Cara pakai:
//   node scripts/import-lisensi.js daftar_lisensi.csv
//   node scripts/import-lisensi.js daftar_lisensi.csv --dry-run
//   node scripts/import-lisensi.js daftar_lisensi.csv --hapus-lama
// ================================================================

require('dotenv').config({ path: '.env.local' })

const fs      = require('fs')
const path    = require('path')
const admin   = require('firebase-admin')

// ── Init Firebase Admin ───────────────────────────────────────
function initFirebase() {
  if (admin.apps.length) return admin.firestore()

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId  : process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    })
  })
  return admin.firestore()
}

// ── Parse CSV sederhana ───────────────────────────────────────
function parseCSV(filePath) {
  const raw  = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l)

  if (lines.length < 2) throw new Error('CSV kosong atau hanya header.')

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

  const colNpsn    = headers.indexOf('npsn')
  const colNama    = headers.indexOf('nama_sekolah')
  const colStatus  = headers.indexOf('status')
  const colExpired = headers.indexOf('tgl_expired')

  if (colNpsn < 0)   throw new Error('Kolom "npsn" tidak ditemukan di CSV.')
  if (colNama < 0)   throw new Error('Kolom "nama_sekolah" tidak ditemukan di CSV.')

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    // Handle nilai yang mungkin mengandung koma (dibungkus quotes)
    const cols = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || lines[i].split(',')
    const clean = cols.map(c => String(c || '').trim().replace(/^"|"$/g, ''))

    const npsn = String(clean[colNpsn] || '').trim()
    if (!npsn) continue  // skip baris kosong

    rows.push({
      npsn,
      nama_sekolah : String(clean[colNama]    || '').trim(),
      status       : String(colStatus  >= 0 ? clean[colStatus]  : 'aktif').trim().toLowerCase() || 'aktif',
      tgl_expired  : String(colExpired >= 0 ? clean[colExpired] : '').trim() || ''
    })
  }
  return rows
}

// ── Batch write ke Firestore (max 500 per batch) ─────────────
async function batchWrite(db, ops) {
  const CHUNK = 500
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch()
    ops.slice(i, i + CHUNK).forEach(({ ref, data }) => batch.set(ref, data))
    await batch.commit()
    console.log(`  ✅ Commit batch ${Math.floor(i / CHUNK) + 1}: ${Math.min(i + CHUNK, ops.length) - i} dokumen`)
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2)
  const csvFile = args.find(a => !a.startsWith('--'))
  const dryRun  = args.includes('--dry-run')
  const hapusLama = args.includes('--hapus-lama')

  if (!csvFile) {
    console.error('Usage: node scripts/import-lisensi.js daftar_lisensi.csv [--dry-run] [--hapus-lama]')
    process.exit(1)
  }

  if (!fs.existsSync(csvFile)) {
    console.error('❌ File tidak ditemukan:', csvFile)
    process.exit(1)
  }

  console.log('📖 Membaca CSV:', csvFile)
  const rows = parseCSV(path.resolve(csvFile))
  console.log(`📋 Ditemukan ${rows.length} baris data lisensi`)

  if (dryRun) {
    console.log('\n🔍 DRY RUN — tidak ada yang ditulis ke Firestore')
    console.log('Contoh 5 baris pertama:')
    rows.slice(0, 5).forEach(r => console.log(' ', JSON.stringify(r)))
    console.log('\n✅ Dry run selesai. Hapus --dry-run untuk import sungguhan.')
    return
  }

  // Validasi env
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error('❌ FIREBASE_PROJECT_ID tidak diset di .env.local')
    process.exit(1)
  }

  console.log('\n🔥 Menghubungi Firestore...')
  const db = initFirebase()
  const COL = 'lisensi_sekolah'

  // Hapus dokumen lama jika --hapus-lama
  if (hapusLama) {
    console.log('🗑️  Menghapus data lisensi lama...')
    const snapshot = await db.collection(COL).get()
    if (!snapshot.empty) {
      const delOps = []
      snapshot.docs.forEach(d => delOps.push({ ref: d.ref, data: null }))
      // Delete batch
      const CHUNK = 500
      for (let i = 0; i < delOps.length; i += CHUNK) {
        const batch = db.batch()
        delOps.slice(i, i + CHUNK).forEach(({ ref }) => batch.delete(ref))
        await batch.commit()
      }
      console.log(`  ✅ ${delOps.length} dokumen lama dihapus`)
    } else {
      console.log('  ℹ️  Tidak ada data lama.')
    }
  }

  // Tulis data baru
  console.log(`\n📤 Mengimport ${rows.length} lisensi ke Firestore koleksi '${COL}'...`)
  const now = new Date().toISOString()
  const ops = rows.map(r => ({
    ref : db.collection(COL).doc(r.npsn),
    data: {
      npsn        : r.npsn,
      nama_sekolah: r.nama_sekolah,
      status      : r.status,
      tgl_expired : r.tgl_expired,
      updated_at  : now
    }
  }))

  await batchWrite(db, ops)

  // Ringkasan
  const aktif    = rows.filter(r => r.status === 'aktif').length
  const nonaktif = rows.filter(r => r.status !== 'aktif').length
  console.log(`\n✅ Import selesai!`)
  console.log(`   Total   : ${rows.length} sekolah`)
  console.log(`   Aktif   : ${aktif}`)
  console.log(`   Nonaktif: ${nonaktif}`)
  console.log(`   Koleksi : ${COL}`)
  process.exit(0)
}

main().catch(e => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
