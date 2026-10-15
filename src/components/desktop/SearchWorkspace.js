import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDesktopStrings } from './strings';
import apiService from '../../services/api';
import { isPremiumViewer } from '../../utils/subscription';
import { genresList } from '../../data/profiles';
import { ROLES, roleLabel, getAvatarClass } from '../../utils/roles';
import { appAlert } from '../../utils/dialogs';
import { HeartIcon, SearchIcon } from '../../utils/icons';
import LoadingGlobe from '../common/LoadingGlobe';

const SearchGlobe = lazy(() => import('../common/SearchGlobe'));

/* Desktop v3 Search: the map and the list at once. The phone toggles between
   them because it has one viewport; a desk has room for both, and a city
   clicked on the map filters the list beside it. */

const Chip = ({ on, children, onClick }) => (
  <button
    onClick={onClick}
    className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors
                ${on ? 'border-infrared/50 bg-infrared/15 text-white' : 'border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25 hover:text-white'}`}
  >
    {children}
  </button>
);

const SearchWorkspace = ({ onOpenChat, onOpenProfile, onOpenPremium }) => {
  const { user, likedProfiles, toggleLike, connectedUsers, sentRequests, receivedRequests } = useAppContext();
  const { t } = useLanguage();
  const td = useDesktopStrings();
  const premium = isPremiumViewer(user);

  const [query, setQuery] = useState('');
  const [roles, setRoles] = useState([]);
  const [genres, setGenres] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState(null); // { city } | { country } from the globe
  const [showAllGenres, setShowAllGenres] = useState(false);
  const seq = useRef(0); // only the newest request may paint

  const run = useCallback(async () => {
    if (!user?.id) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const params = { activeProfileId: user.id, limit: 500 }; // the globe needs the whole network
      if (query.trim()) params.search = query.trim();
      if (roles.length) params.roles = roles.join(',');
      if (genres.length) params.genres = genres.join(',');
      const r = await apiService.searchProfiles(params);
      if (n !== seq.current) return;
      setResults((r.profiles || r || []).filter((p) => p.id !== user.id));
    } catch (e) {
      if (n === seq.current) setResults([]);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [user?.id, query, roles, genres]);

  useEffect(() => {
    const id = setTimeout(run, 300);
    return () => clearTimeout(id);
  }, [run]);

  const list = useMemo(() => {
    let l = results;
    if (selection?.city) l = l.filter((p) => p.city === selection.city);
    else if (selection?.country) l = l.filter((p) => p.country === selection.country);
    // FREE discovery spans the country but leads with the member's own city.
    if (!premium) l = [...l].sort((a, b) => (a.city === user?.city ? 0 : 1) - (b.city === user?.city ? 0 : 1));
    return l;
  }, [results, selection, premium, user?.city]);

  const toggle = (arr, set) => (v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const like = async (p) => {
    try { await toggleLike(p.id, p); } catch (e) { appAlert(e.message || t('common.error')); }
  };

  const genreChips = showAllGenres ? genresList : genresList.slice(0, 12);

  return (
    <div className="screen active d3-screen">
      <div className="d3-ws d3-fill">
        {/* ---------------- list ---------------- */}
        <div className="d3-panel flex min-w-0 flex-col">
          <div className="border-b border-white/[0.07] px-3 pb-3 pt-3">
            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35 [&>svg]:h-4 [&>svg]:w-4"><SearchIcon /></span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.searchByName')}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.02] pl-9 pr-3 text-[13.5px] text-white placeholder-white/35 outline-none focus:border-white/25"
              />
            </label>
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{td('roles')}</p>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => <Chip key={r} on={roles.includes(r)} onClick={() => toggle(roles, setRoles)(r)}>{roleLabel(r, t)}</Chip>)}
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{td('genres')}</p>
              <div className="flex flex-wrap gap-1.5">
                {genreChips.map((g) => <Chip key={g} on={genres.includes(g)} onClick={() => toggle(genres, setGenres)(g)}>{g}</Chip>)}
                <button onClick={() => setShowAllGenres((v) => !v)} className="cursor-pointer px-1.5 py-1 text-[11px] text-white/40 hover:text-white">
                  {showAllGenres ? '−' : `+${genresList.length - 12}`}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-white/45">
            <span className="min-w-0 truncate">
              {td('results', { n: list.length })}
              {!selection && <span className="ml-2 text-white/30">· {td('globeHint')}</span>}
              {selection && (
                <span className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-infrared/40 bg-infrared/10 px-2 py-0.5 text-white/85">
                  {td('inCity', { name: selection.city || selection.country })}
                  <button onClick={() => setSelection(null)} className="cursor-pointer text-white/60 hover:text-white" aria-label={td('clear')}>×</button>
                </span>
              )}
            </span>
            {(roles.length > 0 || genres.length > 0 || query) && (
              <button onClick={() => { setRoles([]); setGenres([]); setQuery(''); }} className="cursor-pointer hover:text-white">{td('clear')}</button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {loading && results.length === 0 ? <LoadingGlobe label={t('search.loadingProfiles')} /> : list.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-white/35">{t('search.noResults')}</p>
            ) : list.map((profile) => {
              const liked = likedProfiles.has(profile.id);
              const connected = connectedUsers.has(profile.id);
              const pending = sentRequests.has(profile.id) || receivedRequests.has(profile.id);
              return (
                <div key={profile.id} className="search-result-card">
                  <div className="result-content">
                    <div className={`result-avatar ${getAvatarClass(profile.role)} clickable`} onClick={() => onOpenProfile(profile)}>
                      {profile.avatar ? <img src={profile.avatar} alt={profile.name} /> : profile.name.charAt(0).toUpperCase()}
                      {profile.isVerified && <span className="verified-badge">✓</span>}
                    </div>
                    <div className="result-info clickable" onClick={() => onOpenProfile(profile)}>
                      <div className="result-header">
                        <h3>{profile.name}</h3>
                        <span className={`role-badge badge-${String(profile.role).toLowerCase()}`}>{roleLabel(profile.role, t)}</span>
                      </div>
                      <p className="result-location">{profile.location || [profile.city, profile.country].filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                  <div className="result-actions">
                    <button className={`btn ${liked ? 'btn-liked' : 'btn-outline'} btn-like`} onClick={() => like(profile)}>
                      <HeartIcon filled={liked} /> {liked ? t('search.liked') : t('search.like')}
                    </button>
                    {connected ? (
                      <button className="btn btn-message btn-connect" onClick={() => onOpenChat(profile)}>{t('search.message')}</button>
                    ) : pending ? (
                      <button className="btn btn-disabled btn-connect" disabled>{t('search.pending')}</button>
                    ) : (
                      <button className="btn btn-primary btn-connect" onClick={() => onOpenProfile(profile)}>{td('view')}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- map ---------------- */}
        <div className="d3-ws-globe">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><LoadingGlobe label={t('search.loadingProfiles')} /></div>}>
            <SearchGlobe
              profiles={results}
              loading={loading}
              onSelectionChange={setSelection}
              onSelectProfile={onOpenProfile}
              locked={!premium}
              userCity={user?.city}
              userCountry={user?.country}
              onLockedCity={() => onOpenPremium?.()}
              topInset={premium ? 16 : 64}
              bottomInset={16}
            />
          </Suspense>
          {user && !premium && (
            <button
              onClick={onOpenPremium}
              className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-infrared/35 bg-infrared/10 px-4 py-2 text-xs text-white/85 backdrop-blur-md"
            >
              <span className="truncate">{t('profile.searchLimitedTo')} {user.country || user.city}</span>
              <span className="shrink-0 font-semibold text-infrared">{t('search.upgradeNow')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchWorkspace;
