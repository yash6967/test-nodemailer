# ✉️ MERN Nodemailer Cloud Diagnostic Suite

A dedicated MERN stack project specifically crafted to test **Nodemailer**, debug local vs. hosted environments, and resolve common deployment failures when hosting on **Render (Backend)** and **Vercel (Frontend)**.

---

## 📁 Project Structure

```text
Ishita/
├── backend/
│   ├── .env                # Local backend environment variables (DO NOT COMMIT)
│   ├── .env.example        # Environment variable template for reference
│   ├── package.json        # Express, Nodemailer, Cors, Dotenv
│   └── server.js           # Express app with health check, SMTP verify, and send email APIs
├── frontend/
│   ├── .env                # Local frontend environment variables
│   ├── .env.example        # Frontend template (VITE_API_URL)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json        # React + Vite + Lucide icons
│   └── src/
│       ├── App.jsx         # Diagnostic dashboard UI
│       ├── main.jsx
│       └── index.css       # Custom modern glassmorphism styling
└── README.md
```

---

## 🚀 Local Setup Instructions

### 1. Backend Setup

1. Open terminal and navigate to backend directory:
   ```bash
   cd backend
   npm install
   ```
2. Open `backend/.env` and update your SMTP provider credentials:
   ```env
   PORT=5000
   CLIENT_URL=http://localhost:5173

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_actual_email@gmail.com
   SMTP_PASS=your_16_character_app_password
   FROM_EMAIL=your_actual_email@gmail.com
   ```
3. Start the backend server:
   ```bash
   npm run dev
   ```
   *(Backend runs on `http://localhost:5000`)*

### 2. Frontend Setup

1. Open a new terminal and navigate to frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Verify `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   *(Frontend runs on `http://localhost:5173`)*

---

## 🔍 Why Nodemailer Works Locally But Fails on Render / Vercel (Root Causes & Fixes)

If Nodemailer works on `localhost` but fails when hosted on Render or Vercel, it is almost always caused by one of these 5 issues:

### 1. 🛑 Outbound Port 25 is Blocked by Cloud Providers (Render, AWS, DigitalOcean)
- **Problem**: Cloud hosting platforms (like Render free tier) block outbound traffic on **Port 25** to prevent spam abuse. If your `SMTP_PORT` is set to 25, the socket will time out (`ETIMEDOUT`).
- **Fix**: Use **Port 587** (STARTTLS, `SMTP_SECURE=false`) or **Port 465** (SSL/TLS, `SMTP_SECURE=true`).

### 2. 🔑 Missing or Misconfigured Environment Variables in Cloud Dashboard
- **Problem**: Local `.env` files are in `.gitignore` and are **not** uploaded to Git. On Render, `process.env.SMTP_USER` or `SMTP_PASS` will be `undefined`.
- **Fix**:
  - Go to your **Render Dashboard** -> Select your Web Service -> **Environment** tab.
  - Manually add `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `FROM_EMAIL`.

### 3. 🔐 Gmail Security & App Passwords (2FA)
- **Problem**: Gmail blocks login attempts using your standard Google password from server IPs like Render.
- **Fix**:
  1. Enable 2-Step Verification on your Google Account.
  2. Go to Google Security -> **App Passwords**.
  3. Generate a 16-character App Password (e.g. `abcd efgh ijkl mnop`).
  4. Paste this 16-character code into `SMTP_PASS` (remove any spaces).

### 4. 🌐 CORS (Cross-Origin Resource Sharing) Blockages
- **Problem**: Your Vercel frontend (`https://your-app.vercel.app`) calls your Render backend (`https://your-api.onrender.com`), but the browser blocks it because CORS headers are missing.
- **Fix**: In `backend/server.js`, configure CORS allowed origins:
  ```javascript
  app.use(cors({
    origin: ['https://your-app.vercel.app', 'http://localhost:5173'],
    credentials: true
  }));
  ```

### 5. 🛡️ TLS Connection Handshake Failures
- **Problem**: Cloud server Linux images can strictly reject connection handshakes if certificates don't match.
- **Fix**: Add `tls: { rejectUnauthorized: false }` inside `nodemailer.createTransport()` configuration (already included in `backend/server.js`).

---

## 🌐 Deploying to Render & Vercel

### Deploying Backend to Render
1. Push `backend` to GitHub.
2. In Render Dashboard, click **New Web Service** -> Connect repository.
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. In the **Environment Variables** section, add your `SMTP_*` values and `CLIENT_URL` (your Vercel app URL).

### Deploying Frontend to Vercel
1. Push `frontend` to GitHub.
2. Import project in Vercel Dashboard.
3. Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://your-backend-name.onrender.com`

---

## 🛠️ Testing with the App
1. Open the frontend dashboard in your browser.
2. Click **"Test SMTP Handshake (`transporter.verify()`)"** to verify host & credentials before sending.
3. Fill out recipient email & click **"Send Test Email"**.
4. Check the **Diagnostic Response Log** console at the bottom for exact status codes, message IDs, or specific error tips.

# test-nodemailer