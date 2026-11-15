import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import OverlayPortal from './OverlayPortal';
import BioTranslate from './BioTranslate';

/* "Read full bio" under the short bio: the profile's long bio opens in a
   bottom sheet, with its own Translate. Renders nothing without one. */
const FullBio = ({ text, name }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!text || !text.trim()) return null;
  return (
    <>
      <button
        type="button"
        className="mt-1 block bg-transparent border-none p-0 text-infrared text-xs cursor-pointer hover:underline"
        onClick={() => setOpen(true)}
      >
        {t('artistPage.readFullBio')}
      </button>
      {open && (
        <OverlayPortal>
          <div className="message-modal-overlay" onClick={() => setOpen(false)}>
            <div className="message-modal-bottom full-bio-sheet" role="dialog" aria-label={t('artistPage.fullBio')} onClick={(e) => e.stopPropagation()}>
              <h2 className="poster-h2">{t('artistPage.fullBio')}</h2>
              {name && <p className="m-0 mb-3 font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-white">{name}</p>}
              <p className="poster-bio m-0 whitespace-pre-line">{text}</p>
              <BioTranslate text={text} />
              <div className="message-modal-actions">
                <button type="button" className="btn btn-outline btn-modal-cancel" onClick={() => setOpen(false)}>{t('common.close')}</button>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}
    </>
  );
};

export default FullBio;
