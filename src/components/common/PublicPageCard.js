import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import { showToast } from '../../utils/toast';
import { LinkIcon } from '../../utils/icons';

export const PUBLIC_SITE = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://torahub.io').replace(/\/$/, '');
export const publicPageUrl = (slug) => `${PUBLIC_SITE}/@${slug}`;

const igStepKey = (profileId) => `tora:ig-bio-step:${profileId}`;
const readIgStep = (profileId) => { try { return localStorage.getItem(igStepKey(profileId)) === '1'; } catch { return false; } };

/* An artist's own profile: is my public page live, my link (one tap copies
   it), and the one step that makes the page work — putting the link in the
   Instagram bio. Publishing itself lives in Edit profile → Public page; this
   card only offers it. Venues, promoters and agents have no public page yet,
   so the caller renders this for artists only. */
const PublicPageCard = ({ profile, onVerify, onEdit, compact = false }) => {
  const { t } = useLanguage();
  const [state, setState] = useState(null);
  const [igDone, setIgDone] = useState(() => readIgStep(profile?.id));

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setIgDone(readIgStep(profile?.id));
    if (!profile?.id) return undefined;
    apiService.getPublicPage(profile.id)
      .then((s) => { if (!cancelled) setState(s); })
      .catch(() => { if (!cancelled) setState(null); });
    return () => { cancelled = true; };
    // Saving the profile can change what the page shows, not whether it is live.
  }, [profile?.id, profile?.verifyStatus]);

  if (!state) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicPageUrl(state.slug));
      showToast('artistPage.linkCopied');
    } catch {
      window.prompt(t('artistPage.copyLink'), publicPageUrl(state.slug));
    }
  };

  const markIgDone = () => {
    try { localStorage.setItem(igStepKey(profile.id), '1'); } catch { /* private mode: the tick just won't stick */ }
    setIgDone(true);
  };

  if (state.problem === 'VERIFICATION_REQUIRED') {
    return (
      <button type="button" onClick={onVerify} className={`public-page-card w-full cursor-pointer text-left ${compact ? "" : "mb-5"}`}>
        <span className="public-page-dot bg-white/25" />
        <span className="min-w-0 flex-1 text-[13px] text-white/70">{t('artistPage.publishNeedsVerification')}</span>
        <span className="shrink-0 text-[12px] font-semibold text-infrared">{t('verify.verifyButton')}</span>
      </button>
    );
  }
  if (state.problem) return null;

  if (!state.enabled) {
    return (
      <button type="button" onClick={onEdit} className={`public-page-card w-full cursor-pointer text-left ${compact ? "" : "mb-5"}`}>
        <span className="public-page-dot bg-white/25" />
        <span className="min-w-0 flex-1 text-[13px] text-white/70">{t('artistPage.pageOff')}</span>
        <span className="shrink-0 text-[12px] font-semibold text-infrared">{t('artistPage.publish')}</span>
      </button>
    );
  }

  return (
    <div className={`flex flex-col gap-2.5 ${compact ? '' : 'mb-5'}`}>
      <div className="public-page-line">
        <span className="public-page-dot bg-[#00C875]" />
        <span className="min-w-0 flex-1 text-[13px] text-white/70">
          <span className="block truncate">{t('artistPage.pageLive')} · {publicPageUrl(state.slug).replace(/^https?:\/\//, '')}</span>
          <a href={publicPageUrl(state.slug)} target="_blank" rel="noopener noreferrer" className="text-[12px] text-infrared no-underline hover:underline">
            {t('artistPage.seeWhatPeopleSee')}
          </a>
        </span>
        <button type="button" onClick={copy} aria-label={t('artistPage.copyLink')} title={t('artistPage.copyLink')} className="public-page-copy">
          <LinkIcon />
        </button>
      </div>
      {!igDone && (
        <div className="public-page-card items-start">
          <button type="button" onClick={markIgDone} aria-label={t('artistPage.igStepDone')} className="public-page-check" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-white">{t('artistPage.igStepTitle')}</span>
            <span className="mt-0.5 block text-[12px] text-white/50">{t('artistPage.igStepBody')}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default PublicPageCard;
