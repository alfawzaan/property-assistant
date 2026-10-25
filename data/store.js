const { getFirestore } = require('./firebase');

// In-memory cache synced with Cloud Firestore
let state = {
  properties: [],
  leads: {},
  bookings: {},
  payments: {},
  handoffs: {}
};

function saveLocalState() {}

// Sync properties from Cloud Firestore if connected
async function syncPropertiesFromFirestore() {
  const db = getFirestore();
  if (db) {
    try {
      const snap = await db.collection('properties').get();
      if (!snap.empty) {
        state.properties = snap.docs.map(doc => doc.data());
      }
    } catch (err) {
      console.error('Firestore syncProperties error:', err.message);
    }
  }
}
syncPropertiesFromFirestore();

module.exports = {
  getProperties: async () => {
    if (!state.properties || state.properties.length === 0) {
      await syncPropertiesFromFirestore();
    }
    return state.properties;
  },
  syncProperties: syncPropertiesFromFirestore,
  getPropertyById: async (id) => {
    if (!state.properties || state.properties.length === 0) {
      await syncPropertiesFromFirestore();
    }
    const cleanId = (id || '').toUpperCase();
    let prop = state.properties.find(p => (p.property_id || '').toUpperCase() === cleanId);
    if (!prop) {
      const db = getFirestore();
      if (db) {
        try {
          const doc = await db.collection('properties').doc(cleanId).get();
          if (doc.exists) {
            prop = doc.data();
          }
        } catch (err) {}
      }
    }
    return prop;
  },

  // Leads
  getOrCreateLead: async (channel_id, sender_id) => {
    const db = getFirestore();
    let lead_id;
    if (sender_id && sender_id !== 'PROSPECT' && sender_id !== 'user' && sender_id.length >= 4) {
      const clean = sender_id.replace(/[^a-zA-Z0-9]/g, '');
      lead_id = `LEAD-${(clean.slice(-4) || 'USER').toUpperCase()}`;
    } else {
      lead_id = `LEAD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

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
          channel_id: channel_id || 'whatsapp',
          sender_id: sender_id || '+2348000000000',
          customer_email: `${lead_id.toLowerCase()}@propertypro.ng`,
          budget_max_ngn: null,
          bedrooms: null,
          location: null,
          transaction_type: null,
          offer_details: null,
          owner_agent_id: "Chioma Eze",
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
        channel_id: channel_id || 'whatsapp',
        sender_id: sender_id || '+2348000000000',
        customer_email: `${lead_id.toLowerCase()}@propertypro.ng`,
        budget_max_ngn: null,
        bedrooms: null,
        location: null,
        transaction_type: null,
        offer_details: null,
        owner_agent_id: "Chioma Eze",
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
        const doc = await docRef.get();
        const existingData = doc.exists ? doc.data() : { lead_id, created_at: updated_at };
        const merged = { ...existingData, ...fields, lead_id, updated_at };
        await docRef.set(merged, { merge: true });
        state.leads[lead_id] = merged;
        return merged;
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
    const property = await module.exports.getPropertyById(property_id);

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
      customer_email: paymentData.customer_email || `${(paymentData.lead_id || 'customer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@propertypro.ng`,
      channel: paymentData.channel || 'CARD',
      gateway_response: paymentData.gateway_response || 'Pending',
      status: paymentData.status || "pending",
      created_at: paymentData.created_at || new Date().toISOString()
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
        paymentData.gateway_response = "Successful";
        
        await docRef.set(paymentData, { merge: true });

        if (paymentData.booking_id) {
          const bookingDocRef = db.collection('bookings').doc(paymentData.booking_id);
          const bookingDoc = await bookingDocRef.get();
          const existingBooking = bookingDoc.exists ? bookingDoc.data() : {};
          const updatedBooking = {
            ...existingBooking,
            booking_id: paymentData.booking_id,
            lead_id: existingBooking.lead_id || paymentData.lead_id || 'PROSPECT',
            property_title: existingBooking.property_title || paymentData.property_title || 'Private Viewing Inspection',
            property_location: existingBooking.property_location || paymentData.property_location || 'Lekki / Ikoyi',
            slot_time: existingBooking.slot_time || 'Scheduled Viewing Slot',
            amount_ngn: existingBooking.amount_ngn || paymentData.amount_ngn || 5000,
            assigned_agent: existingBooking.assigned_agent || { name: 'Chioma Eze', phone: '+234 803 987 6543' },
            status: "confirmed",
            receipt_id: receipt_id,
            created_at: existingBooking.created_at || paymentData.created_at || verified_at,
            confirmed_at: verified_at
          };
          await bookingDocRef.set(updatedBooking, { merge: true });
          state.bookings[paymentData.booking_id] = updatedBooking;
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
  createHandoff: async (lead_id, reason, summary, extra = {}) => {
    const db = getFirestore();
    const handoff_id = `HD-${Math.floor(100 + Math.random() * 900)}`;
    const handoff = {
      handoff_id,
      lead_id,
      property_id: extra.property_id || null,
      contact_info: extra.contact_info || null,
      urgency: extra.urgency || "standard",
      reason,
      summary,
      status: "escalated_to_human",
      assigned_officer: extra.assigned_officer || "Senior Closing & Legal Officer",
      confirmation_message: `Your escalation has been logged under ticket #${handoff_id}. Our Senior Closing & Legal Officer has been notified and will reach out shortly.`,
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
          db.collection('leads').get(),
          db.collection('bookings').get(),
          db.collection('payments').get(),
          db.collection('handoffs').get(),
          db.collection('properties').get()
        ]);

        const sortByDate = (docs) => docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data };
        }).sort((a, b) => new Date(b.created_at || b.updated_at || b.confirmed_at || 0) - new Date(a.created_at || a.updated_at || a.confirmed_at || 0));

        const leads = sortByDate(leadsSnap.docs);
        const bookings = sortByDate(bookingsSnap.docs);
        const payments = sortByDate(paymentsSnap.docs);
        const handoffs = sortByDate(handoffsSnap.docs);

        if (!propertiesSnap.empty) {
          state.properties = propertiesSnap.docs.map(d => d.data());
        }

        return {
          total_properties: state.properties.length,
          leads,
          bookings,
          payments,
          handoffs,
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
