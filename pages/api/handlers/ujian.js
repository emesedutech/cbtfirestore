// pages/api/handlers/ujian.js
// Engine Ujian Siswa – port dari GAS Ujian.gs
import { fsGet, fsList, fsSet, fsUpdate, fsQuery, COL } from '../../../lib/firestore.js'
import {
  acakSoalBerdasarkanTipe, generateId, logActivity, logError,
  loadPengaturan, getSiswaById, cacheGet, cachePut, cacheDelete
} from '../../../lib/utils.js'

// ── GET SESI UJIAN (dashboard siswa) ─────────────────────────
export async function getSesiUjian(data) {
  const session = data._session
  if (session.role !== 'siswa') return { success: false, message: 'Akses ditolak.' }
  const { id_siswa, kelas } = session
  try {
    const paketList = await fsList(COL.PAKET, 500)
    const aktif = paketList.filter(p => {
      if (p.status !== 'aktif') return false
      if (!p.kelas_target || p.kelas_target.trim() === '') return true
      const kls = p.kelas_target.split(',').map(k => k.trim().toLowerCase())
      if (kls.includes('semua') || kls.includes('all')) return true
      if (!kelas || kelas.trim() === '') return true
      return kls.includes(kelas.trim().toLowerCase())
    })

    const result = await Promise.all(aktif.map(async p => {
      const nilaiId = 'N' + id_siswa + '_' + p.kode_paket
      let nilai = null
      try { nilai = await fsGet(COL.NILAI, nilaiId) } catch {}
      const status_ujian = nilai ? 'selesai' : 'belum'
      return {
        kode_paket      : p.kode_paket,
        nama_paket      : p.nama_paket,
        mata_pelajaran  : p.mata_pelajaran || '',
        durasi          : p.durasi || 90,
        jumlah_soal     : p.jumlah_soal || 0,
        tanggal_mulai   : p.tanggal_mulai || '',
        tanggal_selesai : p.tanggal_selesai || '',
        butuh_token     : !!(p.token_ujian),
        status_ujian,
        nilai           : nilai || null
      }
    }))

    const siswa = await getSiswaById(id_siswa)
    return { success: true, data: result, siswa: { nama: siswa?.nama || '', kelas: siswa?.kelas || '' } }
  } catch(e) {
    logError('getSesiUjian', e)
    return { success: false, message: e.message }
  }
}

// ── GET SOAL UJIAN ────────────────────────────────────────────
export async function getSoalUjian(data) {
  const session = data._session
  if (session.role !== 'siswa') return { success: false, message: 'Akses ditolak.' }
  const { id_siswa } = session
  const { kode_paket } = data
  try {
    const paket = await fsGet(COL.PAKET, kode_paket)
    if (!paket) return { success: false, message: 'Paket tidak ditemukan.' }
    if (paket.status !== 'aktif') return { success: false, message: 'Paket ujian tidak aktif.' }

    const sesiId = 'SESI_' + id_siswa + '_' + kode_paket
    let sesi = null
    try { sesi = await fsGet(COL.SESI, sesiId) } catch {}
    if (sesi && sesi.status === 'selesai') return { success: false, message: 'Anda sudah mengerjakan ujian ini.' }

    const soalList = await fsQuery(COL.SOAL, [{ field: 'kode_paket', op: '==', value: kode_paket }])
    const soalTeracak = acakSoalBerdasarkanTipe(soalList, id_siswa, kode_paket)

    let jawabanObj = {}
    if (sesi?.jawaban_json) {
      try { jawabanObj = JSON.parse(sesi.jawaban_json) } catch {}
    }

    let waktuSisa = parseInt(paket.durasi || 90) * 60
    if (sesi?.status === 'aktif') waktuSisa = parseInt(sesi.waktu_sisa || waktuSisa)

    const soalUntukSiswa = soalTeracak.map((s, idx) => ({
      nomor          : idx + 1,
      kode_soal      : s.kode_soal,
      tipe_soal      : s.tipe_soal,
      pertanyaan     : s.pertanyaan,
      opsi_a         : s.opsi_a || '',
      opsi_b         : s.opsi_b || '',
      opsi_c         : s.opsi_c || '',
      opsi_d         : s.opsi_d || '',
      opsi_e         : s.opsi_e || '',
      pasangan       : s.pasangan || '',
      gambar_url     : s.gambar_url || '',
      gambar_opsi_a  : s.gambar_opsi_a || '',
      gambar_opsi_b  : s.gambar_opsi_b || '',
      gambar_opsi_c  : s.gambar_opsi_c || '',
      gambar_opsi_d  : s.gambar_opsi_d || '',
      gambar_opsi_e  : s.gambar_opsi_e || '',
      bobot          : parseFloat(s.bobot || 1),
      jawaban_siswa  : jawabanObj[s.kode_soal] || ''
    }))

    return {
      success    : true,
      soal       : soalUntukSiswa,
      waktu_sisa : waktuSisa,
      durasi     : parseInt(paket.durasi || 90) * 60,
      nama_paket : paket.nama_paket
    }
  } catch(e) {
    logError('getSoalUjian', e)
    return { success: false, message: e.message }
  }
}

