// pages/api/handlers/log.js
import { fsList, fsBatchWrite, COL } from '../../../lib/firestore.js'
import { logActivity, hasPermission } from '../../../lib/utils.js'
import { hasPermission as checkPerm } from '../../../lib/auth.js'

export async function getLogActivity(data) {
  const session = data._session
  if (!checkPerm(session, 'getLogActivity')) return { success: false, message: 'Akses ditolak.' }
  try {
    const { page = 1, limit = 50 } = data
    const docs = await fsList(COL.LOG, 5000)
    docs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    const total = docs.length
    const start = (page - 1) * limit
    return { success: true, data: docs.slice(start, start + limit), total, page, limit }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getLogStats(data) {
  const session = data._session
  if (!checkPerm(session, 'getLogStats')) return { success: false, message: 'Akses ditolak.' }
  try {
    const docs   = await fsList(COL.LOG, 5000)
    const stats  = {}
    docs.forEach(d => { stats[d.action] = (stats[d.action] || 0) + 1 })
    return { success: true, data: stats, total: docs.length }
  } catch(e) { return { success: false, message: e.message } }
}

export async function clearLog(data) {
  const session = data._session
  if (!checkPerm(session, 'clearLog')) return { success: false, message: 'Akses ditolak.' }
  try {
    const docs = await fsList(COL.LOG, 5000)
    const ops  = docs.map(d => ({ type: 'delete', collection: COL.LOG, docId: d._id }))
    if (ops.length > 0) await fsBatchWrite(ops)
    logActivity('CLEAR_LOG', session.username, 'Clear ' + ops.length + ' log entries')
    return { success: true, message: ops.length + ' log berhasil dihapus.' }
  } catch(e) { return { success: false, message: e.message } }
}
