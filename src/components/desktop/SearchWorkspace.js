import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import { isPremiumViewer } from '../../utils/subscription';
import { zones, countriesByZone, citiesByCountry, genresList } from '../../data/profiles';
import { ROLES, roleLabel, getAvatarClass } from '../../utils/roles';
import { appAlert } from '../../utils/dialogs';
import { HeartIcon, SearchIcon } from '../../utils/icons';
import LoadingGlobe from '../common/LoadingGlobe';
import ConnectAction from '../common/ConnectAction';
import OverlayPortal from '../common/OverlayPortal';
import FilterSheet, { FilterButton } from '../common/FilterSheet';

const SearchGlobe = lazy(() => import('../common/SearchGlobe'));

/* Desktop v3 Search: the map and the list at once.
   - Filters live in the shared FilterSheet (a right-hand drawer on desktop,
     via the v2 .filter-screen rules) — the same sheet Tour uses.
   - A city clicked on the globe filters the LEFT list to that city (the globe's
     own members panel stays off here); clearing the globe selection restores
     the whole search.
   - The map can take the whole window (button top-left, clear of the members panel; Esc to leave). */

const EMPTY = { roles: [], genres: [], zone: 'all', country: 'all', city: 'all' };

const SearchWorkspace = ({ onOpenChat, onOpenProfile: openProfile, onOpenPremium }) => {
  const { user, likedProfiles, toggleLike } = useAppContext(); // connect state lives in ConnectAction
  const { t } = useLanguage();
  const premium = isPremiumViewer(user);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [full, setFull] = useState(false);
  // A city/country tapped on the globe narrows the LIST only. It must stay out
  // of `filters`, which drive the fetch the globe's own pins come from.
  const [mapSel, setMapSel] = useState(null);
  const seq = useRef(0); // only the newest request may paint

  const run = useCallback(async () => {
    if (!user?.id) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const params = { activeProfileId: user.id, limit: 500 }; // the globe needs the whole network
      if (query.trim()) params.search = query.trim();
      if (filters.roles.length) params.roles = filters.roles.join(',');
      if (filters.genres.length) params.genres = filters.genres.join(',');
      if (filters.zone !== 'all') params.zones = filters.zone;
      if (filters.country !== 'all') params.countries = filters.country;
      if (filters.city !== 'all') params.cities = filters.city;
      const r = await apiService.searchProfiles(params);
      if (n !== seq.current) return;
      setResults((r.profiles || r || []).filter((p) => p.id !== user.id));
    } catch (e) {
      if (n === seq.current) setResults([]);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [user?.id, query, filters]);

  useEffect(() => {
    const id = setTimeout(run, 300);
    return () => clearTimeout(id);
  }, [run]);

  // Esc leaves the full-screen map.
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const applyFilters = (v) => {
    // Same gate as SearchScreen: FREE members browse their own country only.
    const hasLocation = v.zone !== 'all' || v.country !== 'all' || v.city !== 'all';
    if (!premium && hasLocation) {
      const tierName = user?.subscriptionTier === 'TRIAL' ? t('search.trialTierName') : t('search.freeTierName');
      appAlert(t('search.locationFiltersAlert', { tierName, city: user?.country || user?.city }));
      v = { ...v, zone: 'all', country: 'all', city: 'all' };
    }
    setFilters(v);
    setShowFilters(false);
  };

  const list = useMemo(() => {
    const base = premium ? results
      // FREE discovery spans the country but leads with the member's own city.
      : [...results].sort((a, b) => (a.city === user?.city ? 0 : 1) - (b.city === user?.city ? 0 : 1));
    if (mapSel?.city) return base.filter((p) => p.city === mapSel.city);
    if (mapSel?.country) return base.filter((p) => p.country === mapSel.country);
    return base;
  }, [results, premium, user?.city, mapSel]);

  const activeChips = [
    ...(mapSel?.city || mapSel?.country ? [{ key: 'map', label: mapSel.city || mapSel.country, clear: () => setMapSel(null) }] : []),
    ...filters.roles.map((r) => ({ key: `r:${r}`, label: roleLabel(r, t), clear: () => setFilters((f) => ({ ...f, roles: f.roles.filter((x) => x !== r) })) })),
    ...filters.genres.map((g) => ({ key: `g:${g}`, label: g, clear: () => setFilters((f) => ({ ...f, genres: f.genres.filter((x) => x !== g) })) })),
    ...(filters.city !== 'all' ? [{ key: 'city', label: filters.city, clear: () => setFilters((f) => ({ ...f, city: 'all' })) }]
      : filters.country !== 'all' ? [{ key: 'country', label: filters.country, clear: () => setFilters((f) => ({ ...f, country: 'all', city: 'all' })) }]
      : filters.zone !== 'all' ? [{ key: 'zone', label: filters.zone, clear: () => setFilters(EMPTY) }] : []),
  ];

  // The filter drawer sits over the profile that opens behind it.
  const onOpenProfile = (p) => { setShowFilters(false); openProfile(p); };

  const like = async (p) => {
    try { await toggleLike(p.id, p); } catch (e) { appAlert(e.message || t('common.error')); }
  };

  const sections = [
    { key: 'roles', label: t('search.roles'), multi: true, emptyLabel: t('desktop.allRoles'),
      options: () => ROLES.map((r) => ({ value: r, label: roleLabel(r, t) })) },
    { key: 'genres', label: t('search.genres'), multi: true,
      options: () => genresList.map((g) => ({ value: g, label: g })) },
    { key: 'zone', label: t('editProfile.zone'), multi: false, allLabel: t('manageArtist.allZones'), resets: ['country', 'city'],
      options: () => [{ value: 'all', label: t('manageArtist.allZones') }, ...zones.map((z) => ({ value: z, label: z }))] },
    { key: 'country', label: t('editProfile.country'), multi: false, allLabel: t('manageArtist.allCountries'), resets: ['city'],
      visible: (d) => d.zone !== 'all',
      options: (d) => [{ value: 'all', label: t('manageArtist.allCountries') }, ...(countriesByZone[d.zone] || []).map((c) => ({ value: c, label: c }))] },
    { key: 'city', label: t('editProfile.city'), multi: false, allLabel: t('calendar.allCities'),
      visible: (d) => d.country !== 'all',
      options: (d) => [{ value: 'all', label: t('calendar.allCities') }, ...(citiesByCountry[d.country] || []).map((c) => ({ value: c, label: c }))] },
  ];

  const FullscreenGlyph = ({ exit }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {exit
        ? <><path d="M9 3v6H3" /><path d="M15 21v-6h6" /><path d="M21 9h-6V3" /><path d="M3 15h6v6" /></>
        : <><path d="M3 9V3h6" /><path d="M21 15v6h-6" /><path d="M15 3h6v6" /><path d="M9 21H3v-6" /></>}
    </svg>
  );

  return (
    <div className="screen active d3-screen">
      <div className="d3-ws d3-fill">
        {/* ---------------- list ---------------- */}
        <div className="d3-panel flex min-w-0 flex-col">
          <div className="border-b border-white/[0.07] px-3 pb-3 pt-3">
            <div className="flex items-center gap-2">
              <label className="relative block min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35 [&>svg]:h-4 [&>svg]:w-4"><SearchIcon /></span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search.searchByName')}
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.02] pl-9 pr-3 text-[13.5px] text-white placeholder-white/35 outline-none focus:border-white/25"
                />
              </label>
              <FilterButton count={activeChips.length} onClick={() => setShowFilters(true)} label={t('search.filters')} />
            </div>
            {activeChips.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {activeChips.map((c) => (
                  <button
                    key={c.key}
                    onClick={c.clear}
                    className="flex cursor-pointer items-center gap-1 rounded-full border border-infrared/40 bg-infrared/10 px-2.5 py-1 text-[11px] text-white/85 hover:border-infrared/70"
                  >
                    {c.label}<span className="text-white/50">×</span>
                  </button>
                ))}
                <button onClick={() => setFilters(EMPTY)} className="cursor-pointer px-1.5 py-1 text-[11px] text-white/40 hover:text-white">{t('desktop.clear')}</button>
              </div>
            )}
          </div>

          <div className="px-3 py-2 text-[11px] text-white/45">{t('desktop.results', { n: list.length })}</div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {loading && results.length === 0 ? <LoadingGlobe label={t('search.loadingProfiles')} /> : list.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-white/35">{t('search.noResults')}</p>
            ) : list.map((profile) => {
              const liked = likedProfiles.has(profile.id);
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
                    <ConnectAction profile={profile} onMessage={onOpenChat} onOpenPremium={onOpenPremium} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- map ---------------- */}
        <div className={`d3-ws-globe${full ? ' d3-ws-globe--full' : ''}`}>
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><LoadingGlobe label={t('search.loadingProfiles')} /></div>}>
            <SearchGlobe
              profiles={results}
              loading={loading}
              onSelectProfile={onOpenProfile}
              locked={!premium}
              userCity={user?.city}
              userCountry={user?.country}
              onLockedCity={() => onOpenPremium?.()}
              listTakesOver
              onSelectionChange={(sel, meta) => setMapSel(sel || (meta?.empty ? { country: meta.country, empty: true } : null))}
              topInset={premium ? 16 : 64}
              bottomInset={16}
            />
          </Suspense>
          <button
            onClick={() => setFull((v) => !v)}
            aria-label={full ? t('desktop.exitFullscreen') : t('desktop.fullscreen')}
            title={full ? t('desktop.exitFullscreen') : t('desktop.fullscreen')}
            className="absolute left-3 top-3 z-30 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/80 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white [&>svg]:h-4 [&>svg]:w-4"
          >
            <FullscreenGlyph exit={full} />
          </button>
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

      {showFilters && (
        <OverlayPortal>
          <FilterSheet
            values={filters}
            clearedValues={EMPTY}
            sections={sections}
            onApply={applyFilters}
            onClose={() => setShowFilters(false)}
          />
        </OverlayPortal>
      )}
    </div>
  );
};

export default SearchWorkspace;
