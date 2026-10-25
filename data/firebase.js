const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

let db = null;

function initFirebase() {
  if (db) return db;

  let app = null;
  const apps = getApps();
  if (apps.length > 0) {
    app = apps[0];
  } else {
    // 1. Try environment variable with full JSON string (Vercel standard)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        app = initializeApp({
          credential: cert(serviceAccount)
        });
        console.log('\x1b[32m✔ Firebase Firestore connected via FIREBASE_SERVICE_ACCOUNT\x1b[0m');
      } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
      }
    }

    // 2. Try individual env variables
    if (!app && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      try {
        app = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
        console.log('\x1b[32m✔ Firebase Firestore connected via individual ENV variables\x1b[0m');
      } catch (e) {
        console.error('Failed to initialize Firebase with individual ENVs:', e.message);
      }
    }

    // 3. Try local serviceAccountKey.json file if present
    const localKeyPath = path.join(__dirname, '../serviceAccountKey.json');
    if (!app && fs.existsSync(localKeyPath)) {
      try {
        const serviceAccount = require(localKeyPath);
        app = initializeApp({
          credential: cert(serviceAccount)
        });
        console.log('\x1b[32m✔ Firebase Firestore connected via local serviceAccountKey.json\x1b[0m');
      } catch (e) {
        console.error('Failed to load local serviceAccountKey.json:', e.message);
      }
    }
  }

  if (app) {
    db = getFirestore(app);
    return db;
  }

  console.log('\x1b[33mℹ Firebase credentials not detected. Falling back to local/in-memory store.\x1b[0m');
  return null;
}

module.exports = {
  getFirestore: initFirebase
};
