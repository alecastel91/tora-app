import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { registerDialogHost } from '../../utils/dialogs';

/**
 * Renders appAlert / appConfirm dialogs in the Obsidian Neon language
 * (same card as VerificationModal). Mounted once in App.js; dialogs queue
 * so overlapping calls show one at a time.
 */
const AppDialogHost = () => {
  const { t } = useLanguage();
  const [queue, setQueue] = useState([]);

  useEffect(() => registerDialogHost((dialog) =>
    new Promise((resolve) => {
      setQueue((q) => [...q, { ...dialog, resolve }]);
    })
  ), []);

  const current = queue[0];

  const settle = useCallback((value) => {
    setQueue((q) => {
      q[0]?.resolve(value);
      return q.slice(1);
    });
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') settle(current.type === 'confirm' ? false : undefined);
      if (e.key === 'Enter' && current.type === 'alert') settle(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, settle]);

  if (!current) return null;
  const isConfirm = current.type === 'confirm';

  return createPortal(
    <div
      className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/70 p-5"
      onClick={() => settle(isConfirm ? false : undefined)}
    >
      <div
        className="max-w-md w-full rounded-2xl border border-white/10 bg-[#131315]/95 backdrop-blur-xl p-6 text-left"
        onClick={(e) => e.stopPropagation()}
        role={isConfirm ? 'alertdialog' : 'alert'}
      >
        {current.title && (
          <h3 className="m-0 mb-3 text-[15px] font-semibold text-white font-space-grotesk uppercase tracking-[0.08em] text-center">
            {current.title}
          </h3>
        )}
        <p className="m-0 text-sm leading-relaxed text-white/70 text-center whitespace-pre-line">
          {current.message}
        </p>

        {isConfirm ? (
          <div className="flex gap-2.5 mt-6">
            <button type="button" className="btn btn-outline flex-1" onClick={() => settle(false)}>
              {current.cancelLabel || t('common.cancel')}
            </button>
            <button
              type="button"
              className={`btn flex-1 ${current.danger
                ? 'border border-role-venue/60 text-role-venue bg-role-venue/10 hover:bg-role-venue/20'
                : 'btn-primary'}`}
              onClick={() => settle(true)}
            >
              {current.confirmLabel || t('common.confirm')}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary w-full mt-6" onClick={() => settle(undefined)}>
            {t('common.ok')}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AppDialogHost;
