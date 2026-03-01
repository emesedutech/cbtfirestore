// pages/api/page.js
// Serve HTML_ADMIN dan HTML_SISWA dengan APP_URL di-inject
import { readFileSync } from 'fs'
import path from 'path'

export default function handler(req, res) {
  const page   = req.query.page || ''
  const appUrl = '/api/app'

  const htmlDir = path.join(process.cwd(), 'public', 'html')
  let filename
  if (page === 'admin')      filename = 'admin.html'
  else if (page === 'siswa') filename = 'siswa.html'
  else { res.redirect('/html/login.html'); return }

  try {
    let html = readFileSync(path.join(htmlDir, filename), 'utf-8')
    // Inject APP_URL — identik dengan cara GAS inject APP_URL ke HTML
    html = html.replace(/'{{APP_URL}}'/g, "'" + appUrl + "'")
               .replace(/\{\{APP_URL\}\}/g, appUrl)
               // Patch redirect logout ke login.html
               .replace(/window\.location\.href\s*=\s*['"]\/['"]/g, "window.location.href='/html/login.html'")
               .replace(/window\.location\.href\s*=\s*APP_URL\s*\+\s*['"]\?page=login['"]/g, "window.location.href='/html/login.html'")
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.status(200).send(html)
  } catch(e) {
    res.status(500).send(`
      <h2 style="font-family:sans-serif;color:#dc2626;padding:40px">
        ⚠️ File HTML belum digenerate
      </h2>
      <p style="font-family:sans-serif;padding:0 40px">
        Jalankan perintah berikut di terminal:<br><br>
        <code>node scripts/extract-html.js path/to/EmesCBTApp_v5c_Sync.gs</code>
      </p>
    `)
  }
}
