import AgencyTeamSheet, { AgencySearchCard } from '../common/AgencyTeamSheet';
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import { isPremiumViewer } from '../../utils/subscription';
import { zones, countriesByZone, citiesByCountry, genresList } from '../../data/profiles';
import { ROLES, roleLabel } from '../../utils/roles';
import { appAlert } from '../../utils/dialogs';
import { SearchIcon, ListIcon, GlobeIcon, HeartIcon } from '../../utils/icons';
import { getAvatarClass } from '../../utils/roles';
import { formatEventDate, localIsoDay } from '../../utils/dates';
import LoadingGlobe from '../common/LoadingGlobe';
import ConnectAction from '../common/ConnectAction';
import GenrePills from '../common/GenrePills';
import VerifiedBadge from '../common/VerifiedBadge';
import OverlayPortal from '../common/OverlayPortal';
import FilterSheet, { FilterButton } from '../common/FilterSheet';

const SearchGlobe = lazy(() => import('../common/SearchGlobe'));

/* Desktop v3 Search: the globe OR the list.
   - Search opens on the globe across the page, like the phone app.
   - The list is thin rows with a preview of the selected row on the right;
     the row's Open (or a double click) opens the full profile.
   - Filters live in the shared FilterSheet (a right-hand drawer on desktop,
     via the v2 .filter-screen rules) — the same sheet Tour uses.
   - A city picked on the globe carries into the list as a chip, and back
     onto the globe when you return to it. */

const EMPTY = { roles: [], genres: [], zone: 'all', country: 'all', city: 'all' };

