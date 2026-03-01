// pages/api/handlers/chat.js
import { fsGet, fsList, fsSet, fsUpdate, fsDelete, fsQuery, fsBatchWrite, COL } from '../../../lib/firestore.js'
import { generateId, logActivity, logError } from '../../../lib/utils.js'
import { hasPermission } from '../../../lib/auth.js'

// ── FAQ ────────────────────────────────────────────────────────

export async function getFAQ(data) {
  const session = data._session
  try {
    const docs = await fsList(COL.FAQ, 500)
    return { success: true, data: docs }
  } catch(e) { return { success: false, message: e.message } }
}

export async function saveFAQ(data) {
  const session = data._session
  if (!hasPermission(session, 'saveFAQ')) return { success: false, message: 'Akses ditolak.' }
  const f = data.faq
  if (!f?.pertanyaan || !f?.jawaban) return { success: false, message: 'Pertanyaan dan jawaban wajib diisi.' }
  try {
    const docId = f.id_faq || generateId('FAQ')
    const now   = new Date().toISOString()
    await fsSet(COL.FAQ, docId, { ...f, id_faq: docId, updated_at: now, created_at: f.created_at || now })
    logActivity('SAVE_FAQ', session.username, 'Simpan FAQ: ' + docId)
    return { success: true, id_faq: docId }
  } catch(e) { return { success: false, message: e.message } }
}

export async function deleteFAQ(data) {
  const session = data._session
  if (!hasPermission(session, 'deleteFAQ')) return { success: false, message: 'Akses ditolak.' }
  try {
    await fsDelete(COL.FAQ, data.id_faq)
    return { success: true, message: 'FAQ berhasil dihapus.' }
  } catch(e) { return { success: false, message: e.message } }
}

export async function chatbotAnswer(data) {
  const { pertanyaan } = data
  try {
    const faqs  = await fsList(COL.FAQ, 500)
    const q     = (pertanyaan || '').toLowerCase()
    const match = faqs.find(f => q.includes((f.pertanyaan || '').toLowerCase().substring(0, 10)))
    if (match) return { success: true, jawaban: match.jawaban }
    return { success: true, jawaban: 'Maaf, saya tidak menemukan jawaban untuk pertanyaan Anda. Silakan hubungi guru atau admin.' }
  } catch(e) { return { success: false, message: e.message } }
}

// ── CHAT ───────────────────────────────────────────────────────

export async function sendChatMessage(data) {
  const session = data._session
  const { isi, ke, reply_to, reply_preview } = data
  if (!isi || isi.trim() === '') return { success: false, message: 'Pesan kosong.' }
  try {
    const now   = new Date().toISOString()
    const msgId = generateId('MSG')
    const msg   = {
      id_pesan   : msgId,
      dari       : session.role === 'siswa' ? session.id_siswa : session.username,
      ke         : ke || (session.role === 'siswa' ? 'admin' : 'siswa'),
      isi        : isi.trim(),
      reply_to   : reply_to || '',
      reply_preview: reply_preview || '',
      nama_pengirim: session.nama || session.username || session.id_siswa || '',
      dari_role  : session.role,
      is_read    : false,
      timestamp  : now
    }
    await fsSet(COL.CHAT, msgId, msg)
    return { success: true, id_pesan: msgId, timestamp: now }
  } catch(e) {
    logError('sendChatMessage', e)
    return { success: false, message: e.message }
  }
}

export async function getChatMessages(data) {
  const session  = data._session
  const { dengan, last_ts, limit = 50 } = data
  const maxMsg   = Math.min(parseInt(limit), 100)
  try {
    let msgs
    if (session.role === 'siswa') {
      const [sent, recv] = await Promise.all([
        fsQuery(COL.CHAT, [{ field: 'dari', op: '==', value: session.id_siswa }], 200),
        fsQuery(COL.CHAT, [{ field: 'dari_role', op: '==', value: 'admin' }], 200)
      ])
      const seen = new Set()
      msgs = [...sent, ...recv].filter(m => {
        if (seen.has(m._id)) return false
        seen.add(m._id); return true
      })
    } else {
      // Admin: filter by siswa jika dengan ada
      msgs = await fsList(COL.CHAT, 500)
      if (dengan) msgs = msgs.filter(m => m.dari === dengan || m.ke === dengan)
    }
    if (last_ts) msgs = msgs.filter(m => (m.timestamp || '') > last_ts)
    msgs.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
    const sliced = msgs.slice(-maxMsg)
    return { success: true, messages: sliced }
  } catch(e) {
    logError('getChatMessages', e)
    return { success: false, message: e.message }
  }
}

export async function getChatSiswaList(data) {
  const session = data._session
  if (session.role === 'siswa') return { success: false, message: 'Akses ditolak.' }
  try {
    const msgs     = await fsList(COL.CHAT, 1000)
    const siswaIds = new Set(msgs.filter(m => m.dari_role === 'siswa').map(m => m.dari))
    const result   = Array.from(siswaIds).map(id => {
      const unread = msgs.filter(m => m.dari === id && !m.is_read && m.dari_role === 'siswa').length
      const last   = msgs.filter(m => m.dari === id || (m.dari_role === 'admin' && m.ke === id))
                        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))[0]
      return {
        id_siswa   : id,
        nama_siswa : last?.nama_pengirim || id,
        unread,
        last_msg   : last?.isi || '',
        last_ts    : last?.timestamp || ''
      }
    })
    result.sort((a, b) => (b.last_ts || '').localeCompare(a.last_ts || ''))
    return { success: true, data: result }
  } catch(e) { return { success: false, message: e.message } }
}

export async function markChatRead(data) {
  const session    = data._session
  const { id_siswa } = data
  try {
    const msgs   = await fsQuery(COL.CHAT, [{ field: 'dari', op: '==', value: id_siswa }], 200)
    const unread = msgs.filter(m => !m.is_read && m.dari_role === 'siswa')
    const ops    = unread.map(m => ({
      type: 'set', collection: COL.CHAT, docId: m._id,
      data: { ...m, is_read: true }
    }))
    if (ops.length > 0) await fsBatchWrite(ops)
    return { success: true, marked: ops.length }
  } catch(e) { return { success: false, message: e.message } }
}
