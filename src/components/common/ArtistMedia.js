import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { playerUrl, youtubeId } from '../../utils/mediaLinks';

/* The artist-page sections shared by the own profile, a member's view and
   the desktop pages: Sets, Releases, Videos, Press photos, plus the
   promoter's Nights. Every list is sanitised by the backend
   (utils/profileMedia.js), so items here always have a url and a provider.
   Sets and videos play in one mini-player bar at the bottom of the screen
   instead of stacked embeds. */

const STORE_LABEL = { bandcamp: 'Bandcamp', spotify: 'Spotify', beatport: 'Beatport', soundcloud: 'SoundCloud' };
const PROVIDER_LABEL = { soundcloud: 'SoundCloud', mixcloud: 'Mixcloud', youtube: 'YouTube', vimeo: 'Vimeo' };

const list = (v) => (Array.isArray(v) ? v : []);

const PlayGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
);

// Artwork, or a quiet tile with the provider name when the store gave none.
const Art = ({ src, label, className }) => (
  src
    ? <img src={src} alt="" loading="lazy" className={`block object-cover ${className}`} />
    : <span className={`flex items-center justify-center bg-[#15151b] text-[10px] uppercase tracking-[0.15em] text-white/30 font-tech ${className}`}>{label}</span>
);

/** A section title; on your own profile a "+" beside it opens Edit profile at that section. */
export const SectionTitle = ({ title, onAdd }) => {
  const { t } = useLanguage();
  if (!onAdd) return <p className="poster-h2">{title}</p>;
  return (
    <div className="section-title-row">
      <p className="poster-h2">{title}</p>
      <button type="button" onClick={onAdd} className="section-add" aria-label={`${t('artistPage.addLink')}: ${title}`} title={t('artistPage.addLink')}>+</button>
    </div>
  );
};

const Section = ({ title, onAdd, children }) => (
  <div className="mb-5 text-left">
    <SectionTitle title={title} onAdd={onAdd} />
    {children}
  </div>
);

// Own profile, empty list: a dashed box that opens Edit profile.
const AddBox = ({ label, sub, onClick }) => (
  <button type="button" onClick={onClick} className="artist-add">
    <span className="text-2xl leading-none text-infrared">+</span>
    <span className="text-[13px] text-white/75">{label}</span>
    <span className="text-[11px] text-white/40">{sub}</span>
  </button>
);

// A swipe row on the phone; the desktop pages turn it into a grid (desktop-v3.css).
const Scroller = ({ kind, children }) => (
  <div className={`artist-scroller artist-row-${kind} -mx-1 flex gap-3 overflow-x-auto px-1 pb-1`}>{children}</div>
);

/** One bar at the bottom of the screen; a new item replaces the playing one. */
export const MiniPlayer = ({ item, onClose }) => {
  const { t } = useLanguage();
  const src = playerUrl(item);
  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);
  if (!item || !src) return null;
  // Videos open big, centred over a backdrop, so the controls and the
  // timeline are usable; sets play in the small bar while you keep browsing.
  const video = item.provider === 'youtube' || item.provider === 'vimeo';
  return createPortal(
    <>
    {video && <div className="video-backdrop" onClick={onClose} aria-hidden />}
    <div className={`mini-player ${video ? 'mini-player-video' : ''}`} role={video ? 'dialog' : 'region'} aria-label={item.title || PROVIDER_LABEL[item.provider]}>
      <div className="mini-player-head">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{item.title || PROVIDER_LABEL[item.provider]}</span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-white/50 hover:text-white">
          {PROVIDER_LABEL[item.provider]} ↗
        </a>
        <button type="button" onClick={onClose} aria-label={t('artistPage.closePlayer')} className="mini-player-close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <iframe key={src} src={src} title={item.title || PROVIDER_LABEL[item.provider]} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen className="mini-player-frame" />
    </div>
    </>,
    document.body,
  );
};

