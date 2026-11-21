import React, { useRef, useState } from 'react';
import OverlayPortal from './OverlayPortal';
import LoadingGlobe from './LoadingGlobe';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import { downscaleImageToDataUrl } from '../../utils/image';
import { genresList } from '../../data/profiles';
import { mediaUrls, isNewMedia } from './ProfileMediaEditors';

/**
 * "Fill with Claude": the member hands over links, text, a press-kit PDF or
 * flyers; Claude drafts profile fields; the member ticks what to keep and the
 * ticked fields go into the edit form (nothing is saved until Save). Fields
 * that already hold a value start unticked, and a set Instagram handle is
 * never offered (changing it would reset the profile's verification).
 */
const MAX_FILES = 3;
const LINK_KEYS = ['soundcloud', 'spotify', 'bandcamp', 'residentAdvisor', 'instagram', 'website'];
const LINK_LABEL = { soundcloud: 'SoundCloud', spotify: 'Spotify', bandcamp: 'Bandcamp', residentAdvisor: 'Resident Advisor', instagram: 'Instagram', website: 'Website' };

/** A picked file as a data URL Claude can read: images downscaled, PDFs as they are. */
async function fileForClaude(file) {
  if (file.type.startsWith('image/')) return { dataUrl: await downscaleImageToDataUrl(file, { maxDimension: 1600, quality: 0.85 }) };
  if (file.type !== 'application/pdf') throw new Error('PDF, PNG, JPG or WebP');
  return { dataUrl: await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }) };
}

