import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { appAlert } from '../../utils/dialogs';
import { zones, countriesByZone, citiesByCountry, genresList } from '../../data/profiles';
import { HeartIcon, FilterIcon, SlashCircleIcon, SearchIcon, GlobeIcon, ListIcon } from '../../utils/icons';
import ViewProfileScreen from './ViewProfileScreen';
import Modal from '../common/Modal';
import ConnectionChoiceModal from '../common/ConnectionChoiceModal';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import LoadingGlobe from '../common/LoadingGlobe';
// The globe pulls in d3-geo + a world topojson (~150KB) — only load it when the
// user actually switches to the globe view (matches the PdfViewer lazy pattern).
const SearchGlobe = lazy(() => import('../common/SearchGlobe'));

const SearchScreen = ({ onOpenChat, onNavigateToMessages, onOpenPremium, accountUser }) => {
  const { user, likedProfiles, toggleLike, sentRequests, sendConnectionRequest, connectedUsers, receivedRequests, acceptConnectionRequest, declineConnectionRequest } = useAppContext();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('globe'); // 'globe' | 'list' — the globe IS the search landing
  const [globeUpsellCity, setGlobeUpsellCity] = useState(null); // FREE member tapped a locked city
  const stageRef = useRef(null);
  const [stageH, setStageH] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    roles: [],
    zones: [],
    countries: [],
    cities: [],
    genres: []
  });
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showConnectionChoice, setShowConnectionChoice] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [profilesLoaded, setProfilesLoaded] = useState(false); // Track if profiles loaded
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [showLikeLimitModal, setShowLikeLimitModal] = useState(false);
  const [likeLimitData, setLikeLimitData] = useState(null);
  const [showConnectionLimitModal, setShowConnectionLimitModal] = useState(false);
  const [connectionLimitData, setConnectionLimitData] = useState(null);

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState(null);

  // Helper function to check if user has global search access (per-profile)
  const hasGlobalSearch = () => {
    const tier = user?.subscriptionTier || 'FREE';
    return ['TRIAL', 'MONTHLY', 'YEARLY'].includes(tier);
  };

  // Debug: Log when showConnectionChoice changes
  useEffect(() => {
    console.log('showConnectionChoice state changed:', showConnectionChoice);
    console.log('selectedProfile:', selectedProfile?.name);
  }, [showConnectionChoice, selectedProfile]);

  // Fetch profiles from backend
  const fetchProfiles = async () => {
    if (loading || profilesLoaded) return; // Prevent duplicate fetches

    const startTime = performance.now();
    console.log('🔍 [SearchScreen] Starting to fetch profiles');

    setLoading(true);
    try {
      const apiStartTime = performance.now();
      // Use the authenticated search endpoint with location restrictions (pass active profile for tier check)
      const response = await apiService.searchProfiles({ activeProfileId: user?.id });
      const apiEndTime = performance.now();

      // Handle both response formats (old: array, new: object with profiles array)
      const profiles = response.profiles || response;
      console.log(`✅ [SearchScreen] API call completed in ${(apiEndTime - apiStartTime).toFixed(0)}ms, got ${profiles?.length || 0} profiles`);
      console.log(`📍 [SearchScreen] User location restriction: ${response.userCity || 'N/A'}, tier: ${user?.subscriptionTier || 'FREE'}`);

      // Filter out current user's profile
      const filteredProfiles = (profiles || []).filter(profile => {
        return profile.id !== user?.id;
      });
      setSearchResults(filteredProfiles);
      setProfilesLoaded(true);

      const endTime = performance.now();
      console.log(`✅ [SearchScreen] Total fetch time: ${(endTime - startTime).toFixed(0)}ms`);
    } catch (error) {
      console.error('❌ [SearchScreen] Error fetching profiles:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset and reload profiles when user changes (e.g., login/logout)
    setProfilesLoaded(false);
    setSearchResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // Load profiles on component mount only if not already loaded
    if (!profilesLoaded) {
      fetchProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesLoaded]);

  // Full-bleed globe stage: fill exactly between the app header and the tab
  // bar. Measured off the (always-visible) header/tab-bar so it's correct even
  // while this tab is pre-warmed inside a hidden keep-mounted panel.
  useEffect(() => {
    if (viewMode !== 'globe' || viewingProfile) return undefined;
    const measure = () => {
      const header = document.querySelector('.app-header');
      const tabBar = document.querySelector('.tab-bar');
      const top = header ? header.getBoundingClientRect().bottom : 56;
      const bottom = tabBar ? tabBar.getBoundingClientRect().top : window.innerHeight - 70;
      setStageH(Math.max(420, Math.round(bottom - top)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [viewMode, viewingProfile]);

  const handleSearch = async () => {
    // Check if FREE tier user is trying to use location filters
    if (!hasGlobalSearch()) {
      const hasLocationFilters = filters.zones.length > 0 || filters.countries.length > 0 || filters.cities.length > 0;

      if (hasLocationFilters) {
        const tierName = user?.subscriptionTier === 'TRIAL' ? t('search.trialTierName') : t('search.freeTierName');
        // Show alert and clear location filters
        appAlert(t('search.locationFiltersAlert', { tierName, city: user.city }));

        // Clear location filters but keep other filters
        setFilters({
          ...filters,
          zones: [],
          countries: [],
          cities: []
        });

        return; // Don't proceed with search
      }
    }

    setHasSearched(true);
    setLoading(true);
    try {
      const params = {};

      // Add active profile ID for per-profile subscription check
      if (user?.id) params.activeProfileId = user.id;
      // Add filters to params - send all selected values as arrays for OR logic
      if (searchQuery) params.search = searchQuery;
      if (filters.roles.length > 0) params.roles = filters.roles.join(',');
      if (filters.zones.length > 0) params.zones = filters.zones.join(',');
      if (filters.countries.length > 0) params.countries = filters.countries.join(',');
      if (filters.cities.length > 0) params.cities = filters.cities.join(',');
      if (filters.genres.length > 0) params.genres = filters.genres.join(',');

      const response = await apiService.searchProfiles(params);
      // Handle both response formats (old: array, new: object with profiles array)
      const profiles = response.profiles || response;
      // Filter out current user's profile
      const filteredProfiles = (profiles || []).filter(profile => {
        return profile.id !== user?.id;
      });
      setSearchResults(filteredProfiles);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFilterItem = (filterType, value) => {
    const newFilters = { ...filters };
    const currentArray = newFilters[filterType];
    
    if (currentArray.includes(value)) {
      newFilters[filterType] = currentArray.filter(item => item !== value);
    } else {
      newFilters[filterType] = [...currentArray, value];
    }
    
    setFilters(newFilters);
  };


  const clearFilters = () => {
    setFilters({
      roles: [],
      zones: [],
      countries: [],
      cities: [],
      genres: []
    });
  };

  const getAvailableCountries = () => {
    if (filters.zones.length > 0) {
      return filters.zones.flatMap(zone => countriesByZone[zone] || []).sort();
    }
    return Object.values(countriesByZone).flat().sort();
  };

  const getAvailableCities = () => {
    let cities;
    if (filters.countries.length > 0) {
      cities = filters.countries.flatMap(country => citiesByCountry[country] || []);
    } else {
      cities = Object.values(citiesByCountry).flat();
    }

    // Remove duplicate "Other" entries - keep only one
    const uniqueCities = [...new Set(cities)];

    // Sort alphabetically, but put "Other" at the end
    return uniqueCities.sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
  };

  const activeFilterCount = Object.values(filters).reduce((count, arr) => count + arr.length, 0);

  const handleLike = async (profileId) => {
    console.log('Like button clicked for profile:', profileId);
    console.log('Current user:', user);

    // Check if user is already liked (unlike action is always allowed)
    const isAlreadyLiked = likedProfiles.has(profileId);

    try {
      console.log('Calling toggleLike...');
      await toggleLike(profileId);
      console.log('Toggle like successful!');
    } catch (error) {
      console.error('Error liking profile:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      // Check if error is due to like limit
      if (error.response?.status === 403 && error.response?.data?.error === 'Daily like limit reached') {
        const { limit, tier } = error.response.data;

        console.log('Like limit reached! Opening modal with:', { limit, tier });
        // Show like limit modal
        setLikeLimitData({ limit, tier });
        setShowLikeLimitModal(true);
      } else {
        console.log('Not a like limit error, showing generic alert');
        appAlert(t('search.failedToLike'));
      }
    }
  };

  const handleConnect = (profile) => {
    console.log('SearchScreen handleConnect called with profile:', profile);
    console.log('profile.representedBy:', profile.representedBy);

    const profileId = profile.id;
    if (!sentRequests.has(profileId)) {
      setSelectedProfile(profile);

      // Check if profile has valid representedBy data (now an array)
      const representedByArray = Array.isArray(profile.representedBy)
        ? profile.representedBy
        : (profile.representedBy ? [profile.representedBy] : []);

      const hasValidAgent = representedByArray.some(a =>
        (a.name || a.agentName) && (a.agentId || a.profileId || a.id)
      );

      console.log('hasValidAgent:', hasValidAgent);
      console.log('  profile.representedBy:', profile.representedBy);

      // If artist has a valid agent, show connection choice modal
      // Otherwise show the regular message modal
      if (hasValidAgent) {
        console.log('Opening ConnectionChoiceModal');
        setShowConnectionChoice(true);
      } else {
        console.log('Opening message modal');
        setShowMessageModal(true);
      }
    }
  };

  const handleConnectionChoice = async (targetProfileId, type, artistContext = null, userMessage = '') => {
    try {
      // Use the user's message if provided
      await sendConnectionRequest(targetProfileId, userMessage);

      // Show success feedback
      let targetName = selectedProfile.name;
      if (type === 'AGENT' && artistContext) {
        const repArray = Array.isArray(artistContext.representedBy)
          ? artistContext.representedBy
          : (artistContext.representedBy ? [artistContext.representedBy] : []);
        targetName = repArray[0]?.name || repArray[0]?.agentName || t('search.agent');
      }
      appAlert(t('search.connectionRequestSent', { name: targetName }));
    } catch (error) {
      console.error('Error sending connection request:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      // Check if this is a connection limit error (403)
      if (error.response?.status === 403 && error.response?.data?.error === 'CONNECTION_LIMIT_EXCEEDED') {
        const { limit, tier } = error.response.data;

        console.log('Connection limit reached! Opening modal with:', { limit, tier });

        // Show connection limit modal
        setConnectionLimitData({ limit, tier });
        setShowConnectionLimitModal(true);
        return;
      }

      // Only show alert for non-limit errors
      console.error('Connection request failed:', error);
      appAlert(t('search.failedToSendRequest'));
    }
  };

  const handleMessage = (profile) => {
    // Open chat and navigate to messages tab
    if (onOpenChat) {
      onOpenChat(profile);
    }
    if (onNavigateToMessages) {
      onNavigateToMessages();
    }
  };

  const handleReview = async (profile) => {
    try {
      const profileId = profile.id;
      // Fetch the full profile data to get the request details
      const data = await apiService.getProfileData(user.id);

      // Find the request from this profile
      const request = (data.requests || []).find(req => {
        const fromId = req.from.id || req.from;
        return String(fromId) === String(profileId) && req.type === 'CONNECTION_REQUEST' && req.status === 'PENDING';
      });

      if (request) {
        setReviewingRequest(request);
        setSelectedProfile(profile);
        setShowReviewModal(true);
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
    }
  };

  const handleAcceptRequest = async () => {
    if (reviewingRequest && selectedProfile) {
      try {
        const requestId = reviewingRequest.id;
        await acceptConnectionRequest(requestId);
        setShowReviewModal(false);
        setReviewingRequest(null);
        setSelectedProfile(null);

        // Refetch profiles to update UI
        await fetchProfiles();
      } catch (error) {
        console.error('Error accepting request:', error);
        appAlert(t('search.failedToAcceptRequest'));
      }
    }
  };

  const handleDeclineRequest = async () => {
    if (reviewingRequest && selectedProfile) {
      try {
        const requestId = reviewingRequest.id;
        await declineConnectionRequest(requestId);
        setShowReviewModal(false);
        setReviewingRequest(null);
        setSelectedProfile(null);

        // Refetch profiles to update UI
        await fetchProfiles();
      } catch (error) {
        console.error('Error declining request:', error);
        appAlert(t('search.failedToDeclineRequest'));
      }
    }
  };

  const handleSendMessage = async () => {
    if (selectedProfile) {
      if (!message.trim()) {
        appAlert(t('search.pleaseWriteMessage'));
        return;
      }
      const profileId = selectedProfile.id;
      try {
        await sendConnectionRequest(profileId, message.trim());
        setShowMessageModal(false);
        setMessage('');
        setSelectedProfile(null);

        // Refetch profiles to update UI with new request status
        await fetchProfiles();
      } catch (error) {
        console.error('Error sending connection request:', error);
        console.error('Error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });

        // Check if this is a connection limit error (403)
        if (error.response?.status === 403 && error.response?.data?.error === 'CONNECTION_LIMIT_EXCEEDED') {
          const { limit, tier } = error.response.data;

          console.log('Connection limit reached! Opening modal with:', { limit, tier });

          // Close message modal first
          setShowMessageModal(false);
          setMessage('');
          setSelectedProfile(null);

          // Show connection limit modal
          setConnectionLimitData({ limit, tier });
          setShowConnectionLimitModal(true);
          return;
        }

        // Only show alert for non-limit errors
        appAlert(t('search.failedToSendRequest'));
      }
    }
  };

  const handleProfileClick = (profile) => {
    setViewingProfile(profile);
  };

  // Icon-only Globe/List switch — lives on the same line as search + filter
  // in BOTH views so the chrome never moves when you flip.
  const viewToggle = (
    <div className="flex shrink-0 rounded-full border border-white/10 bg-black/35 p-0.5 backdrop-blur-md">
      {[
        { key: 'globe', Icon: GlobeIcon, label: t('search.viewGlobe') },
        { key: 'list', Icon: ListIcon, label: t('search.viewList') },
      ].map(({ key, Icon, label }) => (
        <button
          key={key}
          onClick={() => setViewMode(key)}
          aria-label={label}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition [&_svg]:h-4 [&_svg]:w-4 ${
            viewMode === key ? 'bg-[#FF3366]/70 text-white' : 'text-white/45'
          }`}
        >
          <Icon />
        </button>
      ))}
    </div>
  );

  // Show viewing profile if selected
  if (viewingProfile) {
    return (
      <ViewProfileScreen
        profile={viewingProfile}
        onClose={() => setViewingProfile(null)}
        onOpenChat={onOpenChat}
        onNavigateToMessages={onNavigateToMessages}
        onOpenPremium={onOpenPremium}
      />
    );
  }

  return (
    <div className="screen active search-screen" style={viewMode === 'globe' ? { padding: 0, minHeight: 0 } : undefined}>
      {/* ===== GLOBE — the search landing: a full-bleed map with floating chrome ===== */}
      {viewMode === 'globe' && (
        <div ref={stageRef} className="relative overflow-hidden" style={{ height: stageH || 'calc(100dvh - 130px)' }}>
          <Suspense fallback={<div className="flex h-full items-center justify-center"><LoadingGlobe label={t('search.loadingProfiles')} /></div>}>
            <SearchGlobe
              profiles={searchResults}
              onSelectProfile={handleProfileClick}
              locked={!hasGlobalSearch()}
              userCity={user?.city}
              onLockedCity={setGlobeUpsellCity}
              topInset={user && !hasGlobalSearch() ? 118 : 66}
              bottomInset={8}
            />
          </Suspense>

          {/* floating translucent search bar + icon-only filter button */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-3">
            <div className="pointer-events-auto flex items-center gap-2">
              <input
                type="text"
                placeholder={t('search.searchByName')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/35 px-4 text-sm text-white placeholder-white/40 outline-none backdrop-blur-md focus:border-white/25"
              />
              <button
                onClick={() => setShowFilters(true)}
                aria-label={t('search.filters')}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md"
              >
                <span className="[&>svg]:h-4 [&>svg]:w-4"><FilterIcon /></span>
                {activeFilterCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3366] px-1 text-[9px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {viewToggle}
            </div>

            {/* FREE tier only: a compact Premium ad (premium members see no banner) */}
            {user && !hasGlobalSearch() && (
              <button
                onClick={onOpenPremium}
                className="pointer-events-auto mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[#FF3366]/35 bg-[#FF3366]/10 px-4 py-2 text-xs text-white/85 backdrop-blur-md"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-[#FF3366]">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="truncate">{t('profile.searchLimitedTo')} {user.city}</span>
                <span className="shrink-0 font-semibold text-[#FF3366]">{t('search.upgradeNow')}</span>
              </button>
            )}
          </div>

        </div>
      )}

      {/* ===== LIST view ===== */}
      {viewMode === 'list' && (
      <div className="relative isolate">
      {/* faint engineering grid fading from the top (quiet-premium backdrop) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-6 h-48 -z-10 bg-grid
                   [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
      />
      <div className="search-header mb-4">
        {/* Search bar + icon-only filter button — identical to the globe view */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t('search.searchByName')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/35 px-4 text-sm text-white placeholder-white/40 outline-none backdrop-blur-md focus:border-white/25"
          />
          <button
            onClick={() => setShowFilters(true)}
            aria-label={t('search.filters')}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md"
          >
            <span className="[&>svg]:h-4 [&>svg]:w-4"><FilterIcon /></span>
            {activeFilterCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF3366] px-1 text-[9px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {viewToggle}
        </div>

        {/* FREE tier only: compact upgrade pill right under (premium sees no banner) */}
        {user && !hasGlobalSearch() && (
          <button
            onClick={onOpenPremium}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[#FF3366]/35 bg-[#FF3366]/10 px-4 py-2 text-xs text-white/85"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-[#FF3366]">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="truncate">{t('profile.searchLimitedTo')} {user.city}</span>
            <span className="shrink-0 font-semibold text-[#FF3366]">{t('search.upgradeNow')}</span>
          </button>
        )}

      </div>

      {/* Search Results */}
      <div className="search-results">
        {loading ? (
          <LoadingGlobe label={t('search.loadingProfiles')} />
        ) : searchResults.length > 0 ? (
          searchResults.map(profile => {
            const profileId = profile.id;
            const isLiked = likedProfiles.has(profileId);
            const isRequested = sentRequests.has(profileId);
            const isConnected = connectedUsers.has(profileId);
            const hasReceivedRequest = receivedRequests.has(profileId);

            return (
              <div key={profileId} className="search-result-card">
                <div className="result-content">
                  <div
                    className={`result-avatar avatar-${profile.role.toLowerCase()} clickable`}
                    onClick={() => handleProfileClick(profile)}
                  >
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} />
                    ) : (
                      profile.name.charAt(0).toUpperCase()
                    )}
                    {profile.isVerified && <span className="verified-badge">✓</span>}
                  </div>
                  <div
                    className="result-info clickable"
                    onClick={() => handleProfileClick(profile)}
                  >
                    <div className="result-header">
                      <h3>{profile.name}</h3>
                      <span className={`role-badge badge-${profile.role.toLowerCase()}`}>
                        {t(`editProfile.${profile.role.toLowerCase()}`)}
                      </span>
                    </div>
                    <p className="result-location">{profile.location}</p>
                  </div>
                </div>
                <div className="result-actions">
                  <button
                    className={`btn ${isLiked ? 'btn-liked' : 'btn-outline'} btn-like`}
                    onClick={() => handleLike(profileId)}
                  >
                    <HeartIcon filled={isLiked} /> {isLiked ? t('search.liked') : t('search.like')}
                  </button>
                  {isConnected ? (
                    <button
                      className="btn btn-message btn-connect"
                      onClick={() => handleMessage(profile)}
                    >
                      {t('search.message')}
                    </button>
                  ) : hasReceivedRequest || isRequested ? (
                    <button
                      className="btn btn-disabled btn-connect"
                      disabled={true}
                    >
                      {t('search.pending')}
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-connect"
                      onClick={() => handleConnect(profile)}
                    >
                      {t('search.connect')}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center py-20 text-center">
            <span aria-hidden className="text-white/15 [&>svg]:w-9 [&>svg]:h-9 mb-4"><SearchIcon /></span>
            <p className="text-sm text-white/50">{hasSearched ? t('search.noResults') : t('search.startSearching')}</p>
            <p className="text-xs text-white/30 mt-1.5">
              {hasSearched ? t('search.tryDifferentKeywords') : t('search.searchByNameOrFilters')}
            </p>
          </div>
        )}
      </div>
      </div>
      )}

      {/* Filter Full-Page Screen */}
      {showFilters && (
        <div className="screen active filter-screen">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-grid
                       [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
          />
          <div className="screen-header">
            <button className="back-btn" onClick={() => setShowFilters(false)}>
              ←
            </button>
            <h2>{t('search.filters')}</h2>
            <div style={{ width: '32px' }}></div>
          </div>
          <div className="filter-screen-content">
          {/* Roles Dropdown */}
          <div className="filter-dropdown-group">
            <div 
              className="filter-dropdown-header"
              onClick={() => setOpenDropdown(openDropdown === 'roles' ? null : 'roles')}
            >
              <span>{t('search.roles')}</span>
              <span className="dropdown-value">
                {filters.roles.length > 0
                  ? t('search.nSelected', { n: filters.roles.length })
                  : t('search.selectRoles')
                }
              </span>
              <span className="dropdown-arrow">{openDropdown === 'roles' ? '▲' : '▼'}</span>
            </div>
            {openDropdown === 'roles' && (
              <div className="filter-dropdown-content">
                {['ARTIST', 'AGENT', 'PROMOTER', 'VENUE'].map(role => (
                  <label key={role} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filters.roles.includes(role)}
                      onChange={() => toggleFilterItem('roles', role)}
                    />
                    <span>{t(`editProfile.${role.toLowerCase()}`)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Zones Dropdown */}
          <div className="filter-dropdown-group">
            <div 
              className="filter-dropdown-header"
              onClick={() => setOpenDropdown(openDropdown === 'zones' ? null : 'zones')}
            >
              <span>{t('search.zones')}</span>
              <span className="dropdown-value">
                {filters.zones.length > 0
                  ? t('search.nSelected', { n: filters.zones.length })
                  : t('search.selectZones')
                }
              </span>
              <span className="dropdown-arrow">{openDropdown === 'zones' ? '▲' : '▼'}</span>
            </div>
            {openDropdown === 'zones' && (
              <div className="filter-dropdown-content">
                {zones.map(zone => (
                  <label key={zone} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filters.zones.includes(zone)}
                      onChange={() => toggleFilterItem('zones', zone)}
                    />
                    <span>{zone}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Countries Dropdown */}
          <div className="filter-dropdown-group">
            <div 
              className="filter-dropdown-header"
              onClick={() => setOpenDropdown(openDropdown === 'countries' ? null : 'countries')}
            >
              <span>{t('search.countries')}</span>
              <span className="dropdown-value">
                {filters.countries.length > 0
                  ? t('search.nSelected', { n: filters.countries.length })
                  : t('search.selectCountries')
                }
              </span>
              <span className="dropdown-arrow">{openDropdown === 'countries' ? '▲' : '▼'}</span>
            </div>
            {openDropdown === 'countries' && (
              <div className="filter-dropdown-content scrollable">
                {getAvailableCountries().map(country => (
                  <label key={country} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filters.countries.includes(country)}
                      onChange={() => toggleFilterItem('countries', country)}
                    />
                    <span>{country}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Cities Dropdown */}
          <div className="filter-dropdown-group">
            <div 
              className="filter-dropdown-header"
              onClick={() => setOpenDropdown(openDropdown === 'cities' ? null : 'cities')}
            >
              <span>{t('search.cities')}</span>
              <span className="dropdown-value">
                {filters.cities.length > 0
                  ? t('search.nSelected', { n: filters.cities.length })
                  : t('search.selectCities')
                }
              </span>
              <span className="dropdown-arrow">{openDropdown === 'cities' ? '▲' : '▼'}</span>
            </div>
            {openDropdown === 'cities' && (
              <div className="filter-dropdown-content scrollable">
                {getAvailableCities().map(city => (
                  <label key={city} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filters.cities.includes(city)}
                      onChange={() => toggleFilterItem('cities', city)}
                    />
                    <span>{city}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Genres Dropdown */}
          <div className="filter-dropdown-group">
            <div 
              className="filter-dropdown-header"
              onClick={() => setOpenDropdown(openDropdown === 'genres' ? null : 'genres')}
            >
              <span>{t('search.genres')}</span>
              <span className="dropdown-value">
                {filters.genres.length > 0
                  ? t('search.nSelected', { n: filters.genres.length })
                  : t('search.selectGenres')
                }
              </span>
              <span className="dropdown-arrow">{openDropdown === 'genres' ? '▲' : '▼'}</span>
            </div>
            {openDropdown === 'genres' && (
              <div className="filter-dropdown-content scrollable">
                {genresList.map(genre => (
                  <label key={genre} className="filter-dropdown-item">
                    <input
                      type="checkbox"
                      checked={filters.genres.includes(genre)}
                      onChange={() => toggleFilterItem('genres', genre)}
                    />
                    <span>{genre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Filter Actions */}
          <div className="filter-screen-actions">
            <button className="btn btn-outline" onClick={clearFilters}>
              {t('search.clearFilters')}
            </button>
            <button className="btn btn-primary" onClick={() => {
              handleSearch();
              setShowFilters(false);
            }}>
              {t('search.applyFilters')}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && selectedProfile && (
        <div className="message-modal-overlay" onClick={() => {
          setShowMessageModal(false);
          setSelectedProfile(null);
          setMessage('');
        }}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">{t('search.sendMessageTo')} {selectedProfile.name}</h2>
            <textarea
              placeholder={t('messages.writeMessage')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="5"
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
                {t('messages.cancel')}
              </button>
              <button
                className="btn btn-primary btn-modal-send"
                onClick={handleSendMessage}
              >
                {t('messages.send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Choice Modal */}
      {showConnectionChoice && selectedProfile && (
        <ConnectionChoiceModal
          artist={selectedProfile}
          onClose={() => {
            setShowConnectionChoice(false);
            setSelectedProfile(null);
          }}
          onConnect={handleConnectionChoice}
        />
      )}

      {/* Review Request Modal */}
      {showReviewModal && selectedProfile && reviewingRequest && (
        <div className="message-modal-overlay" onClick={() => {
          setShowReviewModal(false);
          setSelectedProfile(null);
          setReviewingRequest(null);
        }}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">{t('search.connectionRequestFrom', { name: selectedProfile.name })}</h2>

            <div className="review-modal-profile">
              <div className={`result-avatar avatar-${selectedProfile.role.toLowerCase()}`}>
                {selectedProfile.avatar ? (
                  <img src={selectedProfile.avatar} alt={selectedProfile.name} />
                ) : (
                  selectedProfile.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="review-modal-info">
                <h3>{selectedProfile.name}</h3>
                <p className="result-location">{selectedProfile.location}</p>
                <span className={`role-badge badge-${selectedProfile.role.toLowerCase()}`}>
                  {t(`editProfile.${selectedProfile.role.toLowerCase()}`)}
                </span>
              </div>
            </div>

            {reviewingRequest.message && reviewingRequest.message.trim() ? (
              <div className="review-modal-message">
                <label>{t('search.messageLabel')}</label>
                <div className="message-content">{reviewingRequest.message}</div>
              </div>
            ) : (
              <div className="review-modal-message">
                <p className="system-message-text">{t('search.wantsToConnect', { name: selectedProfile.name })}</p>
              </div>
            )}

            <div className="message-modal-actions">
              <button
                className="btn btn-outline btn-modal-cancel"
                onClick={handleDeclineRequest}
              >
                {t('search.decline')}
              </button>
              <button
                className="btn btn-primary btn-modal-send"
                onClick={handleAcceptRequest}
              >
                {t('search.accept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Like Limit Modal */}
      {showLikeLimitModal && likeLimitData && (
        <div className="modal-overlay" onClick={() => setShowLikeLimitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('search.dailyLikeLimitReached')}</h3>
              <button className="modal-close" onClick={() => setShowLikeLimitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">{t('search.dailyLikeLimitMessage')}</p>
              </div>

              <div className="tier-info-box">
                <p className="tier-details">{t('search.currentPlan')} <strong>{likeLimitData.tier}</strong> • {t('search.likesPerDay', { n: likeLimitData.limit })}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowLikeLimitModal(false)}
              >
                {t('common.close')}
              </button>
              <button
                className="btn btn-upgrade"
                onClick={() => {
                  setShowLikeLimitModal(false);
                  if (onOpenPremium) {
                    onOpenPremium();
                  }
                }}
              >
                {t('search.upgrade')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Limit Modal */}
      {showConnectionLimitModal && connectionLimitData && (
        <div className="modal-overlay" onClick={() => setShowConnectionLimitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('search.monthlyConnectionLimitReached')}</h3>
              <button className="modal-close" onClick={() => setShowConnectionLimitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">{t('search.monthlyConnectionLimitMessage')}</p>
              </div>

              <div className="tier-info-box">
                <p className="tier-details">{t('search.currentPlan')} <strong>{connectionLimitData.tier}</strong> • {t('search.connectionsPerMonth', { n: connectionLimitData.limit })}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowConnectionLimitModal(false)}
              >
                {t('common.close')}
              </button>
              <button
                className="btn btn-upgrade"
                onClick={() => {
                  setShowConnectionLimitModal(false);
                  if (onOpenPremium) {
                    onOpenPremium();
                  }
                }}
              >
                {t('search.upgrade')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Globe locked-city upsell (FREE members tapping a Premium pin) */}
      {globeUpsellCity && (
        <div className="modal-overlay" onClick={() => setGlobeUpsellCity(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('search.globeLockedTitle')}</h3>
              <button className="modal-close" onClick={() => setGlobeUpsellCity(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">{t('search.globeLockedBody', { city: globeUpsellCity })}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setGlobeUpsellCity(null)}
              >
                {t('common.close')}
              </button>
              <button
                className="btn btn-upgrade"
                onClick={() => {
                  setGlobeUpsellCity(null);
                  if (onOpenPremium) {
                    onOpenPremium();
                  }
                }}
              >
                {t('search.upgrade')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Keep-mounted tabs re-render on every App state change; memo keeps
// hidden tabs cheap when their props are unchanged.
export default React.memo(SearchScreen);