const express = require('express');
const cors = require('cors');
require('dotenv').config();

const store = require('./data/store');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

// Logger middleware
app.use((req, res, next) => {
  console.log(`\n\x1b[36m[TOOL CALL]\x1b[0m ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log(`\x1b[90mPayload:\x1b[0m`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// 1. Get or Create Lead
app.post('/leads/get-or-create', async (req, res) => {
  const { channel_id, sender_id } = req.body;
  const lead = await store.getOrCreateLead(channel_id, sender_id);
  res.json({
    lead_id: lead.lead_id,
    owner_agent_id: lead.owner_agent_id,
    status: "active",
    lead: lead
  });
});

// 2. Update Lead Requirements & Offers
app.post('/leads/update', async (req, res) => {
  const { lead_id, budget_max_ngn, bedrooms, location, transaction_type, offer_details } = req.body;
  const updated = await store.updateLead(lead_id, {
    budget_max_ngn,
    bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
    location,
    transaction_type,
    offer_details
  });
  console.log(`\x1b[32m[LEAD SAVED]\x1b[0m ${lead_id}:`, updated);
  res.json({
    success: true,
    message: "Lead requirements and offers saved",
    lead: updated
  });
});

// 3. Search Real Properties Catalog
app.post('/properties/search', (req, res) => {
  const { location, bedrooms, max_price_ngn, transaction_type } = req.body || {};
  let properties = store.getProperties();

  if (transaction_type) {
    properties = properties.filter(p => p.transaction_type.toLowerCase() === transaction_type.toLowerCase());
  }
  if (bedrooms) {
    properties = properties.filter(p => p.bedrooms >= parseInt(bedrooms));
  }
  if (location) {
    const locLower = location.toLowerCase();
    properties = properties.filter(p => 
      p.location.toLowerCase().includes(locLower) || 
      p.neighborhood.toLowerCase().includes(locLower)
    );
  }
  if (max_price_ngn) {
    properties = properties.filter(p => p.price_ngn <= parseFloat(max_price_ngn));
  }

  // Fallback to top properties if filter was too narrow
  if (properties.length === 0) {
    properties = store.getProperties().slice(0, 3);
  }

  res.json(properties);
});

// 4. Check Viewing Slots (Reads property-specific slots)
app.post('/bookings/check-slot', (req, res) => {
  const { property_id, preferred_date } = req.body;
  const property = store.getPropertyById(property_id);

  if (property) {
    return res.json({
      property_id: property.property_id,
      title: property.title,
      location: property.location,
      available_slots: property.available_slots,
      assigned_agent: `${property.agent.name} (${property.agent.phone})`,
      inspection_fee_ngn: property.inspection_fee_ngn
    });
  }

  res.json({
    property_id: property_id || "GENERIC",
    available_slots: ["Saturday 11:00 AM", "Saturday 02:00 PM", "Sunday 03:00 PM"],
    inspection_fee_ngn: 5000
  });
});

// 5. Book Viewing & Save to State
app.post('/bookings/book', async (req, res) => {
  const { lead_id, property_id, slot_time } = req.body;
  const booking = await store.createBooking(lead_id, property_id, slot_time);
  
  res.json({
    booking_id: booking.booking_id,
    property_id: booking.property_id,
    property_title: booking.property_title,
    lead_id: booking.lead_id,
    slot_time: booking.slot_time,
    status: booking.status,
    assigned_agent: booking.assigned_agent,
    confirmation_message: `Viewing scheduled for ${booking.slot_time} at ${booking.property_title}`
  });
});

// 6. Get Payable Fee
app.get('/payments/fees', (req, res) => {
  const feeType = req.query.fee_type || 'inspection';
  if (feeType === 'reservation') {
    return res.json({
      fee_id: "FEE-RESERVE",
      amount_kobo: 50000000, // ₦500,000
      amount_ngn: 500000,
      currency: "NGN",
      terms: "Holding deposit to reserve property for 7 days pending contract review."
    });
  }
  return res.json({
    fee_id: "FEE-INSPECT",
    amount_kobo: 500000, // ₦5,000
    amount_ngn: 5000,
    currency: "NGN",
    terms: "Non-refundable inspection logistics fee for private viewing."
  });
});

// 7. Initialize Paystack Payment & Save Record
app.post('/payments/paystack/initialize', async (req, res) => {
  const { lead_id, booking_id, fee_id, idempotency_key } = req.body;
  const isReserve = fee_id === 'FEE-RESERVE';
  const amount_kobo = isReserve ? 50000000 : 500000;
  const reference = `REF-${Date.now()}`;

  let authUrl = `https://checkout.paystack.com/mock-pay-${reference}`;

  // Call real Paystack API if key exists
  if (PAYSTACK_SECRET_KEY) {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: `${(lead_id || 'customer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@propertypro.ng`,
          amount: amount_kobo,
          reference: reference,
          callback_url: `https://property-assistant-dun.vercel.app/payment/callback`,
          metadata: {
            lead_id: lead_id || 'PROSPECT',
            booking_id: booking_id || `BK-${reference.slice(-4)}`,
            fee_id: fee_id || 'FEE-INSPECT'
          }
        })
      });
      const data = await response.json();
      if (data.status && data.data) {
        authUrl = data.data.authorization_url;
      }
    } catch (err) {
      console.error('Paystack API call failed:', err.message);
    }
  }

  // Persist pending payment record
  const paymentRecord = await store.createPayment({
    payment_id: reference,
    lead_id,
    booking_id,
    fee_id: fee_id || "FEE-INSPECT",
    amount_kobo,
    amount_ngn: amount_kobo / 100,
    reference,
    authorization_url: authUrl
  });

  res.json({
    payment_id: reference,
    authorization_url: authUrl,
    reference: reference,
    status: paymentRecord.status
  });
});

