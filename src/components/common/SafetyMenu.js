import React, { useEffect, useRef, useState } from 'react';
import ReportDialog from './ReportDialog';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { confirmBlock } from '../../utils/blockActions';

/**
 * Report + block for a PERSON, the two controls App Review guideline 1.2 asks
 * for on any surface carrying user content. Two shapes:
 *
 *   variant="menu"   an overflow button with a dropdown — the chat header,
 *                    where there is no end of the page to put anything at.
 *   variant="footer" a quiet row at the end of a profile. Safety actions are
 *                    rare and deliberate; at the top they crowd the back arrow
 *                    and invite mis-taps, at the end they are found when
 *                    looked for.
 *
 * Blocking always acts on the PERSON behind `profile`, never one profile of
 * theirs. Reporting a post is ReportDialog directly — see NewsScreen.
 */
const SafetyMenu = ({ profile, variant = 'menu', onBlocked, className = '' }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!profile?.id || profile.id === user?.id) return null;

  const block = async () => {
    setOpen(false);
    if (await confirmBlock(profile, t) && onBlocked) onBlocked();
  };

  return (
    <div ref={wrapRef} className={`${variant === 'footer' ? 'safety-footer' : 'safety-menu'} ${className}`}>
      {variant === 'footer' ? (
        <>
          <button type="button" className="safety-footer-action" onClick={() => setReporting(true)}>
            {t('safety.reportProfile')}
          </button>
          <button type="button" className="safety-footer-action is-danger" onClick={block}>
            {t('safety.blockMember', { name: profile.name })}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            aria-label={t('safety.moreActions')}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="safety-menu-trigger"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>

          {open && (
            <div className="safety-menu-list" role="menu">
              <button type="button" role="menuitem" onClick={() => { setOpen(false); setReporting(true); }}>
                {t('safety.reportProfile')}
              </button>
              <button type="button" role="menuitem" className="is-danger" onClick={block}>
                {t('safety.blockMember', { name: profile.name })}
              </button>
            </div>
          )}
        </>
      )}

      {reporting && (
        <ReportDialog targetId={profile.id} name={profile.name} onClose={() => setReporting(false)} />
      )}
    </div>
  );
};

export default SafetyMenu;
