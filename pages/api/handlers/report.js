// pages/api/handlers/report.js
import { fsGet, fsSet, fsUpdate, fsQuery, COL } from '../../../lib/firestore.js'
import { logActivity, logError } from '../../../lib/utils.js'
import { hasPermission } from '../../../lib/auth.js'
import { hitungNilai } from './ujian.js'

export async function getAnalisaButir(data) {
  const session = data._session
  if (!hasPermission(session, 'getAnalisaButir')) return { success: false, message: 'Akses ditolak.' }
  const { kode_paket } = data
  try {
    const [soalList, sesiList] = await Promise.all([
      fsQuery(COL.SOAL, [{ field: 'kode_paket', op: '==', value: kode_paket }]),
      fsQuery(COL.SESI, [
        { field: 'kode_paket', op: '==', value: kode_paket },
        { field: 'status',     op: '==', value: 'selesai' }
      ])
    ])
    if (soalList.length === 0) return { success: false, message: 'Tidak ada soal di paket ini.' }
    const n = sesiList.length
    if (n === 0) return { success: false, message: 'Belum ada siswa yang menyelesaikan ujian ini.' }

    const jawabanPerSoal = {}
    soalList.forEach(s => { jawabanPerSoal[s.kode_soal] = [] })
    sesiList.forEach(sesi => {
      let jObj = {}
      try { jObj = JSON.parse(sesi.jawaban_json || '{}') } catch {}
      soalList.forEach(s => { jawabanPerSoal[s.kode_soal].push(jObj[s.kode_soal] || '') })
    })

    const analisa = soalList.map(soal => {
      const jawaban = jawabanPerSoal[soal.kode_soal]
      const kunci   = String(soal.kunci_jawaban || '').trim().toUpperCase()
      let benar = 0, kosong = 0
      const distribusi = {}
      jawaban.forEach(j => {
        const jStr = String(j || '').trim().toUpperCase()
        if (!jStr) { kosong++; return }
        distribusi[jStr] = (distribusi[jStr] || 0) + 1
        if (jStr === kunci) benar++
      })
      const tingkatKesulitan = n > 0 ? benar / n : 0
      const salah            = n - benar - kosong
      let dayaBeda           = 0
      if (benar > 0 && benar < n) {
        dayaBeda = Math.abs(benar / n - 0.5) * 2
      }
      return {
        kode_soal        : soal.kode_soal,
        pertanyaan       : (soal.pertanyaan || '').substring(0, 100),
        tipe_soal        : soal.tipe_soal || 'Pilihan Ganda',
        kunci_jawaban    : soal.kunci_jawaban || '',
        n, benar, salah, kosong,
        tingkat_kesulitan: Math.round(tingkatKesulitan * 100) / 100,
        daya_beda        : Math.round(dayaBeda * 100) / 100,
        distribusi
      }
    })
    return { success: true, data: analisa }
  } catch(e) {
    logError('getAnalisaButir', e)
    return { success: false, message: e.message }
  }
}

export async function getUraianUntukKoreksi(data) {
  const session = data._session
  if (!hasPermission(session, 'getUraianUntukKoreksi')) return { success: false, message: 'Akses ditolak.' }
  const { kode_paket } = data
  try {
    const [soalUraian, sesiList] = await Promise.all([
      fsQuery(COL.SOAL, [
        { field: 'kode_paket', op: '==', value: kode_paket },
        { field: 'tipe_soal',  op: '==', value: 'Uraian' }
      ]),
      fsQuery(COL.SESI, [
        { field: 'kode_paket', op: '==', value: kode_paket },
        { field: 'status',     op: '==', value: 'selesai' }
      ])
    ])
    if (soalUraian.length === 0) return { success: false, message: 'Tidak ada soal uraian di paket ini.' }

    const result = sesiList.map(sesi => {
      let jObj = {}
      let sObj = {}
      try { jObj = JSON.parse(sesi.jawaban_json || '{}') } catch {}
      try { sObj = JSON.parse(sesi.skor_json    || '{}') } catch {}
      const uraian = soalUraian.map(s => ({
        kode_soal    : s.kode_soal,
        pertanyaan   : s.pertanyaan,
        bobot        : parseFloat(s.bobot || 1),
        jawaban_siswa: jObj[s.kode_soal] || '',
        skor_manual  : sObj[s.kode_soal] !== undefined ? sObj[s.kode_soal] : null
      }))
      return { id_siswa: sesi.id_siswa, nama_siswa: sesi.nama_siswa || '', kelas: sesi.kelas || '', uraian }
    })
    return { success: true, data: result, soal_uraian: soalUraian }
  } catch(e) {
    logError('getUraianUntukKoreksi', e)
    return { success: false, message: e.message }
  }
}

export async function simpanSkorUraian(data) {
  const session = data._session
  if (!hasPermission(session, 'simpanSkorUraian')) return { success: false, message: 'Akses ditolak.' }
  const { id_siswa, kode_paket, skor_map } = data
  try {
    const sesiId = 'SESI_' + id_siswa + '_' + kode_paket
    const sesi   = await fsGet(COL.SESI, sesiId)
    if (!sesi) return { success: false, message: 'Sesi tidak ditemukan.' }
    let skorObj = {}
    try { skorObj = JSON.parse(sesi.skor_json || '{}') } catch {}
    Object.assign(skorObj, skor_map)
    await fsUpdate(COL.SESI, sesiId, { skor_json: JSON.stringify(skorObj), updated_at: new Date().toISOString() })
    await hitungNilai(id_siswa, kode_paket)
    logActivity('KOREKSI_URAIAN', session.username, 'Koreksi uraian ' + id_siswa + ' paket ' + kode_paket)
    return { success: true }
  } catch(e) {
    logError('simpanSkorUraian', e)
    return { success: false, message: e.message }
  }
}
