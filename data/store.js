const fs = require('fs');
const path = require('path');
const { getFirestore } = require('./firebase');
const PROPERTIES = require('./properties.json');

const STATE_FILE = process.env.VERCEL ? path.join('/tmp', 'state.json') : path.join(__dirname, 'state.json');

// Local in-memory state
let state = {
  properties: PROPERTIES,
  leads: {},
  bookings: {},
  payments: {},
  handoffs: {}
};

function loadLocalState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      state.leads = parsed.leads || {};
      state.bookings = parsed.bookings || {};
      state.payments = parsed.payments || {};
      state.handoffs = parsed.handoffs || {};
    }
  } catch (err) {}
}

function saveLocalState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      leads: state.leads,
      bookings: state.bookings,
      payments: state.payments,
      handoffs: state.handoffs
    }, null, 2));
  } catch (err) {}
}

// Sync properties from Cloud Firestore if connected
async function syncPropertiesFromFirestore() {
  const db = getFirestore();
  if (db) {
    try {
      const snap = await db.collection('properties').get();
      if (!snap.empty) {
        state.properties = snap.docs.map(doc => doc.data());
      }
    } catch (err) {}
  }
}
syncPropertiesFromFirestore();

module.exports = {
  getProperties: () => state.properties,
  syncProperties: syncPropertiesFromFirestore,
  getPropertyById: (id) => state.properties.find(p => p.property_id.toUpperCase() === (id || '').toUpperCase()),

  // Leads
  getOrCreateLead: async (channel_id, sender_id) => {
    const db = getFirestore();
    const lead_id = `LEAD-${(sender_id || 'PROSPECT').slice(-4).toUpperCase()}`;

    if (db) {
      try {
        const docRef = db.collection('leads').doc(lead_id);
        const doc = await docRef.get();
        if (doc.exists) {
          const lead = doc.data();
          state.leads[lead_id] = lead;
          return lead;
        }
        const newLead = {
          lead_id,
          channel_id,
          sender_id,
          budget_max_ngn: null,
          bedrooms: null,
          location: null,
          transaction_type: null,
          offer_details: null,
          owner_agent_id: "AGENT-007",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await docRef.set(newLead);
        state.leads[lead_id] = newLead;
        return newLead;
      } catch (err) {
        console.error('Firestore getOrCreateLead error:', err.message);
      }
    }

    let existing = Object.values(state.leads).find(l => l.channel_id === channel_id && l.sender_id === sender_id);
    if (!existing) {
      existing = {
        lead_id,
        channel_id,
        sender_id,
        budget_max_ngn: null,
        bedrooms: null,
        location: null,
        transaction_type: null,
        offer_details: null,
        owner_agent_id: "AGENT-007",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      state.leads[lead_id] = existing;
      saveLocalState();
    }
    return existing;
  },

  updateLead: async (lead_id, fields) => {
    const db = getFirestore();
    const updated_at = new Date().toISOString();

    if (db) {
      try {
        const docRef = db.collection('leads').doc(lead_id);
        await docRef.set({ ...fields, lead_id, updated_at }, { merge: true });
        const doc = await docRef.get();
        state.leads[lead_id] = doc.data();
        return doc.data();
      } catch (err) {
        console.error('Firestore updateLead error:', err.message);
      }
    }

    let lead = state.leads[lead_id] || { lead_id, created_at: updated_at };
    Object.assign(lead, fields, { updated_at });
    state.leads[lead_id] = lead;
    saveLocalState();
    return lead;
  },

  getLeadById: async (lead_id) => {
    const db = getFirestore();
    if (db) {
      try {
        const doc = await db.collection('leads').doc(lead_id).get();
        if (doc.exists) return doc.data();
      } catch (err) {}
    }
    return state.leads[lead_id];
  },

  // Bookings
  createBooking: async (lead_id, property_id, slot_time) => {
    const db = getFirestore();
    const booking_id = `BK-${Math.floor(100 + Math.random() * 900)}`;
    const property = state.properties.find(p => p.property_id.toUpperCase() === (property_id || '').toUpperCase());

    const booking = {
      booking_id,
      lead_id,
      property_id,
      property_title: property ? property.title : property_id,
      property_location: property ? property.location : "Lagos",
      slot_time,
      status: "pending_payment",
      assigned_agent: property ? property.agent : { name: "Agent Tunde", phone: "+2348000000000" },
      created_at: new Date().toISOString()
    };

    if (db) {
      try {
        await db.collection('bookings').doc(booking_id).set(booking);
      } catch (err) {
        console.error('Firestore createBooking error:', err.message);
      }
    }

    state.bookings[booking_id] = booking;
    saveLocalState();
    return booking;
  },

  getBookingById: async (booking_id) => {
    const db = getFirestore();
    if (db) {
      try {
        const doc = await db.collection('bookings').doc(booking_id).get();
        if (doc.exists) return doc.data();
      } catch (err) {}
    }
    return state.bookings[booking_id];
  },

  updateBookingStatus: async (booking_id, status) => {
    const db = getFirestore();
    const confirmed_at = new Date().toISOString();

    if (db) {
      try {
        await db.collection('bookings').doc(booking_id).update({ status, confirmed_at });
      } catch (err) {}
    }

    if (state.bookings[booking_id]) {
      state.bookings[booking_id].status = status;
      state.bookings[booking_id].confirmed_at = confirmed_at;
      saveLocalState();
    }
  },

  // Payments
  createPayment: async (paymentData) => {
    const db = getFirestore();
    const payment = {
      ...paymentData,
      status: "pending",
      created_at: new Date().toISOString()
    };

    if (db) {
      try {
        await db.collection('payments').doc(payment.payment_id).set(payment);
      } catch (err) {
        console.error('Firestore createPayment error:', err.message);
      }
    }

    state.payments[payment.payment_id] = payment;
    saveLocalState();
    return payment;
  },

  getPaymentById: async (payment_id) => {
    const db = getFirestore();
    if (db) {
      try {
        const doc = await db.collection('payments').doc(payment_id).get();
        if (doc.exists) return doc.data();
      } catch (err) {}
    }
    return state.payments[payment_id];
  },

  verifyPayment: async (payment_id, reference) => {
    const db = getFirestore();
    const ref = payment_id || reference;
    const verified_at = new Date().toISOString();
    const receipt_id = `RC-${ref}`;

    if (db) {
      try {
        const docRef = db.collection('payments').doc(ref);
        const doc = await docRef.get();
        let paymentData = doc.exists ? doc.data() : { payment_id: ref, reference: ref, amount_ngn: 5000 };
        
        paymentData.status = "verified_success";
        paymentData.receipt_id = receipt_id;
        paymentData.verified_at = verified_at;
        
        await docRef.set(paymentData, { merge: true });

        if (paymentData.booking_id) {
          await db.collection('bookings').doc(paymentData.booking_id).set({
            status: "confirmed",
            receipt_id: receipt_id,
            confirmed_at: verified_at
          }, { merge: true });
        }

        state.payments[ref] = paymentData;
        return paymentData;
      } catch (err) {
        console.error('Firestore verifyPayment error:', err.message);
      }
    }

    const payment = state.payments[ref] || Object.values(state.payments).find(p => p.reference === ref);
    if (payment) {
      payment.status = "verified_success";
      payment.receipt_id = receipt_id;
      payment.verified_at = verified_at;

      if (payment.booking_id && state.bookings[payment.booking_id]) {
        state.bookings[payment.booking_id].status = "confirmed";
        state.bookings[payment.booking_id].receipt_id = receipt_id;
      }
      saveLocalState();
      return payment;
    }

    return {
      payment_id: ref,
      reference: ref,
      status: "verified_success",
      receipt_id: receipt_id
    };
  },

  // Handoffs
  createHandoff: async (lead_id, reason, summary) => {
    const db = getFirestore();
    const handoff_id = `HD-${Math.floor(100 + Math.random() * 900)}`;
    const handoff = {
      handoff_id,
      lead_id,
      reason,
      summary,
      status: "escalated_to_human",
      assigned_officer: "Senior Closing & Legal Officer",
      created_at: new Date().toISOString()
    };

    if (db) {
      try {
        await db.collection('handoffs').doc(handoff_id).set(handoff);
      } catch (err) {
        console.error('Firestore createHandoff error:', err.message);
      }
    }

    state.handoffs[handoff_id] = handoff;
    saveLocalState();
    return handoff;
  },

  // Full state snapshot for Dashboard inspection
  getAllState: async () => {
    const db = getFirestore();
    if (db) {
      try {
        const [leadsSnap, bookingsSnap, paymentsSnap, handoffsSnap, propertiesSnap] = await Promise.all([
          db.collection('leads').orderBy('created_at', 'desc').limit(50).get(),
          db.collection('bookings').orderBy('created_at', 'desc').limit(50).get(),
          db.collection('payments').orderBy('created_at', 'desc').limit(50).get(),
          db.collection('handoffs').orderBy('created_at', 'desc').limit(50).get(),
          db.collection('properties').get()
        ]);

        if (!propertiesSnap.empty) {
          state.properties = propertiesSnap.docs.map(d => d.data());
        }

        return {
          total_properties: state.properties.length,
          leads: leadsSnap.docs.map(d => d.data()),
          bookings: bookingsSnap.docs.map(d => d.data()),
          payments: paymentsSnap.docs.map(d => d.data()),
          handoffs: handoffsSnap.docs.map(d => d.data()),
          properties: state.properties
        };
      } catch (err) {
        console.error('Firestore getAllState error:', err.message);
      }
    }

    return {
      total_properties: state.properties.length,
      leads: Object.values(state.leads),
      bookings: Object.values(state.bookings),
      payments: Object.values(state.payments),
      handoffs: Object.values(state.handoffs)
    };
  }
};
