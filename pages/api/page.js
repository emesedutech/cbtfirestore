// pages/api/page.js
// Equivalent to doGet() di GAS: serve HTML_ADMIN dan HTML_SISWA
// APP_URL diganti dengan URL API endpoint yang benar
import { readFileSync } from 'fs'
import path from 'path'

// Import HTML strings dari file terpisah
// Kita ekstrak HTML dari GAS dan simpan sebagai static files
export default function handler(req, res) {
  const page = req.query.page || 'login'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const appUrl  = baseUrl + '/api/app'

  // Baca file HTML dari public/html/
  const htmlDir = path.join(process.cwd(), 'public', 'html')
  let filename
  if (page === 'admin')  filename = 'admin.html'
  else if (page === 'siswa') filename = 'siswa.html'
  else { res.redirect('/'); return }

  try {
    let html = readFileSync(path.join(htmlDir, filename), 'utf-8')
    // Inject APP_URL – identik dengan cara GAS inject APP_URL
    html = html.replace(/'{{APP_URL}}'/g, "'" + appUrl + "'")
               .replace(/\{\{APP_URL\}\}/g, appUrl)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.status(200).send(html)
  } catch(e) {
    res.status(500).send('<h1>Error: HTML file not found</h1><p>Jalankan script extract-html.js terlebih dahulu.</p><pre>' + e.message + '</pre>')
  }
}