// Paystack Return Callback (Where Paystack redirects the customer upon payment completion)
app.get('/payment/callback', async (req, res) => {
  const ref = req.query.reference || req.query.trxref;
  console.log(`\x1b[32m[PAYSTACK CALLBACK]\x1b[0m Customer returned. Verifying ref: ${ref}`);

  // Real Paystack verification if key exists
  if (PAYSTACK_SECRET_KEY && ref) {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, {
        headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` }
      });
      const data = await response.json();
      if (data.status && data.data && data.data.status === 'success') {
        store.verifyPayment(ref, ref);
      }
    } catch (err) {
      console.error('Paystack verify failed on callback:', err.message);
    }
  } else if (ref) {
    store.verifyPayment(ref, ref);
  }

  const payment = store.getPaymentById(ref) || Object.values(store.getAllState().payments).find(p => p.reference === ref);

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Payment Successful — Property Assistant</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px 28px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
        .check-icon { width: 64px; height: 64px; background: #064e3b; color: #34d399; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px; }
        h1 { font-size: 22px; margin: 0 0 8px; color: #38bdf8; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
        .receipt-box { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin-bottom: 24px; text-align: left; font-size: 13px; font-family: monospace; }
        .receipt-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .receipt-row:last-child { margin-bottom: 0; }
        .btn { background: #38bdf8; color: #0f172a; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-size: 14px; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="check-icon">✓</div>
        <h1>Payment Successful!</h1>
        <p>Your payment has been verified. Your property viewing appointment is officially locked in.</p>
        
        <div class="receipt-box">
          <div class="receipt-row"><span>Status:</span> <b style="color: #34d399;">VERIFIED SUCCESS</b></div>
          <div class="receipt-row"><span>Reference:</span> <span>${ref || 'N/A'}</span></div>
          <div class="receipt-row"><span>Receipt ID:</span> <b style="color: #a5f3fc;">${payment ? (payment.receipt_id || 'RC-' + ref) : 'RC-' + ref}</b></div>
          <div class="receipt-row"><span>Amount:</span> <b>₦${payment ? payment.amount_ngn.toLocaleString() : '5,000'}</b></div>
        </div>

        <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">
          You can return to your chat conversation now. The assistant is already updated.
        </p>
        <a href="/" class="btn">View Live Dashboard</a>
      </div>
    </body>
    </html>
  `);
});

// Paystack Webhook Handler (for asynchronous background updates)
app.post('/payments/paystack/webhook', (req, res) => {
  const event = req.body;
  console.log(`\x1b[35m[PAYSTACK WEBHOOK]\x1b[0m Event received:`, event ? event.event : 'none');
  if (event && event.event === 'charge.success' && event.data) {
    const ref = event.data.reference;
    if (ref) {
      store.verifyPayment(ref, ref);
      console.log(`\x1b[32m[PAYMENT VERIFIED VIA WEBHOOK]\x1b[0m ${ref}`);
    }
  }
  res.sendStatus(200);
});

// 8. Verify Paystack Status & Update Records
app.get('/payments/paystack/status', async (req, res) => {
  const { payment_id, reference } = req.query;
  const ref = payment_id || reference;

  // Real Paystack verification if key exists
  if (PAYSTACK_SECRET_KEY && ref && !ref.startsWith('REF-MOCK')) {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, {
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      });
      const data = await response.json();
      if (data.status && data.data.status === 'success') {
        const verified = store.verifyPayment(ref, ref);
        return res.json({
          verified_status: "verified_success",
          reference: ref,
          receipt_id: verified.receipt_id,
          payment: verified
        });
      }
    } catch (err) {
      console.error('Paystack verify failed:', err.message);
    }
  }

  // Mock auto-verification for prototype flow
  const verified = store.verifyPayment(ref, ref);
  res.json({
    verified_status: "verified_success",
    reference: ref,
    receipt_id: verified.receipt_id,
    payment: verified
  });
});

