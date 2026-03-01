// pages/api/lisensi-admin.js
// ================================================================
// API Kelola Database Lisensi — KHUSUS DEVELOPER (Emes EduTech)
// Dilindungi LISENSI_ADMIN_SECRET di environment variable.
//
// Endpoint: POST /api/lisensi-admin
// Header  : x-lisensi-secret: <LISENSI_ADMIN_SECRET>
// ================================================================

import { fsGet, fsSet, fsUpdate, fsDelete, fsList } from '../../lib/firebase.js'

const COL = 'lisensi_sekolah'

function auth(req) {
  const secret = req.headers['x-lisensi-secret'] || req.body?.secret || ''
  return secret === process.env.LISENSI_ADMIN_SECRET
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!auth(req)) return res.status(403).json({ success: false, message: 'Akses ditolak.' })

  const { action, npsn, nama_sekolah, status, tgl_expired, limit = 100 } = req.body || {}

  try {
    switch (action) {
      case 'tambah': {
        if (!npsn || !nama_sekolah) return res.json({ success: false, message: 'npsn dan nama_sekolah wajib.' })
        const n = String(npsn).trim()
        await fsSet(COL, n, { npsn: n, nama_sekolah: String(nama_sekolah).trim(), status: status || 'aktif', tgl_expired: tgl_expired || '', updated_at: new Date().toISOString() })
        return res.json({ success: true, message: `NPSN ${n} berhasil disimpan.` })
      }
      case 'hapus': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib.' })
        await fsDelete(COL, String(npsn).trim())
        return res.json({ success: true, message: `NPSN ${npsn} dihapus.` })
      }
      case 'nonaktif':
      case 'aktifkan': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib.' })
        const n = String(npsn).trim()
        const s = action === 'aktifkan' ? 'aktif' : 'nonaktif'
        await fsUpdate(COL, n, { status: s, updated_at: new Date().toISOString() })
        return res.json({ success: true, message: `NPSN ${n} → ${s}.` })
      }
      case 'set_expired': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib.' })
        await fsUpdate(COL, String(npsn).trim(), { tgl_expired: tgl_expired || '', updated_at: new Date().toISOString() })
        return res.json({ success: true, message: `tgl_expired NPSN ${npsn} diperbarui.` })
      }
      case 'cek': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib.' })
        const doc = await fsGet(COL, String(npsn).trim())
        if (!doc) return res.json({ success: true, found: false, data: null })
        const isExpired = doc.tgl_expired && new Date() > new Date(doc.tgl_expired)
        return res.json({ success: true, found: true, valid: doc.status === 'aktif' && !isExpired, data: { ...doc, is_expired: isExpired } })
      }
      case 'list': {
        const rows = await fsList(COL, { limit: parseInt(limit) })
        return res.json({ success: true, data: rows, total: rows.length })
      }
      default:
        return res.json({ success: false, message: `Action tidak dikenal: ${action}` })
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error: ' + e.message })
  }
}
