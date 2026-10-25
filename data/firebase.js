const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;

function initFirebase() {
  if (db) return db;

  // 1. Try environment variable with full JSON string (Vercel standard)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('\x1b[32m✔ Firebase Firestore connected via FIREBASE_SERVICE_ACCOUNT\x1b[0m');
      db = admin.firestore();
      return db;
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
    }
  }

  // 2. Try individual env variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
      console.log('\x1b[32m✔ Firebase Firestore connected via individual ENV variables\x1b[0m');
      db = admin.firestore();
      return db;
    } catch (e) {
      console.error('Failed to initialize Firebase with individual ENVs:', e.message);
    }
  }

  // 3. Try local serviceAccountKey.json file if present
  const localKeyPath = path.join(__dirname, '../serviceAccountKey.json');
  if (fs.existsSync(localKeyPath)) {
    try {
      const serviceAccount = require(localKeyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('\x1b[32m✔ Firebase Firestore connected via local serviceAccountKey.json\x1b[0m');
      db = admin.firestore();
      return db;
    } catch (e) {
      console.error('Failed to load local serviceAccountKey.json:', e.message);
    }
  }

  console.log('\x1b[33mℹ Firebase credentials not detected. Falling back to local/in-memory store.\x1b[0m');
  return null;
}

module.exports = {
  getFirestore: initFirebase
};
