import React, { useState, useEffect } from 'react';
import { zones, countriesByZone, citiesByCountry, genresList } from '../../data/profiles';
import { HeartIcon, FilterIcon, SlashCircleIcon } from '../../utils/icons';
import ViewProfileScreen from './ViewProfileScreen';
import Modal from '../common/Modal';
import ConnectionChoiceModal from '../common/ConnectionChoiceModal';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';

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
        const tierName = user?.subscriptionTier === 'TRIAL' ? 'Your 48h trial' : 'FREE tier';
        // Show alert and clear location filters
        alert(`Location filters require a paid subscription.\n\n${tierName} search is restricted to ${user.city} only.\n\nUpgrade to search worldwide!`);

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
        alert('Failed to like profile. Please try again.');
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
        targetName = repArray[0]?.name || repArray[0]?.agentName || 'Agent';
      }
      alert(`Connection request sent to ${targetName}!`);
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
      alert('Failed to send connection request. Please try again.');
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
        alert('Failed to accept request');
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
        alert('Failed to decline request');
      }
    }
  };

  const handleSendMessage = async () => {
    if (selectedProfile) {
      if (!message.trim()) {
        alert('Please write a message to introduce yourself');
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
        alert('Failed to send connection request. Please try again.');
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
            <span className="premium-icon">✨</span>
            <span>
              {user?.subscriptionTier === 'TRIAL' ? 'Searching worldwide with 48h trial' : 'Searching worldwide with Premium'}
            </span>
          </div>
        )}

        {/* Upgrade banner for FREE tier */}
        {user && !hasGlobalSearch() && (
          <div className="search-upgrade-banner">
            <div className="upgrade-banner-content">
              <span className="upgrade-icon">🔒</span>
              <div className="upgrade-text">
                <strong>Search limited to {user.city}</strong>
                <p>Upgrade to search worldwide and unlock premium features</p>
              </div>
              <button className="btn btn-upgrade-banner" onClick={onOpenPremium}>
                Upgrade Now
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Search Results */}
      <div className="search-results">
        {loading ? (
          <div className="loading-message">Loading profiles...</div>
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
                        {profile.role}
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
                      Message
                    </button>
                  ) : hasReceivedRequest || isRequested ? (
                    <button
                      className="btn btn-disabled btn-connect"
                      disabled={true}
                    >
                      Pending
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
          <div className="empty-state">
            <p>{hasSearched ? 'No results found' : 'Start searching to find profiles'}</p>
          </div>
        )}
      </div>
      
      {/* Filter Full-Page Screen */}
      {showFilters && (
        <div className="screen active filter-screen">
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
                  ? `${filters.roles.length} selected`
                  : 'Select roles'
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
                    <span>{role}</span>
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
                  ? `${filters.zones.length} selected`
                  : 'Select zones'
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
                  ? `${filters.countries.length} selected`
                  : 'Select countries'
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
                  ? `${filters.cities.length} selected`
                  : 'Select cities'
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
                  ? `${filters.genres.length} selected`
                  : 'Select genres'
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
      {console.log('[RENDER] showConnectionChoice:', showConnectionChoice, 'selectedProfile:', selectedProfile?.name)}
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
            <h2 className="message-modal-title">Connection Request from {selectedProfile.name}</h2>

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
                  {selectedProfile.role}
                </span>
              </div>
            </div>

            {reviewingRequest.message && reviewingRequest.message.trim() ? (
              <div className="review-modal-message">
                <label>Message:</label>
                <div className="message-content">{reviewingRequest.message}</div>
              </div>
            ) : (
              <div className="review-modal-message">
                <p className="system-message-text">{selectedProfile.name} wants to connect</p>
              </div>
            )}

            <div className="message-modal-actions">
              <button
                className="btn btn-outline btn-modal-cancel"
                onClick={handleDeclineRequest}
              >
                Decline
              </button>
              <button
                className="btn btn-primary btn-modal-send"
                onClick={handleAcceptRequest}
              >
                Accept
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
              <h3>Daily Like Limit Reached</h3>
              <button className="modal-close" onClick={() => setShowLikeLimitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">You've reached your daily limit. Upgrade to Premium for unlimited likes!</p>
              </div>

              <div className="tier-info-box">
                <p className="tier-details">Current plan: <strong>{likeLimitData.tier}</strong> • {likeLimitData.limit} likes per day</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowLikeLimitModal(false)}
              >
                Close
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
                Upgrade
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
              <h3>Monthly Connection Limit Reached</h3>
              <button className="modal-close" onClick={() => setShowConnectionLimitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">You've reached your monthly limit. Upgrade to Premium for unlimited connections!</p>
              </div>

              <div className="tier-info-box">
                <p className="tier-details">Current plan: <strong>{connectionLimitData.tier}</strong> • {connectionLimitData.limit} connections per month</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowConnectionLimitModal(false)}
              >
                Close
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
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchScreen;