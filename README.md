# Property Assistant

Backend service and dashboard for the Property Assistant Chord teammate. It handles inventory lookups, inspection bookings, Paystack payments, and escalations, storing everything in Firebase Firestore.

## Quick Start

### 1. Firebase Setup
1. Head over to the [Firebase Console](https://console.firebase.google.com/) and create a project (or use an existing one).
2. In the left sidebar, go to **Build** > **Firestore Database** and click **Create database**.
3. Open **Project Settings** (the gear icon at the top left) and go to the **Service accounts** tab.
4. Click **Generate new private key** and download the JSON file.
5. Rename the downloaded file to `serviceAccountKey.json` and move it into the root of this project. It is already added to `.gitignore`, so it won't be committed to Git.

### 2. Install & Run
```bash
npm install
npm start
```
The server starts up at `http://localhost:3000`. Open that in your browser to view the live dashboard showing bookings, leads, payments, and property inventory.

### 3. Optional: Real Paystack Keys
By default, the server generates mock payment links for testing. If you want to test live or test-mode Paystack checkout pages, copy `.env.example` to `.env` and add your secret key:

```bash
cp .env.example .env
```
```env
PAYSTACK_SECRET_KEY=sk_test_xxxx
```

## Connecting to Chord
- **Tools**: Import `property-tools.json` into Chord to give the agent access to the backend routes while you ensure that you update the server.url key to your server base URL if you are deploying to your own server.
- **Agent Instructions**: See `SKILL.md`, `references/faq.md` and `references/policies.md` for guidelines on tone, inspection fees, and human escalation handoffs.

## Development & AI Tooling
- **ChatGPT**: Used during the initial research phase to identify high-value business operations that could be automated to prevent costly revenue leaks, helping narrow the focus down to structured real estate developers and brokerages.
- **Chord Teammate Assistant direct message**: Used to understand how specific parts of the Chord framework operate and clarify expected teammate behaviors.
- **Google Antigravity**: Used as the agentic coding and implementation assistant to develop, test, and refactor the backend REST API, Firestore data layer, Paystack flow, and live revenue dashboard, as well as refining and formatting submission documents from raw drafts.

## Deploying to Vercel
1. Push your code to GitHub and import the project into Vercel.
2. Under **Project Settings** > **Environment Variables**, add:
   - `FIREBASE_SERVICE_ACCOUNT`: Copy the entire contents of your `serviceAccountKey.json` and paste it here as a single value.
   - `PAYSTACK_SECRET_KEY`: *(Optional)* Your Paystack secret key.
3. Deploy. The file `api/index.js` routes all incoming requests to `server.js`.
