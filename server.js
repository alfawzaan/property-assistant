const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

// Logger middleware to see Chord triggering tools live in terminal
app.use((req, res, next) => {
  console.log(`\n\x1b[36m[TOOL CALL]\x1b[0m ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log(`\x1b[90mPayload:\x1b[0m`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// Mock Property Database
const PROPERTIES = [
  {
    property_id: "IK-402",
    title: "4-Bedroom Luxury Terrace with BQ",
    location: "Parkview Estate, Ikoyi",
    bedrooms: 4,
    price_ngn: 240000000,
    transaction_type: "buy",
    available: true
  },
  {
    property_id: "IK-405",
    title: "4-Bedroom Serviced Duplex",
    location: "Old Ikoyi (Off Bourdillon)",
    bedrooms: 4,
    price_ngn: 250000000,
    transaction_type: "buy",
    available: true
  },
  {
    property_id: "LK-301",
    title: "3-Bedroom Contemporary Flat",
    location: "Admiralty Way, Lekki Phase 1",
    bedrooms: 3,
    price_ngn: 7500000,
    transaction_type: "rent",
    available: true
  },
  {
    property_id: "LK-304",
    title: "3-Bedroom Waterfront Apartment",
    location: "Off Freedom Way, Lekki Phase 1",
    bedrooms: 3,
    price_ngn: 8000000,
    transaction_type: "rent",
    available: true
  }
];

// 1. Get or Create Lead
app.post('/leads/get-or-create', (req, res) => {
  const { channel_id, sender_id } = req.body;
  const lead_id = `LEAD-${(sender_id || 'PROSPECT').slice(-4).toUpperCase()}`;
  res.json({
    lead_id: lead_id,
    owner_agent_id: "AGENT-007",
    status: "active"
  });
});

// 2. Update Lead Requirements
app.post('/leads/update', (req, res) => {
  const { lead_id, budget_max_ngn, bedrooms, location, transaction_type, offer_details } = req.body;
  console.log(`\x1b[32m[LEAD SAVED]\x1b[0m ${lead_id}: ${transaction_type || 'search'} in ${location || 'any'} | ₦${budget_max_ngn || 'flexible'}`);
  res.json({
    success: true,
    message: "Requirements successfully updated",
    lead_id
  });
});

// 3. Search Properties
app.post('/properties/search', (req, res) => {
  const { location, bedrooms, max_price_ngn, transaction_type } = req.body || {};

  let results = PROPERTIES;
  if (transaction_type) {
    results = results.filter(p => p.transaction_type.toLowerCase() === transaction_type.toLowerCase());
  }
  if (bedrooms) {
    results = results.filter(p => p.bedrooms === parseInt(bedrooms));
  }
  if (location) {
    const locLower = location.toLowerCase();
    results = results.filter(p => p.location.toLowerCase().includes(locLower));
  }
  if (max_price_ngn) {
    results = results.filter(p => p.price_ngn <= parseFloat(max_price_ngn));
  }

  // If strict filtering returned nothing, return top 2 for prototype demo
  if (results.length === 0) {
    results = PROPERTIES.slice(0, 2);
  }

  res.json(results);
});

// 4. Check Viewing Slots
app.post('/bookings/check-slot', (req, res) => {
  const { property_id, preferred_date } = req.body;
  res.json({
    property_id,
    date: preferred_date || "Upcoming Saturday",
    available_slots: ["11:00 AM", "02:00 PM", "04:30 PM"],
    agent_assigned: "Agent Tunde (Ikoyi/Lekki Specialist)"
  });
});

// 5. Book Viewing
app.post('/bookings/book', (req, res) => {
  const { lead_id, property_id, slot_time } = req.body;
  const booking_id = `BK-${Math.floor(100 + Math.random() * 900)}`;
  res.json({
    booking_id,
    property_id,
    lead_id,
    slot_time,
    status: "confirmed",
    confirmation_message: `Viewing scheduled for ${slot_time}`
  });
});

// 6. Get Payable Fee
app.get('/payments/fees', (req, res) => {
  const feeType = req.query.fee_type || 'inspection';
  if (feeType === 'reservation') {
    return res.json({
      fee_id: "FEE-RESERVE",
      amount_kobo: 50000000, // ₦500,000
      currency: "NGN",
      terms: "Holding deposit to reserve property for 7 days pending contract review."
    });
  }
  return res.json({
    fee_id: "FEE-INSPECT",
    amount_kobo: 500000, // ₦5,000
    currency: "NGN",
    terms: "Non-refundable inspection logistics fee for private viewing."
  });
});

// 7. Initialize Paystack Payment
app.post('/payments/paystack/initialize', async (req, res) => {
  const { lead_id, fee_id, idempotency_key } = req.body;
  const amount_kobo = (fee_id === 'FEE-RESERVE') ? 50000000 : 500000;
  const reference = `REF-${Date.now()}`;

  // If real Paystack API key is supplied in .env
  if (PAYSTACK_SECRET_KEY) {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: `${lead_id.toLowerCase()}@example.com`,
          amount: amount_kobo,
          reference: reference,
          callback_url: 'https://checkout.paystack.com'
        })
      });
      const data = await response.json();
      if (data.status) {
        return res.json({
          payment_id: reference,
          authorization_url: data.data.authorization_url,
          reference: reference
        });
      }
    } catch (err) {
      console.error('Paystack API call failed:', err.message);
    }
  }

  // Mock Paystack URL for local prototype testing
  res.json({
    payment_id: reference,
    authorization_url: `https://checkout.paystack.com/mock-pay-${reference}`,
    reference: reference,
    note: "Mock checkout URL. Add PAYSTACK_SECRET_KEY in .env for live test payments."
  });
});

// 8. Verify Paystack Status
app.get('/payments/paystack/status', async (req, res) => {
  const { payment_id } = req.query;

  if (PAYSTACK_SECRET_KEY && payment_id && !payment_id.startsWith('REF-MOCK')) {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${payment_id}`, {
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      });
      const data = await response.json();
      if (data.status && data.data.status === 'success') {
        return res.json({
          verified_status: "verified_success",
          reference: payment_id,
          receipt_id: `RC-${payment_id}`
        });
      }
    } catch (err) {
      console.error('Paystack verify failed:', err.message);
    }
  }

  // Mock status: always return verified_success for testing conversation completion
  res.json({
    verified_status: "verified_success",
    reference: payment_id || "REF-DEMO-SUCCESS",
    receipt_id: `RC-${payment_id || 'DEMO-881'}`
  });
});

// 9. Create Human Handoff
app.post('/handoffs/create', (req, res) => {
  const { lead_id, reason, summary } = req.body;
  const handoff_id = `HD-${Math.floor(100 + Math.random() * 900)}`;
  console.log(`\x1b[33m[HUMAN HANDOFF]\x1b[0m ${handoff_id} for ${lead_id}: ${reason}`);
  res.json({
    handoff_id,
    status: "escalated_to_agent",
    assigned_officer: "Senior Legal & Closing Officer"
  });
});

// Root Health Check
app.get('/', (req, res) => {
  res.send({ status: 'online', service: 'Property Assistant API Tools' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\x1b[32m✔ Mock & Paystack API Server running on port ${PORT}\x1b[0m`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`  Ready for Chord tool calls!`);
  });
}

module.exports = app;
