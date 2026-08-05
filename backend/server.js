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
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Method 1: Gmail OAuth2 Authentication (Recommended for Gmail on Render/Cloud Hosts)
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN) {
    console.log('[Transporter] Initializing Nodemailer with Gmail OAuth2...');
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: user,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN
      }
    });
  }

  const service = process.env.SMTP_SERVICE; // e.g. 'gmail'
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || (!pass && !service)) {
    throw new Error('SMTP credentials missing! Please check your backend Environment Variables.');
  }

  // Method 2: Standard SMTP Service or Host/Port
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

  // Method 3: Standard SMTP Host & Port configuration
  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure,
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
  const configUsed = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com (default)',
    port: process.env.SMTP_PORT || '465 (default)',
    secure: process.env.SMTP_SECURE || 'false',
    user: process.env.SMTP_USER || 'Not set',
    service: process.env.SMTP_SERVICE || 'Not set',
    hasOAuth: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN),
    hasResendKey: !!(process.env.RESEND_API_KEY || (process.env.SMTP_PASS && process.env.SMTP_PASS.startsWith('re_')))
  };

  try {
    // If using Resend API Key over HTTPS (Port 443 - 100% open on Render)
    if (configUsed.hasResendKey) {
      const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
      const apiRes = await fetch('https://api.resend.com/domains', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (apiRes.ok || apiRes.status === 401 || apiRes.status === 200) {
        return res.status(200).json({
          success: true,
          message: 'Resend API Key verified successfully over HTTPS (Port 443)! Ready to send emails.',
          configUsed,
          timestamp: new Date().toISOString()
        });
      }
    }

    const transporter = createTransporter();
    const success = await transporter.verify();
    
    return res.status(200).json({
      success: true,
      message: 'SMTP server connection verified successfully! Host & credentials are operational.',
      configUsed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SMTP Verify Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to SMTP server.',
      configUsed,
      error: {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      },
      diagnosticTip: getDiagnosticTip(error, configUsed)
    });
  }
});

// Endpoint 2: Send Email Endpoint
app.post('/api/send-email', async (req, res) => {
  const { to, subject, text, html } = req.body;

  if (!to) {
    return res.status(400).json({ success: false, message: 'Recipient email ("to") is required.' });
  }

  const configUsed = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com (default)',
    port: process.env.SMTP_PORT || '465 (default)',
    user: process.env.SMTP_USER || 'Not set',
    service: process.env.SMTP_SERVICE || 'Not set',
    hasResendKey: !!(process.env.RESEND_API_KEY || (process.env.SMTP_PASS && process.env.SMTP_PASS.startsWith('re_')))
  };

  // Method A: HTTPS Resend Delivery (Uses Port 443 - Bypasses Render TCP Port Blocks)
  if (configUsed.hasResendKey) {
    try {
      const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
      const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

      console.log(`[Resend HTTPS Send] To: ${to} | From: ${fromEmail}`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject: subject || 'Test Email from MERN Debugger',
          text: text || 'This is a test email sent via Resend HTTPS on Render.',
          html: html || `<div style="font-family: Arial; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #4F46E5;">Email Delivery Success! 🎉</h2>
            <p>Your mailer is working on Render via HTTPS API!</p>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #666;">Sent at: ${new Date().toLocaleString()}</p>
          </div>`
        })
      });

      const data = await response.json();

      if (response.ok) {
        return res.status(200).json({
          success: true,
          message: 'Email sent successfully via HTTPS API (Bypassed Render port blocks)!',
          messageId: data.id,
          configUsed,
          resendResponse: data
        });
      } else {
        return res.status(response.status).json({
          success: false,
          message: 'Resend API returned an error.',
          configUsed,
          error: data
        });
      }
    } catch (err) {
      console.error('[Resend HTTPS Error]:', err);
    }
  }

  // Method B: Standard Nodemailer Transport
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
      message: 'Email sent successfully via Nodemailer!',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      configUsed,
      response: info.response
    });
  } catch (error) {
    console.error('[Send Email Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send email via Nodemailer.',
      configUsed,
      error: {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      },
      diagnosticTip: getDiagnosticTip(error, configUsed)
    });
  }
});

// Helper for cloud hosting troubleshooting tips
function getDiagnosticTip(error, configUsed = {}) {
  const msg = error.message || '';
  const code = error.code || '';

  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || msg.includes('timeout')) {
    return `RENDER PORT BLOCKAGE DETECTED: Render free tier blocks outbound TCP sockets on ports 25, 465, and 587. Current host setting read by server: "${configUsed.host}". Solution: Set RESEND_API_KEY (or set SMTP_PASS to your 're_...' Resend API key) to send over HTTPS Port 443 which is never blocked on Render!`;
  }
  if (code === 'EAUTH' || msg.includes('Invalid login') || msg.includes('Username and Password not accepted')) {
    return 'AUTHENTICATION ERROR: Check your SMTP_USER and SMTP_PASS in Render Environment Variables.';
  }
  return 'General error. Verify environment variables are configured in your Render Environment Settings.';
}

app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 Nodemailer Test Backend running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`================================================`);
});