// ── AUTOSAVE ──────────────────────────────────────────────────
export async function autosaveJawaban(data) {
  const session = data._session
  if (session.role !== 'siswa') return { success: false, message: 'Akses ditolak.' }
  const { id_siswa } = session
  const { kode_paket, jawaban, waktu_sisa, fullJawaban } = data
  try {
    const sesiId = 'SESI_' + id_siswa + '_' + kode_paket
    let jawabanFinal, jumlahDijawab

    if (fullJawaban) {
      jawabanFinal  = jawaban
      jumlahDijawab = Object.values(jawaban).filter(v => v !== '' && v !== null).length
      // Cek status selesai
      const snap = await fsGet(COL.SESI, sesiId)
      if (snap?.status === 'selesai') return { success: false, message: 'Ujian sudah selesai.' }
    } else {
      const sesi = await fsGet(COL.SESI, sesiId)
      if (!sesi) {
        // Buat sesi baru (autosave pertama)
        const paket = await fsGet(COL.PAKET, kode_paket)
        const siswa = await getSiswaById(id_siswa)
        const now   = new Date().toISOString()
        await fsSet(COL.SESI, sesiId, {
          id_sesi: sesiId, id_siswa, kode_paket,
          nama_siswa : siswa?.nama || '', kelas: siswa?.kelas || '',
          jawaban_json: JSON.stringify(jawaban || {}),
          skor_json   : '{}', status: 'aktif',
          mulai_at: now, waktu_sisa: parseInt(waktu_sisa || 0),
          progres: Object.values(jawaban || {}).filter(v => v !== '' && v !== null).length,
          updated_at: now
        })
        return { success: true }
      }
      if (sesi.status === 'selesai') return { success: false, message: 'Ujian sudah selesai.' }
      let existing = {}
      try { existing = JSON.parse(sesi.jawaban_json || '{}') } catch {}
      Object.assign(existing, jawaban)
      jawabanFinal  = existing
      jumlahDijawab = Object.values(existing).filter(v => v !== '' && v !== null).length
    }

    await fsUpdate(COL.SESI, sesiId, {
      jawaban_json: JSON.stringify(jawabanFinal),
      waktu_sisa  : parseInt(waktu_sisa || 0),
      progres     : jumlahDijawab,
      updated_at  : new Date().toISOString()
    })
    return { success: true }
  } catch(e) {
    logError('autosaveJawaban', e)
    return { success: false, message: e.message }
  }
}

