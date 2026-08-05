const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup to allow localhost and deployed frontends (Vercel)
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*') || process.env.ALLOW_ALL_CORS === 'true') {
      return callback(null, true);
    }
    // Allow any Vercel preview domain for easier testing
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for testing nodemailer backend
  },
  credentials: true
}));

app.use(express.json());

// Helper function to create Nodemailer Transporter
function createTransporter() {
  const service = process.env.SMTP_SERVICE; // e.g. 'gmail'
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP credentials missing! Please check your backend Environment Variables (SMTP_USER, SMTP_PASS).');
  }

  // Option A: If SMTP_SERVICE is set (e.g. SMTP_SERVICE=gmail)
  if (service) {
    return nodemailer.createTransport({
      service: service,
      auth: {
        user: user,
        pass: pass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
  }

  // Option B: Standard SMTP Host & Port configuration
  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: user,
      pass: pass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      smtp_host: process.env.SMTP_HOST || 'Not configured',
      smtp_port: process.env.SMTP_PORT || 'Not configured',
      smtp_secure: process.env.SMTP_SECURE || 'Not configured',
      smtp_user_set: !!process.env.SMTP_USER,
      smtp_pass_set: !!process.env.SMTP_PASS,
      from_email: process.env.FROM_EMAIL || 'Not configured'
    }
  });
});

// Endpoint 1: Verify SMTP Connection without sending mail
app.post('/api/verify-smtp', async (req, res) => {
  try {
    const transporter = createTransporter();
    
    // Verify connection configuration
    const success = await transporter.verify();
    
    return res.status(200).json({
      success: true,
      message: 'SMTP server connection verified successfully! Host & credentials are operational.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SMTP Verify Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to SMTP server.',
      error: {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      },
      diagnosticTip: getDiagnosticTip(error)
    });
  }
});

// Endpoint 2: Send Email Endpoint
app.post('/api/send-email', async (req, res) => {
  const { to, subject, text, html } = req.body;

  if (!to) {
    return res.status(400).json({ success: false, message: 'Recipient email ("to") is required.' });
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: to,
      subject: subject || 'Test Email from Nodemailer MERN Debugger',
      text: text || 'This is a test email sent from Nodemailer test application.',
      html: html || `<div style="font-family: Arial; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #4F46E5;">Nodemailer Test Success! 🎉</h2>
        <p>If you are receiving this email, your Nodemailer setup is working properly!</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #666;">Sent at: ${new Date().toLocaleString()}</p>
      </div>`
    };

    console.log(`[Sending Mail] To: ${to} | Subject: ${mailOptions.subject}`);
    const info = await transporter.sendMail(mailOptions);
    console.log('[Mail Sent Success] MessageId:', info.messageId);

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully!',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response
    });
  } catch (error) {
    console.error('[Send Email Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send email via Nodemailer.',
      error: {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      },
      diagnosticTip: getDiagnosticTip(error)
    });
  }
});

// Helper for cloud hosting troubleshooting tips
function getDiagnosticTip(error) {
  const msg = error.message || '';
  const code = error.code || '';

  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || msg.includes('timeout')) {
    return 'CONNECTION TIMEOUT ON RENDER: Port 25 is blocked on cloud providers, and Port 587 often gets blocked or times out on free cloud tiers. FIX: In Render Environment Settings, set SMTP_PORT to 465 and SMTP_SECURE to true (SSL mode). Or add SMTP_SERVICE=gmail to let Nodemailer manage connection settings automatically.';
  }
  if (code === 'EAUTH' || msg.includes('Invalid login') || msg.includes('Username and Password not accepted')) {
    return 'AUTHENTICATION ERROR: Check your SMTP_USER and SMTP_PASS in Render Environment Variables. For Gmail, you MUST use an 16-character App Password (not your normal login password) with 2FA enabled on Google.';
  }
  if (msg.includes('self signed certificate') || msg.includes('TLS')) {
    return 'TLS ERROR: Cloud servers might require tls: { rejectUnauthorized: false } which is enabled in this server.';
  }
  return 'General error. Verify environment variables are configured in your hosting platform dashboard (Render Environment Settings).';
}

app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 Nodemailer Test Backend running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`================================================`);
});
