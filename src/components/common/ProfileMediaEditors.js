import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import { downscaleImageToDataUrl } from '../../utils/image';
import { appAlert } from '../../utils/dialogs';
import { publicPageUrl } from './PublicPageCard';

/* Edit Profile editors for the artist-page lists and the public page.
   One rule for every list: paste one link, the server fills in title and
   artwork (POST /profiles/:id/media-preview); the member only renames,
   reorders or removes. Caps mirror tora-backend utils/profileMedia.js. */

export const MEDIA_CAPS = { sets: 6, releases: 12, videos: 4, pressPhotos: 8, nights: 6 };
const PROVIDER_LABEL = { soundcloud: 'SoundCloud', mixcloud: 'Mixcloud', youtube: 'YouTube', vimeo: 'Vimeo', bandcamp: 'Bandcamp', spotify: 'Spotify', beatport: 'Beatport' };
const NIGHT_FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'OCCASIONAL'];

const newId = () => Math.random().toString(36).slice(2, 14);
const move = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
};

const Hint = ({ children }) => <p className="m-0 mb-3 text-xs leading-relaxed text-white/45">{children}</p>;

const Thumb = ({ src, wide }) => (
  src
    ? <img src={src} alt="" className={`shrink-0 rounded-md object-cover ${wide ? 'h-10 w-[72px]' : 'h-12 w-12'}`} />
    : <span className={`shrink-0 rounded-md bg-[#1c1c24] ${wide ? 'h-10 w-[72px]' : 'h-12 w-12'}`} />
);

// Reorder arrows sit on the small line under the title; delete stays on the
// right. Three round buttons on the right left the title ~120px on a phone.
const MoveButtons = ({ index, count, onMove }) => {
  const { t } = useLanguage();
  if (count < 2) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button type="button" aria-label={t('artistPage.moveUp')} disabled={index === 0} onClick={() => onMove(index, index - 1)} className="media-row-btn media-row-btn-sm">↑</button>
      <button type="button" aria-label={t('artistPage.moveDown')} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className="media-row-btn media-row-btn-sm">↓</button>
    </span>
  );
};

const RemoveButton = ({ index, onRemove }) => {
  const { t } = useLanguage();
  return <button type="button" aria-label={t('common.delete')} onClick={() => onRemove(index)} className="media-row-btn shrink-0 hover:!text-role-venue">×</button>;
};

