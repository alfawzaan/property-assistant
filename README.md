# Property Assistant OS

A backend and visual revenue dashboard for an AI property assistant operating in the Nigerian real estate market (Lagos & Abuja). It handles property search, scheduling physical viewings, collecting logistics fees via Paystack, and escalating complex inquiries to human agents — backed by Google Cloud Firestore.

---

## What’s Inside

- **Live Revenue Dashboard (`/`)**: A clean real-time view of verified Paystack payments, viewing bookings, captured leads, and current inventory.
- **REST Endpoints for AI Tools**: Plugs directly into Chord (or any LLM agent) using the schema in `property-tools.json`.
- **Cloud Firestore Storage**: Persistent storage for properties, leads, inspection bookings, payments, and handoff tickets.
- **Paystack Integration**: Generates checkout links and verifies inspection logistics fees (`₦5,000` residential, `₦10,000` commercial).

---

## Getting Started Locally

### 1. Install dependencies
Make sure you have Node.js (v18+) installed, then run:

```bash
npm install
```

### 2. Set up Firebase & Environment Variables
The app connects to Cloud Firestore using Firebase Admin SDK. You have two easy ways to set this up:

- **Option A (Simplest for local dev):** Drop your Firebase service account key file directly in the project root as `serviceAccountKey.json` (this file is already in `.gitignore`).
- **Option B (Environment variables):** Copy `.env.example` to `.env`:
  ```bash
  cp .env.example .env
  ```
  Fill in your `FIREBASE_SERVICE_ACCOUNT` JSON string (or the individual project ID, email, and private key).

*Optional:* If you want real Paystack checkout links instead of mock links, add your test secret key:
```env
PAYSTACK_SECRET_KEY=sk_test_...
PORT=3000
```

### 3. Start the server

```bash
npm start
```

You should see:
```text
✔ Firebase Firestore connected via local serviceAccountKey.json
Property Assistant OS running on port 3000
Dashboard available at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the live dashboard.

---

## Connecting to Chord / AI Agent

1. **Tools Schema**: The file `property-tools.json` contains the full OpenAPI-style tool definitions (search, slot check, booking, payment generation, payment verification, and human handoff).
2. **Behavior & Policy Rules**: See `SKILL.md` and `references/policies.md` for the agent's tone, fee disclosures, and escalation boundaries.

---

## Deploying to Vercel

The repository is pre-configured for Vercel:
1. Push your code to GitHub and import the repo into Vercel.
2. In the Vercel dashboard (**Settings → Environment Variables**), add:
   - `FIREBASE_SERVICE_ACCOUNT`: The raw JSON string of your Firebase service account.
   - `PAYSTACK_SECRET_KEY`: *(Optional)* Your Paystack Secret Key.
3. Deploy! The serverless function in `api/index.js` routes all incoming requests to `server.js`.