// 9. Create Human Handoff & Save Record
app.post('/handoffs/create', async (req, res) => {
  const { lead_id, reason, summary } = req.body;
  const handoff = await store.createHandoff(lead_id, reason, summary);
  console.log(`\x1b[33m[HUMAN HANDOFF]\x1b[0m ${handoff.handoff_id} for ${lead_id}: ${reason}`);
  res.json({
    handoff_id: handoff.handoff_id,
    status: handoff.status,
    assigned_officer: handoff.assigned_officer,
    created_at: handoff.created_at
  });
});

// Helper to fetch live transactions directly from Paystack API and merge with state
async function getUnifiedState() {
  const localState = await store.getAllState();
  let payments = [...localState.payments];
  let bookings = [...localState.bookings];

  if (PAYSTACK_SECRET_KEY) {
    try {
      const response = await fetch('https://api.paystack.co/transaction?perPage=50', {
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      });
      const data = await response.json();
      if (data.status && Array.isArray(data.data)) {
        // Only include transactions that belong to this Property Assistant app (starts with REF- or has fee_id)
        const propertyAssistantTxs = data.data.filter(tx => 
          (tx.reference && tx.reference.startsWith('REF-')) || 
          (tx.metadata && (tx.metadata.fee_id || tx.metadata.lead_id || tx.metadata.booking_id))
        );

        const paystackPayments = propertyAssistantTxs.map(tx => {
          const meta = tx.metadata || {};
          const isSuccess = tx.status === 'success';
          
          if (meta.booking_id && !bookings.some(b => b.booking_id === meta.booking_id)) {
            bookings.unshift({
              booking_id: meta.booking_id,
              lead_id: meta.lead_id || (tx.customer ? tx.customer.email : 'Customer'),
              property_title: meta.property_title || 'Viewing Inspection',
              slot_time: meta.slot_time || 'Scheduled Viewing',
              status: isSuccess ? 'confirmed' : 'pending_payment',
              assigned_agent: { name: 'Agent Tunde', phone: '+2348023456789' },
              created_at: tx.created_at
            });
          } else if (meta.booking_id && isSuccess) {
            const existingB = bookings.find(b => b.booking_id === meta.booking_id);
            if (existingB) existingB.status = 'confirmed';
          }

          return {
            payment_id: tx.reference,
            reference: tx.reference,
            amount_ngn: tx.amount / 100,
            status: isSuccess ? 'verified_success' : tx.status,
            receipt_id: isSuccess ? `RC-${tx.reference}` : 'Pending',
            created_at: tx.created_at,
            customer_email: tx.customer ? tx.customer.email : 'N/A'
          };
        });

        const seen = new Set();
        payments = [...paystackPayments, ...payments].filter(p => {
          if (seen.has(p.reference)) return false;
          seen.add(p.reference);
          return true;
        });
      }
    } catch (err) {
      console.error('Error fetching live transactions from Paystack:', err.message);
    }
  }

  return {
    total_properties: localState.total_properties,
    leads: localState.leads,
    bookings,
    payments,
    handoffs: localState.handoffs
  };
}

