// lib/firebase.js
// Firebase Admin SDK singleton untuk Next.js API Routes
import admin from 'firebase-admin'

let db = null

function getFirestore() {
  if (db) return db

  if (!admin.apps.length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '')
      .replace(/\\n/g, '\n')

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey
      })
    })
  }

  db = admin.firestore()
  return db
}

export { getFirestore, admin }