/** The paste box: an input + Add, asking the server what the link is. */
const PasteLink = ({ profileId, kind, placeholder, disabled, onPreview }) => {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const add = async () => {
    const url = value.trim();
    if (!url || busy) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await apiService.previewMediaLink(profileId, url, kind);
      onPreview(preview);
      setValue('');
    } catch (err) {
      setError(err.code === 'UNSUPPORTED_LINK' ? t('artistPage.linkNotSupported') : t('artistPage.linkUnreadable'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="url"
          className="form-input min-w-0 flex-1"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn btn-outline shrink-0" disabled={disabled || busy || !value.trim()} onClick={add}>
          {busy ? t('artistPage.readingLink') : t('artistPage.add')}
        </button>
      </div>
      {error && <p className="m-0 text-[11px] text-role-venue/90">{error}</p>}
    </div>
  );
};

/** Sets (kind 'set') or Videos (kind 'video'): link items with an editable title. */
export const MediaLinksEditor = ({ profileId, kind, items, onChange }) => {
  const { t } = useLanguage();
  const list = Array.isArray(items) ? items : [];
  const cap = kind === 'set' ? MEDIA_CAPS.sets : MEDIA_CAPS.videos;
  const add = (p) => {
    if (list.some((x) => x.url === p.url)) return;
    onChange([...list, { id: newId(), url: p.url, provider: p.provider, title: p.title || '', image: p.image || null }].slice(0, cap));
  };
  return (
    <div className="flex flex-col gap-2.5">
      <PasteLink
        profileId={profileId}
        kind={kind}
        disabled={list.length >= cap}
        placeholder={kind === 'set' ? t('artistPage.pasteSetLink') : t('artistPage.pasteVideoLink')}
        onPreview={add}
      />
      {list.map((item, i) => (
        <div key={item.id || item.url} className="media-row">
          <Thumb src={item.image} wide={kind === 'video'} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <input
              type="text"
              className="form-input w-full min-w-0 !py-1.5 !text-[13px]"
              value={item.title || ''}
              placeholder={PROVIDER_LABEL[item.provider]}
              maxLength={120}
              onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
            />
            <span className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-white/40">{PROVIDER_LABEL[item.provider]}</span>
              <MoveButtons index={i} count={list.length} onMove={(a, b) => onChange(move(list, a, b))} />
            </span>
          </span>
          <RemoveButton index={i} onRemove={(k) => onChange(list.filter((_, j) => j !== k))} />
        </div>
      ))}
      <p className="m-0 text-[10px] text-white/30">{list.length}/{cap}</p>
    </div>
  );
};

/**
 * Releases: a pasted store link fills cover, title, year and type. Pasting
 * the same release from another store adds that store's button to the
 * existing entry instead of a duplicate (matched by title).
 */
export const ReleasesEditor = ({ profileId, items, onChange }) => {
  const { t } = useLanguage();
  const list = Array.isArray(items) ? items : [];
  const add = (p) => {
    const same = p.title ? list.findIndex((r) => r.title && r.title.trim().toLowerCase() === p.title.trim().toLowerCase()) : -1;
    if (same >= 0) {
      const r = list[same];
      if ((r.links || []).some((l) => l.store === p.store)) return;
      onChange(list.map((x, j) => (j === same ? { ...x, image: x.image || p.image, links: [...(x.links || []), { store: p.store, url: p.url }] } : x)));
      return;
    }
    if (list.length >= MEDIA_CAPS.releases) return;
    onChange([...list, { id: newId(), title: p.title || '', type: p.type || null, year: p.year || null, label: '', image: p.image || null, links: [{ store: p.store, url: p.url }] }]);
  };
  const patch = (i, changes) => onChange(list.map((x, j) => (j === i ? { ...x, ...changes } : x)));
  return (
    <div className="flex flex-col gap-2.5">
      <PasteLink profileId={profileId} kind="release" placeholder={t('artistPage.pasteReleaseLink')} onPreview={add} />
      {list.map((r, i) => (
        <div key={r.id || i} className="media-row items-start">
          <Thumb src={r.image} />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input type="text" className="form-input w-full min-w-0 !py-1.5 !text-[13px]" value={r.title || ''} maxLength={120} placeholder={t('artistPage.releaseTitle')} onChange={(e) => patch(i, { title: e.target.value })} />
            <span className="flex gap-1.5">
              <input type="text" className="form-input min-w-0 flex-[2] !py-1.5 !text-[12px]" value={r.label || ''} maxLength={120} placeholder={t('artistPage.labelShort')} onChange={(e) => patch(i, { label: e.target.value })} />
              <input type="text" inputMode="numeric" className="form-input !py-1.5 !text-[12px] w-[70px]" value={r.year || ''} maxLength={4} placeholder={t('editProfile.yearPlaceholder')} onChange={(e) => patch(i, { year: e.target.value.replace(/[^0-9]/g, '') })} />
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {(r.links || []).map((l) => (
                <span key={l.store} className="store-badge inline-flex items-center gap-1">
                  {PROVIDER_LABEL[l.store] || l.store}
                  {(r.links || []).length > 1 && (
                    <button type="button" aria-label={t('common.delete')} className="cursor-pointer border-0 bg-transparent p-0 text-white/40 hover:text-white" onClick={() => patch(i, { links: r.links.filter((x) => x.store !== l.store) })}>×</button>
                  )}
                </span>
              ))}
              <span className="ml-auto"><MoveButtons index={i} count={list.length} onMove={(a, b) => onChange(move(list, a, b))} /></span>
            </span>
          </span>
          <RemoveButton index={i} onRemove={(k) => onChange(list.filter((_, j) => j !== k))} />
        </div>
      ))}
      <p className="m-0 text-[10px] text-white/30">{list.length}/{MEDIA_CAPS.releases}</p>
    </div>
  );
};

/** Press photos with the photographer's credit, printed under each photo. */
export const PressPhotosEditor = ({ items, onChange }) => {
  const { t } = useLanguage();
  const list = Array.isArray(items) ? items : [];
  const inputRef = useRef(null);
  const addFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || list.length >= MEDIA_CAPS.pressPhotos) return;
    try {
      const url = await downscaleImageToDataUrl(file, { maxDimension: 1600, quality: 0.85 });
      onChange([...list, { url, credit: '' }]);
    } catch (err) {
      appAlert(err.message || t('editProfile.saveFailed'));
    }
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {list.map((p, i) => (
          <div key={p.url} className="flex flex-col gap-1">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button type="button" aria-label={t('common.delete')} onClick={() => onChange(list.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/70 text-sm text-white">×</button>
            </div>
            <input type="text" className="form-input !px-2 !py-1 !text-[11px]" maxLength={80} value={p.credit || ''} placeholder={t('artistPage.credit')} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, credit: e.target.value } : x)))} />
          </div>
        ))}
        {list.length < MEDIA_CAPS.pressPhotos && (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 bg-transparent text-white/50 transition-colors hover:border-infrared/50 hover:text-infrared">
            <span className="text-2xl leading-none">+</span>
            <span className="font-tech text-[9px] uppercase tracking-[0.15em]">{t('editProfile.addPhoto')}</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={addFile} style={{ display: 'none' }} />
    </div>
  );
};

