import React, { useState, useEffect, useRef, useMemo } from 'react';
import OverlayPortal from '../common/OverlayPortal';
import FilterSheet, { FilterButton } from '../common/FilterSheet';
import { CURRENCY_OPTIONS, CURRENCY_OPTIONS_WITH_SYMBOL } from '../common/CurrencyOptions';
import ReactDOM from 'react-dom';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatEventDate, clampDateRange } from '../../utils/dates';
import { subscribeToTours } from '../../services/realtime';
import ViewProfileScreen from './ViewProfileScreen';
import MakeOfferModal from '../common/MakeOfferModal';
import { CalendarIcon, PlaneIcon, LocationIcon, HandshakeIcon, DollarIcon, TargetIcon, StarIcon, EyeIcon, SlidersIcon, HeartIcon } from '../../utils/icons';
import { isVerificationGate } from '../../utils/errors';
import apiService from '../../services/api';
import LoadingGlobe from '../common/LoadingGlobe';
import CalendarScreen from './CalendarScreen';
import LockedPane from '../common/LockedPane';
import { countriesByZone, genresList, zones } from '../../data/profiles';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { isPremiumViewer, isYearlyViewer } from '../../utils/subscription';
import { rosterEntryId } from '../../utils/representation';
import { counterpartRoles, matchDatesFor, normalizeDate } from '../../utils/calendarMatch';
import { goProfileThen } from '../../utils/navigation';
import { useNativeDesktop } from '../../utils/desktopV2';
import TourBoard from '../desktop/TourBoard';

const TourScreen = ({ onOpenChat, onNavigateToMessages, onUnreadProposalsChange, onOpenPremium, accountUser, isActive = true }) => {
  const { user, getCalendarMatches, sentRequests, sendConnectionRequest, connectedUsers } = useAppContext();
  const { t } = useLanguage();
  const tourStatusLabel = (st) => ({ ACTIVE: t('tour.statusActive'), COMPLETED: t('tour.statusCompleted'), CANCELLED: t('tour.statusCancelled') }[st] || st);

  // Helper function to check if user has premium access (per-profile subscription)
  // Single premium gate shared with every other surface (utils/subscription).
  const isPremiumUser = () => isPremiumViewer(user);
  // Fee privacy is Yearly-exclusive (backend re-enforces on save).
  const canHideFee = isYearlyViewer(user);

  // Date fields: after a selection, desktop Chrome leaves the picker primed to
  // re-open on the next click anywhere, so we blur to dismiss it. On touch that
  // same blur fights the native wheel picker (onChange fires on every scroll),
  // so blur only for fine (mouse) pointers.
  const handleDateChange = (field) => (e) => {
    const el = e.target;
    const value = el.value;
    setTourForm((prev) => clampDateRange(prev, field, value));
    if (typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(pointer: fine)').matches) {
      el.blur();
    }
  };
  // Same fee-privacy control in both the create and edit forms.
  const renderHideFeeField = () => (
    <div className="form-group">
      <label
        className={`checkbox-label ${canHideFee ? '' : 'opacity-50 cursor-not-allowed'}`}
        /* `.form-group label { display: block }` (canonical rule) otherwise
           beats `.checkbox-label`'s flex, collapsing the gap — force flex here. */
        style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBlock: '2px' }}
      >
        <input
          type="checkbox"
          checked={canHideFee && !!tourForm.hideFee}
          disabled={!canHideFee}
          onChange={(e) => setTourForm({ ...tourForm, hideFee: e.target.checked })}
        />
        <span style={{ lineHeight: 1.4 }}>{t('tour.hideFeeLabel')}</span>
      </label>
      {!canHideFee && (
        <small className="form-hint text-infrared/80">{t('tour.hideFeeYearlyNote')}</small>
      )}
    </div>
  );

  // Tab state
  // 'calendar' (availability + travel, per artist for agents), 'matches',
  // 'kickstart'. Opens on Calendar — your data first, the matches it drives
  // next — unless the viewer would only meet the Premium teaser there.
  const [activeTab, setActiveTab] = useState(isPremiumViewer(user) ? 'calendar' : 'matches');
  // Desktop v3 is a workspace: the calendar is always on the left, and
  // Matches / Tour Kickstart are a side panel whose tab IS activeTab — so
  // every fetch below keeps its gating. 'calendar' has no meaning as a side
  // tab there, so it resolves to Matches.
  const nativeDesktop = useNativeDesktop();
  // Desktop v3 has two modes under Tour: 'calendar' (the grid with Matches
  // beside it) and 'tours' (a full-width pipeline of tours). The mode drives
  // activeTab so every fetch keeps its gating: calendar mode = 'matches',
  // tours mode = 'kickstart'. Deep links that set activeTab pick the mode.
  // Three modes, one per job: 'calendar' | 'matches' | 'tours'. Each takes
  // the whole canvas; the mode is activeTab under another name, so every
  // fetch keeps its gating and deep links land.
  const D3_TAB = { calendar: 'calendar', matches: 'matches', tours: 'kickstart' };
  const d3Mode = activeTab === 'kickstart' ? 'tours' : activeTab;
  const setD3Mode = (m) => setActiveTab(D3_TAB[m] || 'calendar');
  const [d3TourId, setD3TourId] = useState(null);
  // Deep-links: ViewProfile's tour block asks for Kickstart; the onboarding
  // checklist and the Matches "Edit" link ask for Calendar. The sessionStorage
  // flags cover the case where TourScreen wasn't mounted yet when the event
  // fired (event listeners only exist after mount).
  useEffect(() => {
    const intents = { 'tora:tour-kickstart-intent': 'kickstart', 'tora:tour-calendar-intent': 'calendar' };
    for (const [flag, tab] of Object.entries(intents)) {
      if (sessionStorage.getItem(flag)) { sessionStorage.removeItem(flag); setActiveTab(tab); }
    }
    // a profile's tour card names the tour: the desktop board opens on it
    const linked = sessionStorage.getItem('tora:tour-kickstart-tour');
    if (linked) { sessionStorage.removeItem('tora:tour-kickstart-tour'); setD3TourId(linked); }
    const openKickstart = (e) => {
      sessionStorage.removeItem('tora:tour-kickstart-intent'); sessionStorage.removeItem('tora:tour-kickstart-tour');
      setActiveTab('kickstart');
      if (e?.detail?.tourId) setD3TourId(e.detail.tourId);
    };
    const openCalendar = () => { sessionStorage.removeItem('tora:tour-calendar-intent'); setActiveTab('calendar'); };
    window.addEventListener('tora:tour-kickstart', openKickstart);
    window.addEventListener('tora:tour-calendar', openCalendar);
    return () => {
      window.removeEventListener('tora:tour-kickstart', openKickstart);
      window.removeEventListener('tora:tour-calendar', openCalendar);
    };
  }, []);

  // My dates: own availability + travel schedule (moved here from Profile >
  // Manage so the data and the matches it drives live under one tab). Free
  // tier sees it as a blurred teaser that opens Premium, exactly as before.
  // ---- Represented-artist selection shared by the three sub-tabs -------
  // `artistFilter` is what the agent picked ('all' or an id). It is resolved
  // against the CURRENT roster every render, so an artist removed from the
  // roster (Tour stays mounted) falls back to 'all' / the first artist
  // instead of a dead id: `selectedArtistId` for Matches/Kickstart (may be
  // 'all'), `calendarArtistId` for Calendar (never 'all').
  const [artistFilter, setArtistFilter] = useState('all');
  const isAgent = user?.role === 'AGENT';
  const roster = isAgent ? (Array.isArray(user?.representingArtists) ? user.representingArtists : []) : [];
  const inRoster = roster.some((a) => rosterEntryId(a) === artistFilter);
  const selectedArtistId = inRoster ? artistFilter : 'all';
  const calendarArtistId = inRoster ? artistFilter : (roster[0] ? rosterEntryId(roster[0]) : null);
  const calendarArtist = useMemo(() => {
    const a = roster.find((x) => rosterEntryId(x) === calendarArtistId);
    return a ? { id: calendarArtistId, name: a.name, role: 'ARTIST' } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarArtistId, roster.map(rosterEntryId).join(',')]);

  // ---- One header for the three sub-tabs -----------------------------
  // Intro sentence on the left, optional action on the right, and for agents
  // the represented-artist picker underneath.
  const renderArtistPicker = ({ allowAll }) => (
    <div className="matches-filters text-left">
      <div className="filter-group" style={{ flex: 1 }}>
        <label className="filter-label">{t('tour.artist')}</label>
        <select
          className="filter-select"
          style={{ width: '100%' }}
          value={allowAll ? selectedArtistId : calendarArtistId}
          onChange={(e) => setArtistFilter(e.target.value)}
        >
          {allowAll && <option value="all">{t('tour.allArtists')}</option>}
          {roster.map((a) => <option key={rosterEntryId(a)} value={rosterEntryId(a)}>{a.name}</option>)}
        </select>
      </div>
    </div>
  );
  const renderSubTabHeader = ({ intro, action = null, allowAll = true }) => (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-left text-xs leading-relaxed text-white/45">{intro}</div>
        {action}
      </div>
      {isAgent && roster.length > 0 && renderArtistPicker({ allowAll })}
    </>
  );

  // Calendar sub-tab: own availability + travel, or one represented artist's.
  const renderMyDates = () => {
    const premium = isPremiumViewer(user); // the teaser renders a preview: no fetches
    let pane;
    if (isAgent && !roster.length) {
      pane = (
        <p className="m-0 py-8 text-center text-sm text-white/45">
          {t('tour.calendarNoArtists')}{' '}
          <button type="button" className="border-0 bg-transparent p-0 text-sm text-white/70 underline"
            onClick={() => goProfileThen('tora:open-roster')}>
            {t('tour.calendarAddArtists')}
          </button>
        </p>
      );
    } else if (isAgent) {
      pane = calendarArtist && (
        <CalendarScreen key={calendarArtist.id} embedded={true} targetProfile={calendarArtist} preview={!premium} onSeeMatches={() => setActiveTab('matches')} />
      );
    } else {
      pane = <CalendarScreen embedded={true} preview={!premium} onSeeMatches={() => setActiveTab('matches')} />;
    }
    return (
      <div className="tour-kickstart-content">
        <div className="coming-soon-placeholder">
          {renderSubTabHeader({ intro: t('tour.calendarIntro'), allowAll: false })}
          {/* The placeholder centres text for the header; the calendar's own
              tiles (travel schedule, upcoming events) read left-aligned. */}
          <div className="text-left">
            {premium
              ? pane
              : <LockedPane message={t('manage.calendarLockedMsg')} onUnlock={onOpenPremium}>{pane}</LockedPane>}
          </div>
        </div>
      </div>
    );
  };

  // Calendar Matches state
  const [viewingProfile, setViewingProfile] = useState(null);

  // Exact screen height: the CSS 100vh calc over-shoots on iPhones (100vh
  // includes the collapsed-URL-bar area), which let the whole page scroll.
  // Measure the space the scroller actually gives us and pin the screen to it.
  // Re-keyed on viewingProfile — the root remounts around that early return.
  const screenRef = useRef(null);
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return undefined;
    const measure = () => {
      // Phones only: desktop lets the page scroll (responsive.css) and
      // ignores --tour-screen-h.
      if (window.matchMedia('(min-width: 1024px)').matches) return;
      const scroller = el.closest('.app-content');
      if (!scroller || scroller.clientHeight < 100) return; // hidden keep-mounted panel
      // NaN-only fallback: desktop legitimately has padding-bottom 0 (sidebar
      // layout), and `|| 70` would treat that real 0 as missing.
      const pb = parseFloat(getComputedStyle(scroller).paddingBottom);
      const padBottom = Number.isNaN(pb) ? 70 : pb;
      el.style.setProperty('--tour-screen-h', `${Math.max(320, Math.round(scroller.clientHeight - padBottom))}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure); // fires when the hidden tab becomes visible
    ro.observe(el);
    return () => { window.removeEventListener('resize', measure); ro.disconnect(); };
  }, [viewingProfile]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [message, setMessage] = useState('');
  // Matches/feed filters: period, geography, genres (roles are fixed to the
  // viewer's counterparts — see utils/calendarMatch).
  const [monthFilter, setMonthFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [genresFilter, setGenresFilter] = useState([]);
  const [showMatchFilters, setShowMatchFilters] = useState(false);
  const matchFilterCount =
    (monthFilter !== 'all' ? 1 : 0) +
    (zoneFilter !== 'all' ? 1 : 0) + (countryFilter !== 'all' ? 1 : 0) +
    (genresFilter.length ? 1 : 0);
  const clearMatchFilters = () => {
    setMonthFilter('all'); setZoneFilter('all');
    setCountryFilter('all'); setGenresFilter([]); setArtistFilter('all');
  };
  const [calendarMatches, setCalendarMatches] = useState([]);
  // Desktop v3 Matches is a master-detail: this is the row showing in the
  // right pane, as { kind: 'match' | 'feed', id, match?, item? }.
  const [pickedMatch, setPickedMatch] = useState(null);

  // Industry travel feed: every active schedule (connected > liked > others),
  // server-paginated; the sentinel div drives infinite scroll.
  const [travelFeed, setTravelFeed] = useState([]);
  const feedPageRef = useRef(0);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const feedHasMoreRef = useRef(true);
  const [feedLoading, setFeedLoading] = useState(false);
  // Synchronous mirror of feedLoading: the IntersectionObserver can fire
  // twice before React re-renders, and both firings would pass a state-based
  // guard and fetch the same page.
  const feedLoadingRef = useRef(false);
  // Monotonic token: a reset (filter change / tab entry) invalidates any
  // in-flight page so its late response can't clobber the fresh list.
  const feedReqRef = useRef(0);
  const feedSentinelRef = useRef(null);

  const loadFeedPage = async (reset = false) => {
    if (!user?.id || !isPremiumUser()) return;
    if (!reset && (feedLoadingRef.current || !feedHasMoreRef.current)) return;
    const reqId = reset ? ++feedReqRef.current : feedReqRef.current;
    if (reset) {
      feedPageRef.current = 0;
      feedHasMoreRef.current = true;
      setFeedHasMore(true);
    }
    // An unknown role has no counterparts; an empty list would mean "all roles"
    // to the API, so the feed stays empty instead of showing the viewer's own kind.
    const roles = counterpartRoles(user.role);
    if (roles.length === 0) { setTravelFeed([]); return; }
    feedLoadingRef.current = true;
    setFeedLoading(true);
    try {
      const page = feedPageRef.current;
      const range = monthFilter !== 'all' ? monthKeyToRange(monthFilter) : null;
      const res = await apiService.getTravelFeed(user.id, page, {
        roles,
        zone: zoneFilter !== 'all' ? zoneFilter : undefined,
        country: countryFilter !== 'all' ? countryFilter : undefined,
        genres: genresFilter,
        from: range?.from, to: range?.to,
      });
      if (reqId !== feedReqRef.current) return; // superseded by a newer reset
      feedPageRef.current = page + 1;
      feedHasMoreRef.current = !!res.hasMore;
      setFeedHasMore(!!res.hasMore);
      setTravelFeed((prev) => (page === 0 ? res.schedules : [...prev, ...res.schedules]));
    } catch { /* premium 403 / network — leave the list as is */ }
    finally {
      if (reqId === feedReqRef.current) {
        feedLoadingRef.current = false;
        setFeedLoading(false);
      }
    }
  };
  const loadFeedPageRef = useRef(loadFeedPage);
  loadFeedPageRef.current = loadFeedPage;

  useEffect(() => {
    if (activeTab === 'matches' && isActive && user?.id) {
      loadFeedPage(true); // owns the page/hasMore reset
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, activeTab, isActive, monthFilter, zoneFilter, countryFilter, genresFilter]);

  useEffect(() => {
    const el = feedSentinelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadFeedPageRef.current();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [activeTab, isActive]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Tour Kickstart state
  const [showCreateTourModal, setShowCreateTourModal] = useState(false);
  const [myTours, setMyTours] = useState([]);
  const [tourActionBusy, setTourActionBusy] = useState(null);

  const [toursLoading, setToursLoading] = useState(true);
  const [allTours, setAllTours] = useState([]); // For promoters/venues
  // A tour closing (or reopening) has to land on everyone else's open screen:
  // otherwise a promoter fills in a proposal against a card that stopped
  // taking them and only finds out on submit. The payload carries the new
  // state, so both lists patch in place — no refetch.
  useEffect(() => {
    const unsubscribe = subscribeToTours(({ tourId, closedToOffers, status }) => {
      const patch = (list) => list.map((x) => (
        x.id === tourId ? { ...x, closedToOffers, status: status ?? x.status } : x
      ));
      setAllTours(patch);
      setMyTours(patch);
    });
    return unsubscribe;
  }, []);
  const [tourZoneFilter, setTourZoneFilter] = useState('all');
  const [tourGenreFilter, setTourGenreFilter] = useState([]); // Array for multi-select
  const [tourMonthFilter, setTourMonthFilter] = useState('all');
  const [tourCountryFilter, setTourCountryFilter] = useState('all');
  const [showTourFilters, setShowTourFilters] = useState(false);
  const [tourDropdown, setTourDropdown] = useState(null);
  const tourFilterCount =
    (tourZoneFilter !== 'all' ? 1 : 0) + (tourGenreFilter.length ? 1 : 0) +
    (tourMonthFilter !== 'all' ? 1 : 0) + (tourCountryFilter !== 'all' ? 1 : 0);
  const clearTourFilters = () => {
    setTourZoneFilter('all'); setTourCountryFilter('all');
    setTourGenreFilter([]); setTourMonthFilter('all');
  };
  const [tourForm, setTourForm] = useState({
    artistId: '', // agents create tours on behalf of a represented artist
    hideFee: false,
    zone: '',
    country: '', // Optional - if selected, tour is country-specific
    startDate: '',
    endDate: '',
    minRevenue: '',
    revenueCurrency: 'EUR',
    feeCurrency: 'EUR',
    feeMin: '',
    feeMax: '',
    additionalNotes: ''
  });

  // Modal states
  const [showMakeOfferModal, setShowMakeOfferModal] = useState(false);

  // Portaled sub-panes escape the hidden keep-mounted panel — close them when
  // this tab deactivates. MUST live above every early return (viewingProfile
  // returns at the top of render; a hook below it crashes with "rendered
  // fewer hooks than expected").
  useEffect(() => {
    if (!isActive) closeTourPanes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // A viewed calendar-match can disappear on refetch — clear the stale id so
  // the pane doesn't pop back open when a later fetch re-includes it.
  useEffect(() => {
    if (typeof viewingProfile === 'string' && !calendarMatches.some((m) => m.profile.id === viewingProfile)) {
      setViewingProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingProfile, calendarMatches]);
  const [selectedTourArtist, setSelectedTourArtist] = useState(null);
  const [selectedTour, setSelectedTour] = useState(null);
  // An offer opened from Matches has no tour behind it, so it carries its own
  // country. Without this the modal would prefill whichever tour was last
  // opened in this session.
  const [offerCountry, setOfferCountry] = useState(null);
  const [showEditTourModal, setShowEditTourModal] = useState(false);
  const [showMyProposalModal, setShowMyProposalModal] = useState(false);
  const [myProposalData, setMyProposalData] = useState(null);
  const [showTourGigsModal, setShowTourGigsModal] = useState(false);
  const [tourGigs, setTourGigs] = useState([]);
  const [loadingTourGigs, setLoadingTourGigs] = useState(false);
  const [tourBusy, setTourBusy] = useState(false);
  // Tour interest: owner-side interested list + invite state
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [tourInterests, setTourInterests] = useState([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [invitingInterestId, setInvitingInterestId] = useState(null);

  // Month keys look like 'sep-2026' (see generateMonthOptions). One parser,
  // shared by the feed request and the kickstart tour filter.
  const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthKeyToRange = (key) => {
    const [mon, year] = String(key).split('-');
    const idx = MONTH_KEYS.indexOf(mon);
    if (idx < 0) return null;
    const y = Number(year);
    const last = new Date(y, idx + 1, 0).getDate();
    const mm = String(idx + 1).padStart(2, '0');
    return {
      from: `${y}-${mm}-01`,
      to: `${y}-${mm}-${String(last).padStart(2, '0')}`,
      fromDate: new Date(y, idx, 1),
      toDate: new Date(y, idx + 1, 0, 23, 59, 59),
    };
  };

  // Generate month/year options starting from current month for next 12 months
  const generateMonthOptions = () => {
    const options = [{ value: 'all', label: t('tour.allMonths') }];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    for (let i = 0; i < 24; i++) {
      const monthIndex = (currentMonth + i) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      const monthName = months[monthIndex];
      options.push({
        value: `${monthName.toLowerCase()}-${year}`,
        label: `${monthName} ${year}`
      });
    }

    return options;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const monthOptions = React.useMemo(generateMonthOptions, [t]);

  // Fetch calendar matches when premium. Artists/venues/promoters match on
  // their OWN availability; an agent has no calendar of their own, so they
  // match on behalf of each represented artist (each match is tagged with the
  // artist it belongs to).
  useEffect(() => {
    // Only while Matches is actually on screen — Calendar opens first now.
    if (activeTab !== 'matches' || !isActive) return;
    const fetchCalendarMatches = async () => {
      if (!user || !isPremiumUser()) {
        setCalendarMatches([]);
        return;
      }

      // Resolve the "source" profiles whose availability drives the matching.
      let sources = [];
      if (isAgent) {
        const ids = roster.map(rosterEntryId).filter(Boolean);
        if (ids.length === 0) { setCalendarMatches([]); return; }
        const artistProfiles = await Promise.all(
          ids.map((id) => apiService.getProfile(id).catch(() => null))
        );
        sources = artistProfiles.filter((p) => p && (p.availableDates || []).length > 0);
      } else if ((user.availableDates || []).length > 0) {
        sources = [user];
      }

      if (sources.length === 0) { setCalendarMatches([]); return; }

      setLoadingMatches(true);
      try {
        const response = await apiService.searchProfiles({});
        const allProfiles = response.profiles || [];

        const matches = [];
        for (const source of sources) {
          for (const profile of allProfiles) {
            if (profile.id === source.id || profile.id === user.id) continue;
            // Counterpart roles, shared genre, shared open dates on which the
            // artist is actually in the counterpart's country (utils/calendarMatch).
            const overlappingDates = matchDatesFor(source, profile);
            if (overlappingDates.length > 0) {
              matches.push({
                profile,
                dates: formatMatchDates(overlappingDates),
                matchCount: overlappingDates.length,
                rawDates: overlappingDates,
                // Both sides' open dates, so the desktop can draw the overlap
                // itself — the matching already had them in hand.
                sourceDates: source.availableDates || [],
                sourceGenres: source.genres || [],
                // Agent view: which represented artist this match is for.
                forArtist: isAgent ? { id: source.id, name: source.name } : null,
              });
            }
          }
        }

        matches.sort((a, b) => b.matchCount - a.matchCount);
        setCalendarMatches(matches);
      } catch (error) {
        console.error('Error fetching calendar matches:', error);
        setCalendarMatches([]);
      } finally {
        setLoadingMatches(false);
      }
    };

    fetchCalendarMatches();
  }, [user?.id, user?.role, user?.subscriptionTier, user?.availableDates?.length, user?.representingArtists?.length, activeTab, isActive]);

  // Fetch tours when Kickstart tab is active
  useEffect(() => {
    const fetchTours = async () => {
      if (!user || activeTab !== 'kickstart' || !isActive) return;

      // Spinner only while the list is empty — re-activations refresh silently
      // (fixes e.g. the interested-counter staying stale until re-login).
      if (myTours.length === 0 && allTours.length === 0) setToursLoading(true);
      console.log('[TourScreen] Fetching tours, user role:', user.role);

      try {
        const isArtist = user.role === 'ARTIST' || user.role === 'AGENT';
        const isPromoterOrVenue = user.role === 'PROMOTER' || user.role === 'VENUE';

        if (isArtist) {
          // Fetch artist's own tours
          const response = await apiService.getMyTours(user.id);
          console.log('[TourScreen] Artist tours received:', response.tours?.length);
          console.log('[TourScreen] My tours count:', response.tours?.length);
          setMyTours(response.tours || []);
        } else if (isPromoterOrVenue) {
          // Fetch all tours for promoters/venues
          console.log('[TourScreen] Fetching all tours with role:', user.role);
          const response = await apiService.getTours({ role: user.role });
          console.log('[TourScreen] Promoter/Venue tours received:', response.tours?.length);
          setAllTours(response.tours || []);
        }
      } catch (error) {
        console.error('Error fetching tours:', error);
      } finally {
        setToursLoading(false);
      }
    };

    fetchTours();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, activeTab, isActive, onUnreadProposalsChange]);

  // Helper function to format overlapping dates for display
  // Tour span as one "d MMM – d MMM yyyy" string for drafts and cards.
  const tourDatesLabel = (tour) => `${formatEventDate(tour.startDate, t('dateFormat.locale'))} – ${formatEventDate(tour.endDate, t('dateFormat.locale'))}`;

  const formatMatchDates = (dates) => {
    if (dates.length === 0) return '';

    // matchDatesFor already returns normalized 'YYYY-MM-DD' strings.
    const sortedDates = [...dates].sort();

    // Group consecutive dates
    const groups = [];
    let currentGroup = [sortedDates[0]];

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        // Consecutive date
        currentGroup.push(sortedDates[i]);
      } else {
        // Gap - start new group
        groups.push(currentGroup);
        currentGroup = [sortedDates[i]];
      }
    }
    groups.push(currentGroup);

    // Format each group
    const formattedGroups = groups.slice(0, 3).map(group => {
      const startDate = new Date(group[0]);
      const endDate = new Date(group[group.length - 1]);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[startDate.getMonth()];
      const year = startDate.getFullYear();

      if (group.length === 1) {
        return `${month} ${startDate.getDate()}, ${year}`;
      } else {
        return `${month} ${startDate.getDate()}-${endDate.getDate()}, ${year}`;
      }
    });

    return formattedGroups.join('; ');
  };

  const allMatches = calendarMatches;

  // Filter matches based on selected UI filters. Genre + availability
  // matching already happened at fetch time against the correct source
  // profile (the artist, for agents), so we only apply the role/period
  // filters here — re-checking genre against user.genres would wrongly drop
  // every agent match (an agent has no genres of their own).
  const filteredMatches = allMatches.filter(match => {
    // Represented-artist filter (agents only)
    if (selectedArtistId !== 'all' && match.forArtist?.id !== selectedArtistId) {
      return false;
    }

    // Geography (the match's base location)
    if (zoneFilter !== 'all' && match.profile.zone !== zoneFilter) {
      return false;
    }
    if (countryFilter !== 'all' && match.profile.country !== countryFilter) {
      return false;
    }
    if (genresFilter.length > 0 && !(match.profile.genres || []).some((g) => genresFilter.includes(g))) {
      return false;
    }

    // Month/Year filter
    if (monthFilter !== 'all') {
      // Extract month and year from dates string (e.g., "Jan 8-10, 2025")
      const dateParts = match.dates.split(' ');
      const matchMonth = dateParts[0].toLowerCase();
      const matchYear = dateParts[dateParts.length - 1];

      // Extract month and year from filter (e.g., "jan-2025")
      const [filterMonth, filterYear] = monthFilter.split('-');

      if (matchMonth !== filterMonth || matchYear !== filterYear) {
        return false;
      }
    }

    return true;
  });

  const matches = filteredMatches;


  const handleConnect = (profile) => {
    if (!sentRequests.has(profile.id)) {
      setSelectedProfile(profile);
      setShowMessageModal(true);
    }
  };

  const handleMessage = (profile, draft = null) => {
    // onOpenChat lands on the Messages tab itself. Calling
    // onNavigateToMessages as well used to undo it — tab navigation closes
    // overlays, including the chat just opened.
    if (onOpenChat) onOpenChat(profile, null, draft);
  };

  const handleSendMessage = () => {
    if (selectedProfile) {
      const profileId = selectedProfile.id;
      sendConnectionRequest(profileId, message.trim() || '');
      setShowMessageModal(false);
      setMessage('');
      setSelectedProfile(null);
    }
  };

  const handleProfileClick = (profileId) => {
    console.log('[TourScreen] Opening profile:', profileId);
    setViewingProfile(profileId);
  };

  /* ---- Desktop v3: Matches as a master-detail ----
     The left column lists every lead at two strengths — exact date matches
     first, then the live feed, one row per person rather than one per date
     range. The right pane draws the reason on a real calendar: their open
     nights, yours, and the ones you share. Both sides' dates are already on
     the page (the matching needs them), so none of this costs a request. */

  const ISO = (d) => d.toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

  // One row per person: a promoter with five open ranges is one lead, not five.
  const feedByProfile = useMemo(() => {
    // Someone who is already an exact date match belongs in that group and
    // not again below it.
    const alreadyMatched = new Set(matches.map((m) => m.profile?.id));
    const byId = new Map();
    travelFeed.forEach((f) => {
      const id = f.profile?.id;
      if (!id || alreadyMatched.has(id)) return;
      if (!byId.has(id)) byId.set(id, { profile: f.profile, items: [], connected: f.connected, liked: f.liked });
      byId.get(id).items.push(f);
    });
    return [...byId.values()];
  }, [travelFeed, matches]);

  // A venue or promoter does not travel — it opens dates. Same list, two
  // headings, so neither role is described in the other's language.
  const opensDates = (role) => ['VENUE', 'PROMOTER'].includes(String(role || '').toUpperCase());
  // Only a promoter or venue books an artist, and only an artist is booked.
  const canOffer = (prof) => opensDates(user?.role) && String(prof?.role || '').toUpperCase() === 'ARTIST';
  const feedGroups = [
    { key: 'available', label: t('desktop.matAlsoAvailable'), items: feedByProfile.filter((g) => opensDates(g.profile.role)) },
    { key: 'travelling', label: t('desktop.matAlsoTravelling'), items: feedByProfile.filter((g) => !opensDates(g.profile.role)) },
  ].filter((g) => g.items.length > 0);

  // Desktop opens on the strongest lead rather than an empty pane: an exact
  // date match if there is one, otherwise the first person in the feed.
  // Must sit below feedByProfile — the dependency array is read during
  // render, and reading it above its declaration is a TDZ crash.
  useEffect(() => {
    if (!nativeDesktop || pickedMatch) return;
    // The feed arrives before the matches do; falling back to it too early
    // would pin a weaker lead and never let go.
    if (loadingMatches) return;
    if (matches.length > 0) setPickedMatch({ kind: 'match', id: `m-${matches[0].profile.id}-0`, match: matches[0] });
    else if (feedByProfile.length > 0) setPickedMatch({ kind: 'group', id: `g-${feedByProfile[0].profile.id}`, group: feedByProfile[0] });
  }, [nativeDesktop, matches, feedByProfile, pickedMatch, loadingMatches]);

  // Every day worth drawing, as iso -> 'both' | 'them' | 'you'.
  const dayMarks = (picked) => {
    const marks = new Map();
    const mineList = picked.kind === 'match' ? (picked.match.sourceDates || []) : (user?.availableDates || []);
    new Set(mineList.map(normalizeDate)).forEach((d) => marks.set(d, 'you'));

    if (picked.kind === 'match') {
      new Set((picked.match.profile?.availableDates || []).map(normalizeDate))
        .forEach((d) => marks.set(d, marks.get(d) === 'you' ? 'both' : 'them'));
      new Set((picked.match.rawDates || []).map(normalizeDate)).forEach((d) => marks.set(d, 'both'));
    } else {
      picked.group.items.forEach((it) => {
        const end = new Date(`${it.endDate}T00:00:00Z`);
        for (let d = new Date(`${it.startDate}T00:00:00Z`); d <= end; d = addDays(d, 1)) {
          const iso = ISO(d);
          marks.set(iso, marks.get(iso) === 'you' ? 'both' : 'them');
        }
      });
    }
    return marks;
  };

  // Months the other side actually appears in — your own free days alone are
  // not a reason to draw a month here.
  const monthsToDraw = (marks) => [...new Set([...marks.entries()]
    .filter(([, k]) => k !== 'you').map(([iso]) => iso.slice(0, 7)))].sort().slice(0, 3);

  const miniMonth = (ym, marks) => {
    const [y, mo] = ym.split('-').map(Number);
    const firstDow = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
    const total = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const cells = [];
    t('dateFormat.weekLetters').split(',').forEach((w, i) => cells.push(<i key={`h${i}`} className="is-dow">{w}</i>));
    for (let i = 0; i < firstDow; i++) cells.push(<i key={`p${i}`} className="is-pad" />);
    for (let d = 1; d <= total; d++) {
      const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const kind = marks.get(iso);
      cells.push(<i key={iso} className={kind ? `is-${kind}` : ''}>{d}</i>);
    }
    return (
      <div className="d3-mini" key={ym}>
        <p className="d3-mini-name">
          {new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(t('dateFormat.locale'), { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </p>
        <div className="d3-mini-grid">{cells}</div>
      </div>
    );
  };

  const matchRowKey = (m, i) => `m-${m.profile.id}-${i}`;
  const groupRowKey = (g) => `g-${g.profile.id}`;

  const desktopMatchRow = (match, i) => {
    const key = matchRowKey(match, i);
    const shared = new Set((match.rawDates || []).map(normalizeDate));
    const sorted = [...shared].sort();
    const strip = [];
    if (sorted.length) {
      const end = new Date(`${sorted[sorted.length - 1]}T00:00:00Z`);
      for (let d = new Date(`${sorted[0]}T00:00:00Z`); d <= end && strip.length < 14; d = addDays(d, 1)) strip.push(shared.has(ISO(d)));
    }
    return (
      <button type="button" key={key}
        className={`d3-mat-row${pickedMatch?.id === key ? ' is-on' : ''}`}
        onClick={() => setPickedMatch({ kind: 'match', id: key, match })}>
        <span className="d3-mat-name">{match.profile.name}</span>
        <span className="d3-mat-sub">
          {match.profile.role} · {match.profile.location}
          {match.forArtist ? ` · ${match.forArtist.name}` : ''}
        </span>
        {connectedUsers.has(match.profile.id) && (
          <span className="d3-mat-rel">{t('tour.feedConnected')}</span>
        )}
        {strip.length > 0 && (
          <span className="d3-mat-strip" aria-hidden>
            {strip.map((on, j) => <i key={j} className={on ? 'is-both' : ''} />)}
          </span>
        )}
      </button>
    );
  };

  const desktopGroupRow = (group) => {
    const key = groupRowKey(group);
    const first = group.items[0];
    const where = [first.destCity, first.destCountry].filter(Boolean).join(', ') || first.zone;
    const starts = group.items.map((i) => i.startDate).sort();
    const ends = group.items.map((i) => i.endDate).sort();
    return (
      <button type="button" key={key}
        className={`d3-mat-row${pickedMatch?.id === key ? ' is-on' : ''}`}
        onClick={() => setPickedMatch({ kind: 'group', id: key, group })}>
        <span className="d3-mat-name">{group.profile.name}</span>
        <span className="d3-mat-sub">
          {group.profile.role} · {where} · {starts[0]}
          {ends[ends.length - 1] !== starts[0] ? ` → ${ends[ends.length - 1]}` : ''}
        </span>
        <span className="d3-mat-tags">
          {group.items.length > 1 && (
            <span className="d3-mat-count">{t('desktop.matRanges', { n: group.items.length })}</span>
          )}
          {connectedUsers.has(group.profile.id)
            ? <span className="d3-mat-rel">{t('tour.feedConnected')}</span>
            : group.liked ? <span className="d3-mat-rel is-liked">{t('tour.feedLiked')}</span> : null}
        </span>
      </button>
    );
  };

  const desktopMatchDetail = () => {
    if (!pickedMatch) return <p className="d3-mat-blank">{t('desktop.matPick')}</p>;

    const prof = pickedMatch.kind === 'match' ? pickedMatch.match.profile : pickedMatch.group.profile;
    const isRequested = sentRequests.has(prof.id);
    const isConnected = connectedUsers.has(prof.id);
    const marks = dayMarks(pickedMatch);
    const months = monthsToDraw(marks);
    const sharedNights = [...marks.values()].filter((k) => k === 'both').length;

    // Only the genres both sides actually work in — their full list is on
    // their profile, this pane is about what you have in common.
    const myGenres = pickedMatch.kind === 'match' ? (pickedMatch.match.sourceGenres || []) : (user?.genres || []);
    const theirGenres = prof.genres || [];
    const sharedGenres = theirGenres.filter((g) => myGenres.includes(g));
    const genreList = sharedGenres.length > 0 ? sharedGenres : theirGenres;

    return (
      <>
        <div className="d3-mat-head">
          <div className={`match-avatar avatar-${(prof.role || 'artist').toLowerCase()} clickable`}
               onClick={() => handleProfileClick(prof.id)}>
            {prof.avatar ? <img src={prof.avatar} alt={prof.name} /> : (prof.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="match-name-role !mb-0">
              <h3 className="truncate">{prof.name}</h3>
              <span className={`role-badge ${(prof.role || '').toLowerCase()}`}>{prof.role}</span>
            </div>
            <p className="d3-mat-loc">
              {isConnected ? <span className="d3-mat-rel">{t('tour.feedConnected')}</span> : null}
              {prof.location}
              {/* Real field, filled in by the venue — absent on most profiles today. */}
              {prof.venueCapacity ? ` · ${t('profile.capacity')} ${Number(prof.venueCapacity).toLocaleString()}` : ''}
            </p>
          </div>
        </div>

        {months.length > 0 && (
          <div className="d3-mat-ov">
            <p className="d3-mat-lbl">
              {pickedMatch.kind === 'match' ? t('desktop.matOverlapTitle')
                : opensDates(prof.role) ? t('tour.feedOpenDates') : t('calendar.travelSchedules')}
            </p>
            <div className="d3-mat-months">{months.map((ym) => miniMonth(ym, marks))}</div>
            <div className="d3-mat-key">
              <span><b className="is-both" />{t('desktop.matBoth')}</span>
              <span><b className="is-them" />{t('desktop.matThem')}</span>
              <span><b className="is-you" />{t('desktop.matYou')}</span>
            </div>
            {/* An artist's ranges are a travel schedule, not open dates: the
                lit days mean "you are free while they are in the area", which
                is not the same claim as a shared open night. */}
            {sharedNights > 0 && (
              <p className="d3-mat-note">
                {pickedMatch.kind === 'match' || opensDates(prof.role)
                  ? t('desktop.matNightsCommon', { n: sharedNights })
                  : t('desktop.matNightsHere', { n: sharedNights })}
              </p>
            )}
          </div>
        )}

        {genreList.length > 0 && (
          <div className="d3-mat-ov">
            <p className="d3-mat-lbl">{sharedGenres.length > 0 ? t('desktop.matGenresShared') : t('search.genres')}</p>
            <div className="match-genres-simple">
              {genreList.slice(0, 8).map((g) => <span key={g} className="genre-tag-small">{g}</span>)}
            </div>
          </div>
        )}

        <div className="d3-mat-actions">
          {/* A promoter or venue looking at an artist is here to book them, so
              the offer leads and the relationship control follows it. Everyone
              else gets Message when connected and Connect when not — messaging
              is connection-gated, so a lead you have no relationship with can
              only be connected to. */}
          {canOffer(prof) && (
            <button className="btn btn-primary" onClick={() => {
              setSelectedTourArtist(prof);
              setOfferCountry(prof.country || null);
              setShowMakeOfferModal(true);
            }}>
              {t('tour.makeAnOffer')}
            </button>
          )}
          {isConnected ? (
            <button className={`btn ${canOffer(prof) ? '' : 'btn-message'}`}
              onClick={() => handleMessage(prof, pickedMatch.kind === 'match'
                ? t('tour.matchDraft', { name: prof.name, dates: pickedMatch.match.dates })
                : '')}>
              {t('search.message')}
            </button>
          ) : (
            <button className={`btn ${isRequested ? 'btn-disabled' : canOffer(prof) ? '' : 'btn-primary'}`}
              onClick={() => handleConnect(prof)} disabled={isRequested}>
              {isRequested ? t('search.requested') : t('search.connect')}
            </button>
          )}
          <button className="btn" onClick={() => handleProfileClick(prof.id)}>{t('desktop.view')}</button>
        </div>
      </>
    );
  };

  // Calendar Matches Tab Content
  const renderCalendarMatches = () => {
    // Show upgrade prompt for basic users
    if (!isPremiumUser()) {
      return (
        <div className="tour-kickstart-content">
          <div className="coming-soon-placeholder">
            <div className="coming-soon-icon">
              <StarIcon />
            </div>
            <h2>{t('tour.unlockCalendarMatching')}</h2>
            <p>{t('tour.unlockCalendarMatchingDesc')}</p>
            <div className="feature-preview">
              <h4>{t('tour.premiumFeatures')}</h4>
              <ul className="feature-list">
                <li>
                  <span className="feature-icon"><CalendarIcon /></span>
                  <span>{t('tour.featureMatchingAvailability')}</span>
                </li>
                <li>
                  <span className="feature-icon"><LocationIcon /></span>
                  <span>{t('tour.featureSearchGlobally')}</span>
                </li>
                <li>
                  <span className="feature-icon"><TargetIcon /></span>
                  <span>{t('tour.featureArtistsTouring')}</span>
                </li>
                <li>
                  <span className="feature-icon"><EyeIcon /></span>
                  <span>{t('tour.featureCalendarVisibility')}</span>
                </li>
              </ul>
            </div>
            <button
              className="btn btn-primary"
              style={{
                backgroundColor: '#FFD700',
                color: '#000',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer'
              }}
              onClick={() => onOpenPremium && onOpenPremium()}
            >
              {t('tour.upgradeToPremium')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="tour-kickstart-content">
        <div className="coming-soon-placeholder">
          {renderSubTabHeader({
            intro: (
              <>
                <p className="m-0">{t('tour.matchesIntro')}</p>
                {/* Where the matches come from — otherwise "I filled in my
                    calendar and nothing happened". */}
                <p className="m-0 mt-1 text-white/35">
                  {t(isAgent ? 'tour.matchesSourceAgent' : 'tour.matchesSource')}{' '}
                  <button type="button" className="border-0 bg-transparent p-0 text-xs text-white/60 underline"
                    onClick={() => { closeTourPanes(); setActiveTab('calendar'); }}>
                    {t('tour.editAvailability')}
                  </button>
                </p>
              </>
            ),
            action: <FilterButton count={matchFilterCount} onClick={() => setShowMatchFilters(true)} label={t('search.filters')} />,
          })}

          <div className="feature-preview">
            {!nativeDesktop && <p className="form-hint" style={{ margin: '0 0 12px' }}>{t('tour.matchesGeoHint')}</p>}

            {nativeDesktop ? (
              <div className="d3-mat">
                <div className="d3-mat-list">
                  {matches.length > 0 && (
                    <>
                      <p className="d3-mat-group">{t('desktop.matMatching')} · {matches.length}</p>
                      {matches.map(desktopMatchRow)}
                    </>
                  )}
                  {feedGroups.map((g) => (
                    <React.Fragment key={g.key}>
                      <p className="d3-mat-group">{g.label} · {g.items.length}</p>
                      {g.items.map(desktopGroupRow)}
                    </React.Fragment>
                  ))}
                  {matches.length === 0 && feedGroups.length === 0 && !feedLoading && (
                    <p className="d3-mat-blank">{t('tour.noMatchesMessage')}</p>
                  )}
                  <div ref={feedSentinelRef} className="h-8" />
                  {feedLoading && <p className="text-center text-xs text-white/35 py-2">{t('common.loading')}</p>}
                </div>
                <div className="d3-mat-detail">{desktopMatchDetail()}</div>
              </div>
            ) : matches.length > 0 ? (
              <div className="matches-results">
                <p className="matches-count">
                  {matches.length === 1 ? t('tour.matchFound', { n: matches.length }) : t('tour.matchesFound', { n: matches.length })}
                </p>

                {matches.map((match, index) => {
                  const profileId = match.profile.id;
                  const isRequested = sentRequests.has(profileId);
                  const isConnected = connectedUsers.has(profileId);

                  return (
                    <div key={`${profileId}-${index}`} className="match-card-simple">
                      {match.forArtist && (
                        <div className="text-[10px] uppercase tracking-[0.15em] text-infrared/80 font-tech mb-1.5">
                          {t('bookings.forArtist', { name: match.forArtist.name })}
                        </div>
                      )}
                      <div className="match-date-location">
                        <span><CalendarIcon /> {match.dates}</span>
                        <span><LocationIcon /> {match.profile.location}</span>
                      </div>

                      <div className="match-profile-content">
                        <div
                          className={`match-avatar avatar-${match.profile.role.toLowerCase()} clickable`}
                          onClick={() => handleProfileClick(profileId)}
                        >
                          {match.profile.avatar ? (
                            <img src={match.profile.avatar} alt={match.profile.name} />
                          ) : (
                            match.profile.name.charAt(0).toUpperCase()
                          )}
                          {match.profile.isVerified && <span className="verified-badge">✓</span>}
                        </div>

                        <div
                          className="match-info clickable"
                          onClick={() => handleProfileClick(profileId)}
                        >
                          <div className="match-name-role">
                            <h3>{match.profile.name}</h3>
                            <span className={`role-badge ${match.profile.role.toLowerCase()}`}>
                              {match.profile.role}
                            </span>
                          </div>
                          <p className="match-base-location">{match.profile.location}</p>
                        </div>
                      </div>

                      {match.profile.genres && match.profile.genres.length > 0 && (
                        <div className="match-genres-simple">
                          {match.profile.genres.slice(0, 3).map(genre => (
                            <span key={genre} className="genre-tag-small">{genre}</span>
                          ))}
                          {match.profile.genres.length > 3 && (
                            <span className="genre-tag-small">+{match.profile.genres.length - 3}</span>
                          )}
                        </div>
                      )}

                      {isConnected ? (
                        <button
                          className="btn btn-message btn-match-full"
                          onClick={() => handleMessage(match.profile, t('tour.matchDraft', { name: match.profile.name, dates: match.dates }))}
                        >
                          {t('search.message')}
                        </button>
                      ) : (
                        <button
                          className={`btn ${isRequested ? 'btn-disabled' : 'btn-primary'} btn-match-full`}
                          onClick={() => handleConnect(match.profile)}
                          disabled={isRequested}
                        >
                          {isRequested ? t('search.requested') : t('search.connect')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-matches-simple">
                <p>{t('tour.noMatchesMessage')}</p>
                <div className="no-matches-tips">
                  <h4>{t('tour.tipsTitle')}</h4>
                  <ul className="feature-list">
                    <li>
                      <span className="feature-icon"><CalendarIcon /></span>
                      <span>{t('tour.tipAddTravelDates')}</span>
                    </li>
                    <li>
                      <span className="feature-icon"><SlidersIcon /></span>
                      <span>{t('tour.tipAddGenres')}</span>
                    </li>
                    <li>
                      <span className="feature-icon"><EyeIcon /></span>
                      <span>{t('tour.tipCalendarVisible')}</span>
                    </li>
                    <li>
                      <span className="feature-icon"><LocationIcon /></span>
                      <span>{t('tour.tipCheckDestinations')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Industry travel feed: every ACTIVE schedule out there, beyond
                strict date matches — connected people first, then liked,
                then everyone else. Infinite scroll via sentinel. */}
            {!nativeDesktop && isPremiumUser() && (
              <div className="mt-8">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-tech m-0">
                  {t('tour.travelFeedTitle')}
                </p>
                <p className="text-xs text-white/45 mt-1 mb-4">{t('tour.travelFeedHint')}</p>
                {travelFeed.length === 0 && !feedLoading && (
                  <p className="text-sm text-white/40">{t('tour.travelFeedEmpty')}</p>
                )}
                <div className="flex flex-col gap-2.5">
                  {travelFeed.map((s, i) => (
                    <div
                      key={`${s.profile.id}-${s.startDate}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 cursor-pointer hover:border-infrared/40 transition-colors"
                      onClick={() => setViewingProfile(s.profile)}
                    >
                      <div className={`match-avatar avatar-${(s.profile.role || 'artist').toLowerCase()} shrink-0`}>
                        {s.profile.avatar
                          ? <img src={s.profile.avatar} alt={s.profile.name} />
                          : (s.profile.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Same structure as the match cards (.match-name-role)
                            so name + role pill align identically everywhere. */}
                        <div className="match-name-role !mb-0">
                          <h3 className="truncate">{s.profile.name}</h3>
                          <span className={`role-badge ${(s.profile.role || '').toLowerCase()}`}>{s.profile.role}</span>
                          {s.connected && (
                            <span className="text-[9px] uppercase tracking-[0.12em] text-emerald-400/90 font-tech">{t('tour.feedConnected')}</span>
                          )}
                          {s.liked && (
                            <span className="text-infrared [&_svg]:w-3 [&_svg]:h-3 [&_svg]:translate-y-[1.5px]" aria-label={t('tour.feedLiked')}>
                              <HeartIcon filled />
                            </span>
                          )}
                        </div>
                        <p className="m-0 mt-0.5 text-xs text-white/55 truncate">
                          {s.kind === 'availability' && (
                            <span className="text-amber-300/80">{t('tour.feedOpenDates')} · </span>
                          )}
                          {[s.destCity, s.destCountry].filter(Boolean).join(', ') || s.zone}
                          <span className="text-white/35"> · {s.startDate}{s.endDate !== s.startDate ? ` → ${s.endDate}` : ''}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div ref={feedSentinelRef} className="h-8" />
                {feedLoading && <p className="text-center text-xs text-white/35 py-2">{t('common.loading')}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Full-page filters — shared FilterSheet, draft-applied on Apply */}
        {/* Portaled out of the tour column so nothing in it (sticky tabs, the
            phone's fixed-height box) can sit on top of the sheet. */}
        {showMatchFilters && (
          <OverlayPortal><FilterSheet
            values={{ period: monthFilter, zone: zoneFilter, country: countryFilter, genres: genresFilter }}
            clearedValues={{ period: 'all', zone: 'all', country: 'all', genres: [] }}
            onClose={() => setShowMatchFilters(false)}
            onApply={(v) => {
              setMonthFilter(v.period);
              setZoneFilter(v.zone); setCountryFilter(v.country);
              setGenresFilter(v.genres);
              setShowMatchFilters(false);
            }}
            sections={[
              { key: 'period', label: t('tour.period'), multi: false, allLabel: t('tour.allMonths'),
                options: () => monthOptions.map((o) => ({ value: o.value, label: o.label })) },
              { key: 'zone', label: t('editProfile.zone'), multi: false, allLabel: t('manageArtist.allZones'), resets: ['country'],
                options: () => [{ value: 'all', label: t('manageArtist.allZones') }, ...zones.map((z) => ({ value: z, label: z }))] },
              { key: 'country', label: t('editProfile.country'), multi: false, allLabel: t('manageArtist.allCountries'),
                visible: (d) => d.zone !== 'all',
                options: (d) => [{ value: 'all', label: t('manageArtist.allCountries') }, ...(countriesByZone[d.zone] || []).map((c) => ({ value: c, label: c }))] },
              { key: 'genres', label: t('search.genres'), multi: true,
                options: () => genresList.map((g) => ({ value: g, label: g })) },
            ]}
          /></OverlayPortal>
        )}
      </div>
    );
  };

  // Handle city field change

  // Handle Create Tour form submission
  const handleCreateTour = async () => {
    if (tourBusy) return;
    // Validation
    if (user?.role === 'AGENT' && !tourForm.artistId) {
      appAlert(t('offer.selectArtistError'));
      return;
    }
    if (!tourForm.zone || !tourForm.startDate || !tourForm.endDate || !tourForm.minRevenue) {
      appAlert(t('tour.fillRequiredFields'));
      return;
    }

    // Date validation - end date must be after start date
    const startDate = new Date(tourForm.startDate);
    const endDate = new Date(tourForm.endDate);
    if (endDate < startDate) {
      appAlert(t('tour.endDateAfterStart'));
      return;
    }

    // Build fee expectation string
    const feeExpectation = tourForm.feeMin && tourForm.feeMax
      ? `${tourForm.feeCurrency} ${tourForm.feeMin}-${tourForm.feeMax}`
      : '';

    setTourBusy(true);
    try {
      // Save to backend
      const tourData = {
        zone: tourForm.zone,
        country: tourForm.country || '', // Empty string means zone-wide tour
        startDate: tourForm.startDate,
        endDate: tourForm.endDate,
        minRevenue: parseInt(tourForm.minRevenue, 10),
        revenueCurrency: tourForm.revenueCurrency,
        targetCities: [], // Always empty - feature removed
        feeExpectation: feeExpectation,
        additionalNotes: tourForm.additionalNotes
      };
      tourData.hideFee = !!tourForm.hideFee;
      if (user?.role === 'AGENT' && tourForm.artistId) {
        tourData.artistId = tourForm.artistId;
      }

      const response = await apiService.createTour(tourData);

      if (response.tour) {
        // Add to local list
        setMyTours([response.tour, ...myTours]);

        // Reset form and close modal
        setTourForm({
          artistId: '',
          hideFee: false,
          zone: '',
          country: '',
          startDate: '',
          endDate: '',
          minRevenue: '',
          revenueCurrency: 'EUR',
          feeCurrency: 'EUR',
          feeMin: '',
          feeMax: '',
          additionalNotes: ''
        });
        setShowCreateTourModal(false);

        appAlert(t('tour.tourCreated'));
      }
    } catch (error) {
      console.error('Error creating tour:', error);
      if (!isVerificationGate(error)) appAlert(error.message || t('tour.createTourFailed'));
    } finally {
      setTourBusy(false);
    }
  };

  // Handle Make Offer (for tours)
  const handleMakeOffer = (tour) => {
    setSelectedTour(tour);
    setSelectedTourArtist(tour.artist); // Set the artist profile for MakeOfferModal
    setShowMakeOfferModal(true);
  };

  // Handle Edit Tour
  // Full up: stop taking proposals without cancelling the tour.
  const handleToggleTourOffers = async (tour) => {
    const next = !tour.closedToOffers;
    setTourActionBusy(tour.id);
    try {
      await apiService.setTourOffersClosed(tour.id, next);
      setMyTours((prev) => prev.map((x) => (x.id === tour.id ? { ...x, closedToOffers: next } : x)));
    } catch (error) {
      appAlert(error.message || t('tour.updateFailed'));
    } finally {
      setTourActionBusy(null);
    }
  };

  const handleEditTour = (tour) => {
    setSelectedTour(tour);
    setTourForm({
      zone: tour.zone,
      country: tour.country || '',
      startDate: tour.startDate.split('T')[0],
      endDate: tour.endDate.split('T')[0],
      minRevenue: tour.minRevenue?.toString() || '',
      revenueCurrency: tour.revenueCurrency || 'EUR',
      hideFee: !!tour.hideFee,
      feeCurrency: tour.feeExpectation ? tour.feeExpectation.split(' ')[0] : 'EUR',
      feeMin: tour.feeExpectation ? tour.feeExpectation.split(' ')[1]?.split('-')[0] || '' : '',
      feeMax: tour.feeExpectation ? tour.feeExpectation.split(' ')[1]?.split('-')[1] || '' : '',
      additionalNotes: tour.additionalNotes || ''
    });
    closeTourPanes();
    setShowEditTourModal(true);
  };

  // Handle Update Tour form submission
  const handleUpdateTour = async () => {
    if (tourBusy) return;
    // Validation
    if (!tourForm.zone || !tourForm.startDate || !tourForm.endDate || !tourForm.minRevenue) {
      appAlert(t('tour.fillRequiredFields'));
      return;
    }

    // Date validation - end date must be after start date
    const startDate = new Date(tourForm.startDate);
    const endDate = new Date(tourForm.endDate);
    if (endDate < startDate) {
      appAlert(t('tour.endDateAfterStart'));
      return;
    }

    // Build fee expectation string
    const feeExpectation = tourForm.feeMin && tourForm.feeMax
      ? `${tourForm.feeCurrency} ${tourForm.feeMin}-${tourForm.feeMax}`
      : '';

    setTourBusy(true);
    try {
      // Update tour via backend
      const tourData = {
        zone: tourForm.zone,
        country: tourForm.country || '', // Empty string means zone-wide tour
        startDate: tourForm.startDate,
        endDate: tourForm.endDate,
        minRevenue: parseInt(tourForm.minRevenue, 10),
        revenueCurrency: tourForm.revenueCurrency,
        targetCities: [], // Always empty - feature removed
        feeExpectation: feeExpectation,
        additionalNotes: tourForm.additionalNotes,
        hideFee: !!tourForm.hideFee
      };

      const response = await apiService.updateTour(selectedTour.id, tourData);

      // Update tours list with the updated tour
      const updatedTour = response.tour;
      setMyTours(prev => prev.map(t => t.id === updatedTour.id ? updatedTour : t));

      // Close modal and reset form
      setShowEditTourModal(false);
      setTourForm({
        zone: '',
        country: '',
        startDate: '',
        endDate: '',
        minRevenue: '',
        revenueCurrency: 'EUR',
        feeCurrency: 'EUR',
        feeMin: '',
        feeMax: '',
        additionalNotes: ''
      });
      setSelectedTour(null);

      appAlert(t('tour.tourUpdated'));
    } catch (error) {
      console.error('Error updating tour:', error);
      appAlert(t('tour.updateTourFailed'));
    } finally {
      setTourBusy(false);
    }
  };

  // Handle Delete Tour
  const handleDeleteTour = async (tour) => {
    const confirmed = await appConfirm(
      t('tour.deleteTourConfirm', { location: tour.country || tour.zone }),
      { danger: true }
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/tours/${tour.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete tour');
      }

      // Remove tour from myTours state
      setMyTours(prevTours => prevTours.filter(t => t.id !== tour.id));

      appAlert(t('tour.tourDeleted'));
    } catch (error) {
      console.error('Error deleting tour:', error);
      appAlert(t('tour.deleteTourFailed'));
    }
  };


  // Only one tour sub-pane (create / edit / gigs / proposal) at a time —
  // opening one closes whatever else is open.
  const closeTourPanes = () => {
    setShowCreateTourModal(false);
    setShowEditTourModal(false);
    setShowTourGigsModal(false);
    setShowMyProposalModal(false);
    setShowMakeOfferModal(false);
    setShowInterestsModal(false);
    setSelectedTourArtist(null);
    setViewingProfile(null);
  };

  const handleViewTourGigs = async (tour) => {
    setSelectedTour(tour);
    closeTourPanes();
    setShowTourGigsModal(true);
    setLoadingTourGigs(true);
    setTourGigs([]);

    try {
      // Fetch deals linked to this tour
      const response = await apiService.getDealsForTour(tour.id, user.id);
      setTourGigs(response.deals || []);
    } catch (error) {
      console.error('Error fetching tour gigs:', error);
      appAlert(t('tour.loadGigsFailed'));
    } finally {
      setLoadingTourGigs(false);
    }
  };

  // Owner opens the interested-list (the market-appetite map)
  const handleViewInterests = async (tour) => {
    setSelectedTour(tour);
    closeTourPanes();
    setShowInterestsModal(true);
    setLoadingInterests(true);
    setTourInterests([]);
    try {
      const response = await apiService.getTourInterests(tour.id);
      setTourInterests(response.interests || []);
    } catch (error) {
      console.error('Error fetching tour interests:', error);
      appAlert(t('tour.loadInterestsFailed'));
    } finally {
      setLoadingInterests(false);
    }
  };

  // Owner invites an interested promoter/venue to make a real offer
  const handleInviteInterest = async (interest) => {
    if (invitingInterestId) return;
    setInvitingInterestId(interest.id);
    try {
      const res = await apiService.inviteTourInterest(interest.tourId, interest.id);
      const invitedAt = res.invitedAt || new Date().toISOString();
      setTourInterests((prev) => prev.map((i) => (i.id === interest.id ? { ...i, invitedAt } : i)));
    } catch (error) {
      console.error('Error inviting interest:', error);
      appAlert(t('tour.inviteFailed'));
    } finally {
      setInvitingInterestId(null);
    }
  };

  // Open the tour's artist profile (card header identity is the link)
  const handleViewTourArtist = async (tour) => {
    if (!tour.artist?.id) return;
    try {
      const fullProfile = await apiService.getProfile(tour.artist.id);
      setViewingProfile(fullProfile);
    } catch (error) {
      console.error('Error fetching artist profile:', error);
      appAlert(t('tour.loadArtistProfileFailed'));
    }
  };

  // Promoter/venue toggles "I'm interested" on a tour card — optimistic,
  // mirrors AppContext.toggleLike (flip, call, revert on error).
  const handleToggleInterest = async (tour) => {
    const patch = (on, delta) => setAllTours((prev) => prev.map((tt) => (
      tt.id === tour.id
        ? { ...tt, myInterest: on, interestsCount: Math.max(0, (tt.interestsCount || 0) + delta) }
        : tt
    )));
    const turningOn = !tour.myInterest;
    patch(turningOn, turningOn ? 1 : -1);
    try {
      const res = await apiService.toggleTourInterest(tour.id, user.id);
      // Server is authoritative on the count (handles races)
      setAllTours((prev) => prev.map((tt) => (
        tt.id === tour.id ? { ...tt, myInterest: res.interested, interestsCount: res.interestsCount } : tt
      )));
    } catch (error) {
      console.error('Error toggling tour interest:', error);
      patch(!turningOn, turningOn ? -1 : 1);
      if (!isVerificationGate(error)) appAlert(t('tour.interestFailed'));
    }
  };

  // Handle View Proposals
  // Handle View My Sent Proposal
  const handleViewMyProposal = async (tour) => {
    if (!tour.myProposal) return;

    try {
      // Fetch the full proposal details
      const response = await apiService.getTourProposals(tour.id);
      const myProposal = response.proposals?.find(p => p.id === tour.myProposal.id);

      if (!myProposal) {
        appAlert(t('tour.proposalNotFound'));
        return;
      }

      // Store proposal data and show modal
      setMyProposalData({ ...myProposal, tour });
      closeTourPanes();
      setShowMyProposalModal(true);
    } catch (error) {
      console.error('Error fetching proposal:', error);
      appAlert(t('tour.loadProposalFailed'));
    }
  };

  // Render Create Tour Modal
  const renderCreateTourModal = () => {
    if (!showCreateTourModal) return null;

    const modalContent = (
      <OverlayPortal><div className="create-tour-modal-overlay md-drawer" onClick={() => setShowCreateTourModal(false)}>
        <div className="modal-content create-tour-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{t('tour.createTour')}</h2>
            <button className="modal-close" onClick={() => setShowCreateTourModal(false)}>×</button>
          </div>
          <div className="modal-body">
            {user?.role === 'AGENT' && (
              <div className="form-group">
                <label>{t('manageArtist.artist')} *</label>
                <select
                  value={tourForm.artistId}
                  onChange={(e) => setTourForm({ ...tourForm, artistId: e.target.value })}
                  className="form-input"
                >
                  <option value="">{t('offer.selectAnArtist')}</option>
                  {(user?.representingArtists || [])
                    .filter((a) => a.profileId || a.id)
                    .map((a) => (
                      <option key={a.profileId || a.id} value={a.profileId || a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>{t('calendar.zone')} *</label>
              <select
                value={tourForm.zone}
                onChange={(e) => setTourForm({ ...tourForm, zone: e.target.value, country: '' })}
                className="form-input"
              >
                <option value="">{t('tour.selectZone')}</option>
                {zones.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
              <small className="form-hint">{t('tour.zoneHint')}</small>
            </div>

            {tourForm.zone && (
              <div className="form-group">
                <label>{t('tour.countryOptional')}</label>
                <select
                  value={tourForm.country}
                  onChange={(e) => setTourForm({ ...tourForm, country: e.target.value })}
                  className="form-input"
                >
                  <option value="">{t('tour.zoneWideTour')}</option>
                  {(countriesByZone[tourForm.zone] || []).map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
                <small className="form-hint">{t('tour.countryHint')}</small>
              </div>
            )}

            <div className="form-group">
              <label>{t('calendar.startDate')} *</label>
              <input
                type="date"
                value={tourForm.startDate}
                onChange={handleDateChange('startDate')}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>{t('calendar.endDate')} *</label>
              <input
                type="date"
                min={tourForm.startDate || undefined}
                value={tourForm.endDate}
                onChange={handleDateChange('endDate')}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>{t('tour.minRevenueTarget')} *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={tourForm.revenueCurrency}
                  onChange={(e) => setTourForm({ ...tourForm, revenueCurrency: e.target.value })}
                  className="form-input"
                  style={{ width: '100px' }}
                >
{CURRENCY_OPTIONS}
                </select>
                <input
                  type="number"
                  value={tourForm.minRevenue}
                  onChange={(e) => setTourForm({ ...tourForm, minRevenue: e.target.value })}
                  onWheel={(e) => e.target.blur()}
                  placeholder="0"
                  min="0"
                  className="form-input"
                  style={{ flex: 1 }}
                />
              </div>
              <small className="form-hint">{t('tour.minRevenueHint')}</small>
              <small className="form-hint block text-white/35">{t('tour.minRevenuePrivateNote')}</small>
            </div>


            <div className="form-group">
              <label>{t('tour.feeExpectationPerShow')}</label>
              <div className="fee-input-container">
                <div className="fee-currency-selector">
                  <select
                    value={tourForm.feeCurrency}
                    onChange={(e) => setTourForm({ ...tourForm, feeCurrency: e.target.value })}
                    className="form-input"
                  >
{CURRENCY_OPTIONS_WITH_SYMBOL}
                  </select>
                </div>
                <div className="fee-range-inputs">
                  <div className="fee-input-wrapper">
                    <span className="fee-currency-symbol">
                      {tourForm.feeCurrency === 'EUR' ? '€' :
                       tourForm.feeCurrency === 'USD' ? '$' :
                       tourForm.feeCurrency === 'GBP' ? '£' : '¥'}
                    </span>
                    <input
                      type="number"
                      value={tourForm.feeMin}
                      onChange={(e) => setTourForm({ ...tourForm, feeMin: e.target.value })}
                      placeholder={t('tour.min')}
                      min="0"
                      step={tourForm.feeCurrency === 'JPY' ? '1000' : '50'}
                      className="form-input fee-number-input"
                    />
                  </div>
                  <span className="fee-separator">-</span>
                  <div className="fee-input-wrapper">
                    <span className="fee-currency-symbol">
                      {tourForm.feeCurrency === 'EUR' ? '€' :
                       tourForm.feeCurrency === 'USD' ? '$' :
                       tourForm.feeCurrency === 'GBP' ? '£' : '¥'}
                    </span>
                    <input
                      type="number"
                      value={tourForm.feeMax}
                      onChange={(e) => setTourForm({ ...tourForm, feeMax: e.target.value })}
                      placeholder={t('tour.max')}
                      min="0"
                      step={tourForm.feeCurrency === 'JPY' ? '1000' : '50'}
                      className="form-input fee-number-input"
                    />
                  </div>
                </div>
              </div>
              <small className="form-hint">{t('tour.feeRangeHint')}</small>
            </div>

            {renderHideFeeField()}

            <div className="form-group">
              <label>{t('tour.additionalNotesOptional')}</label>
              <textarea
                value={tourForm.additionalNotes}
                onChange={(e) => setTourForm({ ...tourForm, additionalNotes: e.target.value })}
                placeholder={t('tour.additionalNotesPlaceholder')}
                className="form-input"
                rows="3"
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateTourModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleCreateTour} disabled={tourBusy}>
                {tourBusy ? t('tour.creating') : t('tour.createTour')}
              </button>
            </div>
          </div>
        </div>
      </div></OverlayPortal>
    );

    // Render modal using portal to escape the TourScreen stacking context
    // modalContent portals itself via OverlayPortal — return it directly.
    return modalContent;
  };

  // Render Edit Tour Modal
  const renderEditTourModal = () => {
    if (!showEditTourModal || !selectedTour) return null;

    const modalContent = (
      <OverlayPortal><div className="create-tour-modal-overlay md-drawer" onClick={() => setShowEditTourModal(false)}>
        <div className="modal-content create-tour-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{t('tour.editTour')}</h2>
            <button className="modal-close" onClick={() => setShowEditTourModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>{t('calendar.zone')} *</label>
              <select
                value={tourForm.zone}
                onChange={(e) => setTourForm({ ...tourForm, zone: e.target.value, country: '' })}
                className="form-input"
              >
                <option value="">{t('tour.selectZone')}</option>
                {zones.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
              <small className="form-hint">{t('tour.zoneHint')}</small>
            </div>

            {tourForm.zone && (
              <div className="form-group">
                <label>{t('tour.countryOptional')}</label>
                <select
                  value={tourForm.country}
                  onChange={(e) => setTourForm({ ...tourForm, country: e.target.value })}
                  className="form-input"
                >
                  <option value="">{t('tour.zoneWideTour')}</option>
                  {(countriesByZone[tourForm.zone] || []).map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
                <small className="form-hint">{t('tour.countryHint')}</small>
              </div>
            )}

            <div className="form-group">
              <label>{t('calendar.startDate')} *</label>
              <input
                type="date"
                value={tourForm.startDate}
                onChange={handleDateChange('startDate')}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>{t('calendar.endDate')} *</label>
              <input
                type="date"
                min={tourForm.startDate || undefined}
                value={tourForm.endDate}
                onChange={handleDateChange('endDate')}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>{t('tour.minRevenueTarget')} *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={tourForm.revenueCurrency}
                  onChange={(e) => setTourForm({ ...tourForm, revenueCurrency: e.target.value })}
                  className="form-input"
                  style={{ width: '100px' }}
                >
{CURRENCY_OPTIONS}
                </select>
                <input
                  type="number"
                  value={tourForm.minRevenue}
                  onChange={(e) => setTourForm({ ...tourForm, minRevenue: e.target.value })}
                  onWheel={(e) => e.target.blur()}
                  placeholder="0"
                  min="0"
                  className="form-input"
                  style={{ flex: 1 }}
                />
              </div>
              <small className="form-hint">{t('tour.minRevenueHintShort')}</small>
              <small className="form-hint block text-white/35">{t('tour.minRevenuePrivateNote')}</small>
            </div>


            <div className="form-group">
              <label>{t('tour.feeExpectationRange')}</label>
              <div className="form-row" style={{ gap: '8px', marginBottom: '8px' }}>
                <div className="form-group" style={{ flex: '0 0 120px', margin: 0 }}>
                  <select
                    value={tourForm.feeCurrency}
                    onChange={(e) => setTourForm({ ...tourForm, feeCurrency: e.target.value })}
                    className="form-input"
                  >
{CURRENCY_OPTIONS}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      value={tourForm.feeMin}
                      onChange={(e) => setTourForm({ ...tourForm, feeMin: e.target.value })}
                      placeholder={t('tour.min')}
                      min="0"
                      step={tourForm.feeCurrency === 'JPY' ? '1000' : '50'}
                      className="form-input fee-number-input"
                    />
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>{t('tour.to')}</span>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      value={tourForm.feeMax}
                      onChange={(e) => setTourForm({ ...tourForm, feeMax: e.target.value })}
                      placeholder={t('tour.max')}
                      min="0"
                      step={tourForm.feeCurrency === 'JPY' ? '1000' : '50'}
                      className="form-input fee-number-input"
                    />
                  </div>
                </div>
              </div>
              <small className="form-hint">{t('tour.feeRangeHint')}</small>
            </div>

            {renderHideFeeField()}

            <div className="form-group">
              <label>{t('tour.additionalNotesOptional')}</label>
              <textarea
                value={tourForm.additionalNotes}
                onChange={(e) => setTourForm({ ...tourForm, additionalNotes: e.target.value })}
                placeholder={t('tour.additionalNotesPlaceholder')}
                className="form-input"
                rows="3"
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditTourModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleUpdateTour} disabled={tourBusy}>
                {tourBusy ? t('tour.updating') : t('tour.updateTour')}
              </button>
            </div>
          </div>
        </div>
      </div></OverlayPortal>
    );

    // Render modal using portal to escape the TourScreen stacking context
    // modalContent portals itself via OverlayPortal — return it directly.
    return modalContent;
  };

  // Tour Kickstart Tab Content
  /* Tour Kickstart filters (no Roles). One renderer, mounted by whichever
     layout is live: the phone/v2 card list, or the v3 board. On v3 the board
     keeps its Filters button in the toolbar with no tour selected, so the
     sheet cannot live inside the detail pane. */
  const renderTourFilterSheet = () => (showTourFilters ? (
              <FilterSheet
                values={{ period: tourMonthFilter, zone: tourZoneFilter, country: tourCountryFilter, genres: tourGenreFilter }}
                clearedValues={{ period: 'all', zone: 'all', country: 'all', genres: [] }}
                onClose={() => setShowTourFilters(false)}
                onApply={(v) => {
                  setTourMonthFilter(v.period); setTourZoneFilter(v.zone);
                  setTourCountryFilter(v.country); setTourGenreFilter(v.genres);
                  setShowTourFilters(false);
                }}
                sections={[
                  { key: 'period', label: t('tour.period'), multi: false, allLabel: t('tour.allMonths'),
                    options: () => monthOptions.map((o) => ({ value: o.value, label: o.label })) },
                  { key: 'zone', label: t('editProfile.zone'), multi: false, allLabel: t('manageArtist.allZones'), resets: ['country'],
                    options: () => [{ value: 'all', label: t('manageArtist.allZones') }, ...zones.map((z) => ({ value: z, label: z }))] },
                  { key: 'country', label: t('editProfile.country'), multi: false, allLabel: t('manageArtist.allCountries'),
                    visible: (d) => d.zone !== 'all',
                    options: (d) => [{ value: 'all', label: t('manageArtist.allCountries') }, ...(countriesByZone[d.zone] || []).map((c) => ({ value: c, label: c }))] },
                  { key: 'genres', label: t('search.genres'), multi: true,
                    options: () => genresList.map((g) => ({ value: g, label: g })) },
                ]}
              />
  ) : null);

  const renderTourKickstart = ({ only = null } = {}) => {
    // Show upgrade prompt for basic users
    if (!isPremiumUser()) {
      return (
        <div className="tour-kickstart-content">
          <div className="coming-soon-placeholder">
            <div className="coming-soon-icon">
              <StarIcon />
            </div>
            <h2>{t('tour.unlockTourKickstart')}</h2>
            <p>{t('tour.unlockTourKickstartDesc')}</p>
            <div className="feature-preview">
              <h4>{t('tour.premiumFeatures')}</h4>
              <ul className="feature-list">
                <li>
                  <span className="feature-icon"><LocationIcon /></span>
                  <span>{t('tour.featureSetTourGoals')}</span>
                </li>
                <li>
                  <span className="feature-icon"><HandshakeIcon /></span>
                  <span>{t('tour.featureCollaborate')}</span>
                </li>
                <li>
                  <span className="feature-icon"><DollarIcon /></span>
                  <span>{t('tour.featureShareCosts')}</span>
                </li>
                <li>
                  <span className="feature-icon"><TargetIcon /></span>
                  <span>{t('tour.featureRegionalTours')}</span>
                </li>
              </ul>
            </div>
            <button
              className="btn btn-primary"
              style={{
                backgroundColor: '#FFD700',
                color: '#000',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer'
              }}
              onClick={() => onOpenPremium && onOpenPremium()}
            >
              {t('tour.upgradeToPremium')}
            </button>
          </div>
        </div>
      );
    }

    // Check user role — agents get the artist view, acting for their roster.
    const isArtist = user?.role === 'ARTIST' || user?.role === 'AGENT';
    const isPromoterOrVenue = user?.role === 'PROMOTER' || user?.role === 'VENUE';

    // ARTISTS + AGENTS: Create and manage tours
    if (isArtist) {
      const allVisible = isAgent && selectedArtistId !== 'all' ? myTours.filter((tour) => tour.artist?.id === selectedArtistId) : myTours;
      const visibleTours = only ? allVisible.filter((tour) => tour.id === only) : allVisible;
      return (
        <div className="tour-kickstart-content">
          {!only && <div className="coming-soon-placeholder">
            {renderSubTabHeader({
              intro: t('tour.kickstartIntro'),
              action: (
                <button className="btn btn-primary btn-small shrink-0" onClick={() => { closeTourPanes(); setShowCreateTourModal(true); }}>
                  <span>+ {t('tour.createTour')}</span>
                </button>
              ),
            })}
          </div>}
          <div className="tour-kickstart-section">
            {!only && <div className="section-header">
              <h3>{t('tour.myTours')}</h3>
            </div>}

            {/* Tour cards or empty state */}
            {toursLoading ? (
              <LoadingGlobe label={t('tour.loadingTours')} />
            ) : visibleTours.length === 0 ? (
              <div className="tour-empty-state">
                <PlaneIcon />
                <p>{t('tour.noToursYet')}</p>
                <p className="tour-empty-hint">{t('tour.noToursHint')}</p>
              </div>
            ) : (
              <div className="tour-cards-list">
                {visibleTours.map(tour => {
                  const pct = Math.min(100, Math.round(((tour.totalRevenue || 0) / (tour.minRevenue || 1)) * 100));
                  const statusPill = {
                    ACTIVE: 'text-role-agent border-role-agent/50',
                    COMPLETED: 'text-white/60 border-white/25',
                    CANCELLED: 'text-role-venue border-role-venue/50',
                  }[tour.status] || 'text-white/60 border-white/25';
                  return (
                  <div
                    key={tour.id}
                    className="rounded-2xl border border-white/10 bg-[#0a0a0e] p-4 transition-colors hover:border-white/20"
                  >
                    {/* Header: destination + window, status pill */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <h4 className="text-[17px] font-semibold text-white font-space-grotesk tracking-[-0.01em] m-0 truncate">
                          {t('tour.tourTitle', { location: tour.country || tour.zone })}
                        </h4>
                        {user?.role === 'AGENT' && tour.artist?.name && (
                          <p className="text-[11px] text-infrared/90 font-tech mt-1 m-0 truncate">
                            {tour.artist.name}
                          </p>
                        )}
                        <p className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-tech mt-1.5 m-0">
                          {formatEventDate(tour.startDate, t('dateFormat.locale'), { month: 'short', day: 'numeric' })}
                          {' — '}
                          {formatEventDate(tour.endDate, t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
                          {tour.zone && tour.country ? ` · ${tour.zone}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[9px]
                                          font-semibold uppercase tracking-[0.15em] font-tech ${statusPill}`}>
                          {tourStatusLabel(tour.status)}
                        </span>
                        {/* Closed to offers is a state of a LIVE tour, so it
                            reads alongside the status rather than replacing it. */}
                        {tour.closedToOffers && tour.status === 'ACTIVE' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-white/20
                                           text-white/55 text-[9px] font-semibold uppercase tracking-[0.15em] font-tech">
                            {t('tour.fullyBooked')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Console: gigs + interest + revenue tiles */}
                    <div className="grid grid-cols-3 gap-2.5 mb-3">
                      {/* The two counts ARE the way in to their lists — a
                          separate "View gigs" / "View interested" button pair
                          restated the same numbers and pushed the action row
                          to five CTAs, which wrapped and clipped. */}
                      <button
                        type="button"
                        onClick={() => handleViewTourGigs(tour)}
                        className="text-left rounded-xl border border-white/10 bg-[#070709] px-3 py-2.5
                                   transition-colors hover:border-infrared/40 cursor-pointer"
                      >
                        <p className="text-lg font-bold text-white font-space-grotesk leading-none m-0">
                          {tour.confirmedGigs || 0}
                        </p>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-tech mt-1.5 m-0">
                          {t('tour.gigsConfirmed')}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewInterests(tour)}
                        className="text-left rounded-xl border border-white/10 bg-[#070709] px-3 py-2.5
                                   transition-colors hover:border-infrared/40 cursor-pointer"
                      >
                        <p className="text-lg font-bold text-white font-space-grotesk leading-none m-0">
                          {tour.interestsCount || 0}
                        </p>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-tech mt-1.5 m-0">
                          {t('tour.interestedCount')}
                        </p>
                      </button>
                      <div className="rounded-xl border border-white/10 bg-[#070709] px-3 py-2.5">
                        <p className="text-lg font-bold text-white font-space-grotesk leading-none m-0">
                          {Math.round(tour.totalRevenue || 0).toLocaleString()}
                          <span className="text-xs font-medium text-white/35"> / {Math.round(tour.minRevenue || 0).toLocaleString()} {tour.revenueCurrency || 'EUR'}</span>
                        </p>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-tech mt-1.5 m-0">
                          {t('tour.revenueTarget')}
                        </p>
                      </div>
                    </div>

                    {/* Thin crimson progress line */}
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-infrared" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="shrink-0 text-[10px] text-white/50 font-tech">{pct}%</span>
                    </div>

                    {/* Actions: the two things you DO to a tour, then the
                        quiet destructive one. Labels stay on one line; the row
                        wraps rather than clipping on a narrow phone. */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.07]">
                      <button
                        className="btn btn-outline btn-small whitespace-nowrap"
                        onClick={() => handleEditTour(tour)}
                      >
                        {t('common.edit')}
                      </button>
                      {tour.status === 'ACTIVE' && (
                        <button
                          className={`btn btn-small whitespace-nowrap ${tour.closedToOffers ? 'btn-primary' : 'btn-outline'}`}
                          disabled={tourActionBusy === tour.id}
                          onClick={() => handleToggleTourOffers(tour)}
                        >
                          {tourActionBusy === tour.id
                            ? '...'
                            : (tour.closedToOffers ? t('tour.reopenToOffers') : t('tour.closeToOffers'))}
                        </button>
                      )}
                      <button
                        className="ml-auto bg-transparent border-none cursor-pointer text-[10px] uppercase tracking-[0.1em]
                                   font-tech text-white/35 hover:text-role-venue transition-colors whitespace-nowrap"
                        onClick={() => handleDeleteTour(tour)}
                      >
                        {t('tour.cancelTour')}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    // PROMOTERS/VENUES: Browse and contribute to tours
    if (isPromoterOrVenue) {
      // Filter tours by selected zone and genres
      const filteredTours = allTours.filter(tour => {
        const zoneMatch = tourZoneFilter === 'all' || tour.zone === tourZoneFilter;
        const countryMatch = tourCountryFilter === 'all' || tour.country === tourCountryFilter;
        const genreMatch = tourGenreFilter.length === 0 ||
          (tour.artist && tour.artist.genres && tour.artist.genres.some(g => tourGenreFilter.includes(g)));
        let monthMatch = true;
        if (tourMonthFilter !== 'all') {
          const range = monthKeyToRange(tourMonthFilter);
          if (range) {
            const ts = new Date(tour.startDate); const te = new Date(tour.endDate);
            monthMatch = ts <= range.toDate && te >= range.fromDate;
          }
        }
        return (!only || tour.id === only) && zoneMatch && countryMatch && genreMatch && monthMatch;
      });

      return (
        <div className="tour-kickstart-content">
          <div className="tour-kickstart-section">
            {!only && renderSubTabHeader({
              intro: t('tour.tourOpportunitiesDesc'),
              action: <FilterButton count={tourFilterCount} onClick={() => setShowTourFilters(true)} label={t('search.filters')} />,
            })}

            {!only && renderTourFilterSheet()}

            {/* Tour cards or empty state */}
            {filteredTours.length === 0 ? (
              <div className="tour-empty-state">
                <PlaneIcon />
                <p>{t('tour.noActiveTours')}</p>
                <p className="tour-empty-hint">{t('tour.noActiveToursHint')}</p>
              </div>
            ) : (
              <div className="tour-cards-list">
                {filteredTours.map(tour => (
                  <div key={tour.id} className="tour-card">
                    <div className="tour-card-header">
                      {/* Artist identity links to the profile (replaces the old
                          View Artist CTA in the footer) */}
                      <div
                        className="tour-artist-info"
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleViewTourArtist(tour)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewTourArtist(tour); } }}
                      >
                        <div className="tour-artist-avatar">
                          {tour.artist?.avatar ? (
                            <img src={tour.artist.avatar} alt={tour.artist.name} />
                          ) : (
                            <div className="avatar-placeholder">
                              {tour.artist?.name?.charAt(0) || 'A'}
                            </div>
                          )}
                        </div>
                        <div className="tour-artist-details">
                          <h4 className="tour-artist-name">{tour.artist?.name || t('tour.unknownArtist')}</h4>
                          <p className="tour-artist-role">{tour.artist?.role || t('tour.artistRoleFallback')}</p>
                          {tour.artist?.id && connectedUsers?.has(tour.artist.id) && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ marginTop: 6 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMessage(tour.artist, t('tour.tourDraft', { name: tour.artist.name, where: tour.country || tour.zone, dates: tourDatesLabel(tour) }));
                              }}
                            >
                              {t('search.message')}
                            </button>
                          )}
                          <p className="tour-location-info">
                            <LocationIcon /> {t('tour.tourTitle', { location: tour.country || tour.zone })}
                          </p>
                        </div>
                      </div>
                      <span className={`tour-status-badge status-${tour.status.toLowerCase()}`}>
                        {tourStatusLabel(tour.status)}
                      </span>
                    </div>
                    <div className="tour-dates-section">
                      <CalendarIcon />
                      <span>
                        {formatEventDate(tour.startDate, t('dateFormat.locale'), { month: 'short', day: 'numeric' })} - {formatEventDate(tour.endDate, t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="tour-card-body">
                      {/* Booking traction. Deliberately NOT the revenue
                          progress bar the owner sees: how much the tour still
                          needs to earn is the owner's planning figure, and it
                          would tell a promoter exactly how much leverage they
                          have. Confirmed shows are the honest public signal —
                          drawn as one segment per booked show against the
                          stops the artist is targeting, so the visual counts
                          real things rather than implying a percentage of a
                          number nobody outside can see. */}
                      {(() => {
                        const booked = tour.confirmedGigs || 0;
                        // Five slots to start with, and a fresh one appears as
                        // soon as the last is taken — so an open tour always
                        // reads as "there is still room", never as finished.
                        // A tour CLOSED to offers is the one case that should
                        // read as full: the slots collapse to what was booked
                        // and the bar completes.
                        const segments = tour.closedToOffers
                          ? Math.max(booked, 1)
                          : Math.min(14, Math.max(5, booked + 1));
                        return (
                          <div className="tour-progress">
                            <div className="tour-progress-header">
                              <span className="tour-progress-label">
                                {booked === 1
                                  ? t('tour.gigConfirmedCountOne')
                                  : t('tour.gigsConfirmedCount', { n: booked })}
                              </span>
                            </div>
                            <div className="flex gap-1" aria-hidden="true">
                              {Array.from({ length: segments }, (_, i) => (
                                <span
                                  key={i}
                                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                                    i < booked ? 'bg-infrared' : 'bg-white/10'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="tour-stats-row">
                        {(tour.feeExpectation || tour.priceOnRequest) && (
                          <div className="tour-stat">
                            <span className="tour-stat-label">{t('tour.feeRangeLabel')}</span>
                            <span className="tour-stat-value">{tour.priceOnRequest ? t('tour.priceOnRequest') : tour.feeExpectation}</span>
                          </div>
                        )}
                        {(tour.interestsCount || 0) > 0 && (
                          <div className="tour-stat">
                            <span className="tour-stat-value text-infrared">
                              {t('tour.interestedCountPublic', { n: tour.interestsCount })}
                            </span>
                          </div>
                        )}
                      </div>
                      {tour.artist?.genres && tour.artist.genres.length > 0 && (
                        <div className="tour-genres">
                          <span className="genres-label">{t('tour.genresLabel')}</span>
                          <span>{tour.artist.genres.slice(0, 3).join(', ')}</span>
                        </div>
                      )}
                    </div>
                    <div className="tour-card-footer">
                      {tour.myProposal ? (
                        // User has already sent a proposal
                        <button
                          className={`btn btn-small ${
                            tour.myProposal.status === 'ACCEPTED' ? 'btn-success' :
                            tour.myProposal.status === 'DECLINED' ? 'btn-secondary' :
                            'btn-primary'
                          }`}
                          onClick={() => handleViewMyProposal(tour)}
                          style={{ flex: 1 }}
                        >
                          {tour.myProposal.status === 'ACCEPTED' ? `✓ ${t('tour.proposalAccepted')}` :
                           tour.myProposal.status === 'DECLINED' ? t('tour.proposalDeclined') :
                           t('tour.viewSentProposal')}
                        </button>
                      ) : tour.closedToOffers ? (
                        // Full: the artist side stopped taking offers. The tour
                        // stays listed and interest stays open, so a promoter
                        // can still put their hand up for the next run.
                        <button className="btn btn-secondary btn-small" style={{ flex: 1 }} disabled>
                          {t('tour.fullyBooked')}
                        </button>
                      ) : (
                        // No proposal sent yet
                        <button
                          className="btn btn-primary btn-small"
                          style={{ flex: 1 }}
                          onClick={() => handleMakeOffer(tour)}
                        >
                          {t('tour.makeAnOffer')}
                        </button>
                      )}
                      {/* Lightweight appetite signal — free, precedes an offer */}
                      <button
                        className={`btn btn-small ${tour.myInterest ? 'btn-liked' : 'btn-outline'}`}
                        style={{ flex: 1 }}
                        onClick={() => handleToggleInterest(tour)}
                      >
                        <HeartIcon filled={!!tour.myInterest} />{' '}
                        {tour.myInterest ? t('tour.interested') : t('tour.imInterested')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // AGENTS: Not applicable
    return (
      <div className="tour-kickstart-content">
        <div className="coming-soon-placeholder">
          <div className="coming-soon-icon">
            <PlaneIcon />
          </div>
          <h2>{t('tour.tourKickstart')}</h2>
          <p>{t('tour.agentsNotAvailable')}</p>
        </div>
      </div>
    );
  };

  // Viewing an artist: the tour page stays docked left on desktop and the
  // profile opens as a right-hand pane (mobile hides the master via CSS —
  // full-screen as before). Lives after every declaration (renderMain reads
  // consts — TDZ) and hooks (no hook may follow an early return).
  if (viewingProfile) {
    const profileToView =
      typeof viewingProfile === 'object' && viewingProfile.id
        ? viewingProfile
        : calendarMatches.find((m) => m.profile.id === viewingProfile)?.profile;
    if (profileToView) {
      return (
        <div className="md-split md-split-wide">
          <div className="md-master">{renderMain()}</div>
          <div className="md-detail">
            <ViewProfileScreen
              profile={profileToView}
              onClose={() => setViewingProfile(null)}
              onOpenChat={onOpenChat}
              onNavigateToMessages={onNavigateToMessages}
            />
          </div>
        </div>
      );
    }
  }

  return renderMain();

  function renderMain() {
  return (
    <div ref={screenRef} className={`screen active matches-screen tour-screen${nativeDesktop ? ' d3-tour' : (activeTab === 'calendar' ? ' tour-screen--calendar' : '')}`}>
      {nativeDesktop ? (() => {
        const premium = isPremiumUser();
        const owner = user?.role === 'ARTIST' || user?.role === 'AGENT';
        const boardTours = owner
          ? (isAgent && selectedArtistId !== 'all' ? myTours.filter((tour) => tour.artist?.id === selectedArtistId) : myTours)
          : allTours.filter((tour) => {
              const zoneMatch = tourZoneFilter === 'all' || tour.zone === tourZoneFilter;
              const countryMatch = tourCountryFilter === 'all' || tour.country === tourCountryFilter;
              const genreMatch = tourGenreFilter.length === 0 || (tour.artist?.genres || []).some((g) => tourGenreFilter.includes(g));
              let monthMatch = true;
              if (tourMonthFilter !== 'all') {
                const range = monthKeyToRange(tourMonthFilter);
                if (range) { const ts = new Date(tour.startDate); const te = new Date(tour.endDate); monthMatch = ts <= range.toDate && te >= range.fromDate; }
              }
              return zoneMatch && countryMatch && genreMatch && monthMatch;
            });
        const modeTabs = (
          <div className="d3-tour-modes">
            <button type="button" className={d3Mode === 'calendar' ? 'is-on' : ''} onClick={() => { closeTourPanes(); setD3Mode('calendar'); }}>
              <CalendarIcon /><span>{t('profile.calendar')}</span>
            </button>
            <button type="button" className={d3Mode === 'matches' ? 'is-on' : ''} onClick={() => { closeTourPanes(); setD3Mode('matches'); }}>
              <TargetIcon /><span>{t('tour.calendarMatches')}</span>
            </button>
            <button type="button" className={d3Mode === 'tours' ? 'is-on' : ''} onClick={() => { closeTourPanes(); setD3Mode('tours'); }}>
              <PlaneIcon /><span>{t('tour.tourKickstart')}</span>
            </button>
          </div>
        );
        return (
          <>
            {modeTabs}
            {d3Mode === 'calendar' ? (
              <section className="d3-tour-main d3-tour-calendar">{renderMyDates()}</section>
            ) : d3Mode === 'matches' ? (
              <section className="d3-tour-main d3-tour-matches">{renderCalendarMatches()}</section>
            ) : !premium ? (
              renderTourKickstart()
            ) : (
              <>
              <TourBoard
                tours={boardTours}
                loading={toursLoading}
                owner={owner}
                selectedId={d3TourId}
                onSelect={setD3TourId}
                statusLabel={tourStatusLabel}
                toolbar={(
                  <>
                    <span className="min-w-0 flex-1 text-[12px] text-white/45">{owner ? t('tour.kickstartIntro') : t('tour.tourOpportunitiesDesc')}</span>
                    {isAgent && roster.length > 0 && (
                      <select className="h-8 cursor-pointer rounded-lg border border-white/10 bg-[#0b0b0e] px-2.5 text-[12px] text-white/80 outline-none" value={selectedArtistId} onChange={(e) => setArtistFilter(e.target.value)}>
                        <option value="all">{t('tour.allArtists')}</option>
                        {roster.map((a) => <option key={rosterEntryId(a)} value={rosterEntryId(a)}>{a.name}</option>)}
                      </select>
                    )}
                    {owner
                      ? <button className="btn btn-primary btn-small shrink-0" onClick={() => { closeTourPanes(); setShowCreateTourModal(true); }}>+ {t('tour.createTour')}</button>
                      : <FilterButton count={tourFilterCount} onClick={() => setShowTourFilters(true)} label={t('search.filters')} />}
                  </>
                )}
                detail={d3TourId ? renderTourKickstart({ only: d3TourId }) : null}
              />
              {!owner && renderTourFilterSheet()}
              </>
            )}
          </>
        );
      })() : (
      <div className="relative isolate">
      {/* faint engineering grid fading from the top (quiet-premium backdrop) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 top-11 h-44 -z-10 bg-grid
                   [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
      />
      {/* Sub-tabs */}
      <div className="tour-tabs">
        <button
          className={`tour-tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => { closeTourPanes(); setActiveTab('calendar'); }}
        >
          <CalendarIcon />
          <span>{t('tour.myDates')}</span>
        </button>
        <button
          className={`tour-tab ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => { closeTourPanes(); setActiveTab('matches'); }}
        >
          <TargetIcon />
          <span>{t('tour.calendarMatches')}</span>
        </button>
        <button
          className={`tour-tab ${activeTab === 'kickstart' ? 'active' : ''}`}
          onClick={() => { closeTourPanes(); setActiveTab('kickstart'); }}
        >
          <PlaneIcon />
          <span>{t('tour.tourKickstart')}</span>
        </button>
      </div>

      {/* Tab Content — the measured --tour-screen-h height means the FREE gate
          fits without scrolling on normal phones; scrolling stays enabled so
          short viewports can still reach the Upgrade CTA */}
      <div className="tour-tab-content">
        {activeTab === 'calendar' && renderMyDates()}
        {activeTab === 'matches' && renderCalendarMatches()}
        {activeTab === 'kickstart' && renderTourKickstart()}
      </div>
      </div>
      )}

      {/* Message Modal */}
      {showMessageModal && selectedProfile && (
        <OverlayPortal><div className="message-modal-overlay" onClick={() => {
          setShowMessageModal(false);
          setSelectedProfile(null);
          setMessage('');
        }}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">{t('tour.connectWith', { name: selectedProfile.name })}</h2>
            <textarea
              placeholder={t('tour.connectPlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="4"
              className="message-textarea-bottom"
            />
            <div className="message-modal-actions">
              <button
                className="btn btn-outline btn-modal-cancel"
                onClick={() => {
                  setShowMessageModal(false);
                  setSelectedProfile(null);
                  setMessage('');
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-primary btn-modal-send"
                onClick={handleSendMessage}
              >
                {t('tour.sendRequest')}
              </button>
            </div>
          </div>
        </div></OverlayPortal>
      )}

      {/* Create Tour Modal */}
      {renderCreateTourModal()}

      {/* Edit Tour Modal */}
      {renderEditTourModal()}

      {/* Make Offer Modal (for tours) */}
      <MakeOfferModal
        isOpen={showMakeOfferModal}
        dockAsDrawer
        onClose={() => {
          setShowMakeOfferModal(false);
          setSelectedTourArtist(null);
          setOfferCountry(null);
        }}
        recipientProfile={selectedTourArtist}
        preferCountry={offerCountry || selectedTour?.country || null}
        onSuccess={() => {
          setShowMakeOfferModal(false);
          setSelectedTourArtist(null);
          setOfferCountry(null);
          // Navigate to Messages tab to see the offer
          onNavigateToMessages();
        }}
      />

      {/* View My Sent Proposal Modal */}
      {showMyProposalModal && myProposalData && ReactDOM.createPortal(
        <div className="create-tour-modal-overlay md-drawer" onClick={() => setShowMyProposalModal(false)}>
          <div className="modal-content create-tour-modal view-proposals-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('tour.yourProposal')}</h2>
              <button className="modal-close" onClick={() => setShowMyProposalModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Tour Info */}
              <div className="proposal-tour-info" style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px', color: '#fff' }}>
                  {t('tour.tourTitle', { location: myProposalData.tour?.zone })}
                </h3>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                  {formatEventDate(myProposalData.tour?.startDate, t('dateFormat.locale'), { month: 'short', day: 'numeric' })} - {formatEventDate(myProposalData.tour?.endDate, t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* Proposal Card */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: myProposalData.status === 'ACCEPTED' ? '3px solid #43E97B' :
                           myProposalData.status === 'DECLINED' ? '3px solid #f44336' :
                           '3px solid #FFC107'
              }}>
                {/* Header with Artist Info and Status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: '0 0 4px 0' }}>
                      {myProposalData.tour?.artist?.name}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', margin: 0 }}>
                      {t('editProfile.artist')}
                    </p>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    background: myProposalData.status === 'ACCEPTED' ? 'rgba(67,233,123,0.2)' :
                               myProposalData.status === 'DECLINED' ? 'rgba(244, 67, 54, 0.2)' :
                               'rgba(255, 193, 7, 0.2)',
                    color: myProposalData.status === 'ACCEPTED' ? '#43E97B' :
                           myProposalData.status === 'DECLINED' ? '#f44336' :
                           '#FFC107',
                    alignSelf: 'flex-start'
                  }}>
                    {myProposalData.status}
                  </span>
                </div>

                {/* Your Message */}
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5', margin: '0 0 12px 0', whiteSpace: 'pre-wrap' }}>
                    {myProposalData.message}
                  </p>

                  {/* Proposed Details */}
                  {(myProposalData.proposedDates || myProposalData.proposedFee) && (
                    <div>
                      {myProposalData.proposedDates && (
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 6px 0' }}>
                          <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{t('tour.proposedDates')}</strong> {myProposalData.proposedDates}
                        </p>
                      )}
                      {myProposalData.proposedFee && (
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                          <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{t('tour.proposedFee')}</strong> {myProposalData.proposedFee.currency} {myProposalData.proposedFee.amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Artist Response */}
                {myProposalData.artistResponse && (
                  <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '0 0 4px 0' }}>
                      {t('tour.artistResponse')}
                    </p>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: '1.5' }}>
                      {myProposalData.artistResponse}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMyProposalModal(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Tour Gigs Modal */}
      {showTourGigsModal && selectedTour && ReactDOM.createPortal(
        <div className="modal-overlay md-drawer" onClick={() => setShowTourGigsModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('tour.tourGigsTitle', { location: selectedTour.country || selectedTour.zone })}</h3>
              <button className="modal-close" onClick={() => setShowTourGigsModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {loadingTourGigs ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)' }}>
                  {t('tour.loadingGigs')}
                </div>
              ) : tourGigs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)' }}>
                  <p>{t('tour.noGigsYet')}</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>{t('tour.noGigsHint')}</p>
                </div>
              ) : (
                <div className="tour-gigs-list">
                  {tourGigs.map(deal => (
                    <div key={deal.id} className="tour-gig-card" style={{
                      background: '#1a1a1a',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '12px',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff' }}>
                            {deal.eventName || deal.venueName}
                          </h4>
                          <p style={{ margin: '0', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                            {deal.venue?.name || deal.venueName}
                          </p>
                        </div>
                        <span className="tour-status-badge status-accepted" style={{
                          background: 'rgba(67,233,123,0.2)',
                          color: '#43E97B',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {deal.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div>
                          <p style={{ margin: '0 0 4px 0', color: 'rgba(255,255,255,0.5)' }}>{t('tour.date')}</p>
                          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
                            {formatEventDate(deal.date, t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px 0', color: 'rgba(255,255,255,0.5)' }}>{t('tour.fee')}</p>
                          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>
                            {deal.currency} {(deal.currentFee || 0).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px 0', color: 'rgba(255,255,255,0.5)' }}>{t('editProfile.city')}</p>
                          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
                            {deal.city}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px 0', color: 'rgba(255,255,255,0.5)' }}>{t('editProfile.country')}</p>
                          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
                            {deal.country}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowTourGigsModal(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Tour Interests Modal — the owner's market-appetite map */}
      {showInterestsModal && selectedTour && ReactDOM.createPortal(
        <div className="modal-overlay md-drawer" onClick={() => setShowInterestsModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('tour.interestedList')}</h3>
              <button className="modal-close" onClick={() => setShowInterestsModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {loadingInterests ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)' }}>
                  <LoadingGlobe label="" size={44} />
                </div>
              ) : tourInterests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)' }}>
                  <p>{t('tour.noInterestsYet')}</p>
                </div>
              ) : (
                <div>
                  {tourInterests.map((interest) => (
                    <div
                      key={interest.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        background: '#101015', borderRadius: '12px', padding: '12px 14px',
                        marginBottom: '10px', border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                        {interest.profile?.avatar
                          ? <img src={interest.profile.avatar} alt={interest.profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (interest.profile?.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {interest.profile?.name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                          {[interest.profile?.role, interest.profile?.city].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {interest.invitedAt ? (
                        <span style={{
                          fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em',
                          color: '#43E97B', border: '1px solid rgba(67,233,123,0.4)',
                          borderRadius: '999px', padding: '4px 10px', flexShrink: 0,
                        }}>
                          {t('tour.invited')}
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary btn-small"
                          style={{ flexShrink: 0 }}
                          disabled={invitingInterestId === interest.id}
                          onClick={() => handleInviteInterest(interest)}
                        >
                          {invitingInterestId === interest.id ? '...' : t('tour.inviteToOffer')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowInterestsModal(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
  }
};

// Keep-mounted tabs re-render on every App state change; memo keeps
// hidden tabs cheap when their props are unchanged.
export default React.memo(TourScreen);