const SearchWorkspace = ({ onOpenChat, onOpenProfile: openProfile, onOpenPremium }) => {
  const { user, likedProfiles, toggleLike } = useAppContext(); // connect state lives in ConnectAction
  const { t } = useLanguage();
  const premium = isPremiumViewer(user);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [openAgencyId, setOpenAgencyId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Search opens on the globe across the whole page, like the phone app; the
  // list joins it on the left on demand (or as soon as you type a name).
  const [listOpen, setListOpen] = useState(false);
  const listInputRef = useRef(null);
  const openListForTyping = () => { showList(); requestAnimationFrame(() => listInputRef.current?.focus()); };
  // A city/country tapped on the globe narrows the LIST only. It must stay out
  // of `filters`, which drive the fetch the globe's own pins come from.
  const [mapSel, setMapSel] = useState(null);
  // The globe's role legend narrows the list the same way (null = all on).
  const [mapRoles, setMapRoles] = useState(null);
  const roleShown = (role) => mapRoles?.[role] !== false;
  const [selectedId, setSelectedId] = useState(null);
  const seq = useRef(0); // only the newest request may paint
  // The legend lives on the globe, which the list replaces: leaving the globe
  // shows every role again (the globe comes back with its legend all on).
  const showList = () => { setMapRoles(null); setListOpen(true); };

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
      setAgencies(r.agencies || []);
    } catch (e) {
      if (n === seq.current) { setResults([]); setAgencies([]); }
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [user?.id, query, filters]);

  useEffect(() => {
    const id = setTimeout(run, 300);
    return () => clearTimeout(id);
  }, [run]);


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
    const byRole = base.filter((p) => mapRoles?.[p.role] !== false);
    if (mapSel?.city) return byRole.filter((p) => p.city === mapSel.city);
    if (mapSel?.country) return byRole.filter((p) => p.country === mapSel.country);
    return byRole;
  }, [results, premium, user?.city, mapSel, mapRoles]);

  const activeChips = [
    ...(mapSel?.city || mapSel?.country ? [{ key: 'map', label: mapSel.city || mapSel.country, clear: () => setMapSel(null) }] : []),
    ...filters.roles.map((r) => ({ key: `r:${r}`, label: roleLabel(r, t), clear: () => setFilters((f) => ({ ...f, roles: f.roles.filter((x) => x !== r) })) })),
    ...filters.genres.map((g) => ({ key: `g:${g}`, label: g, clear: () => setFilters((f) => ({ ...f, genres: f.genres.filter((x) => x !== g) })) })),
    ...(filters.city !== 'all' ? [{ key: 'city', label: filters.city, clear: () => setFilters((f) => ({ ...f, city: 'all' })) }]
      : filters.country !== 'all' ? [{ key: 'country', label: filters.country, clear: () => setFilters((f) => ({ ...f, country: 'all', city: 'all' })) }]
      : filters.zone !== 'all' ? [{ key: 'zone', label: filters.zone, clear: () => setFilters(EMPTY) }] : []),
  ];

  // Agencies are agents: the legend's Agent toggle hides them too.
  const shownAgencies = roleShown('AGENT') ? agencies : [];

  // The filter drawer sits over the profile that opens behind it.
  const onOpenProfile = (p) => { setShowFilters(false); openProfile(p); };

  const like = async (p) => {
    try { await toggleLike(p.id, p); } catch (e) { appAlert(e.message || t('common.error')); }
  };

  // The preview follows the clicked row; until then (or once it is filtered
  // away) it shows the first result.
  const selected = list.find((p) => p.id === selectedId) || list[0] || null;

  const upgradePill = (place) => (
    <button
      onClick={onOpenPremium}
      className={`flex cursor-pointer items-center gap-2 rounded-full border border-infrared/35 bg-infrared/10 px-4 py-2 text-xs text-white/85 backdrop-blur-md ${place}`}
    >
      <span className="truncate">{t('profile.searchLimitedTo')} {user.country || user.city}</span>
      <span className="shrink-0 font-semibold text-infrared">{t('search.upgradeNow')}</span>
    </button>
  );

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


  return (
    <div className="screen active d3-screen">
      <div className={`d3-ws d3-fill${listOpen ? ' d3-ws--list' : ' d3-ws--map'}`}>
        {/* ---------------- list ---------------- */}
        <div className="d3-panel flex min-w-0 flex-col">
          <div className="border-b border-white/[0.07] px-3 pb-3 pt-3">
            <div className="flex items-center gap-2">
              <label className="relative block min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35 [&>svg]:h-4 [&>svg]:w-4"><SearchIcon /></span>
                <input
                  ref={listInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search.searchByName')}
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.02] pl-9 pr-3 text-[13.5px] text-white placeholder-white/35 outline-none focus:border-white/25"
                />
              </label>
              <FilterButton count={activeChips.length} onClick={() => setShowFilters(true)} label={t('search.filters')} />
              <button
                onClick={() => setListOpen(false)}
                aria-label={t('search.viewGlobe')}
                title={t('search.viewGlobe')}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:border-white/30 hover:text-white [&>svg]:h-4 [&>svg]:w-4"
              >
                <GlobeIcon />
              </button>
            </div>
            {user && !premium && upgradePill('mt-2.5 w-fit max-w-full')}
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

          <div className="d3-ws-list min-h-0 flex-1 overflow-y-auto">
            {shownAgencies.map((agency) => <AgencySearchCard key={agency.id} agency={agency} onOpen={setOpenAgencyId} />)}
            {openAgencyId && <AgencyTeamSheet organisationId={openAgencyId} onClose={() => setOpenAgencyId(null)} onOpenProfile={onOpenProfile} />}
            {loading && results.length === 0 ? <LoadingGlobe label={t('search.loadingProfiles')} /> : list.length === 0 ? shownAgencies.length > 0 ? null : (
              <p className="py-14 text-center text-[13px] text-white/35">{t('search.noResults')}</p>
            ) : list.map((profile) => (
              <SearchRow
                key={profile.id}
                profile={profile}
                selected={profile.id === selected?.id}
                liked={likedProfiles.has(profile.id)}
                onSelect={() => setSelectedId(profile.id)}
                onOpen={() => onOpenProfile(profile)}
                onLike={() => like(profile)}
                onMessage={onOpenChat}
                onOpenPremium={onOpenPremium}
              />
            ))}
          </div>
        </div>

        {listOpen ? (
          <SearchPreview
            profile={selected}
            liked={!!selected && likedProfiles.has(selected.id)}
            onOpen={() => onOpenProfile(selected)}
            onLike={() => like(selected)}
            onMessage={onOpenChat}
            onOpenPremium={onOpenPremium}
          />
        ) : (
        <div className="d3-ws-globe">
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><LoadingGlobe label={t('search.loadingProfiles')} /></div>}>
            <SearchGlobe
              profiles={results}
              loading={loading}
              onSelectProfile={onOpenProfile}
              restoreSelection={mapSel?.city ? { city: mapSel.city } : mapSel?.country && !mapSel.empty ? { country: mapSel.country } : null}
              locked={!premium}
              userCity={user?.city}
              userCountry={user?.country}
              onLockedCity={() => onOpenPremium?.()}
              onRolesChange={setMapRoles}
              onSelectionChange={(sel, meta) => setMapSel(sel || (meta?.empty ? { country: meta.country, empty: true } : null))}
              topInset={premium ? 72 : 120}
              // The search bar sits on the left: the panel can start at the top.
              panelTopInset={0}
              bottomInset={16}
              controlsLeft={16}
            />
          </Suspense>
          {/* Search, filters and the list button float on the map.
              Never wider than the space left of the members panel (400px + gaps). */}
          <div className="absolute left-4 right-4 top-4 z-30 flex max-w-[min(560px,calc(100%_-_440px))] items-center gap-2">
              <label className="relative block min-w-0 flex-1">
                <span className="pointer-events-none absolute z-10 left-3 top-1/2 -translate-y-1/2 text-white/40 [&>svg]:h-4 [&>svg]:w-4"><SearchIcon /></span>
                <input
                  value={query}
                  // The list opens with the first committed character: opening it
                  // mid-composition would swap the input under a CJK keyboard.
                  onChange={(e) => { setQuery(e.target.value); if (!e.nativeEvent.isComposing) openListForTyping(); }}
                  onCompositionEnd={openListForTyping}
                  placeholder={t('search.searchByName')}
                  className="h-10 w-full rounded-full border border-white/10 bg-black/45 pl-9 pr-3 text-[13.5px] text-white placeholder-white/40 outline-none backdrop-blur-md focus:border-white/25"
                />
              </label>
              <FilterButton count={activeChips.length} onClick={() => setShowFilters(true)} label={t('search.filters')} />
              <button
                onClick={showList}
                aria-label={t('search.viewList')}
                title={t('search.viewList')}
                className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 text-[12.5px] font-medium text-white/85 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white [&>svg]:h-4 [&>svg]:w-4"
              >
                <ListIcon />{t('search.viewList')}
              </button>
          </div>
          {user && !premium && upgradePill('absolute left-4 top-[66px] z-30')}
        </div>
        )}
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

const isVerified = (p) => p?.verifyStatus === 'VERIFIED' || p?.isVerified;
const roleKey = (p) => String(p?.role || 'ARTIST').toLowerCase();
const placeOf = (p) => p?.location || [p?.city, p?.country].filter(Boolean).join(', ');

const Avatar = ({ profile, className }) => {
  const src = profile.avatar || profile.avatarLarge;
  return (
    <span className={`${className} ${src ? '' : getAvatarClass(profile.role)}`}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : (profile.name || '?').charAt(0).toUpperCase()}
    </span>
  );
};

const LikeButton = ({ liked, onClick, className = '' }) => {
  const { t } = useLanguage();
  const label = liked ? t('search.liked') : t('search.like');
  return (
    <button type="button" className={`d3-sr-like${liked ? ' is-on' : ''} ${className}`} aria-label={label} aria-pressed={liked} title={label} onClick={onClick}>
      <HeartIcon filled={liked} />
    </button>
  );
};

/* One result: avatar · name + role · place · genres · like · connect.
   A click previews it on the right; a double click opens the profile. */
const SearchRow = ({ profile, selected, liked, onSelect, onOpen, onLike, onMessage, onOpenPremium }) => {
  const { t } = useLanguage();
  return (
    <div className={`d3-sr poster-role-${roleKey(profile)}${selected ? ' is-selected' : ''}`}>
      <button type="button" className="d3-sr-hit" aria-label={profile.name} aria-pressed={selected} onClick={onSelect} onDoubleClick={onOpen} />
      <Avatar profile={profile} className="d3-sr-avatar" />
      <div className="d3-sr-id">
        <span className="d3-sr-name">
          <span className="truncate">{profile.name}</span>
          {isVerified(profile) && <VerifiedBadge size={13} channel={profile.verifyChannel} />}
        </span>
        <span className="d3-sr-meta">
          <span className="poster-role">{roleLabel(profile.role, t)}</span>
          {placeOf(profile) && <> · {placeOf(profile)}</>}
        </span>
      </div>
      <GenrePills genres={profile.genres} shown={2} fit className="d3-sr-genres" />
      <div className="d3-sr-actions">
        <LikeButton liked={liked} onClick={onLike} />
        <ConnectAction profile={profile} onMessage={onMessage} onOpenPremium={onOpenPremium} />
      </div>
    </div>
  );
};

