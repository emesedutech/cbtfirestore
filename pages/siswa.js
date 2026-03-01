// pages/siswa.js
// Siswa halaman – identik dengan admin.js tapi load siswa.html
import { useEffect, useRef } from 'react'

export default function SiswaPage() {
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true

    const token = localStorage.getItem('emes_token')
    const role  = localStorage.getItem('emes_role')
    if (!token) { window.location.href = '/'; return }
    if (['admin','guru','proktor'].includes(role)) { window.location.href = '/admin'; return }

    window.__EMES_TOKEN__ = token
    window.__EMES_ROLE__  = role

    fetch('/api/page?page=siswa', { headers: { 'x-emes-token': token } })
      .then(r => r.text())
      .then(html => { document.open(); document.write(html); document.close() })
      .catch(() => { window.location.href = '/' })
  }, [])

  return (
    <div id="siswaPageRoot">
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'DM Sans,sans-serif',color:'#047857'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:24,fontWeight:700,marginBottom:8}}>Emes CBT</div>
          <div style={{fontSize:14,opacity:.7}}>Memuat halaman siswa...</div>
        </div>
      </div>
    </div>
  )
}
