// pages/api/handlers/auth.js
import { loginSiswa, loginAdmin } from '../../../lib/auth.js'
import { logActivity } from '../../../lib/utils.js'

export async function login(data) {
  const { username, password } = data
  const result = await loginSiswa({ username, password })
  if (result.success) logActivity('LOGIN_SISWA', username, 'Login berhasil')
  else logActivity('LOGIN_SISWA_GAGAL', username, result.message)
  return result
}

export async function loginAdminHandler(data) {
  const { username, password } = data
  const result = await loginAdmin({ username, password })
  if (result.success) logActivity('LOGIN_ADMIN', username, 'Login admin berhasil')
  else logActivity('LOGIN_ADMIN_GAGAL', username, result.message)
  return result
}

export async function logout(data) {
  const session = data._session
  logActivity('LOGOUT', session?.username || session?.id_siswa || 'unknown', 'Logout')
  return { success: true, message: 'Logout berhasil.' }
}
