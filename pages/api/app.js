// pages/api/app.js
// ============================================================
// EMESCBT – Main API Router
// Pengganti doPost() di GAS. Semua action diproses di sini.
// ============================================================
import { validateSession, hasPermission, loginSiswa, loginAdmin } from '../../lib/auth.js'
import { flushLogs, logError } from '../../lib/utils.js'

// ── Import semua handler ─────────────────────────────────────
import * as AuthH    from './handlers/auth.js'
import * as AdminH   from './handlers/admin.js'
import * as SiswaH   from './handlers/siswa.js'
import * as SoalH    from './handlers/soal.js'
import * as PaketH   from './handlers/paket.js'
import * as UjianH   from './handlers/ujian.js'
import * as NilaiH   from './handlers/nilai.js'
import * as MonitH   from './handlers/monitoring.js'
import * as LogH     from './handlers/log.js'
import * as PengH    from './handlers/pengaturan.js'
import * as ChatH    from './handlers/chat.js'
import * as ReportH  from './handlers/report.js'
import * as CetakH   from './handlers/cetak.js'
import * as LisensiH from './handlers/lisensi.js'
import * as MediaH   from './handlers/media.js'

// ── Route Table (persis sama dengan GAS) ────────────────────
function buildRoutes(data) {
  return {
    // Auth
    login                     : () => AuthH.login(data),
    loginAdmin                : () => AuthH.loginAdminHandler(data),
    logout                    : () => AuthH.logout(data),

    // Dashboard & init
    getDashboard              : () => AdminH.getDashboard(data),
    getInitData               : () => AdminH.getInitData(data),

    // Siswa
    getSiswaList              : () => SiswaH.getSiswaList(data),
    getSiswaUntukKartu        : () => SiswaH.getSiswaUntukKartu(data),
    saveSiswa                 : () => SiswaH.saveSiswa(data),
    deleteSiswa               : () => SiswaH.deleteSiswa(data),
    importSiswa               : () => SiswaH.importSiswa(data),

    // Soal
    getSoalList               : () => SoalH.getSoalList(data),
    saveSoal                  : () => SoalH.saveSoal(data),
    deleteSoal                : () => SoalH.deleteSoal(data),
    importSoal                : () => SoalH.importSoal(data),

    // Paket
    getPaketList              : () => PaketH.getPaketList(data),
    savePaket                 : () => PaketH.savePaket(data),
    deletePaket               : () => PaketH.deletePaket(data),
    duplikasiPaket            : () => PaketH.duplikasiPaket(data),

    // Token Ujian
    generateTokenUjian        : () => PaketH.generateTokenUjian(data),
    hapusTokenUjian           : () => PaketH.hapusTokenUjian(data),
    validasiTokenUjian        : () => PaketH.validasiTokenUjian(data),

    // Nilai & Rekap
    getNilaiList              : () => NilaiH.getNilaiList(data),
    getHasilDetail            : () => NilaiH.getHasilDetail(data),
    exportNilai               : () => NilaiH.exportNilai(data),
    exportNilaiExcel          : () => NilaiH.exportNilaiExcel(data),

    // Pengaturan
    getPengaturan             : () => PengH.getPengaturan(data),
    getPengaturanPublik       : () => PengH.getPengaturanPublik(data),
    getPengaturanPublikSiswa  : () => PengH.getPengaturanPublikSiswa(data),
    savePengaturan            : () => PengH.savePengaturan(data),

    // Monitoring
    getMonitoring             : () => MonitH.getMonitoring(data),
    resetUjian                : () => MonitH.resetUjian(data),
    paksakanSubmit            : () => MonitH.paksakanSubmit(data),
    forceLogoutSiswa          : () => MonitH.forceLogoutSiswa(data),

    // Log
    getLogActivity            : () => LogH.getLogActivity(data),
    getLogStats               : () => LogH.getLogStats(data),
    clearLog                  : () => LogH.clearLog(data),

    // Admin users
    getAdminUserList          : () => AdminH.getAdminUserList(data),
    saveAdminUser             : () => AdminH.saveAdminUser(data),
    deleteAdminUser           : () => AdminH.deleteAdminUser(data),

    // Data ops
    backupData                : () => AdminH.backupData(data),
    resetDatabase             : () => AdminH.resetDatabase(data),

    // FAQ & Chatbot
    getFAQ                    : () => ChatH.getFAQ(data),
    saveFAQ                   : () => ChatH.saveFAQ(data),
    deleteFAQ                 : () => ChatH.deleteFAQ(data),
    chatbotAnswer             : () => ChatH.chatbotAnswer(data),

    // Upload Media
    uploadImageToDrive        : () => MediaH.uploadImage(data),

    // Cetak dokumen
    getDataDaftarHadir        : () => CetakH.getDataDaftarHadir(data),
    getDataBeritaAcara        : () => CetakH.getDataBeritaAcara(data),

    // Analisa & Koreksi
    getAnalisaButir           : () => ReportH.getAnalisaButir(data),
    getUraianUntukKoreksi     : () => ReportH.getUraianUntukKoreksi(data),
    simpanSkorUraian          : () => ReportH.simpanSkorUraian(data),

    // Chat
    sendChatMessage           : () => ChatH.sendChatMessage(data),
    getChatMessages           : () => ChatH.getChatMessages(data),
    getChatSiswaList          : () => ChatH.getChatSiswaList(data),
    markChatRead              : () => ChatH.markChatRead(data),

    // Lisensi NPSN
    simpanNPSN                : () => LisensiH.simpanNPSN(data),
    statusLisensi             : () => LisensiH.statusLisensi(data),

    // Siswa – Ujian
    getSesiUjian              : () => UjianH.getSesiUjian(data),
    getSoalUjian              : () => UjianH.getSoalUjian(data),
    autosaveJawaban           : () => UjianH.autosaveJawaban(data),
    submitUjian               : () => UjianH.submitUjian(data),
    getHasilUjian             : () => UjianH.getHasilUjian(data),
    getHasilUjianV2           : () => UjianH.getHasilUjianV2(data),
    getProgressSiswa          : () => UjianH.getProgressSiswa(data),
    getInfoPaketUntukKonfirmasi: () => UjianH.getInfoPaketUntukKonfirmasi(data),
    getReviewJawaban          : () => UjianH.getReviewJawaban(data)
  }
}