// The first trip that hasn't ended yet, if the calendar is visible to this viewer.
const nextTrip = (profile) => {
  const today = localIsoDay();
  return (Array.isArray(profile?.travelSchedule) ? profile.travelSchedule : [])
    .filter((e) => e?.startDate && (e.endDate || e.startDate) >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0] || null;
};

/* Where the globe was: the selected row, large enough to decide on. */
const SearchPreview = ({ profile, liked, onOpen, onLike, onMessage, onOpenPremium }) => {
  const { t } = useLanguage();
  if (!profile) return <aside className="d3-sp d3-sp--empty" />;
  const cover = profile.avatarLarge || profile.avatar;
  const trip = nextTrip(profile);
  const locale = t('dateFormat.locale');
  const day = (d) => formatEventDate(d, locale, { year: undefined });
  return (
    <aside className={`d3-sp poster-role-${roleKey(profile)}`} aria-label={t('desktop.preview')}>
      <div className={`d3-sp-cover${cover ? '' : ` poster-empty poster-role-${roleKey(profile)}`}`}>
        {cover
          ? <img src={cover} alt="" style={profile.avatarFocus ? { objectPosition: profile.avatarFocus } : undefined} />
          : <span aria-hidden>{(profile.name || '?').charAt(0).toUpperCase()}</span>}
      </div>
      <div className="d3-sp-body">
        <div>
          <h2 className="d3-sp-name">
            {profile.name}
            {isVerified(profile) && <VerifiedBadge size={18} channel={profile.verifyChannel} />}
          </h2>
          <p className="d3-sp-meta">
            {placeOf(profile)}{placeOf(profile) ? ' · ' : ''}
            <span className="poster-role">{roleLabel(profile.role, t)}</span>
          </p>
        </div>
        <GenrePills genres={profile.genres} shown={6} />
        {profile.bio && <p className="d3-sp-bio">{profile.bio}</p>}
        {trip && (
          <div className="d3-sp-trip">
            <span className="d3-sp-label">{t('desktop.nextTravel')}</span>
            <span>
              {[trip.city, trip.country].filter(Boolean).join(', ')}
              {' · '}{day(trip.startDate)}{trip.endDate && trip.endDate !== trip.startDate ? ` – ${day(trip.endDate)}` : ''}
            </span>
          </div>
        )}
      </div>
      <div className="d3-sp-actions">
        <LikeButton liked={liked} onClick={onLike} />
        <ConnectAction profile={profile} onMessage={onMessage} onOpenPremium={onOpenPremium} />
        <button type="button" className="btn btn-secondary d3-sp-open" onClick={onOpen}>{t('desktop.openProfile')}</button>
      </div>
    </aside>
  );
};

export default SearchWorkspace;
