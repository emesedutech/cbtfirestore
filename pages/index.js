// pages/index.js
// Redirect ke login.html (plain HTML, tanpa React hydration)
import { useEffect } from 'react'

export default function Home() {
  useEffect(() => { window.location.replace('/html/login.html') }, [])
  return null
}
