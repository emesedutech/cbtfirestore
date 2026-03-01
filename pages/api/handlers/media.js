// pages/api/handlers/media.js
// ================================================================
// Upload Gambar
// Versi GAS: upload ke Google Drive → public URL
// Versi fullstack: upload ke layanan eksternal.
//
// Opsi yang direkomendasikan:
//   1. Cloudinary (gratis tier cukup): https://cloudinary.com
//   2. Supabase Storage
//   3. Firebase Storage (dari firebase-admin)
//
// Saat ini: simpan sebagai base64 data URL (fallback, tidak ideal untuk produksi)
// Ganti implementasi di bawah sesuai pilihan Anda.
// ================================================================
import { hasPermission } from '../../../lib/auth.js'
import { logActivity } from '../../../lib/utils.js'

export async function uploadImage(data) {
  const session = data._session
  if (!hasPermission(session, 'uploadImageToDrive')) return { success: false, message: 'Akses ditolak.' }

  const { base64, mimeType, fileName } = data
  if (!base64) return { success: false, message: 'Data gambar kosong.' }

  try {
    // ── OPSI 1: Cloudinary ────────────────────────────────────
    // Aktifkan jika env CLOUDINARY_CLOUD_NAME diset
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const cloudinary = await import('cloudinary').then(m => m.v2)
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key   : process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      })
      const result = await cloudinary.uploader.upload(`data:${mimeType};base64,${base64}`, {
        folder  : 'emescbt',
        public_id: fileName?.replace(/\.[^.]+$/, '') || undefined
      })
      logActivity('UPLOAD_IMAGE', session.username, 'Upload gambar: ' + result.public_id)
      return { success: true, url: result.secure_url }
    }

    // ── OPSI 2: Firebase Storage ──────────────────────────────
    // Aktifkan jika env FIREBASE_STORAGE_BUCKET diset
    if (process.env.FIREBASE_STORAGE_BUCKET) {
      const { admin } = await import('../../../lib/firebase.js')
      const bucket    = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET)
      const buf       = Buffer.from(base64, 'base64')
      const fileRef   = bucket.file('emescbt/' + (fileName || Date.now() + '.png'))
      await fileRef.save(buf, { metadata: { contentType: mimeType || 'image/png' } })
      await fileRef.makePublic()
      const url = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/emescbt/${fileName || Date.now() + '.png'}`
      logActivity('UPLOAD_IMAGE', session.username, 'Upload gambar ke Storage')
      return { success: true, url }
    }

    // ── FALLBACK: kembalikan data URL ─────────────────────────
    // CATATAN: data URL sangat panjang dan tidak efisien untuk produksi.
    // Gunakan hanya untuk development/testing.
    const dataUrl = `data:${mimeType || 'image/png'};base64,${base64}`
    return { success: true, url: dataUrl }

  } catch(e) {
    return { success: false, message: 'Upload gagal: ' + e.message }
  }
}
