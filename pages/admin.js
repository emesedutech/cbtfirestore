// pages/admin.js
import { useEffect } from 'react'

export default function AdminPage() {
  useEffect(() => {
    const token = localStorage.getItem('emes_token')
    if (!token) { window.location.replace('/html/login.html'); return }
    window.location.replace('/api/page?page=admin')
  }, [])
  return null
}
