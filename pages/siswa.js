// pages/siswa.js
import { useEffect } from 'react'

export default function SiswaPage() {
  useEffect(() => {
    const token = localStorage.getItem('emes_token')
    const role  = localStorage.getItem('emes_role')
    if (!token) { window.location.replace('/html/login.html'); return }
    if (['admin','guru','proktor'].includes(role)) { window.location.replace('/api/page?page=admin'); return }
    window.location.replace('/api/page?page=siswa')
  }, [])
  return null
}
