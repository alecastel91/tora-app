import React, { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import OverlayPortal from './OverlayPortal';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { downscaleImageToDataUrl } from '../../utils/image';
import { isStandalone } from '../../services/install';
import { betaUi } from '../../beta/tasks-strings';

/**
 * Beta feedback sheet — the only beta-only surface in the app (behind the
 * BETA bubble), so beta otherwise looks exactly like production. The task
 * checklist lives in the admin cockpit, ticked from what testers do.
 * TELL US: type + severity + text + up to five screenshots; everything else
 * (route, screen, commit, device, last API error, Sentry event) is captured
 * silently. Deliberately outside the main i18n catalog.
 */
const TYPES = ['Bug', 'Confusing', 'Missing', 'Idea', 'Copy', 'Performance'];
const SEVERITY_KEYS = ['blocked', 'annoyed', 'noting'];

const currentTab = () => {
  const container = document.querySelector('.app-container');
  const tabClass = container && Array.from(container.classList).find((c) => c.startsWith('tab-'));
  return tabClass ? tabClass.replace('tab-', '') : (window.location.pathname || '/');
};

const SentScreen = ({ title, sub, cta, onClick }) => (
  <div className="pt-10 text-center">
    <p className="m-0 mb-2 text-[15px] font-semibold text-white">{title}</p>
    <p className="m-0 mb-6 text-[13px] text-white/60">{sub}</p>
    <button className="btn btn-primary" onClick={onClick}>{cta}</button>
  </div>
);

const BetaSheet = ({ open, onClose, language = 'en' }) => {
  const { user } = useAppContext();
  const ui = betaUi(language);
  const [type, setType] = useState('Bug');
  const [severity, setSeverity] = useState('annoyed');
  const [body, setBody] = useState('');
  const [shots, setShots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const shotInputRef = useRef(null);

  // The sheet stays mounted while closed: reopen on the form, not on a stale
  // thank-you screen or an old error.
  useEffect(() => {
    if (open) { setSent(false); setError(''); }
  }, [open]);

  if (!open) return null;

  // Silent context attached to every feedback row — screen, device, last
  // error — so the tester never has to describe them.
  const silentContext = () => ({
    route: window.location.pathname + window.location.search,
    screen: currentTab(),
    commit: window.__toraCommit || null,
    device: {
      ua: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      standalone: isStandalone(),
      lang: navigator.language,
    },
    sentryEventId: (Sentry.lastEventId && Sentry.lastEventId()) || null,
    lastApiError: window.__toraLastApiError || null,
  });

  const pickShots = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - shots.length);
    e.target.value = '';
    setError('');
    for (const f of files) {
      try {
        const dataUrl = await downscaleImageToDataUrl(f, { maxDimension: 1280, quality: 0.8 });
        setShots((s) => (s.length < 5 ? [...s, dataUrl] : s));
      } catch {
        setError('Could not read that image — try a JPEG or PNG.');
      }
    }
  };

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiService.betaSendFeedback({
        profileId: user?.id || null,
        type,
        severity,
        body: body.trim(),
        attachments: shots,
        ...silentContext(),
      });
      setSent(true);
      setBody(''); setShots([]);
    } catch (e2) {
      setError(e2.message || 'Could not send — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayPortal>
      {/* Phone: a full page. Desktop: a centred panel over a dimmed app, above
          the desktop header (which otherwise covered the page title). */}
      <div className="fixed inset-0 z-[3000] flex flex-col bg-[#0a0a0a] lg:items-center lg:justify-center lg:bg-black/70 lg:p-8" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
       <div className="flex min-h-0 flex-1 flex-col lg:w-full lg:max-w-[600px] lg:flex-none lg:max-h-[88vh] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-white/10 lg:bg-[#0c0c11] lg:shadow-2xl">
        {/* Same header structure as the Premium page: back arrow left,
            centered title, symmetric spacer. */}
        <div className="premium-header beta-sheet-header shrink-0">
          <button className="back-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1>{ui.tellUs}</h1>
          <div style={{ width: '24px' }}></div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)] lg:px-6 lg:pb-6">
          {sent ? (
              <SentScreen title={ui.received} sub={ui.receivedSub} cta={ui.sendAnother} onClick={() => setSent(false)} />
            ) : (
              <>
                <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{ui.typeQ}</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {TYPES.map((tp) => (
                    <button key={tp} type="button" onClick={() => setType(tp)}
                      className={`rounded-full border px-3 py-1.5 text-[12px] ${type === tp ? 'border-infrared bg-infrared/20 text-white' : 'border-white/15 text-white/60'}`}>
                      {tp}
                    </button>
                  ))}
                </div>
                <p className="m-0 mb-1.5 mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">{ui.howBad}</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {SEVERITY_KEYS.map((sv) => (
                    <button key={sv} type="button" onClick={() => setSeverity(sv)}
                      className={`rounded-full border px-3 py-1.5 text-[12px] ${severity === sv ? 'border-[#FFB800] bg-[#FFB800]/15 text-white' : 'border-white/15 text-white/60'}`}>
                      {ui.severities[sv]}
                    </button>
                  ))}
                </div>
                <textarea
                  className="message-textarea-bottom w-full"
                  placeholder={ui.placeholder}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  rows={5}
                />
                <input ref={shotInputRef} type="file" accept="image/*" multiple className="hidden" onChange={pickShots} />
                {shots.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {shots.map((s, i) => (
                      <div key={i} className="relative">
                        <img src={s} alt="" className="h-16 w-16 rounded-lg object-cover" />
                        <button type="button" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white" onClick={() => setShots(shots.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {shots.length < 5 && (
                  <button type="button" className="btn btn-outline beta-shot-attach" onClick={() => shotInputRef.current?.click()}>
                    + {ui.addShot} ({shots.length}/5)
                  </button>
                )}
                <p className="m-0 mb-2 mt-1 text-[11px] text-white/35">
                  {ui.autoNote}
                </p>
                {error && <p className="m-0 mb-3 text-sm text-infrared">{error}</p>}
                <button className="btn btn-primary btn-full" onClick={submit} disabled={busy || !body.trim()}>
                  {busy ? '…' : ui.send}
                </button>
              </>
          )}
        </div>
       </div>
      </div>
    </OverlayPortal>
  );
};

export default BetaSheet;
