const { getFirestore } = require('../data/firebase');
const properties = require('../data/properties.json');

async function seed() {
  console.log('Connecting to Firestore...');
  const db = getFirestore();
  if (!db) {
    console.error('❌ Could not connect to Firestore. Check serviceAccountKey.json.');
    process.exit(1);
  }

  console.log(`Uploading ${properties.length} properties to Firestore collection 'properties'...`);
  const batch = db.batch();

  for (const property of properties) {
    const docRef = db.collection('properties').doc(property.property_id);
    batch.set(docRef, {
      ...property,
      updated_at: new Date().toISOString()
    }, { merge: true });
  }

  await batch.commit();
  console.log(`✔ Successfully migrated ${properties.length} properties to Cloud Firestore!`);

  // Verify by reading back
  const snap = await db.collection('properties').get();
  console.log(`✔ Verified: Firestore 'properties' collection now has ${snap.size} documents.`);
  snap.forEach(doc => {
    console.log(`   - [${doc.id}] ${doc.data().title} (${doc.data().price_formatted})`);
  });

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
