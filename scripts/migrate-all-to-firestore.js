const { getFirestore } = require('../data/firebase');

async function migrateAll() {
  console.log('Connecting to Cloud Firestore...');
  const db = getFirestore();
  if (!db) {
    console.error('❌ Could not connect to Firestore. Check serviceAccountKey.json.');
    process.exit(1);
  }

  // 1. Leads Collection
  const leads = [
    {
      lead_id: "LEAD-PECT",
      channel_id: "whatsapp",
      sender_id: "+2348011223344",
      customer_email: "leadpect@propertypro.ng",
      location: "Ikoyi",
      neighborhood: "Parkview Estate",
      bedrooms: 4,
      budget_max_ngn: 250000000,
      transaction_type: "buy",
      offer_details: "Interested in 4-Bed Terrace in Parkview Estate with BQ",
      owner_agent_id: "Tunde Balogun",
      created_at: "2026-10-25T13:05:00.000Z",
      updated_at: "2026-10-25T13:12:00.000Z"
    },
    {
      lead_id: "LEAD-5ENW",
      channel_id: "whatsapp",
      sender_id: "+2348022334455",
      customer_email: "lead5enw@propertypro.ng",
      location: "Lekki Phase 1",
      neighborhood: "Admiralty Way",
      bedrooms: 3,
      budget_max_ngn: 10000000,
      transaction_type: "rent",
      offer_details: "Looking for serviced 3-bedroom flat on Admiralty Way",
      owner_agent_id: "Chioma Eze",
      created_at: "2026-10-25T12:20:00.000Z",
      updated_at: "2026-10-25T12:27:00.000Z"
    },
    {
      lead_id: "LEAD-101",
      channel_id: "web-chat",
      sender_id: "+2348033445566",
      customer_email: "customer@example.com",
      location: "Victoria Island",
      neighborhood: "Ahmadu Bello Way",
      bedrooms: 2,
      budget_max_ngn: 15000000,
      transaction_type: "rent",
      offer_details: "Corporate lease inquiry for executive high-rise apartment",
      owner_agent_id: "Femi Adeleke",
      created_at: "2026-10-25T11:55:00.000Z",
      updated_at: "2026-10-25T12:04:00.000Z"
    }
  ];

  console.log(`\n1. Migrating ${leads.length} Leads to Firestore 'leads'...`);
  for (const l of leads) {
    await db.collection('leads').doc(l.lead_id).set(l, { merge: true });
    console.log(`   ✔ Lead [${l.lead_id}] -> ${l.customer_email} (${l.location})`);
  }

  // 2. Bookings Collection
  const bookings = [
    {
      booking_id: "BK-335",
      lead_id: "LEAD-PECT",
      property_id: "IK-402",
      property_title: "4-Bedroom Luxury Waterfront Terrace with BQ",
      property_location: "Parkview Estate, Ikoyi, Lagos",
      slot_time: "Saturday 11:00 AM",
      status: "confirmed",
      receipt_id: "RC-REF-1792933884034",
      amount_ngn: 5000,
      assigned_agent: {
        name: "Tunde Balogun",
        phone: "+234 802 345 6789",
        specialization: "Ikoyi Luxury Sales"
      },
      created_at: "2026-10-25T13:11:25.000Z",
      confirmed_at: "2026-10-25T13:11:42.000Z"
    },
    {
      booking_id: "BK-462",
      lead_id: "LEAD-5ENW",
      property_id: "LK-301",
      property_title: "3-Bedroom Contemporary Serviced Flat",
      property_location: "Admiralty Way, Lekki Phase 1, Lagos",
      slot_time: "Saturday 12:30 PM",
      status: "confirmed",
      receipt_id: "RC-REF-1792931167615",
      amount_ngn: 5000,
      assigned_agent: {
        name: "Chioma Eze",
        phone: "+234 803 987 6543",
        specialization: "Lekki Residential Rentals"
      },
      created_at: "2026-10-25T12:26:08.000Z",
      confirmed_at: "2026-10-25T12:26:35.000Z"
    },
    {
      booking_id: "BK-101",
      lead_id: "LEAD-101",
      property_id: "VI-202",
      property_title: "2-Bedroom Luxury Serviced High-Rise Suite",
      property_location: "Ahmadu Bello Way, Victoria Island, Lagos",
      slot_time: "Saturday 01:00 PM",
      status: "confirmed",
      receipt_id: "RC-REF-1792929799954",
      amount_ngn: 5000,
      assigned_agent: {
        name: "Femi Adeleke",
        phone: "+234 805 111 2233",
        specialization: "VI Commercial & Luxury"
      },
      created_at: "2026-10-25T12:03:20.000Z",
      confirmed_at: "2026-10-25T12:03:41.000Z"
    }
  ];

  console.log(`\n2. Migrating ${bookings.length} Bookings to Firestore 'bookings'...`);
  for (const b of bookings) {
    await db.collection('bookings').doc(b.booking_id).set(b, { merge: true });
    console.log(`   ✔ Booking [${b.booking_id}] -> ${b.property_title} (${b.slot_time}) [${b.status}]`);
  }

  // 3. Payments Collection
  const payments = [
    {
      payment_id: "REF-1792933884034",
      reference: "REF-1792933884034",
      lead_id: "LEAD-PECT",
      booking_id: "BK-335",
      fee_id: "FEE-INSPECT",
      fee_name: "Inspection Logistics Fee",
      amount_kobo: 500000,
      amount_ngn: 5000,
      status: "verified_success",
      receipt_id: "RC-REF-1792933884034",
      channel: "CARD",
      gateway_response: "Successful",
      customer_email: "leadpect@propertypro.ng",
      property_title: "4-Bedroom Luxury Waterfront Terrace with BQ",
      property_location: "Parkview Estate, Ikoyi, Lagos",
      created_at: "2026-10-25T13:11:25.000Z",
      paid_at: "2026-10-25T13:11:42.000Z",
      verified_at: "2026-10-25T13:11:43.000Z"
    },
    {
      payment_id: "REF-1792931167615",
      reference: "REF-1792931167615",
      lead_id: "LEAD-5ENW",
      booking_id: "BK-462",
      fee_id: "FEE-INSPECT",
      fee_name: "Inspection Logistics Fee",
      amount_kobo: 500000,
      amount_ngn: 5000,
      status: "verified_success",
      receipt_id: "RC-REF-1792931167615",
      channel: "CARD",
      gateway_response: "Successful",
      customer_email: "lead5enw@propertypro.ng",
      property_title: "3-Bedroom Contemporary Serviced Flat",
      property_location: "Admiralty Way, Lekki Phase 1, Lagos",
      created_at: "2026-10-25T12:26:08.000Z",
      paid_at: "2026-10-25T12:26:35.000Z",
      verified_at: "2026-10-25T12:26:36.000Z"
    },
    {
      payment_id: "REF-1792929799954",
      reference: "REF-1792929799954",
      lead_id: "LEAD-101",
      booking_id: "BK-101",
      fee_id: "FEE-INSPECT",
      fee_name: "Inspection Logistics Fee",
      amount_kobo: 500000,
      amount_ngn: 5000,
      status: "verified_success",
      receipt_id: "RC-REF-1792929799954",
      channel: "CARD",
      gateway_response: "Successful",
      customer_email: "customer@example.com",
      property_title: "2-Bedroom Luxury Serviced High-Rise Suite",
      property_location: "Ahmadu Bello Way, Victoria Island, Lagos",
      created_at: "2026-10-25T12:03:20.000Z",
      paid_at: "2026-10-25T12:03:41.000Z",
      verified_at: "2026-10-25T12:03:42.000Z"
    }
  ];

  console.log(`\n3. Migrating ${payments.length} Payments to Firestore 'payments'...`);
  for (const p of payments) {
    await db.collection('payments').doc(p.payment_id).set(p, { merge: true });
    console.log(`   ✔ Payment [${p.reference}] -> ₦${p.amount_ngn.toLocaleString()} [${p.status}] (${p.receipt_id})`);
  }

  // 4. Handoffs Collection
  const handoffs = [
    {
      handoff_id: "HD-204",
      lead_id: "LEAD-PECT",
      reason: "Request for Title Documents & Deed Review",
      summary: "Buyer requested Governor's Consent verification and draft sales contract for Parkview Terrace (IK-402) after viewing fee payment.",
      status: "escalated_to_human",
      assigned_officer: "Senior Closing & Legal Officer",
      created_at: "2026-10-25T13:25:00.000Z"
    },
    {
      handoff_id: "HD-109",
      lead_id: "LEAD-101",
      reason: "Corporate Tenancy Agreement Signing",
      summary: "Corporate client requested official company VAT invoice and legal lease contract execution for Ahmadu Bello Suite (VI-202).",
      status: "escalated_to_human",
      assigned_officer: "Senior Closing & Legal Officer",
      created_at: "2026-10-25T12:10:00.000Z"
    }
  ];

  console.log(`\n4. Migrating ${handoffs.length} Handoffs to Firestore 'handoffs'...`);
  for (const h of handoffs) {
    await db.collection('handoffs').doc(h.handoff_id).set(h, { merge: true });
    console.log(`   ✔ Handoff [${h.handoff_id}] -> ${h.reason} (${h.status})`);
  }

  console.log('\n✔ Verification of all 5 Collections in Cloud Firestore:');
  const collections = ['properties', 'leads', 'bookings', 'payments', 'handoffs'];
  for (const c of collections) {
    const snap = await db.collection(c).get();
    console.log(`   • ${c.padEnd(12)}: ${snap.size} documents`);
  }

  console.log('\n🎉 ALL DATA IS NOW COMPLETELY MIGRATED TO CLOUD FIRESTORE!');
  process.exit(0);
}

migrateAll().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