/** State for the one mini-player a page has. */
export const usePlayer = () => {
  const [playing, setPlaying] = useState(null);
  return { playing, play: setPlaying, stop: () => setPlaying(null) };
};

export const SetsStrip = ({ sets, onPlay, onAdd }) => {
  const { t } = useLanguage();
  const items = list(sets);
  if (!items.length) {
    return onAdd ? <Section title={t('artistPage.sets')}><AddBox label={t('artistPage.addMix')} sub={t('artistPage.addMixSub')} onClick={onAdd} /></Section> : null;
  }
  return (
    <Section title={t('artistPage.sets')} onAdd={onAdd}>
      <Scroller kind="sets">
        {items.map((s) => (
          <button key={s.id || s.url} type="button" onClick={() => onPlay(s)} className="artist-tile media-item w-[150px] shrink-0">
            <span className="relative block">
              <Art src={s.image} label={PROVIDER_LABEL[s.provider]} className="artist-art h-[150px] w-[150px] rounded-xl" />
              <span className="artist-play"><PlayGlyph /></span>
            </span>
            <span className="mt-2 block truncate text-[13px] font-medium text-white">{s.title || PROVIDER_LABEL[s.provider]}</span>
            <span className="block text-[11px] text-white/45">{PROVIDER_LABEL[s.provider]}</span>
          </button>
        ))}
      </Scroller>
    </Section>
  );
};

export const ReleasesRow = ({ releases, onAdd }) => {
  const { t } = useLanguage();
  const items = list(releases);
  if (!items.length) {
    return onAdd ? <Section title={t('artistPage.releases')}><AddBox label={t('artistPage.addReleases')} sub={t('artistPage.addReleasesSub')} onClick={onAdd} /></Section> : null;
  }
  return (
    <Section title={t('artistPage.releases')} onAdd={onAdd}>
      <Scroller kind="releases">
        {items.map((r) => (
          <div key={r.id || r.title} className="media-item w-[140px] shrink-0">
            <a href={r.links?.[0]?.url} target="_blank" rel="noopener noreferrer" className="block">
              <Art src={r.image} label={t('artistPage.releases')} className="artist-art aspect-square w-[140px] rounded-lg" />
            </a>
            <span className="mt-2 block truncate text-[13px] font-medium text-white">{r.title}</span>
            <span className="block truncate text-[11px] text-white/45">{[r.label, r.year, r.type].filter(Boolean).join(' · ')}</span>
            <span className="mt-1.5 flex flex-wrap gap-1">
              {list(r.links).map((l) => (
                <a key={l.store} href={l.url} target="_blank" rel="noopener noreferrer" className="store-badge">{STORE_LABEL[l.store] || l.store}</a>
              ))}
            </span>
          </div>
        ))}
      </Scroller>
    </Section>
  );
};

/** Videos play right where their preview is: tap the thumbnail and the
    player takes its place, with the provider's own controls. */