// ── Actions yang tidak butuh auth ───────────────────────────
const PUBLIC_ACTIONS = new Set([
  'login', 'loginAdmin', 'getPengaturanPublik', 'getPengaturanPublikSiswa'
])

// ── Handler utama ────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  let data = {}
  try {
    data = req.body || {}
  } catch {
    return res.status(400).json({ success: false, message: 'Body tidak valid.' })
  }

  const action = data.action
  const token  = data.token || ''

  if (!action) {
    return res.status(400).json({ success: false, message: 'Action diperlukan.' })
  }

  try {
    // ── Auth check ──────────────────────────────────────────
    if (!PUBLIC_ACTIONS.has(action)) {
      const session = validateSession(token)
      if (!session) {
        return res.status(401).json({ success: false, message: 'Sesi tidak valid atau telah berakhir.' })
      }
      data._session = session

      if (!hasPermission(session, action)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Role Anda tidak memiliki izin.' })
      }
    }

    // ── Route ────────────────────────────────────────────────
    const routes = buildRoutes(data)
    if (!routes[action]) {
      return res.status(404).json({ success: false, message: 'Action tidak dikenal: ' + action })
    }

    const result = await routes[action]()
    await flushLogs()
    return res.status(200).json(result)

  } catch (err) {
    logError('handler', err)
    await flushLogs()
    return res.status(500).json({ success: false, message: 'Error server: ' + err.message })
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // untuk upload base64 gambar
    }
  }
}