/** Nights a promoter (as a person) runs: name, where, how often. */
export const NightsEditor = ({ items, onChange }) => {
  const { t } = useLanguage();
  const list = Array.isArray(items) ? items : [];
  const patch = (i, changes) => onChange(list.map((x, j) => (j === i ? { ...x, ...changes } : x)));
  return (
    <div className="flex flex-col gap-2.5">
      {list.map((n, i) => (
        <div key={n.id || i} className="media-row flex-col !items-stretch">
          <span className="flex gap-2">
            <input type="text" className="form-input min-w-0 flex-1" maxLength={80} value={n.name || ''} placeholder={t('artistPage.nightName')} onChange={(e) => patch(i, { name: e.target.value })} />
            <MoveButtons index={i} count={list.length} onMove={(a, b) => onChange(move(list, a, b))} />
            <RemoveButton index={i} onRemove={(k) => onChange(list.filter((_, j) => j !== k))} />
          </span>
          <span className="flex gap-2">
            <input type="text" className="form-input min-w-0 flex-1 !text-[13px]" maxLength={80} value={n.venue || ''} placeholder={t('artistPage.nightVenue')} onChange={(e) => patch(i, { venue: e.target.value })} />
            <input type="text" className="form-input min-w-0 flex-1 !text-[13px]" maxLength={60} value={n.city || ''} placeholder={t('editProfile.city')} onChange={(e) => patch(i, { city: e.target.value })} />
            <select className="form-input !w-auto !text-[13px]" value={n.frequency || ''} onChange={(e) => patch(i, { frequency: e.target.value || null })}>
              <option value="">{t('artistPage.howOften')}</option>
              {NIGHT_FREQUENCIES.map((f) => <option key={f} value={f}>{t(`artistPage.freq_${f}`)}</option>)}
            </select>
          </span>
        </div>
      ))}
      {list.length < MEDIA_CAPS.nights && (
        <button type="button" className="btn btn-outline" onClick={() => onChange([...list, { id: newId(), name: '', venue: '', city: '', frequency: null }])}>
          + {t('artistPage.addNight')}
        </button>
      )}
    </div>
  );
};

const Toggle = ({ on, onClick, disabled, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick} className={`public-toggle ${on ? 'is-on' : ''}`}>
    <span />
  </button>
);

const SLUG_ERRORS = {
  SLUG_TAKEN: 'artistPage.slugTaken',
  SLUG_RESERVED: 'artistPage.slugReserved',
  SLUG_INVALID: 'artistPage.slugInvalid',
  SLUG_RENAME_TOO_SOON: 'artistPage.slugTooSoon',
};

/**
 * Publish / unpublish, the link, the press kit. These save immediately
 * (they are settings, not profile text), so Cancel on the form never undoes
 * a publish the member just confirmed.
 */
export const PublicPageSettings = ({ profileId }) => {
  const { t } = useLanguage();
  const [state, setState] = useState(null);
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiService.getPublicPage(profileId)
      .then((s) => { if (!cancelled) { setState(s); setSlug(s.slug || ''); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profileId]);

  if (!state) return null;
  if (state.problem && state.problem !== 'VERIFICATION_REQUIRED') return null;

  const save = async (changes) => {
    setBusy(true);
    setError(null);
    try {
      const next = await apiService.updatePublicPage(profileId, changes);
      setState(next);
      setSlug(next.slug || '');
    } catch (err) {
      const key = SLUG_ERRORS[err.code];
      if (key) setError(t(key, { date: err.response?.data?.nextSlugChangeAt ? new Date(err.response.data.nextSlugChangeAt).toLocaleDateString(t('dateFormat.locale')) : '' }));
      else if (err.code !== 'VERIFICATION_REQUIRED') setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const slugChanged = slug.trim().toLowerCase() !== (state.slug || '');

  return (
    <div className="flex flex-col gap-3">
      <div className="media-row">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{t('artistPage.publish')}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
            {state.problem === 'VERIFICATION_REQUIRED' ? t('artistPage.publishNeedsVerification') : t('artistPage.publishHint')}
          </span>
        </span>
        <Toggle on={!!state.enabled} disabled={busy} label={t('artistPage.publish')} onClick={() => save({ enabled: !state.enabled })} />
      </div>

      {!state.problem && (
        <div className="form-group !mb-0">
          <label>{t('artistPage.yourLink')}</label>
          <div className="flex gap-2">
            <span className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#0a0a0e] pl-3">
              <span className="shrink-0 text-[13px] text-white/40">torahub.io/@</span>
              <input type="text" className="form-input !border-0 !bg-transparent !pl-0.5" value={slug} maxLength={30} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} />
            </span>
            {slugChanged && <button type="button" className="btn btn-outline shrink-0" disabled={busy || !slug} onClick={() => save({ slug })}>{t('artistPage.saveLink')}</button>}
          </div>
          <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-white/40">{t('artistPage.yourLinkHint')}</p>
        </div>
      )}

      {!state.problem && (
        <div className="media-row">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">{t('artistPage.pressKit')}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-white/45">{t('artistPage.pressKitHint')}</span>
          </span>
          <Toggle on={!!state.pressKitEnabled} disabled={busy} label={t('artistPage.pressKit')} onClick={() => save({ pressKitEnabled: !state.pressKitEnabled })} />
        </div>
      )}

      {error && <p className="m-0 text-[12px] text-role-venue/90">{error}</p>}

      {state.enabled && state.slug && (
        <a href={publicPageUrl(state.slug)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-infrared no-underline hover:underline">
          {t('artistPage.seeWhatPeopleSee')} ↗
        </a>
      )}
    </div>
  );
};
