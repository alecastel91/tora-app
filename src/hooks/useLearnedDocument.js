import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { appAlert } from '../utils/dialogs';
import { showToast } from '../utils/toast';

/**
 * The "learn from past PDFs, review, save" skeleton shared by the invoice
 * style and the contract template sections. `saved` is what the server
 * holds, `draft` what the member is editing; `onFiles` handles the hidden
 * file input (PDF only, 10 MB, at most `maxFiles`).
 *
 * api: { get(profileId) → response, learn(profileId, files) → response,
 *        save(profileId, draft) → response }, with `pick(response)` naming the
 * document inside each response and `onLoaded(response)` for any extras.
 */
export default function useLearnedDocument({ profileId, api, pick, maxFiles, toasts, onLoaded }) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    api.get(profileId).then((r) => { setSaved(pick(r)); setDraft(pick(r)); if (onLoaded) onLoaded(r); }).catch(() => {});
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (err) { appAlert(err.message || t('common.error')); } finally { setBusy(false); }
  };

  const onFiles = (e) => {
    const files = [...(e.target.files || [])].slice(0, maxFiles);
    e.target.value = '';
    if (!files.length) return;
    if (files.some((f) => f.type !== 'application/pdf' || f.size > 10 * 1024 * 1024)) { appAlert(t('invoices.pdfOnly')); return; }
    return act(async () => { setDraft(pick(await api.learn(profileId, files))); showToast(toasts.learned); });
  };

  const save = () => draft && act(async () => {
    const clean = pick(await api.save(profileId, draft));
    setSaved(clean); setDraft(clean);
    showToast(toasts.saved);
  });

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  return { saved, draft, setDraft, busy, dirty, onFiles, save };
}
