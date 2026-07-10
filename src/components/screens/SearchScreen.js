import React, { useState, useEffect } from 'react';
import { zones, countriesByZone, citiesByCountry, genresList } from '../../data/profiles';
import { HeartIcon, FilterIcon, SlashCircleIcon, SearchIcon } from '../../utils/icons';
import ViewProfileScreen from './ViewProfileScreen';
import Modal from '../common/Modal';
import ConnectionChoiceModal from '../common/ConnectionChoiceModal';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import LoadingGlobe from '../common/LoadingGlobe';

const SearchScreen = ({ onOpenChat, onNavigateToMessages, onOpenPremium, accountUser }) => {
  const { user, likedProfiles, toggleLike, sentRequests, sendConnectionRequest, connectedUsers, receivedRequests, acceptConnectionRequest, declineConnectionRequest } = useAppContext();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleSearch = async () => {
    // Check if FREE tier user is trying to use location filters
    if (!hasGlobalSearch()) {
      const hasLocationFilters = filters.zones.length > 0 || filters.countries.length > 0 || filters.cities.length > 0;

      if (hasLocationFilters) {
        const tierName = user?.subscriptionTier === 'TRIAL' ? t('search.trialTierName') : t('search.freeTierName');
        // Show alert and clear location filters
        alert(t('search.locationFiltersAlert', { tierName, city: user.city }));

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
        alert(t('search.failedToLike'));
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
      alert(t('search.connectionRequestSent', { name: targetName }));
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
      alert(t('search.failedToSendRequest'));
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
        alert(t('search.failedToAcceptRequest'));
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
        alert(t('search.failedToDeclineRequest'));
      }
    }
  };

  const handleSendMessage = async () => {
    if (selectedProfile) {
      if (!message.trim()) {
        alert(t('search.pleaseWriteMessage'));
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
        alert(t('search.failedToSendRequest'));
      }
    }
  };

  const handleProfileClick = (profile) => {
    setViewingProfile(profile);
  };

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
    <div className="screen active search-screen">
      {/* isolate wraps ONLY in-flow content so the -z-10 backdrop stays visible;
          full-screen overlays (filter screen, modals) must live OUTSIDE it or
          they get trapped under the sticky app header's stacking context. */}
      <div className="relative isolate">
      {/* faint engineering grid fading from the top (quiet-premium backdrop) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-6 h-48 -z-10 bg-grid
                   [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
      />
      <div className="search-header">
        {/* Search Bar */}
        <div className="search-bar">
          <input
            type="text"
            placeholder={t('search.searchByName')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button 
            className="filter-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <span className="filter-icon"><FilterIcon /></span> {t('search.filters')}
            {activeFilterCount > 0 && (
              <span className="filter-count">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Tier-based notification banner */}
        {user && hasGlobalSearch() && (
          <div className="search-premium-notice">
            <span className="premium-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            <span>
              {user?.subscriptionTier === 'TRIAL' ? t('profile.searchingWorldwideTrial') : t('profile.searchingWorldwidePremium')}
            </span>
          </div>
        )}

        {/* Upgrade banner for FREE tier */}
        {user && !hasGlobalSearch() && (
          <div className="search-upgrade-banner">
            <div className="upgrade-banner-content">
              <span className="upgrade-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <div className="upgrade-text">
                <strong>{t('profile.searchLimitedTo')} {user.city}</strong>
                <p>{t('search.upgradeWorldwide')}</p>
              </div>
              <button className="btn btn-upgrade-banner" onClick={onOpenPremium}>
                {t('search.upgradeNow')}
              </button>
            </div>
          </div>
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
    </div>
  );
};

export default SearchScreen;