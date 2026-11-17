import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import { getAvatarClass } from '../../utils/roles';
import { requiredEmailDomain } from '../../utils/emailDomain';

/**
 * How an agency verifies. Instagram is not offered here: a handle costs a
 * minute to create, so it proves little about an agency — and an easy weak
 * path beside a strong one means the strong one never gets used.
 *
 *   1. A work email at the domain the profile already shows as its website.
 *   2. Failing that, an artist who already knows them.
 */
const AgentVerificationPanel = ({ onClose, onVerified }) => {
  const { t } = useLanguage();
  const { user, reloadProfileData, profileOnly } = useAppContext();

  // 'choose' | 'email' | 'code' | 'vouch' | 'done'
  const [step, setStep] = useState('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [asked, setAsked] = useState(null);

  // The domain the work email has to sit at, shown before anything is typed.
  // Computed with the same registrable-domain rule the server matches on, so
  // the sentence in the UI is exactly the requirement that will be enforced.
  const websiteDomain = requiredEmailDomain(user?.website);

  const sendCode = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.startEmailVerification(user.id, email.trim());
      setSentTo(email.trim());
      setStep('code');
    } catch (e) {
      setError(e.message || t('verify.agentEmailFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.confirmEmailVerification(user.id, code.trim());
      await reloadProfileData();
      setStep('done');
      if (onVerified) onVerified();
    } catch (e) {
      setError(e.message || t('verify.agentCodeFailed'));
    } finally {
      setBusy(false);
    }
  };

  const searchArtists = async () => {
    if (busy || !query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiService.searchVouchCandidates(user.id, query.trim());
      setResults(res.artists || []);
    } catch (e) {
      setError(e.message || t('verify.vouchSearchFailed'));
    } finally {
      setBusy(false);
    }
  };

  const askArtist = async (artist) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.requestVouch(user.id, artist.id);
      setAsked(artist);
    } catch (e) {
      setError(e.message || t('verify.vouchRequestFailed'));
    } finally {
      setBusy(false);
    }
  };

  const label = 'text-[10px] uppercase tracking-[0.18em] text-white/40 font-tech';
  const input = 'w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-3 text-sm text-white placeholder:text-white/25';

  if (step === 'done') {
    return (
      <div className="mt-5 text-center">
        <p className="text-sm leading-relaxed text-white/70 m-0">{t('verify.agentVerified')}</p>
        <button type="button" className="btn btn-primary w-full mt-5" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {error && (
        <p className="mb-4 border-l-2 border-infrared pl-3 text-[12.5px] leading-relaxed text-infrared m-0">
          {error}
        </p>
      )}

      {step === 'choose' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-white/70 m-0">{t('verify.agentIntro')}</p>

          <button
            type="button"
            className="rounded-xl border border-white/12 bg-black/30 p-4 text-left transition-colors hover:border-infrared/40"
            onClick={() => setStep('email')}
          >
            <span className="block text-sm font-semibold text-white">{t('verify.agentMethodEmail')}</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-white/50">
              {websiteDomain
                ? t('verify.agentMethodEmailAt', { domain: websiteDomain })
                : t('verify.agentMethodEmailNoSite')}
            </span>
          </button>

          {/* Vouching searches other members: closed until launch for profile-only accounts. */}
          {!profileOnly && (
            <button
              type="button"
              className="rounded-xl border border-white/12 bg-black/30 p-4 text-left transition-colors hover:border-infrared/40"
              onClick={() => setStep('vouch')}
            >
              <span className="block text-sm font-semibold text-white">{t('verify.agentMethodVouch')}</span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-white/50">
                {t('verify.agentMethodVouchHint')}
              </span>
            </button>
          )}
        </div>
      )}

      {step === 'email' && (
        <div className="flex flex-col gap-3">
          {!websiteDomain ? (
            <>
              <p className="text-sm leading-relaxed text-white/70 m-0">{t('verify.agentNeedsWebsite')}</p>
              <button type="button" className="btn btn-outline w-full" onClick={() => setStep('choose')}>
                {t('common.back')}
              </button>
            </>
          ) : (
            <>
              <p className={label}>{t('verify.agentWorkEmail')}</p>
              <input
                className={input}
                type="email"
                autoComplete="off"
                inputMode="email"
                placeholder={`booking@${websiteDomain}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-[11.5px] leading-relaxed text-white/35 m-0">
                {t('verify.agentWorkEmailNote', { domain: websiteDomain })}
              </p>
              <button type="button" className="btn btn-primary w-full" disabled={busy || !email.trim()} onClick={sendCode}>
                {busy ? '...' : t('verify.agentSendCode')}
              </button>
              <button
                type="button"
                className="bg-transparent border-none text-white/40 text-xs cursor-pointer hover:text-white/60"
                onClick={() => { setStep('choose'); setError(null); }}
              >
                {t('common.back')}
              </button>
            </>
          )}
        </div>
      )}

      {step === 'code' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-white/70 m-0">
            {t('verify.agentCodeSent', { email: sentTo })}
          </p>
          <input
            className={`${input} text-center text-xl tracking-[0.4em] font-space-grotesk`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="——————"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button type="button" className="btn btn-primary w-full" disabled={busy || code.length < 6} onClick={confirmCode}>
            {busy ? '...' : t('verify.agentConfirmCode')}
          </button>
          <button
            type="button"
            className="bg-transparent border-none text-white/40 text-xs cursor-pointer hover:text-white/60"
            disabled={busy}
            onClick={() => { setStep('email'); setCode(''); setError(null); }}
          >
            {t('verify.agentWrongEmail')}
          </button>
        </div>
      )}

      {step === 'vouch' && (
        <div className="flex flex-col gap-3">
          {asked ? (
            <>
              <p className="text-sm leading-relaxed text-white/70 m-0">
                {t('verify.vouchAsked', { name: asked.name })}
              </p>
              <button type="button" className="btn btn-outline w-full" onClick={onClose}>
                {t('common.close')}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-white/70 m-0">{t('verify.vouchIntro')}</p>
              <div className="flex gap-2">
                <input
                  className={input}
                  placeholder={t('verify.vouchSearchPlaceholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') searchArtists(); }}
                />
                <button type="button" className="btn btn-outline" disabled={busy || !query.trim()} onClick={searchArtists}>
                  {busy ? '...' : t('verify.vouchSearchAction')}
                </button>
              </div>

              {results && results.length === 0 && (
                <p className="text-[12.5px] text-white/40 m-0">{t('verify.vouchNoEligible')}</p>
              )}

              {results && results.length > 0 && (
                <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
                  {results.map((artist) => (
                      <div
                        key={artist.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2.5"
                      >
                        {artist.avatar ? (
                          <img src={artist.avatar} alt={artist.name} className="w-9 h-9 rounded-lg object-cover" />
                        ) : (
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white ${getAvatarClass('ARTIST')}`}>
                            {(artist.name || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-white">{artist.name}</span>
                          {(artist.city || artist.country) && (
                            <span className="block truncate text-[11px] text-white/35">
                              {[artist.city, artist.country].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary btn-small shrink-0"
                          disabled={busy}
                          onClick={() => askArtist(artist)}
                        >
                          {t('verify.vouchAsk')}
                        </button>
                      </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="bg-transparent border-none text-white/40 text-xs cursor-pointer hover:text-white/60"
                onClick={() => { setStep('choose'); setError(null); }}
              >
                {t('common.back')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentVerificationPanel;
