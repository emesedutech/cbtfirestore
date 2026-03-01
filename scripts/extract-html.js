#!/usr/bin/env node
// scripts/extract-html.js
// ============================================================
// Ekstrak HTML_LOGIN, HTML_ADMIN, HTML_SISWA dari file .gs
// Jalankan sekali sebelum build:
//   node scripts/extract-html.js path/to/EmesCBTApp_v5c_Sync.gs
//
// Output: public/html/admin.html dan public/html/siswa.html
// ============================================================
const fs   = require('fs')
const path = require('path')

const gsFile = process.argv[2]
if (!gsFile) {
  console.error('Usage: node scripts/extract-html.js path/to/EmesCBTApp_v5c_Sync.gs')
  process.exit(1)
}

console.log('📖 Membaca file:', gsFile)
const src = fs.readFileSync(gsFile, 'utf-8')

function extractHtml(varName) {
  // Cari: const HTML_XXX = `...`;
  // Perlu menangani backtick template literal yang sangat panjang
  const startMarker = `const ${varName} = \``
  const start = src.indexOf(startMarker)
  if (start === -1) {
    console.warn(`⚠️  ${varName} tidak ditemukan`)
    return null
  }
  let i = start + startMarker.length
  let depth = 1
  let result = ''
  // Scan sampai backtick penutup (yang tidak di-escape)
  while (i < src.length && depth > 0) {
    const ch = src[i]
    if (ch === '\\') { result += src[i] + (src[i+1] || ''); i += 2; continue }
    if (ch === '`') { depth--; if (depth > 0) result += ch }
    else result += ch
    i++
  }
  return result
}

// Buat output directory
const outDir = path.join(process.cwd(), 'public', 'html')
fs.mkdirSync(outDir, { recursive: true })

// ── HTML_ADMIN ────────────────────────────────────────────────
const adminHtml = extractHtml('HTML_ADMIN')
if (adminHtml) {
  // APP_URL sudah pakai placeholder '{{APP_URL}}' di script GAS
  // Pastikan ada placeholder, jika tidak: inject
  let html = adminHtml
  if (!html.includes("'{{APP_URL}}'") && !html.includes('{{APP_URL}}')) {
    // inject setelah <script> pertama
    html = html.replace(
      "var APP_URL = '",
      "var APP_URL = '{{APP_URL}}'; var __orig = '"
    )
    if (!html.includes('{{APP_URL}}')) {
      html = html.replace("var APP_URL = '", "var APP_URL = '{{APP_URL}}' || '")
    }
  }
  const outFile = path.join(outDir, 'admin.html')
  fs.writeFileSync(outFile, html, 'utf-8')
  console.log('✅ Saved:', outFile, '(' + Math.round(html.length / 1024) + ' KB)')
} else {
  console.error('❌ HTML_ADMIN tidak bisa diekstrak')
}

// ── HTML_SISWA ────────────────────────────────────────────────
const siswaHtml = extractHtml('HTML_SISWA')
if (siswaHtml) {
  const outFile = path.join(outDir, 'siswa.html')
  fs.writeFileSync(outFile, siswaHtml, 'utf-8')
  console.log('✅ Saved:', outFile, '(' + Math.round(siswaHtml.length / 1024) + ' KB)')
} else {
  console.error('❌ HTML_SISWA tidak bisa diekstrak')
}

console.log('\n✅ Ekstraksi selesai. HTML disimpan di public/html/')
console.log('📝 Pastikan APP_URL placeholder "{{APP_URL}}" ada di file HTML yang dihasilkan.')
