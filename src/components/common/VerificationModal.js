import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';

/**
 * The verification screen: issue the code, DM it to @tora.verify, mark sent.
 * Opened from the profile nudge and from any gated action (the api.js
 * interceptor fires `tora:verification-required` → App.js opens this).
 */
const VerificationModal = ({ onClose, contextMessage }) => {
  const { t } = useLanguage();
  const { user, reloadProfileData } = useAppContext();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(user?.verifyCode || null);
  const [status, setStatus] = useState(user?.verifyStatus || 'UNVERIFIED');
  const [copied, setCopied] = useState(false);

  const issue = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiService.issueVerifyCode(user.id);
      setCode(res.code);
      setStatus(res.status);
    } catch (e) {
      console.error('Issue code failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const markSent = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiService.markVerificationSent(user.id);
      setStatus(res.status);
      reloadProfileData();
    } catch (e) {
      console.error('Mark sent failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — code is visible to copy manually */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 p-5" onClick={onClose}>
      <div
        className="max-w-md w-full rounded-2xl border border-white/10 bg-[#131315]/95 backdrop-blur-xl p-6 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="m-0 text-[15px] font-semibold text-white font-space-grotesk uppercase tracking-[0.08em] text-center">
          {t('verify.verifyTitle')}
        </h3>

        {contextMessage && (
          <p className="text-sm text-infrared/90 text-center mt-3 mb-0">{contextMessage}</p>
        )}

        {!user?.instagram?.trim() && status !== 'PENDING_REVIEW' ? (
          <div className="mt-5 text-center">
            <p className="text-sm leading-relaxed text-white/70 m-0">
              {t('verify.addInstagramFirst')}
            </p>
            <button type="button" className="btn btn-outline w-full mt-5" onClick={onClose}>{t('common.close')}</button>
          </div>
        ) : status === 'PENDING_REVIEW' ? (
          <div className="mt-5 text-center">
            <p className="text-sm leading-relaxed text-white/70 m-0">
              {t('verify.inReviewLong')}
            </p>
            <button type="button" className="btn btn-outline w-full mt-5" onClick={onClose}>{t('common.close')}</button>
          </div>
        ) : (
          <div className="mt-5">
            <ol className="m-0 pl-5 text-sm leading-relaxed text-white/70 flex flex-col gap-2">
              <li>{t('verify.step1')}</li>
              <li>
                {t('verify.step2Before')}{' '}
                <a
                  href="https://instagram.com/tora.verify"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-infrared no-underline hover:underline"
                >@tora.verify</a>.
              </li>
              <li>{t('verify.step3')}</li>
            </ol>

            {code ? (
              <button
                type="button"
                onClick={copyCode}
                className="w-full mt-5 rounded-2xl border border-white/15 bg-black/40 py-4 text-center cursor-pointer"
                title={t('verify.tapToCopy')}
              >
                <span className="block text-2xl font-semibold text-white font-space-grotesk tracking-[0.15em]">{code}</span>
                <span className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1 font-tech">
                  {copied ? t('verify.copied') : t('verify.tapToCopy')}
                </span>
              </button>
            ) : (
              <button type="button" className="btn btn-primary w-full mt-5" disabled={busy} onClick={issue}>
                {busy ? '...' : t('verify.getMyCode')}
              </button>
            )}

            {code && (
              <div className="flex gap-2.5 mt-4">
                <button type="button" className="btn btn-outline flex-1" disabled={busy} onClick={issue}>
                  {t('verify.newCode')}
                </button>
                <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={markSent}>
                  {t('verify.iveSentIt')}
                </button>
              </div>
            )}

            <button
              type="button"
              className="block w-full mt-4 bg-transparent border-none text-white/40 text-xs cursor-pointer hover:text-white/60"
              onClick={onClose}
            >
              {t('verify.notNow')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default VerificationModal;