// ── SUBMIT UJIAN ──────────────────────────────────────────────
export async function submitUjian(data) {
  const session = data._session
  if (session.role !== 'siswa') return { success: false, message: 'Akses ditolak.' }
  const { id_siswa } = session
  const { kode_paket, jawaban, hybridMode } = data
  try {
    const sesiId = 'SESI_' + id_siswa + '_' + kode_paket
    const sesi   = await fsGet(COL.SESI, sesiId)
    if (sesi?.status === 'selesai') return { success: false, message: 'Ujian sudah disubmit.' }

    const now           = new Date().toISOString()
    const jumlahDijawab = jawaban ? Object.values(jawaban).filter(v => v !== '' && v !== null).length : 0
    const siswa         = await getSiswaById(id_siswa)

    // Satu operasi: buat atau update sesi langsung dengan status selesai
    const sesiData = {
      id_sesi     : sesiId, id_siswa, kode_paket,
      nama_siswa  : sesi?.nama_siswa || siswa?.nama || session.nama || '',
      kelas       : sesi?.kelas      || siswa?.kelas || session.kelas || '',
      mulai_at    : sesi?.mulai_at   || now,
      jawaban_json: JSON.stringify(jawaban || {}),
      skor_json   : '{}',
      progres     : jumlahDijawab,
      waktu_sisa  : 0,
      status      : 'selesai',
      selesai_at  : now,
      updated_at  : now
    }
    await fsSet(COL.SESI, sesiId, sesiData)

    // Hitung nilai
    const hasil = await hitungNilai(id_siswa, kode_paket)
    logActivity('SUBMIT_UJIAN', session.username || id_siswa, 'Submit ujian ' + kode_paket + (hybridMode ? ' [hybrid]' : ''))
    return { success: true, message: 'Ujian berhasil disubmit.', nilai: hasil.nilai }
  } catch(e) {
    logError('submitUjian', e)
    return { success: false, message: e.message }
  }
}

// ── HITUNG NILAI ──────────────────────────────────────────────
async function hitungNilai(id_siswa, kode_paket) {
  try {
    const sesiId = 'SESI_' + id_siswa + '_' + kode_paket
    const [sesi, soalList, paket, siswa] = await Promise.all([
      fsGet(COL.SESI, sesiId),
      fsQuery(COL.SOAL, [{ field: 'kode_paket', op: '==', value: kode_paket }]),
      fsGet(COL.PAKET, kode_paket),
      getSiswaById(id_siswa)
    ])

    let jawabanObj = {}
    let skorObj    = {}
    try { jawabanObj = JSON.parse(sesi?.jawaban_json || '{}') } catch {}
    try { skorObj    = JSON.parse(sesi?.skor_json    || '{}') } catch {}

    let totalBobot = 0, totalSkor = 0, benar = 0, salah = 0, kosong = 0

    soalList.forEach(soal => {
      const bobot   = parseFloat(soal.bobot || 1)
      totalBobot   += bobot
      const jawaban = jawabanObj[soal.kode_soal] || ''
      let skor      = skorObj[soal.kode_soal] !== undefined ? parseFloat(skorObj[soal.kode_soal]) : -999

      if (skor === -999) {
        if (!jawaban || jawaban === '') { skor = 0; kosong++ }
        else if (soal.tipe_soal === 'Uraian') { skor = 0 }
        else {
          const benarFlag = String(jawaban).trim().toUpperCase() === String(soal.kunci_jawaban || '').trim().toUpperCase()
          skor = benarFlag ? bobot : 0
          if (benarFlag) benar++; else salah++
        }
        skorObj[soal.kode_soal] = skor
      } else {
        if (!jawaban || jawaban === '') kosong++
        else if (skor >= bobot) benar++
        else salah++
      }
      totalSkor += skor
    })

    if (sesi) {
      await fsUpdate(COL.SESI, sesiId, { skor_json: JSON.stringify(skorObj), updated_at: new Date().toISOString() })
    }

    const nilaiAkhir = totalBobot > 0 ? Math.round((totalSkor / totalBobot) * 100 * 10) / 10 : 0
    const kkm        = parseFloat(paket?.kkm || 70)
    const lulus      = nilaiAkhir >= kkm ? 'Lulus' : 'Tidak Lulus'
    const now        = new Date().toISOString()
    const nilaiId    = 'N' + id_siswa + '_' + kode_paket

    await fsSet(COL.NILAI, nilaiId, {
      id_nilai   : nilaiId, id_siswa, kode_paket,
      nama_siswa : siswa?.nama || sesi?.nama_siswa || '',
      kelas      : siswa?.kelas || sesi?.kelas || '',
      nama_paket : paket?.nama_paket || '',
      nilai_akhir: nilaiAkhir, skor_total: totalSkor, bobot_total: totalBobot,
      benar, salah, kosong, status: lulus, kkm, updated_at: now, created_at: now
    })

    return { success: true, nilai: { nilaiAkhir, benar, salah, kosong, lulus, kkm } }
  } catch(e) {
    logError('hitungNilai', e)
    return { success: false, message: e.message }
  }
}

