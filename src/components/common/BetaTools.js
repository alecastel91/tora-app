import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const IS_BETA = import.meta.env.VITE_TORA_ENV === 'beta';

/**
 * Beta-only chrome: the persistent "test environment" banner and the floating
 * feedback widget. Renders nothing outside beta (VITE_TORA_ENV !== 'beta'),
 * so prod builds carry zero visual footprint.
 * Deliberately English-only — beta tooling, not product surface.
 */
const BetaTools = () => {
  const { user } = useAppContext();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Shift the sticky header/content below the fixed banner.
  useEffect(() => {
    if (!IS_BETA) return undefined;
    document.body.classList.add('beta-env');
    return () => document.body.classList.remove('beta-env');
  }, []);

  if (!IS_BETA) return null;

  const submit = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      // Capture the active tab — the app is a SPA (tabs don't change the URL),
      // so read the `tab-<name>` class the app-container carries.
      const container = document.querySelector('.app-container');
      const tabClass = container && Array.from(container.classList).find((c) => c.startsWith('tab-'));
      const page = tabClass ? tabClass.replace('tab-', '') : (window.location.pathname || '/');
      const res = await fetch(`${API_URL}/public/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          profileId: user?.id || null,
          page,
        }),
      });
      if (!res.ok) throw new Error('Could not send — try again');
      setSent(true);
      setMessage('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => { setOpen(false); setSent(false); setError(''); };

  return (
    <>
      <div className="beta-banner">Test environment · nothing here is real</div>

      <button type="button" className="beta-fab" onClick={() => setOpen(true)} aria-label="Send feedback">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.3 8.7 8.7 0 0 1-3.9-.9L3 20l1.2-4.1a8.2 8.2 0 0 1-1-4A8.38 8.38 0 0 1 11.7 3.6a8.38 8.38 0 0 1 9.3 7.9z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="message-modal-overlay" onClick={close}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">Beta feedback</h2>
            {sent ? (
              <>
                <p className="extras-success">Thank you — received. Every report makes TORA better.</p>
                <div className="message-modal-actions">
                  <button className="btn btn-primary btn-modal-send" onClick={close}>Close</button>
                </div>
              </>
            ) : (
              <>
                <textarea
                  className="message-textarea-bottom"
                  placeholder="What happened? What did you expect? Screenshots can go to support@torahub.io"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={5}
                />
                {error && <p className="m-0 mb-3 text-sm text-infrared">{error}</p>}
                <div className="message-modal-actions">
                  <button className="btn btn-outline btn-modal-cancel" onClick={close} disabled={busy}>Cancel</button>
                  <button className="btn btn-primary btn-modal-send" onClick={submit} disabled={busy || !message.trim()}>
                    {busy ? '...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default BetaTools;
