// lib/firestore.js
// Re-export semua fungsi dari firebase.js (REST API)
// File ini dipertahankan agar semua handler tidak perlu diubah import-nya
export { fsGet, fsSet, fsUpdate, fsDelete, fsList, fsQuery, fsBatchWrite } from './firebase.js'