export { hitungNilai }

// ── GET HASIL, PROGRESS, REVIEW ───────────────────────────────

export async function getHasilUjian(data) {
  const session = data._session
  if (session.role !== 'siswa') return { success: false, message: 'Akses ditolak.' }
  try {
    const nilaiId = 'N' + session.id_siswa + '_' + data.kode_paket
    const nilai   = await fsGet(COL.NILAI, nilaiId)
    if (!nilai) return { success: false, message: 'Nilai belum tersedia.' }
    return { success: true, data: nilai }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getHasilUjianV2(data) {
  const session   = data._session
  const targetId  = data.id_siswa || (session.role === 'siswa' ? session.id_siswa : null)
  if (!targetId) return { success: false, message: 'ID siswa diperlukan.' }
  try {
    const nilaiId = 'N' + targetId + '_' + data.kode_paket
    const nilai   = await fsGet(COL.NILAI, nilaiId)
    if (!nilai) return { success: false, message: 'Nilai belum tersedia.' }
    const peng = await loadPengaturan()
    const sembunyikan = peng.sembunyikan_nilai === 'true' || peng.sembunyikan_nilai === true
    if (sembunyikan && session.role === 'siswa') {
      return { success: true, data: { status: nilai.status, pesan: 'Nilai sedang diproses oleh guru.' } }
    }
    return { success: true, data: nilai }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getProgressSiswa(data) {
  const session = data._session
  if (session.role !== 'siswa') return { success: false, message: 'Akses ditolak.' }
  try {
    const sesiId = 'SESI_' + session.id_siswa + '_' + data.kode_paket
    const sesi   = await fsGet(COL.SESI, sesiId)
    return { success: true, progres: sesi?.progres || 0, waktu_sisa: sesi?.waktu_sisa || 0 }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getInfoPaketUntukKonfirmasi(data) {
  const { kode_paket } = data
  try {
    const paket = await fsGet(COL.PAKET, kode_paket)
    if (!paket) return { success: false, message: 'Paket tidak ditemukan.' }
    return {
      success       : true,
      nama_paket    : paket.nama_paket,
      mata_pelajaran: paket.mata_pelajaran || '',
      durasi        : paket.durasi || 90,
      jumlah_soal   : paket.jumlah_soal || 0,
      butuh_token   : !!(paket.token_ujian)
    }
  } catch(e) { return { success: false, message: e.message } }
}

export async function getReviewJawaban(data) {
  const session  = data._session
  const targetId = session.role === 'siswa' ? session.id_siswa : data.id_siswa
  try {
    const sesiId  = 'SESI_' + targetId + '_' + data.kode_paket
    const [sesi, soalList] = await Promise.all([
      fsGet(COL.SESI, sesiId),
      fsQuery(COL.SOAL, [{ field: 'kode_paket', op: '==', value: data.kode_paket }])
    ])
    if (!sesi) return { success: false, message: 'Data sesi tidak ditemukan.' }

    let jawabanObj = {}
    let skorObj    = {}
    try { jawabanObj = JSON.parse(sesi.jawaban_json || '{}') } catch {}
    try { skorObj    = JSON.parse(sesi.skor_json    || '{}') } catch {}

    const review = soalList.map((s, idx) => ({
      nomor         : idx + 1,
      kode_soal     : s.kode_soal,
      tipe_soal     : s.tipe_soal,
      pertanyaan    : s.pertanyaan,
      kunci_jawaban : s.kunci_jawaban || '',
      jawaban_siswa : jawabanObj[s.kode_soal] || '',
      skor          : skorObj[s.kode_soal] !== undefined ? skorObj[s.kode_soal] : null,
      bobot         : parseFloat(s.bobot || 1)
    }))

    return { success: true, data: review }
  } catch(e) { return { success: false, message: e.message } }
}
