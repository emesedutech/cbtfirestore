// pages/api/setup.js
// ================================================================
// Setup Firestore – buat data default (admin, pengaturan, FAQ)
// Jalankan sekali via: POST /api/setup dengan body { secret: '...' }
// Lindungi dengan SETUP_SECRET env variable!
// ================================================================
import { fsList, fsSet, fsBatchWrite, COL } from '../../lib/firestore.js'
import { hashPassword } from '../../lib/utils.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const secret = req.body?.secret
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ success: false, message: 'Secret salah.' })
  }

  const log = []
  const now = new Date().toISOString()

  try {
    // ── Admin default ─────────────────────────────────────────
    const adminDocs = await fsList(COL.ADMIN, 1)
    if (adminDocs.length === 0) {
      const hashed = await hashPassword('admin123')
      await fsSet(COL.ADMIN, 'admin', {
        username: 'admin', password: hashed, nama: 'Administrator',
        role: 'admin', status: 'aktif', created_at: now, updated_at: now
      })
      log.push('✅ Akun admin default dibuat (username: admin, password: admin123)')
      log.push('⚠️  Segera ganti password setelah login!')
    } else {
      log.push('ℹ️  Akun admin sudah ada, tidak diubah.')
    }

    // ── Pengaturan default ────────────────────────────────────
    const existingPeng = await fsList(COL.PENGATURAN, 200)
    const existingKeys = new Set(existingPeng.map(d => d._id || d.key))
    const defaults     = [
      ['nama_sekolah',      '',        'Nama sekolah'],
      ['nama_kepsek',       '',        'Nama kepala sekolah'],
      ['nip_kepsek',        '',        'NIP kepala sekolah'],
      ['kab_kota',          '',        'Kabupaten/Kota'],
      ['alamat',            '',        'Alamat sekolah'],
      ['logo_url',          '',        'URL logo sekolah'],
      ['npsn',              '',        'NPSN sekolah'],
      ['tahun_pelajaran',   '',        'Tahun pelajaran'],
      ['sembunyikan_nilai', 'false',   'Sembunyikan nilai dari siswa'],
      ['izinkan_lanjut',    'false',   'Izinkan lanjut jika browser tutup'],
      ['login_ganda',       'blokir',  'Blokir atau izinkan login ganda'],
      ['izinkan_review',    'true',    'Izinkan review soal setelah ujian'],
      ['tampil_kunci',      'false',   'Tampilkan kunci jawaban ke siswa']
    ]
    const newDefaults = defaults.filter(d => !existingKeys.has(d[0]))
    if (newDefaults.length > 0) {
      const ops = newDefaults.map(d => ({
        type: 'set', collection: COL.PENGATURAN, docId: d[0],
        data: { key: d[0], value: d[1], deskripsi: d[2] }
      }))
      await fsBatchWrite(ops)
      log.push(`✅ ${newDefaults.length} pengaturan default dibuat.`)
    }

    // ── FAQ contoh ────────────────────────────────────────────
    const faqDocs = await fsList(COL.FAQ, 1)
    if (faqDocs.length === 0) {
      const contohFAQ = [
        ['Bagaimana cara memulai ujian?', 'Pilih paket ujian di dashboard, masukkan token jika diminta, lalu klik Mulai Ujian.'],
        ['Apa yang terjadi jika browser ditutup?', 'Jawaban sudah tersimpan otomatis. Anda dapat melanjutkan jika diizinkan admin.'],
        ['Berapa lama waktu ujian?', 'Durasi ujian tercantum di kartu paket pada dashboard siswa.'],
        ['Bagaimana jika lupa password?', 'Hubungi administrator atau guru untuk reset password Anda.']
      ]
      const ops = contohFAQ.map(([p, j], i) => {
        const id = 'FAQ_DEFAULT_' + i
        return { type: 'set', collection: COL.FAQ, docId: id, data: { id_faq: id, pertanyaan: p, jawaban: j, created_at: now, updated_at: now } }
      })
      await fsBatchWrite(ops)
      log.push('✅ ' + ops.length + ' FAQ contoh dibuat.')
    } else {
      log.push('ℹ️  FAQ sudah ada.')
    }

    return res.status(200).json({ success: true, log })
  } catch(e) {
    return res.status(500).json({ success: false, message: e.message, log })
  }
}