export const VideosGrid = ({ videos, onAdd }) => {
  const { t } = useLanguage();
  const [playing, setPlaying] = useState(null);
  const items = list(videos);
  if (!items.length) return null;
  return (
    <Section title={t('artistPage.videos')} onAdd={onAdd}>
      <div className="artist-videos grid grid-cols-1 gap-3">
        {items.map((v) => {
          const key = v.id || v.url;
          const src = playing === key ? playerUrl(v) : null;
          const thumb = v.image || (youtubeId(v.url) ? `https://i.ytimg.com/vi/${youtubeId(v.url)}/hqdefault.jpg` : null);
          return (
            <div key={key} className="min-w-0">
              {src ? (
                <iframe src={src} title={v.title || PROVIDER_LABEL[v.provider]} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen className="block aspect-video w-full rounded-lg border-0 bg-black" />
              ) : (
                <button type="button" onClick={() => setPlaying(key)} className="artist-tile block w-full text-left">
                  <span className="relative block">
                    <Art src={thumb} label={PROVIDER_LABEL[v.provider]} className="aspect-video w-full rounded-lg" />
                    <span className="artist-play artist-play-video"><PlayGlyph /></span>
                  </span>
                </button>
              )}
              <span className="mt-1.5 block truncate text-[13px] text-white/80">{v.title || PROVIDER_LABEL[v.provider]}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
};

export const PressPhotos = ({ photos, onAdd }) => {
  const { t } = useLanguage();
  const items = list(photos);
  const [open, setOpen] = useState(null);
  if (!items.length) return null;
  return (
    <Section title={t('artistPage.pressPhotos')} onAdd={onAdd}>
      <div className="artist-press grid grid-cols-3 gap-2">
        {items.map((p, i) => (
          <button key={p.url} type="button" onClick={() => setOpen(i)} className="block overflow-hidden rounded-lg border-0 bg-transparent p-0">
            <img src={p.url} alt={p.credit ? t('artistPage.photoBy', { name: p.credit }) : ''} loading="lazy" className="block aspect-[4/5] w-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && createPortal(
        <div className="fixed inset-0 z-[10002] flex flex-col items-center justify-center gap-3 bg-black/90 p-5" onClick={() => setOpen(null)}>
          <img src={items[open].url} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          {items[open].credit && <span className="text-xs text-white/60">{t('artistPage.photoBy', { name: items[open].credit })}</span>}
        </div>,
        document.body,
      )}
    </Section>
  );
};

/** Quiet unlabelled line under the bio: how they play · label. */
export const PlayLine = ({ profile }) => {
  const { t } = useLanguage();
  const parts = [
    list(profile?.playStyles).map((s) => t(`artistPage.play_${s}`)).join(' · '),
    profile?.label,
  ].filter(Boolean);
  if (!parts.length) return null;
  return <p className="m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/60">{parts.map((p) => <span key={p}>{p}</span>)}</p>;
};

/** A promoter who runs nights (promoterKind PERSON) lists them; a party brand IS the night. */
export const NightsList = ({ profile, onOpenProfile }) => {
  const { t } = useLanguage();
  const items = profile?.promoterKind === 'PERSON' ? list(profile.nights) : [];
  if (!items.length) return null;
  return (
    <Section title={t('artistPage.nights')}>
      <div className="flex flex-col">
        {items.map((n) => {
          const meta = [[n.venue, n.city].filter(Boolean).join(', '), n.frequency && t(`artistPage.freq_${n.frequency}`)].filter(Boolean).join(' · ');
          const body = (
            <>
              <span className="min-w-0 flex-1 text-sm text-white">{n.name}</span>
              {meta && <span className="shrink-0 text-[11px] text-white/45">{meta}</span>}
            </>
          );
          return n.profileId && onOpenProfile ? (
            <button key={n.id} type="button" className="poster-row w-full cursor-pointer border-0 bg-transparent text-left" onClick={() => onOpenProfile({ id: n.profileId, name: n.name })}>{body}</button>
          ) : (
            <div key={n.id} className="poster-row">{body}</div>
          );
        })}
      </div>
    </Section>
  );
};

/**
 * Everything music-related on an artist page, in page order. `played` is
 * the members-only network strip, rendered by the caller between
 * Highlights and Videos.
 */
// `onAdd(section)` (own profile only) opens Edit profile at that section.
export const ArtistMediaTop = ({ profile, onPlay, onAdd }) => (
  <>
    <SetsStrip sets={profile?.sets} onPlay={onPlay} onAdd={onAdd && (() => onAdd('sets'))} />
    <ReleasesRow releases={profile?.releases} onAdd={onAdd && (() => onAdd('releases'))} />
  </>
);

export const ArtistMediaBottom = ({ profile, onAdd }) => (
  <>
    <VideosGrid videos={profile?.videos} onAdd={onAdd && (() => onAdd('videos'))} />
    <PressPhotos photos={profile?.pressPhotos} onAdd={onAdd && (() => onAdd('pressPhotos'))} />
  </>
);