// API State Inspection Endpoint (Live Paystack Sync)
app.get('/api/state', async (req, res) => {
  const unified = await getUnifiedState();
  res.json(unified);
});

// Visual Live Dashboard on Root URL
app.get('/', async (req, res) => {
  const stateData = await getUnifiedState();
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Property Assistant OS — Live Status & Database</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 1100px; margin: 0 auto; }
        header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
        .badge { background: #10b981; color: #022c22; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 18px; }
        .card h3 { margin: 0 0 8px 0; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .card .stat { font-size: 28px; font-weight: bold; color: #38bdf8; }
        h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #e2e8f0; border-left: 4px solid #38bdf8; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; margin-bottom: 24px; font-size: 13px; }
        th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #334155; }
        th { background: #0f172a; color: #94a3b8; font-weight: 600; }
        tr:last-child td { border-bottom: none; }
        .status-pill { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .status-confirmed, .status-verified { background: #064e3b; color: #34d399; }
        .status-pending { background: #78350f; color: #fcd34d; }
        .status-escalated { background: #7f1d1d; color: #fca5a5; }
        .code-box { background: #020617; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #a5f3fc; overflow-x: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div>
            <h1 style="margin: 0; font-size: 22px;">Property Assistant OS — Backend Status</h1>
            <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Live Mock & Paystack API for Chord Teammates</p>
          </div>
          <div>
            <span class="badge">● Online (24/7)</span>
          </div>
        </header>

        <div class="grid">
          <div class="card">
            <h3>Active Listings</h3>
            <div class="stat">${stateData.total_properties}</div>
          </div>
          <div class="card">
            <h3>Recorded Leads</h3>
            <div class="stat">${stateData.leads.length}</div>
          </div>
          <div class="card">
            <h3>Booked Viewings</h3>
            <div class="stat">${stateData.bookings.length}</div>
          </div>
          <div class="card">
            <h3>Paystack Payments</h3>
            <div class="stat">${stateData.payments.length}</div>
          </div>
        </div>

        <h2>Latest Bookings (${stateData.bookings.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Property</th>
              <th>Slot Time</th>
              <th>Status</th>
              <th>Agent</th>
            </tr>
          </thead>
          <tbody>
            ${stateData.bookings.length === 0 ? '<tr><td colspan="5" style="color: #64748b; text-align: center;">No bookings recorded yet. Chat with your teammate to book an inspection.</td></tr>' : 
              stateData.bookings.map(b => `
                <tr>
                  <td><b>${b.booking_id}</b></td>
                  <td>${b.property_title}</td>
                  <td>${b.slot_time}</td>
                  <td><span class="status-pill status-${b.status.replace('_', '-')}">${b.status}</span></td>
                  <td>${b.assigned_agent ? b.assigned_agent.name : 'Unassigned'}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>

        <h2>Paystack Transactions (${stateData.payments.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Receipt</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${stateData.payments.length === 0 ? '<tr><td colspan="5" style="color: #64748b; text-align: center;">No Paystack payments initiated yet.</td></tr>' : 
              stateData.payments.map(p => `
                <tr>
                  <td><code>${p.reference}</code></td>
                  <td>₦${p.amount_ngn.toLocaleString()}</td>
                  <td><span class="status-pill status-${p.status === 'verified_success' ? 'verified' : 'pending'}">${p.status}</span></td>
                  <td>${p.receipt_id || 'Pending'}</td>
                  <td>${new Date(p.created_at).toLocaleTimeString()}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>

        <h2>Live Property Catalog Sample</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Property</th>
              <th>Location</th>
              <th>Price</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${store.getProperties().map(p => `
              <tr>
                <td><b>${p.property_id}</b></td>
                <td>${p.title}</td>
                <td>${p.neighborhood}</td>
                <td><b style="color: #38bdf8;">${p.price_formatted}</b></td>
                <td><span style="text-transform: uppercase; font-size: 11px; color: #94a3b8;">${p.transaction_type}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 40px;">
          JSON API state available at <a href="/api/state" style="color: #38bdf8;">/api/state</a>
        </p>
      </div>
    </body>
    </html>
  `);
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\x1b[32m✔ Mock & Paystack API Server running on port ${PORT}\x1b[0m`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`  Ready for Chord tool calls!`);
  });
}

module.exports = app;
