// pages/api/handlers/media.js
// ================================================================
// Upload Gambar – pengganti Google Drive upload dari GAS
// Mendukung Firebase Storage (recommended) atau fallback base64.
// Cloudinary dihapus untuk menghindari dependency build error.
// ================================================================
import { hasPermission } from '../../../lib/auth.js'
import { logActivity } from '../../../lib/utils.js'

export async function uploadImage(data) {
  const session = data._session
  if (!hasPermission(session, 'uploadImageToDrive')) return { success: false, message: 'Akses ditolak.' }

  const { base64, mimeType, fileName } = data
  if (!base64) return { success: false, message: 'Data gambar kosong.' }

  try {
    // ── Firebase Storage ──────────────────────────────────────
    if (process.env.FIREBASE_STORAGE_BUCKET) {
      const { admin } = await import('../../../lib/firebase.js')
      const bucket  = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET)
      const name    = fileName || `emescbt_${Date.now()}.png`
      const buf     = Buffer.from(base64, 'base64')
      const fileRef = bucket.file('emescbt/' + name)
      await fileRef.save(buf, { metadata: { contentType: mimeType || 'image/png' } })
      await fileRef.makePublic()
      const url = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/emescbt/${name}`
      logActivity('UPLOAD_IMAGE', session.username, 'Upload ke Firebase Storage: ' + name)
      return { success: true, url }
    }

    // ── Fallback: base64 data URL (dev only) ──────────────────
    const dataUrl = `data:${mimeType || 'image/png'};base64,${base64}`
    return { success: true, url: dataUrl }

  } catch (e) {
    return { success: false, message: 'Upload gagal: ' + e.message }
  }
}
