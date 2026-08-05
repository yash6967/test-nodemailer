import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertTriangle, RefreshCw, Send, Terminal, Server, ShieldCheck, ExternalLink } from 'lucide-react';

export default function App() {
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:5000');
  const [healthStatus, setHealthStatus] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('Nodemailer Cloud Verification');
  const [message, setMessage] = useState('Testing email sending functionality from Nodemailer MERN setup.');

  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingSend, setLoadingSend] = useState(false);

  const [logOutput, setLogOutput] = useState(null);
  const [diagnosticTip, setDiagnosticTip] = useState(null);

  // Auto-check health on load
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setLoadingHealth(true);
    setHealthStatus(null);
    try {
      const cleanUrl = apiUrl.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/api/health`);
      const data = await res.json();
      setHealthStatus({ online: true, data });
    } catch (err) {
      setHealthStatus({ online: false, error: err.message });
    } finally {
      setLoadingHealth(false);
    }
  };

  const verifySmtp = async () => {
    setLoadingVerify(true);
    setLogOutput('Testing SMTP connection with backend server...');
    setDiagnosticTip(null);
    try {
      const cleanUrl = apiUrl.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/api/verify-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setLogOutput(data);
      if (data.diagnosticTip) {
        setDiagnosticTip(data.diagnosticTip);
      }
    } catch (err) {
      setLogOutput({
        success: false,
        message: 'Network Request Failed. Could not reach backend server.',
        error: err.message,
        tip: 'Ensure your backend server is running and CORS is configured.'
      });
    } finally {
      setLoadingVerify(false);
    }
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    if (!recipient) {
      alert('Please enter a recipient email address.');
      return;
    }

    setLoadingSend(true);
    setLogOutput('Dispatching send-email request to backend...');
    setDiagnosticTip(null);

    try {
      const cleanUrl = apiUrl.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: subject,
          text: message
        })
      });
      const data = await res.json();
      setLogOutput(data);
      if (data.diagnosticTip) {
        setDiagnosticTip(data.diagnosticTip);
      }
    } catch (err) {
      setLogOutput({
        success: false,
        message: 'Network Request Failed',
        error: err.message
      });
    } finally {
      setLoadingSend(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="badge-tag">
          <Mail size={14} /> Nodemailer Diagnostic Suite
        </div>
        <h1 className="title">MERN Mailer Tester</h1>
        <p className="subtitle">
          Easily test Nodemailer configuration locally and diagnose missing environment variables, port blockages, or CORS issues on Render & Vercel.
        </p>
      </header>

      {/* Target API URL Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label className="label" style={{ margin: 0 }}>Target Backend API Base URL:</label>
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={checkHealth} disabled={loadingHealth}>
              <RefreshCw size={12} className={loadingHealth ? 'spinner' : ''} /> Refresh Health
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input" 
              value={apiUrl} 
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:5000 or https://your-app.onrender.com"
            />
          </div>
        </div>
      </div>

      <div className="grid">
        {/* Left Column: Server Status & Diagnostics */}
        <div className="card">
          <div className="card-title">
            <Server size={20} color="#818CF8" /> Backend Health & SMTP Verify
          </div>
          <div className="card-desc">
            Verify whether the backend is reachable and test transporter connection (`transporter.verify()`).
          </div>

          <div className="status-box">
            <div className="status-item">
              <span className="status-key">Server Connection:</span>
              <span className={`status-val ${healthStatus?.online ? 'val-success' : 'val-danger'}`}>
                {loadingHealth ? 'Checking...' : healthStatus?.online ? 'ONLINE (200 OK)' : 'OFFLINE / UNREACHABLE'}
              </span>
            </div>

            {healthStatus?.online && healthStatus.data?.env && (
              <>
                <div className="status-item">
                  <span className="status-key">SMTP Host:</span>
                  <span className="status-val">{healthStatus.data.env.smtp_host}</span>
                </div>
                <div className="status-item">
                  <span className="status-key">SMTP Port:</span>
                  <span className="status-val">{healthStatus.data.env.smtp_port}</span>
                </div>
                <div className="status-item">
                  <span className="status-key">SMTP User Configured:</span>
                  <span className={`status-val ${healthStatus.data.env.smtp_user_set ? 'val-success' : 'val-warning'}`}>
                    {healthStatus.data.env.smtp_user_set ? 'Yes ✅' : 'Missing ⚠️'}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-key">SMTP Password Configured:</span>
                  <span className={`status-val ${healthStatus.data.env.smtp_pass_set ? 'val-success' : 'val-warning'}`}>
                    {healthStatus.data.env.smtp_pass_set ? 'Yes ✅' : 'Missing ⚠️'}
                  </span>
                </div>
              </>
            )}
          </div>

          <button 
            className="btn btn-secondary full-width"
            onClick={verifySmtp} 
            disabled={loadingVerify}
            style={{ marginTop: 'auto' }}
          >
            {loadingVerify ? <div className="spinner" /> : <ShieldCheck size={16} />}
            Test SMTP Handshake (`transporter.verify()`)
          </button>
        </div>

        {/* Right Column: Send Test Email Form */}
        <div className="card">
          <div className="card-title">
            <Send size={20} color="#10B981" /> Send Test Email
          </div>
          <div className="card-desc">
            Dispatch a test email payload to verify Nodemailer end-to-end delivery.
          </div>

          <form onSubmit={sendEmail}>
            <div className="form-group">
              <label className="label">Recipient Email (To):</label>
              <input 
                type="email" 
                className="input"
                placeholder="recipient@example.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="label">Subject:</label>
              <input 
                type="text" 
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="label">Message Body:</label>
              <textarea 
                className="textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary full-width"
              disabled={loadingSend}
            >
              {loadingSend ? <div className="spinner" /> : <Send size={16} />}
              Send Test Email
            </button>
          </form>
        </div>
      </div>

      {/* Response Console */}
      <div className="card console-card">
        <div className="console-header">
          <div className="console-title">
            <Terminal size={16} /> Diagnostic Response Log
          </div>
          {logOutput && (
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setLogOutput(null)}>
              Clear Log
            </button>
          )}
        </div>

        <div className="console-box">
          {logOutput ? (
            typeof logOutput === 'string' ? logOutput : JSON.stringify(logOutput, null, 2)
          ) : (
            '// Logs and server responses will appear here. Click "Test SMTP Handshake" or "Send Test Email" to begin.'
          )}
        </div>

        {diagnosticTip && (
          <div className="tip-banner">
            <strong>💡 Hosting Diagnostic Tip:</strong>
            {diagnosticTip}
          </div>
        )}
      </div>
    </div>
  );
}