const FillWithClaudeSheet = ({ profileId, current, onApply, onClose }) => {
  const { t, language } = useLanguage();
  const [links, setLinks] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // { name, dataUrl }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { draft, unread }
  const [keep, setKeep] = useState({});
  const fileRef = useRef(null);

  const addFiles = async (e) => {
    const picked = [...e.target.files].slice(0, MAX_FILES - files.length);
    e.target.value = '';
    try {
      const read = await Promise.all(picked.map(async (f) => ({ name: f.name, ...(await fileForClaude(f)) })));
      setFiles((prev) => [...prev, ...read].slice(0, MAX_FILES));
    } catch (err) { appAlert(err.message); }
  };

  // The fields Claude filled, each with its review label; empty ones are not shown.
  const rows = (draft) => {
    const out = [];
    if (draft.bio) out.push({ key: 'bio', label: t('fill.shortBio'), value: draft.bio });
    if (draft.bioLong) out.push({ key: 'bioLong', label: t('fill.fullBio'), value: draft.bioLong });
    if (draft.genres?.length) out.push({ key: 'genres', label: t('fill.genres'), value: draft.genres.join(', ') });
    if (draft.city) out.push({ key: 'location', label: t('fill.location'), value: [draft.city, draft.country].filter(Boolean).join(', ') });
    if (draft.pronouns) out.push({ key: 'pronouns', label: t('fill.pronouns'), value: draft.pronouns });
    for (const k of LINK_KEYS) {
      if (!draft[k] || (k === 'instagram' && current.instagram)) continue;
      out.push({ key: k, label: LINK_LABEL[k], value: draft[k] });
    }
    (draft.highlights || []).forEach((h, i) => out.push({ key: `h${i}`, label: t('fill.highlight'), value: [h.venue, h.city || h.artist, h.year].filter(Boolean).join(' · '), highlight: h }));
    (draft.sets || []).forEach((m, i) => out.push({ key: `s${i}`, label: t('artistPage.sets'), value: m.title || m.url, set: m }));
    (draft.releases || []).forEach((r, i) => out.push({ key: `r${i}`, label: t('artistPage.releases'), value: [r.title, r.type, r.label, r.year].filter(Boolean).join(' · '), release: r }));
    return out;
  };

  const read = async () => {
    setBusy(true);
    try {
      const r = await apiService.fillProfile(profileId, {
        links: links.split(/\s+/).filter(Boolean), text, files: files.map((f) => ({ dataUrl: f.dataUrl })),
        genres: genresList, lang: language,
      });
      // Untouched fields start ticked; a field the member already filled waits for their tick.
      const filled = (key) => (key === 'location' ? current.city : key === 'genres' ? current.genres?.length : current[key]);
      // List items (shows, sets, releases) are added, never replace: ticked unless already on the profile.
      const have = mediaUrls(current);
      const fresh = (row) => (row.set || row.release ? isNewMedia(row.set || row.release, have) : true);
      setKeep(Object.fromEntries(rows(r.draft).map((row) => [row.key, row.highlight || row.set || row.release ? fresh(row) : !filled(row.key)])));
      setResult(r);
    } catch (err) {
      appAlert(err.message || t('common.error'));
    } finally { setBusy(false); }
  };

  const apply = () => {
    const d = result.draft;
    const picked = rows(d).filter((row) => keep[row.key]);
    const fields = {};
    for (const row of picked) {
      if (row.highlight) (fields.highlights ||= []).push(row.highlight);
      else if (row.set) (fields.sets ||= []).push(row.set);
      else if (row.release) (fields.releases ||= []).push(row.release);
      else if (row.key === 'location') Object.assign(fields, { city: d.city, country: d.country, zone: d.zone });
      else fields[row.key] = d[row.key];
    }
    onApply(fields);
    onClose();
  };

  const list = result ? rows(result.draft) : [];
  return (
    <OverlayPortal>
      <div className="delete-modal-overlay" onClick={busy ? undefined : onClose}>
        <div className="delete-modal fill-claude-modal" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-content">
            <h2 className="modal-title">✦ {t('fill.title')}</h2>
            {busy ? (
              <div className="py-10"><LoadingGlobe label={t('fill.reading')} /></div>
            ) : !result ? (
              <>
                <p className="form-hint" style={{ marginTop: 0 }}>{t('fill.intro')}</p>
                <div className="form-group">
                  <label>{t('fill.links')}</label>
                  <textarea rows={3} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://soundcloud.com/…&#10;https://yourwebsite.com&#10;https://www.dropbox.com/… · https://drive.google.com/…" />
                  <small className="form-hint">{t('fill.linksHint')}</small>
                </div>
                <div className="form-group">
                  <label>{t('fill.text')}</label>
                  <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('fill.textHint')} />
                </div>
                <div className="form-group">
                  <label>{t('fill.files')}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {files.map((f, i) => (
                      <span key={f.name + i} className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs text-white/80">
                        {f.name}
                        <button type="button" className="cursor-pointer border-0 bg-transparent text-white/50" aria-label={t('common.delete')} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
                      </span>
                    ))}
                    {files.length < MAX_FILES && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>+ {t('fill.addFile')}</button>
                    )}
                    <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple hidden onChange={addFiles} />
                  </div>
                  <small className="form-hint">{t('fill.filesHint')}</small>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline flex-1" onClick={onClose}>{t('common.cancel')}</button>
                  <button type="button" className="btn btn-primary flex-1" disabled={!links.trim() && !text.trim() && !files.length} onClick={read}>{t('fill.read')}</button>
                </div>
              </>
            ) : (
              <>
                <p className="form-hint" style={{ marginTop: 0 }}>{list.length ? t('fill.reviewHint') : t('fill.nothing')}</p>
                {result.unread?.length > 0 && (
                  <p className="form-hint" style={{ color: 'var(--color-role-venue, #FF5757)' }}>{t('fill.unread', { links: result.unread.join(', ') })}</p>
                )}
                {result.draft?.notes && <p className="form-hint">{result.draft.notes}</p>}
                <div className="flex flex-col gap-2">
                  {list.map((row) => (
                    <label key={row.key} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <input type="checkbox" className="mt-1" checked={!!keep[row.key]} onChange={(e) => setKeep({ ...keep, [row.key]: e.target.checked })} />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{row.label}</span>
                        <span className="block whitespace-pre-wrap break-words text-sm text-white/90">{row.value}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn btn-outline flex-1" onClick={() => setResult(null)}>{t('common.back')}</button>
                  <button type="button" className="btn btn-primary flex-1" disabled={!list.some((row) => keep[row.key])} onClick={apply}>{t('fill.apply')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default FillWithClaudeSheet;
