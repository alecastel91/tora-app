import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { appAlert } from '../utils/dialogs';
import { showToast } from '../utils/toast';

/**
 * The member's document templates (invoices or contracts): list, add from a
 * Word / PDF file or as a blank basic layout, rename / edit, delete, make
 * default, render a sample. `api` is the matching group of apiService
 * methods: { list, add, update, remove, setDefault, sample }.
 */
export default function useDocumentTemplates({ profileId, api, toasts }) {
  const { t } = useLanguage();
  const [data, setData] = useState({ templates: [], defaultId: null, converter: { docx: true } });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // 'reading' | 'saving' | template id

  const load = useCallback(() => {
    if (!profileId) return;
    api.list(profileId).then((r) => setData({ ...r, templates: r.templates || [] })).catch(() => {}).finally(() => setLoading(false));
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  const act = async (label, fn) => {
    if (busy) return null;
    setBusy(label);
    try { return await fn(); } catch (err) { appAlert(err.message || t('common.error')); return null; } finally { setBusy(null); }
  };

  /** Add from file(s) (kind 'file' or 'basic') or a blank basic layout (kind 'blank'). */
  const add = (files, kind = 'file', name) => act('reading', async () => {
    const r = await api.add(profileId, { files, kind, name });
    setData((d) => ({ ...d, templates: r.templates, defaultId: r.defaultId }));
    showToast(toasts.added);
    return r.template;
  });
  const update = (id, body) => act(id, async () => {
    const r = await api.update(profileId, id, body);
    setData((d) => ({ ...d, templates: d.templates.map((x) => (x.id === id ? r.template : x)) }));
    showToast(toasts.saved);
    return r.template;
  });
  const remove = (id) => act(id, async () => {
    const r = await api.remove(profileId, id);
    setData((d) => ({ ...d, templates: r.templates, defaultId: r.defaultId }));
    showToast(toasts.removed);
  });
  const makeDefault = (id) => act(id, async () => {
    const r = await api.setDefault(profileId, id);
    setData((d) => ({ ...d, templates: r.templates, defaultId: r.defaultId }));
    showToast(toasts.defaultSet);
  });
  /** A PDF blob URL of the template filled with a sample booking. */
  const sample = (id) => act(id, () => api.sample(profileId, id));

  return { ...data, loading, busy, reload: load, add, update, remove, makeDefault, sample };
}
