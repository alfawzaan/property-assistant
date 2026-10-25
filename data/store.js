const fs = require('fs');
const path = require('path');

const STATE_FILE = process.env.VERCEL ? path.join('/tmp', 'state.json') : path.join(__dirname, 'state.json');
const PROPERTIES = require('./properties.json');

// Initial default state
let state = {
  properties: PROPERTIES,
  leads: {},
  bookings: {},
  payments: {},
  handoffs: {}
};

// Load saved state if available (for local persistence)
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      state.leads = parsed.leads || {};
      state.bookings = parsed.bookings || {};
      state.payments = parsed.payments || {};
      state.handoffs = parsed.handoffs || {};
    }
  } catch (err) {
    console.warn('Could not load persistent state file, using in-memory state.');
  }
}

// Save state to file (silently ignore in read-only serverless environments)
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      leads: state.leads,
      bookings: state.bookings,
      payments: state.payments,
      handoffs: state.handoffs
    }, null, 2));
  } catch (err) {
    // Expected in Vercel serverless read-only filesystem
  }
}

loadState();

module.exports = {
  // Properties
  getProperties: () => state.properties,
  getPropertyById: (id) => state.properties.find(p => p.property_id.toUpperCase() === (id || '').toUpperCase()),
  
  // Leads
  getOrCreateLead: (channel_id, sender_id) => {
    const key = `${channel_id}:${sender_id}`;
    let existing = Object.values(state.leads).find(l => l.channel_id === channel_id && l.sender_id === sender_id);
    if (!existing) {
      const lead_id = `LEAD-${(sender_id || 'PROSPECT').slice(-4).toUpperCase()}`;
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
      saveState();
    }
    return existing;
  },

  updateLead: (lead_id, fields) => {
    let lead = state.leads[lead_id];
    if (!lead) {
      lead = {
        lead_id,
        created_at: new Date().toISOString()
      };
      state.leads[lead_id] = lead;
    }
    Object.assign(lead, fields, { updated_at: new Date().toISOString() });
    saveState();
    return lead;
  },

  getLeadById: (lead_id) => state.leads[lead_id],

  // Bookings
  createBooking: (lead_id, property_id, slot_time) => {
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
    state.bookings[booking_id] = booking;
    saveState();
    return booking;
  },

  getBookingById: (booking_id) => state.bookings[booking_id],

  updateBookingStatus: (booking_id, status) => {
    if (state.bookings[booking_id]) {
      state.bookings[booking_id].status = status;
      state.bookings[booking_id].confirmed_at = new Date().toISOString();
      saveState();
    }
  },

  // Payments
  createPayment: (paymentData) => {
    state.payments[paymentData.payment_id] = {
      ...paymentData,
      status: "pending",
      created_at: new Date().toISOString()
    };
    saveState();
    return state.payments[paymentData.payment_id];
  },

  getPaymentById: (payment_id) => state.payments[payment_id],

  verifyPayment: (payment_id, reference) => {
    const payment = state.payments[payment_id] || Object.values(state.payments).find(p => p.reference === reference);
    if (payment) {
      payment.status = "verified_success";
      payment.receipt_id = `RC-${payment.reference || Math.floor(1000 + Math.random() * 9000)}`;
      payment.verified_at = new Date().toISOString();
      
      // Auto-confirm associated booking if present
      if (payment.booking_id && state.bookings[payment.booking_id]) {
        state.bookings[payment.booking_id].status = "confirmed";
        state.bookings[payment.booking_id].receipt_id = payment.receipt_id;
      }
      saveState();
      return payment;
    }
    // Return standard verified mock if not found in session
    return {
      payment_id,
      reference: reference || payment_id,
      status: "verified_success",
      receipt_id: `RC-${payment_id}`
    };
  },

  // Handoffs
  createHandoff: (lead_id, reason, summary) => {
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
    state.handoffs[handoff_id] = handoff;
    saveState();
    return handoff;
  },

  // Full state snapshot for Dashboard inspection
  getAllState: () => ({
    total_properties: state.properties.length,
    leads: Object.values(state.leads),
    bookings: Object.values(state.bookings),
    payments: Object.values(state.payments),
    handoffs: Object.values(state.handoffs)
  })
};
