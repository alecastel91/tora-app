import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import OverlayPortal from './OverlayPortal';
import { isStandalone, isIos, canPromptInstall, promptInstall, onInstallAvailabilityChange } from '../../services/install';

// The iOS Share glyph (box with arrow out the top), inline with the step text.
const ShareGlyph = () => (
  <svg
    viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    className="mx-0.5 inline-block align-[-2px] text-white"
  >
    <path d="M12 14V3" />
    <path d="M8.5 6.5 12 3l3.5 3.5" />
    <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
  </svg>
);

// Same beta-surface detection as vite.config.js — show the BETA-badged icon
// the user will actually get on their home screen.
const ICON = (import.meta.env.VITE_API_URL || '').includes('-2424')
  ? '/pwa-beta-192.png' : '/pwa-192.png';

/**
 * "Get the TORA app" bottom sheet, opened from Settings → TORA App only (it no
 * longer pops up by itself). Android/desktop Chromium gets the REAL one-tap
 * native install (captured beforeinstallprompt); iOS gets the two-step
 * Add-to-Home-Screen instructions Apple mandates.
 */
const InstallSheet = ({ onClose }) => {
  const { t } = useLanguage();
  const [nativeReady, setNativeReady] = useState(canPromptInstall());

  useEffect(() => onInstallAvailabilityChange(() => setNativeReady(canPromptInstall())), []);

  const install = async () => {
    await promptInstall();
    onClose();
  };

  return (
    <OverlayPortal>
      <div className="message-modal-overlay" onClick={onClose}>
        <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
          <img src={ICON} alt="" className="mx-auto mb-3 h-14 w-14 rounded-[14px]" />
          <h2 className="message-modal-title">{t('install.title')}</h2>
          <p className="m-0 mb-4 text-center text-[13px] leading-relaxed text-white/60">
            {t('install.subtitle')}
          </p>

          {isIos() && !nativeReady ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-[13px] leading-relaxed text-white/75">
              <p className="m-0">
                <span className="font-semibold text-white">1.</span> {t('install.ios1')} <ShareGlyph />
              </p>
              <p className="m-0 mt-2">
                <span className="font-semibold text-white">2.</span> {t('install.ios2')}
              </p>
            </div>
          ) : nativeReady ? (
            <button className="btn btn-primary btn-full mb-2" onClick={install}>
              {t('install.cta')}
            </button>
          ) : (
            // Chromium without a captured prompt (already installed elsewhere,
            // or an unsupported in-app browser): show the generic path.
            <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-[13px] leading-relaxed text-white/75">
              <p className="m-0">{t('install.genericHint')}</p>
            </div>
          )}

          <button className="btn btn-secondary btn-full" onClick={onClose}>
            {t('install.later')}
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
};

/** Settings section: opens the install sheet, or confirms the app is installed when running standalone. */
export const InstallSettingsSection = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <div className="settings-item">
      {isStandalone() ? (
        <p className="m-0 text-sm text-white/70">{t('install.installedNote')}</p>
      ) : (
        <>
          <p className="m-0 mb-2 text-xs leading-relaxed text-white/50">{t('install.settingsBody')}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
            {t('install.settingsCta')}
          </button>
          {open && <InstallSheet onClose={() => setOpen(false)} />}
        </>
      )}
    </div>
  );
};
