// pages/api/lisensi-admin.js
// ================================================================
// API Kelola Database Lisensi — KHUSUS DEVELOPER (Emes EduTech)
// Dilindungi LISENSI_ADMIN_SECRET di environment variable.
//
// Pengganti: mengedit Sheet 'lisensi' di Spreadsheet GAS secara langsung.
//
// Endpoint: POST /api/lisensi-admin
// Header  : x-lisensi-secret: <LISENSI_ADMIN_SECRET>
//
// Actions:
//   tambah    → tambah/update 1 NPSN
//   hapus     → hapus 1 NPSN
//   list      → lihat semua (dengan pagination)
//   cek       → cek status 1 NPSN (sama persis dengan validate())
//   nonaktif  → ubah status jadi nonaktif (tanpa hapus)
//   aktifkan  → ubah status jadi aktif
//   set_expired → set tanggal expired
// ================================================================

import { getFirestore } from '../../lib/firebase.js'

const COL_LISENSI = 'lisensi_sekolah'

// ── Auth developer ────────────────────────────────────────────
function authDeveloper(req) {
  const secret = req.headers['x-lisensi-secret'] || req.body?.secret || ''
  return secret === process.env.LISENSI_ADMIN_SECRET
}

// ── Handler utama ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!authDeveloper(req)) {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Secret salah.' })
  }

  const { action, npsn, nama_sekolah, status, tgl_expired, page = 1, limit = 100 } = req.body || {}
  const db  = getFirestore()
  const col = db.collection(COL_LISENSI)

  try {
    switch (action) {

      // ── TAMBAH / UPDATE ──────────────────────────────────────
      case 'tambah': {
        if (!npsn || !nama_sekolah) return res.json({ success: false, message: 'npsn dan nama_sekolah wajib diisi.' })
        const n = String(npsn).trim()
        await col.doc(n).set({
          npsn        : n,
          nama_sekolah: String(nama_sekolah).trim(),
          status      : status || 'aktif',
          tgl_expired : tgl_expired || '',
          updated_at  : new Date().toISOString()
        })
        return res.json({ success: true, message: `NPSN ${n} berhasil disimpan.` })
      }

      // ── HAPUS ────────────────────────────────────────────────
      case 'hapus': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib diisi.' })
        await col.doc(String(npsn).trim()).delete()
        return res.json({ success: true, message: `NPSN ${npsn} berhasil dihapus.` })
      }

      // ── NONAKTIFKAN ──────────────────────────────────────────
      case 'nonaktif': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib diisi.' })
        const n = String(npsn).trim()
        const snap = await col.doc(n).get()
        if (!snap.exists) return res.json({ success: false, message: 'NPSN tidak ditemukan.' })
        await col.doc(n).update({ status: 'nonaktif', updated_at: new Date().toISOString() })
        return res.json({ success: true, message: `NPSN ${n} dinonaktifkan.` })
      }

      // ── AKTIFKAN ─────────────────────────────────────────────
      case 'aktifkan': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib diisi.' })
        const n = String(npsn).trim()
        const snap = await col.doc(n).get()
        if (!snap.exists) return res.json({ success: false, message: 'NPSN tidak ditemukan.' })
        await col.doc(n).update({ status: 'aktif', updated_at: new Date().toISOString() })
        return res.json({ success: true, message: `NPSN ${n} diaktifkan.` })
      }

      // ── SET EXPIRED ──────────────────────────────────────────
      case 'set_expired': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib diisi.' })
        const n = String(npsn).trim()
        const snap = await col.doc(n).get()
        if (!snap.exists) return res.json({ success: false, message: 'NPSN tidak ditemukan.' })
        await col.doc(n).update({ tgl_expired: tgl_expired || '', updated_at: new Date().toISOString() })
        return res.json({ success: true, message: `tgl_expired NPSN ${n} diperbarui: ${tgl_expired || '(kosong)'}` })
      }

      // ── CEK SATU NPSN ────────────────────────────────────────
      case 'cek': {
        if (!npsn) return res.json({ success: false, message: 'npsn wajib diisi.' })
        const n    = String(npsn).trim()
        const snap = await col.doc(n).get()
        if (!snap.exists) return res.json({ success: true, found: false, data: null, message: 'NPSN tidak ada di database.' })
        const doc  = snap.data()
        const isExpired = doc.tgl_expired && new Date() > new Date(doc.tgl_expired)
        return res.json({
          success : true,
          found   : true,
          valid   : doc.status === 'aktif' && !isExpired,
          data    : { ...doc, is_expired: isExpired }
        })
      }

      // ── LIST SEMUA ───────────────────────────────────────────
      case 'list': {
        const snap = await col.orderBy('npsn').limit(parseInt(limit) * parseInt(page)).get()
        const all  = snap.docs.map(d => d.data())
        const start = (parseInt(page) - 1) * parseInt(limit)
        const sliced = all.slice(start, start + parseInt(limit))
        return res.json({
          success : true,
          data    : sliced,
          total   : all.length,
          page    : parseInt(page),
          limit   : parseInt(limit),
          aktif   : all.filter(d => d.status === 'aktif').length,
          nonaktif: all.filter(d => d.status !== 'aktif').length
        })
      }

      // ── STATISTIK ────────────────────────────────────────────
      case 'stats': {
        const snap     = await col.get()
        const all      = snap.docs.map(d => d.data())
        const now      = new Date()
        const aktif    = all.filter(d => d.status === 'aktif' && (!d.tgl_expired || now <= new Date(d.tgl_expired))).length
        const nonaktif = all.filter(d => d.status !== 'aktif').length
        const expired  = all.filter(d => d.status === 'aktif' && d.tgl_expired && now > new Date(d.tgl_expired)).length
        return res.json({ success: true, total: all.length, aktif, nonaktif, expired })
      }

      default:
        return res.json({ success: false, message: `Action tidak dikenal: ${action}. Tersedia: tambah, hapus, nonaktif, aktifkan, set_expired, cek, list, stats` })
    }

  } catch (e) {
    return res.status(500).json({ success: false, message: 'Error server: ' + e.message })
  }
}
