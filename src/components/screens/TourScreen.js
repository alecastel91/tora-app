import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import ViewProfileScreen from './ViewProfileScreen';
import MakeOfferModal from '../common/MakeOfferModal';
import { CalendarIcon, PlaneIcon, LocationIcon, HandshakeIcon, DollarIcon, TargetIcon, StarIcon, EyeIcon, SlidersIcon } from '../../utils/icons';
import apiService from '../../services/api';
import LoadingGlobe from '../common/LoadingGlobe';
import { citiesByCountry, countriesByZone, genresList } from '../../data/profiles';
import { appAlert, appConfirm } from '../../utils/dialogs';

const TourScreen = ({ onOpenChat, onNavigateToMessages, onUnreadProposalsChange, onOpenPremium, accountUser }) => {
  const { user, getCalendarMatches, sentRequests, sendConnectionRequest, connectedUsers } = useAppContext();
  const { t } = useLanguage();
  const tourStatusLabel = (st) => ({ ACTIVE: t('tour.statusActive'), COMPLETED: t('tour.statusCompleted'), CANCELLED: t('tour.statusCancelled') }[st] || st);

  // Helper function to check if user has premium access (per-profile subscription)
  const isPremiumUser = () => {
    // Agents unlock via their agent plan (roster-based), not subscriptionTier.
    if (user?.role === 'AGENT') return !!user?.agentTier;
    const tier = user?.subscriptionTier || 'FREE';
    return ['TRIAL', 'MONTHLY', 'YEARLY'].includes(tier);
  };

  // Tab state
  const [activeTab, setActiveTab] = useState('calendar');  // 'calendar' or 'kickstart'

  // Calendar Matches state
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [calendarMatches, setCalendarMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Tour Kickstart state
  const [showCreateTourModal, setShowCreateTourModal] = useState(false);
  const [myTours, setMyTours] = useState([]);
  const [toursLoading, setToursLoading] = useState(true);
  const [allTours, setAllTours] = useState([]); // For promoters/venues
  const [tourZoneFilter, setTourZoneFilter] = useState('all');
  const [tourGenreFilter, setTourGenreFilter] = useState([]); // Array for multi-select
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showZoneDropdown, setShowZoneDropdown] = useState(false);
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
  const [selectedTourArtist, setSelectedTourArtist] = useState(null);
  const [selectedTour, setSelectedTour] = useState(null);
  const [showEditTourModal, setShowEditTourModal] = useState(false);
  const [showMyProposalModal, setShowMyProposalModal] = useState(false);
  const [myProposalData, setMyProposalData] = useState(null);
  const [showTourGigsModal, setShowTourGigsModal] = useState(false);
  const [tourGigs, setTourGigs] = useState([]);
  const [loadingTourGigs, setLoadingTourGigs] = useState(false);
  const [tourBusy, setTourBusy] = useState(false);

  // Generate month/year options starting from current month for next 12 months
  const generateMonthOptions = () => {
    const options = [{ value: 'all', label: t('tour.allMonths') }];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    for (let i = 0; i < 12; i++) {
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

  const monthOptions = generateMonthOptions();

  // Fetch calendar matches when user is premium and has available dates
  useEffect(() => {
    const fetchCalendarMatches = async () => {
      if (!user || !isPremiumUser() || !user.availableDates || user.availableDates.length === 0) {
        setCalendarMatches([]);
        return;
      }

      setLoadingMatches(true);
      try {
        // Fetch all profiles from backend (no filters = get all)
        const response = await apiService.searchProfiles({});
        const allProfiles = response.profiles || [];

        // Find matches
        const userAvailableDates = new Set(user.availableDates);
        const matches = [];

        for (const profile of allProfiles) {
          // Skip self
          if (profile.id === user.id) continue;

          // Check role compatibility
          if (!isValidRoleMatch(user.role, profile.role)) continue;

          // Check genre matching - must have at least one genre in common
          const userGenres = user.genres || [];
          const profileGenres = profile.genres || [];

          // Skip if either has no genres, or if they have no common genres
          if (userGenres.length === 0 || profileGenres.length === 0) {
            continue;
          }

          const hasCommonGenre = userGenres.some(genre => profileGenres.includes(genre));
          if (!hasCommonGenre) {
            continue;
          }

          // Check for overlapping available dates
          const profileAvailableDates = profile.availableDates || [];
          const overlappingDates = profileAvailableDates.filter(date => userAvailableDates.has(date));

          if (overlappingDates.length > 0) {
            // Format dates for display
            const datesFormatted = formatMatchDates(overlappingDates);

            matches.push({
              profile,
              dates: datesFormatted,
              matchCount: overlappingDates.length,
              rawDates: overlappingDates
            });
          }
        }

        // Sort by number of matching dates (most matches first)
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
  }, [user?.id, user?.subscriptionTier, user?.availableDates?.length, activeTab]);

  // Fetch tours when Kickstart tab is active
  useEffect(() => {
    const fetchTours = async () => {
      if (!user || activeTab !== 'kickstart') return;

      setToursLoading(true);
      console.log('[TourScreen] Fetching tours, user role:', user.role);

      try {
        const isArtist = user.role === 'ARTIST' || user.role === 'AGENT';
        const isPromoterOrVenue = user.role === 'PROMOTER' || user.role === 'VENUE';

        if (isArtist) {
          // Fetch artist's own tours
          const response = await apiService.getMyTours();
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
  }, [user?.id, user?.role, activeTab, onUnreadProposalsChange]);

  // Helper function to check role compatibility
  const isValidRoleMatch = (role1, role2) => {
    // Treat AGENT same as ARTIST (agents represent artists)
    const normalizedRole1 = role1 === 'AGENT' ? 'ARTIST' : role1;
    const normalizedRole2 = role2 === 'AGENT' ? 'ARTIST' : role2;

    const validPairs = [
      ['ARTIST', 'VENUE'],
      ['ARTIST', 'PROMOTER'],
      ['PROMOTER', 'VENUE']
    ];

    return validPairs.some(([r1, r2]) =>
      (normalizedRole1 === r1 && normalizedRole2 === r2) ||
      (normalizedRole1 === r2 && normalizedRole2 === r1)
    );
  };

  // Helper function to normalize date format (YYYY-M-D to YYYY-MM-DD)
  const normalizeDate = (dateStr) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Helper function to format overlapping dates for display
  const formatMatchDates = (dates) => {
    if (dates.length === 0) return '';

    // Normalize and sort dates
    const sortedDates = [...dates].map(normalizeDate).sort();

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

  // Filter matches based on selected filters
  const filteredMatches = allMatches.filter(match => {
    // Genre matching - must have at least one genre in common
    const userGenres = user?.genres || [];
    const matchGenres = match.profile.genres || [];

    // Skip if either has no genres, or if they have no common genres
    if (userGenres.length === 0 || matchGenres.length === 0) {
      return false;
    }

    const hasCommonGenre = userGenres.some(genre => matchGenres.includes(genre));
    if (!hasCommonGenre) {
      return false;
    }

    // Role filter
    if (roleFilter !== 'all' && match.profile.role !== roleFilter) {
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

  const handleMessage = (profile) => {
    // Open chat and navigate to messages tab
    if (onOpenChat) {
      onOpenChat(profile);
    }
    if (onNavigateToMessages) {
      onNavigateToMessages();
    }
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

  // Show viewing profile if selected
  if (viewingProfile) {
    // Check if viewingProfile is already a profile object (from tour cards)
    let profileToView = null;

    if (typeof viewingProfile === 'object' && viewingProfile.id) {
      // Already a profile object from tour artist
      profileToView = viewingProfile;
    } else {
      // It's an ID string, find from calendar matches
      profileToView = calendarMatches.find(m => {
        const id = m.profile.id;
        return id === viewingProfile;
      })?.profile;
    }

    if (!profileToView) {
      // If profile not found, close the view
      setViewingProfile(null);
      return null;
    }

    return (
      <ViewProfileScreen
        profile={profileToView}
        onClose={() => setViewingProfile(null)}
        onOpenChat={onOpenChat}
        onNavigateToMessages={onNavigateToMessages}
      />
    );
  }

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
          <p className="text-xs text-white/45 leading-relaxed max-w-[300px] mx-auto mt-0 mb-6">
            {t('tour.matchesIntro')}
          </p>

          <div className="feature-preview">
            {/* Filters Section */}
            <div className="matches-filters">
              <div className="filter-group">
                <label className="filter-label">{t('editProfile.role')}</label>
                <select
                  className="filter-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">{t('tour.allRoles')}</option>
                  <option value="VENUE">{t('tour.venues')}</option>
                  <option value="PROMOTER">{t('tour.promoters')}</option>
                  <option value="AGENT">{t('tour.agents')}</option>
                  <option value="ARTIST">{t('tour.artists')}</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">{t('tour.period')}</label>
                <select
                  className="filter-select"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                >
                  {monthOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {(roleFilter !== 'all' || monthFilter !== 'all') && (
                <button
                  className="filter-clear-btn"
                  onClick={() => {
                    setRoleFilter('all');
                    setMonthFilter('all');
                  }}
                >
                  {t('search.clearFilters')}
                </button>
              )}
            </div>

            {matches.length > 0 ? (
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
                          onClick={() => handleMessage(match.profile)}
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
          </div>
        </div>
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
    if (endDate <= startDate) {
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
      appAlert(error.message || t('tour.createTourFailed'));
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
    if (endDate <= startDate) {
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

  const handleViewTourGigs = async (tour) => {
    setSelectedTour(tour);
    setShowTourGigsModal(true);
    setLoadingTourGigs(true);
    setTourGigs([]);

    try {
      // Fetch deals linked to this tour
      const response = await apiService.getDealsForTour(tour.id);
      setTourGigs(response.deals || []);
    } catch (error) {
      console.error('Error fetching tour gigs:', error);
      appAlert(t('tour.loadGigsFailed'));
    } finally {
      setLoadingTourGigs(false);
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
      <div className="create-tour-modal-overlay" onClick={() => setShowCreateTourModal(false)}>
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
                <option value="Europe">Europe</option>
                <option value="Asia">Asia</option>
                <option value="Americas">Americas</option>
                <option value="Africa">Africa</option>
                <option value="Oceania">Oceania</option>
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
                  {(() => {
                    // For Americas, combine North America and Latin America
                    if (tourForm.zone === 'Americas') {
                      const northAmerica = countriesByZone['North America'] || [];
                      const latinAmerica = countriesByZone['Latin America & Caribbean'] || [];
                      return [...northAmerica, ...latinAmerica].sort().map(country => (
                        <option key={country} value={country}>{country}</option>
                      ));
                    }
                    // For other zones, use direct lookup
                    return (countriesByZone[tourForm.zone] || []).sort().map(country => (
                      <option key={country} value={country}>{country}</option>
                    ));
                  })()}
                </select>
                <small className="form-hint">{t('tour.countryHint')}</small>
              </div>
            )}

            <div className="form-group">
              <label>{t('calendar.startDate')} *</label>
              <input
                type="date"
                value={tourForm.startDate}
                onChange={(e) => { setTourForm({ ...tourForm, startDate: e.target.value }); e.target.blur(); }}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>{t('calendar.endDate')} *</label>
              <input
                type="date"
                value={tourForm.endDate}
                onChange={(e) => { setTourForm({ ...tourForm, endDate: e.target.value }); e.target.blur(); }}
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
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
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
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
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

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!tourForm.hideFee}
                  onChange={(e) => setTourForm({ ...tourForm, hideFee: e.target.checked })}
                />
                <span>{t('tour.hideFeeLabel')}</span>
              </label>
            </div>

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
      </div>
    );

    // Render modal using portal to escape the TourScreen stacking context
    return ReactDOM.createPortal(modalContent, document.body);
  };

  // Render Edit Tour Modal
  const renderEditTourModal = () => {
    if (!showEditTourModal || !selectedTour) return null;

    const modalContent = (
      <div className="create-tour-modal-overlay" onClick={() => setShowEditTourModal(false)}>
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
                onChange={(e) => setTourForm({ ...tourForm, zone: e.target.value })}
                className="form-input"
              >
                <option value="">{t('tour.selectZone')}</option>
                <option value="Europe">Europe</option>
                <option value="Asia">Asia</option>
                <option value="Americas">Americas</option>
                <option value="Africa">Africa</option>
                <option value="Oceania">Oceania</option>
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
                  {(() => {
                    // For Americas, combine North America and Latin America
                    if (tourForm.zone === 'Americas') {
                      const northAmerica = countriesByZone['North America'] || [];
                      const latinAmerica = countriesByZone['Latin America & Caribbean'] || [];
                      return [...northAmerica, ...latinAmerica].sort().map(country => (
                        <option key={country} value={country}>{country}</option>
                      ));
                    }
                    // For other zones, use direct lookup
                    return (countriesByZone[tourForm.zone] || []).sort().map(country => (
                      <option key={country} value={country}>{country}</option>
                    ));
                  })()}
                </select>
                <small className="form-hint">{t('tour.countryHint')}</small>
              </div>
            )}

            <div className="form-group">
              <label>{t('calendar.startDate')} *</label>
              <input
                type="date"
                value={tourForm.startDate}
                onChange={(e) => { setTourForm({ ...tourForm, startDate: e.target.value }); e.target.blur(); }}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>{t('calendar.endDate')} *</label>
              <input
                type="date"
                value={tourForm.endDate}
                onChange={(e) => { setTourForm({ ...tourForm, endDate: e.target.value }); e.target.blur(); }}
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
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
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
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
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

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!tourForm.hideFee}
                  onChange={(e) => setTourForm({ ...tourForm, hideFee: e.target.checked })}
                />
                <span>{t('tour.hideFeeLabel')}</span>
              </label>
            </div>

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
      </div>
    );

    // Render modal using portal to escape the TourScreen stacking context
    return ReactDOM.createPortal(modalContent, document.body);
  };

  // Tour Kickstart Tab Content
  const renderTourKickstart = () => {
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
      return (
        <div className="tour-kickstart-content">
          <div className="tour-kickstart-section">
            <div className="section-header">
              <h3>{t('tour.myTours')}</h3>
              <button className="btn btn-primary btn-small" onClick={() => setShowCreateTourModal(true)}>
                <span>+ {t('tour.createTour')}</span>
              </button>
            </div>

            {/* Tour cards or empty state */}
            {toursLoading ? (
              <LoadingGlobe label={t('tour.loadingTours')} />
            ) : myTours.length === 0 ? (
              <div className="tour-empty-state">
                <PlaneIcon />
                <p>{t('tour.noToursYet')}</p>
                <p className="tour-empty-hint">{t('tour.noToursHint')}</p>
              </div>
            ) : (
              <div className="tour-cards-list">
                {myTours.map(tour => {
                  const pct = Math.min(100, Math.round(((tour.totalRevenue || 0) / (tour.minRevenue || 1)) * 100));
                  const statusPill = {
                    ACTIVE: 'text-role-agent border-role-agent/50',
                    COMPLETED: 'text-white/60 border-white/25',
                    CANCELLED: 'text-role-venue border-role-venue/50',
                  }[tour.status] || 'text-white/60 border-white/25';
                  return (
                  <div
                    key={tour.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
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
                          {new Date(tour.startDate).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric' })}
                          {' — '}
                          {new Date(tour.endDate).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
                          {tour.zone && tour.country ? ` · ${tour.zone}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full border text-[9px]
                                        font-semibold uppercase tracking-[0.15em] font-tech ${statusPill}`}>
                        {tourStatusLabel(tour.status)}
                      </span>
                    </div>

                    {/* Console: gigs + revenue tiles */}
                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                        <p className="text-lg font-bold text-white font-space-grotesk leading-none m-0">
                          {tour.confirmedGigs || 0}
                        </p>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-tech mt-1.5 m-0">
                          {t('tour.gigsConfirmed')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
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

                    {/* Actions: primary → neutral → quiet danger */}
                    <div className="flex items-center gap-2 pt-3 border-t border-white/[0.07]">
                      <button className="btn btn-primary btn-small" onClick={() => handleViewTourGigs(tour)}>
                        {t('tour.viewGigs')}
                      </button>
                      <button className="btn btn-outline btn-small" onClick={() => handleEditTour(tour)}>
                        {t('common.edit')}
                      </button>
                      <button
                        className="ml-auto bg-transparent border-none cursor-pointer text-[10px] uppercase tracking-[0.1em]
                                   font-tech text-white/35 hover:text-role-venue transition-colors"
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
        const genreMatch = tourGenreFilter.length === 0 ||
          (tour.artist && tour.artist.genres && tour.artist.genres.some(g => tourGenreFilter.includes(g)));
        return zoneMatch && genreMatch;
      });

      return (
        <div className="tour-kickstart-content">
          <div className="tour-kickstart-section">
            <div className="section-header">
              <h3>{t('tour.tourOpportunities')}</h3>
            </div>
            <p className="section-description">{t('tour.tourOpportunitiesDesc')}</p>

            {/* Filters */}
            <div className="tour-filters">
              <div className="zone-filter-dropdown">
                <button
                  className="filter-select zone-filter-button"
                  onClick={() => setShowZoneDropdown(!showZoneDropdown)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>{tourZoneFilter === 'all' ? t('calendar.allZones') : tourZoneFilter}</span>
                  <span style={{ marginLeft: '8px' }}>▼</span>
                </button>
                {showZoneDropdown && (
                  <div
                    className="zone-dropdown-menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    {['all', 'Europe', 'Asia', 'Americas', 'Africa', 'Oceania'].map(zone => (
                      <div
                        key={zone}
                        onClick={() => {
                          setTourZoneFilter(zone);
                          setShowZoneDropdown(false);
                        }}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          background: tourZoneFilter === zone ? 'rgba(255,51,102,0.2)' : 'transparent',
                          borderLeft: tourZoneFilter === zone ? '3px solid #FF3366' : '3px solid transparent',
                          transition: 'all 0.2s',
                          fontSize: '14px',
                          color: tourZoneFilter === zone ? '#fff' : 'rgba(255,255,255,0.8)',
                          fontWeight: tourZoneFilter === zone ? '600' : '400'
                        }}
                        onMouseEnter={(e) => {
                          if (tourZoneFilter !== zone) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (tourZoneFilter !== zone) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {zone === 'all' ? t('calendar.allZones') : zone}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="genre-filter-dropdown">
                <button
                  className="filter-select genre-filter-button"
                  onClick={() => setShowGenreDropdown(!showGenreDropdown)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>
                    {tourGenreFilter.length === 0
                      ? t('tour.allGenres')
                      : tourGenreFilter.length > 1
                        ? t('tour.genresSelectedCount', { n: tourGenreFilter.length })
                        : t('tour.genreSelectedCount', { n: tourGenreFilter.length })
                    }
                  </span>
                  <span style={{ marginLeft: '8px' }}>▼</span>
                </button>
                {showGenreDropdown && (
                  <div
                    className="genre-dropdown-menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <button
                        onClick={() => setTourGenreFilter([])}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#FF3366',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        {t('tour.clearAll')}
                      </button>
                      <button
                        onClick={() => setShowGenreDropdown(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255,255,255,0.7)',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        {t('common.done')}
                      </button>
                    </div>
                    {genresList.map(genre => (
                      <label
                        key={genre}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          background: tourGenreFilter.includes(genre) ? 'rgba(255,51,102,0.1)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!tourGenreFilter.includes(genre)) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!tourGenreFilter.includes(genre)) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={tourGenreFilter.includes(genre)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTourGenreFilter([...tourGenreFilter, genre]);
                            } else {
                              setTourGenreFilter(tourGenreFilter.filter(g => g !== genre));
                            }
                          }}
                          style={{ marginRight: '10px' }}
                        />
                        <span style={{ fontSize: '14px', color: '#fff' }}>{genre}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
                      <div className="tour-artist-info">
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
                        {new Date(tour.startDate).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric' })} - {new Date(tour.endDate).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="tour-card-body">
                      {/* Revenue Progress Bar */}
                      <div className="tour-progress">
                        <div className="tour-progress-header">
                          <span className="tour-progress-label">
                            {t('tour.gigsConfirmedCount', { n: tour.confirmedGigs || 0 })}
                          </span>
                        </div>
                        <div className="tour-progress-bar">
                          <div
                            className="tour-progress-fill"
                            style={{ width: `${Math.min(100, ((tour.totalRevenue || 0) / (tour.minRevenue || 1)) * 100)}%` }}
                          />
                        </div>
                        <div className="tour-progress-percentage">
                          {Math.round(((tour.totalRevenue || 0) / (tour.minRevenue || 1)) * 100)}%
                        </div>
                      </div>

                      <div className="tour-stats-row">
                        {(tour.feeExpectation || tour.priceOnRequest) && (
                          <div className="tour-stat">
                            <span className="tour-stat-label">{t('tour.feeRangeLabel')}</span>
                            <span className="tour-stat-value">{tour.priceOnRequest ? t('tour.priceOnRequest') : tour.feeExpectation}</span>
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
                      ) : (
                        // No proposal sent yet
                        <button
                          className="btn btn-primary btn-small"
                          onClick={() => handleMakeOffer(tour)}
                        >
                          {t('tour.makeAnOffer')}
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-small"
                        onClick={async () => {
                          // Fetch full artist profile from backend
                          try {
                            const fullProfile = await apiService.getProfile(tour.artist.id);
                            setViewingProfile(fullProfile);
                          } catch (error) {
                            console.error('Error fetching artist profile:', error);
                            appAlert(t('tour.loadArtistProfileFailed'));
                          }
                        }}
                      >
                        {t('tour.viewArtist')}
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

  return (
    <div className="screen active matches-screen tour-screen">
      {/* isolate wraps ONLY in-flow content so the -z-10 backdrop stays visible;
          overlays (modals) live outside it. */}
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
          onClick={() => setActiveTab('calendar')}
        >
          <CalendarIcon />
          <span>{t('tour.calendarMatches')}</span>
        </button>
        <button
          className={`tour-tab ${activeTab === 'kickstart' ? 'active' : ''}`}
          onClick={() => setActiveTab('kickstart')}
        >
          <PlaneIcon />
          <span>{t('tour.tourKickstart')}</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tour-tab-content">
        {activeTab === 'calendar' ? renderCalendarMatches() : renderTourKickstart()}
      </div>
      </div>

      {/* Message Modal */}
      {showMessageModal && selectedProfile && (
        <div className="message-modal-overlay" onClick={() => {
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
        </div>
      )}

      {/* Create Tour Modal */}
      {renderCreateTourModal()}

      {/* Edit Tour Modal */}
      {renderEditTourModal()}

      {/* Make Offer Modal (for tours) */}
      <MakeOfferModal
        isOpen={showMakeOfferModal}
        onClose={() => {
          setShowMakeOfferModal(false);
          setSelectedTourArtist(null);
        }}
        recipientProfile={selectedTourArtist}
        onSuccess={() => {
          setShowMakeOfferModal(false);
          setSelectedTourArtist(null);
          // Navigate to Messages tab to see the offer
          onNavigateToMessages();
        }}
      />

      {/* View My Sent Proposal Modal */}
      {showMyProposalModal && myProposalData && ReactDOM.createPortal(
        <div className="create-tour-modal-overlay" onClick={() => setShowMyProposalModal(false)}>
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
                  {new Date(myProposalData.tour?.startDate).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric' })} - {new Date(myProposalData.tour?.endDate).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* Proposal Card */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: myProposalData.status === 'ACCEPTED' ? '3px solid #4CAF50' :
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
                    background: myProposalData.status === 'ACCEPTED' ? 'rgba(76, 175, 80, 0.2)' :
                               myProposalData.status === 'DECLINED' ? 'rgba(244, 67, 54, 0.2)' :
                               'rgba(255, 193, 7, 0.2)',
                    color: myProposalData.status === 'ACCEPTED' ? '#4CAF50' :
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
        <div className="modal-overlay" onClick={() => setShowTourGigsModal(false)}>
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
                          background: 'rgba(76, 175, 80, 0.2)',
                          color: '#4CAF50',
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
                            {new Date(deal.date).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
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
    </div>
  );
};

// Keep-mounted tabs re-render on every App state change; memo keeps
// hidden tabs cheap when their props are unchanged.
export default React.memo(TourScreen);
