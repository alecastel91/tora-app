import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDesktopStrings } from './strings';
import apiService from '../../services/api';
import OverlayPortal from '../common/OverlayPortal';
import { roleLabel } from '../../utils/roles';
import { Avatar } from './primitives';

/* ⌘K / Ctrl+K: jump to a page or a profile from anywhere. Desktop v3 only
   (App.js mounts it through useNativeDesktop). Also opens on the
   `tora:open-palette` window event, which the top-bar pill dispatches. */

const CommandPalette = ({ pages, onGo, onOpenProfile }) => {
  const { user } = useAppContext();
  const { t } = useLanguage();
  const td = useDesktopStrings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      else if (e.key === 'Escape') setOpen(false);
    };
    const onEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('tora:open-palette', onEvent);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('tora:open-palette', onEvent); };
  }, []);

  useEffect(() => {
    if (!open) { setQuery(''); setProfiles([]); setCursor(0); return; }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Profiles: the same search endpoint, a short page, debounced.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2 || !user?.id) { setProfiles([]); return undefined; }
    const n = ++seq.current;
    const id = setTimeout(() => {
      apiService.searchProfiles({ activeProfileId: user.id, search: q, limit: 8 })
        .then((r) => { if (n === seq.current) setProfiles((r.profiles || r || []).filter((p) => p.id !== user.id)); })
        .catch(() => { if (n === seq.current) setProfiles([]); });
    }, 220);
    return () => clearTimeout(id);
  }, [query, open, user?.id]);

  const q = query.trim().toLowerCase();
  const pageHits = useMemo(() => pages.filter((p) => !q || p.label.toLowerCase().includes(q)), [pages, q]);
  const items = useMemo(() => [
    ...pageHits.map((p) => ({ kind: 'page', id: p.id, label: p.label })),
    ...profiles.map((p) => ({ kind: 'profile', id: p.id, label: p.name, profile: p })),
  ], [pageHits, profiles]);

  useEffect(() => { setCursor(0); }, [items.length, q]);

  const run = (item) => {
    if (!item) return;
    setOpen(false);
    if (item.kind === 'page') onGo(item.id); else onOpenProfile(item.profile);
  };

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[cursor]); }
  };

  if (!open) return null;

  let lastKind = null;
  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[10050] flex items-start justify-center bg-black/55 px-4 pt-[16vh] backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
        <div
          className="w-full max-w-[580px] overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0e] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={td('jumpTo')}
            className="h-13 w-full border-b border-white/[0.08] bg-transparent px-5 py-4 text-[15px] text-white placeholder-white/35 outline-none"
          />
          <ul className="max-h-[48vh] overflow-y-auto p-2">
            {items.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-white/35">{t('search.noResults')}</li>}
            {items.map((item, i) => {
              const header = item.kind !== lastKind ? (item.kind === 'page' ? td('pages') : td('profilesLabel')) : null;
              lastKind = item.kind;
              return (
                <React.Fragment key={`${item.kind}:${item.id}`}>
                  {header && <li className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{header}</li>}
                  <li>
                    <button
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => run(item)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] ${i === cursor ? 'bg-white/[0.07] text-white' : 'text-white/75'}`}
                    >
                      {item.kind === 'profile' ? (
                        <>
                          <Avatar profile={{ ...item.profile, name: item.label }} className="h-7 w-7 text-[11px]" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          <span className="shrink-0 text-[11px] text-white/40">{roleLabel(item.profile.role, t)}{item.profile.city ? ` · ${item.profile.city}` : ''}</span>
                        </>
                      ) : (
                        <span className="flex-1">{item.label}</span>
                      )}
                      {i === cursor && <kbd className="rounded border border-white/15 px-1.5 text-[10px] text-white/45">↵</kbd>}
                    </button>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default CommandPalette;
