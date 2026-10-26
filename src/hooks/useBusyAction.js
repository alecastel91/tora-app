import { useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { appAlert } from '../utils/dialogs';
import { showToast } from '../utils/toast';

/**
 * One in-flight action at a time for a card or modal: `run(fn, opts)` sets
 * `busy`, awaits fn, shows `opts.toast` (an i18n key) on success, then calls
 * `after` (typically a reload). Errors go to appAlert unless `opts.onError(e)`
 * returns true to say it handled them. Double taps while busy are ignored.
 */
export default function useBusyAction(after) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const run = async (fn, { toast, onError } = {}) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      await fn();
      if (toast) showToast(toast);
      if (after) await after();
    } catch (e) {
      if (!onError || !onError(e)) appAlert(e.message || t('common.error'));
    } finally { busyRef.current = false; setBusy(false); }
  };
  return [busy, run];
}
