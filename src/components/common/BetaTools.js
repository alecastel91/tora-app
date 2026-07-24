import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../contexts/AppContext';
import { downscaleImageToDataUrl } from '../../utils/image';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const IS_BETA = import.meta.env.VITE_TORA_ENV === 'beta';
const BANNER_TEXT = 'Test environment — bookings and payments here are not real';

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
  const [screenshot, setScreenshot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const bannerRef = useRef(null);
  const shotInputRef = useRef(null);
  const [ticker, setTicker] = useState(false);

  // Shift the sticky header/content below the fixed banner.
  useEffect(() => {
    if (!IS_BETA) return undefined;
    document.body.classList.add('beta-env');
    return () => document.body.classList.remove('beta-env');
  }, []);

  // Ticker only when the text doesn't fit on one line at this viewport width.
  useEffect(() => {
    if (!IS_BETA) return undefined;
    const check = () => {
      const el = bannerRef.current;
      const text = el && el.firstChild;
      if (el && text) setTicker(text.scrollWidth > el.clientWidth + 1);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
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
          image: screenshot,
        }),
      });
      if (!res.ok) throw new Error('Could not send — try again');
      setSent(true);
      setMessage('');
      setScreenshot(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pickScreenshot = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const dataUrl = await downscaleImageToDataUrl(file, { maxDimension: 1280, quality: 0.8 });
      setScreenshot(dataUrl);
    } catch {
      setError('Could not read that image — try a JPEG or PNG');
    }
  };

  const close = () => { setOpen(false); setSent(false); setError(''); setScreenshot(null); };

  return (
    <>
      {/* Portaled to <body> so it pins to the true screen top, above the
          transformed #root (which is anchored 24px down — see App.css).
          When the text overflows, it becomes a seamless horizontal ticker. */}
      {createPortal(
        <div ref={bannerRef} className={`beta-banner${ticker ? ' is-ticker' : ''}`}>
          <span className="beta-banner-text">{BANNER_TEXT}</span>
          {ticker && <span className="beta-banner-text" aria-hidden="true">{BANNER_TEXT}</span>}
        </div>,
        document.body,
      )}

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
                  placeholder="What happened? What did you expect?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={5}
                />
                <input
                  ref={shotInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={pickScreenshot}
                />
                {screenshot ? (
                  <div className="beta-shot-preview">
                    <img src={screenshot} alt="Attached screenshot" />
                    <button type="button" className="beta-shot-remove" onClick={() => setScreenshot(null)} aria-label="Remove screenshot">✕</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline beta-shot-attach"
                    onClick={() => shotInputRef.current && shotInputRef.current.click()}
                  >
                    + Attach screenshot
                  </button>
                )}
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
