// pages/admin.js
// Admin halaman – menampilkan HTML_ADMIN dari GAS persis sama
// APP_URL diarahkan ke /api/app (Next.js API)
import { useEffect, useRef } from 'react'

export default function AdminPage() {
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true

    // Auth guard
    const token = localStorage.getItem('emes_token')
    const role  = localStorage.getItem('emes_role')
    if (!token) { window.location.href = '/'; return }

    // Inject token & APP_URL ke window untuk digunakan oleh admin script
    window.__EMES_TOKEN__ = token
    window.__EMES_ROLE__  = role

    // Load admin HTML
    loadAdminPage()
  }, [])

  return (
    <div id="adminPageRoot">
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'DM Sans,sans-serif',color:'#047857'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:24,fontWeight:700,marginBottom:8}}>Emes CBT</div>
          <div style={{fontSize:14,opacity:.7}}>Memuat panel admin...</div>
        </div>
      </div>
    </div>
  )
}

function loadAdminPage() {
  // Fetch HTML_ADMIN dari server
  fetch('/api/page?page=admin', { headers: { 'x-emes-token': localStorage.getItem('emes_token') || '' } })
    .then(r => r.text())
    .then(html => {
      document.open(); document.write(html); document.close()
    })
    .catch(() => { window.location.href = '/' })
}
