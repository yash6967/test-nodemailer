# Render Email Migration & Troubleshooting Guide (INSTRUCTIONS.md)

## 📌 Problem Summary & Technical Root Cause
When deploying Node.js / Express applications to **Render**, traditional Nodemailer setups using `smtp.gmail.com` or standard SMTP relays on Ports 25, 465, 587, or 2525 fail with:

```text
Error: Connection timeout (code: ETIMEDOUT, command: CONN)
```

**Root Cause**: Cloud hosting providers (including Render's free tier) block outbound raw TCP socket traffic on traditional email ports to prevent spam abuse. 

## 🚀 Solution Overview
To bypass Render's TCP port restrictions without needing a custom domain, send emails over **HTTPS (Port 443)** using the **Brevo (Sendinblue) v3 API**. HTTPS traffic is 100% unrestricted on Render, and Brevo allows sending up to 300 emails/day to **ANY recipient address** using your verified email address as the sender.

---

## 🛠️ Step-by-Step AI Agent Fix Instructions

### 1. Update Backend Dependencies
No new dependencies are required if using Node.js 18+ (which includes native `fetch`). If using Node.js < 18, install `node-fetch`:
```bash
npm install node-fetch
```

### 2. Add Brevo HTTPS Email Helper Function
In your backend codebase (e.g., `services/emailService.js`, `utils/sendEmail.js`, or `server.js`), replace your Nodemailer `transporter.sendMail(...)` implementation with the following Brevo HTTPS API wrapper:

```javascript
/**
 * Sends an email using Brevo HTTPS API over Port 443 (Render Compatible)
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address or array of emails
 * @param {string} options.subject - Email subject line
 * @param {string} [options.text] - Plain text content
 * @param {string} [options.html] - HTML formatted body
 */
async function sendEmail({ to, subject, text, html }) {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.FROM_EMAIL || '').trim();

  if (!apiKey) {
    throw new Error('BREVO_API_KEY environment variable is missing.');
  }
  if (!senderEmail) {
    throw new Error('FROM_EMAIL environment variable is missing.');
  }

  // Format recipient array
  const recipients = Array.isArray(to) 
    ? to.map(email => ({ email: email.trim() }))
    : [{ email: to.trim() }];

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: process.env.APP_NAME || 'App Notification', email: senderEmail },
      to: recipients,
      subject: subject || 'Notification',
      textContent: text || '',
      htmlContent: html || `<p>${text || ''}</p>`
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Brevo HTTPS API Error]:', data);
    throw new Error(`Email sending failed: ${data.message || JSON.stringify(data)}`);
  }

  console.log('[Brevo HTTPS API Success]: MessageId =', data.messageId);
  return data;
}

module.exports = { sendEmail };
```

---

## 🔐 Environment Variable Checklist for Render

In your **Render Web Service Dashboard** -> **Environment** tab, set the following environment variables:

| Variable Name | Description / Format | Example |
| :--- | :--- | :--- |
| `BREVO_API_KEY` | v3 API Key generated from Brevo *(starts with `xkeysib-`)* | `xkeysib-xxxx...` |
| `FROM_EMAIL` | Verified email address in your Brevo account | `your_email@gmail.com` |

> ❌ **Remove Old Environment Variables**: Delete any old `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, or `SMTP_SECURE` variables from Render to prevent fallback errors.

---

## ⚙️ Brevo Dashboard Settings

1. **API Key Generation**:
   - Go to **[Brevo Dashboard](https://app.brevo.com/)** -> **SMTP & API** -> **API Keys** tab.
   - Click **Generate a new API key**. Use the key starting with `xkeysib-`.
2. **Authorized IP Setup**:
   - Go to **[Brevo Authorized IPs Page](https://app.brevo.com/security/authorised_ips)**.
   - Click **Add an IP address** and enter `0.0.0.0/0` (or add your specific Render server IP) to ensure Render can connect.
3. **Sender Email Verification**:
   - Ensure the email specified in `FROM_EMAIL` is listed as **Verified** under **Senders & IP** -> **Senders**.
