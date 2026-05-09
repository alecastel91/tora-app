import React, { useState, useEffect } from 'react';
import { CloseIcon, CalendarIcon, DollarIcon, AlertIcon, FileIcon, MailIcon, TrendingUpIcon, BriefcaseIcon, PlaneIcon, ListIcon, EditIcon, TrashIcon, ImageIcon, SlidersIcon, FileTextIcon } from '../../utils/icons';
import Modal from '../common/Modal';
import RAEventsModal from '../common/RAEventsModal';
import AddContractModal from '../common/AddContractModal';
import { zones, countriesByZone, citiesByCountry, genresList } from '../../data/profiles';
import apiService from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';

const ManageArtistScreen = ({ artist, onClose, onSwitchTab }) => {
  const { user, preferredCurrency, reloadProfileData } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, events, info, documents
  const [artistProfile, setArtistProfile] = useState(artist); // Store full artist profile
  const [selectedDates, setSelectedDates] = useState(new Set(artist?.availableDates || []));
  const [travelSchedule, setTravelSchedule] = useState(artist.travelSchedule || []);
  const [actionItems, setActionItems] = useState([]);

  useEffect(() => {
    if (!user?.id || !artist?.id) return;
    let cancelled = false;
    apiService
      .getActionSummary(user.id, { artistProfileId: artist.id })
      .then((res) => { if (!cancelled) setActionItems(res.items || []); })
      .catch((err) => console.error('[ManageArtistScreen] action summary failed', err));
    return () => { cancelled = true; };
  }, [user?.id, artist?.id]);

  const handleActionClick = (target) => {
    if (target?.screen === 'BookingsScreen' && onSwitchTab) {
      onSwitchTab('bookings');
      onClose?.();
    } else if (target?.screen === 'MessagesScreen' && onSwitchTab) {
      onSwitchTab('messages');
      onClose?.();
    }
  };
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState(null);
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);
  const [showTravelModal, setShowTravelModal] = useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState(null); // Track which schedule is being edited

  // Delete confirmation state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);

  // RA Events modal state
  const [showRAEvents, setShowRAEvents] = useState(false);

  // Artist info editing state (full profile edit)
  const [showArtistInfoModal, setShowArtistInfoModal] = useState(false);
  const [isEditingArtistInfo, setIsEditingArtistInfo] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [editedArtistInfo, setEditedArtistInfo] = useState({
    name: '',
    role: '',
    bio: '',
    genres: [],
    mixtape: '',
    spotify: '',
    residentAdvisor: '',
    instagram: '',
    website: '',
    location: '',
    capacity: '',
    zone: '',
    country: '',
    city: ''
  });
  const [selectedGenres, setSelectedGenres] = useState(new Set(artistProfile?.genres || []));
  const [showGenresDropdown, setShowGenresDropdown] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [travelFilter, setTravelFilter] = useState({
    zone: '',
    country: '',
    city: '',
    startDate: '',
    endDate: ''
  });
  const [lookingFor, setLookingFor] = useState({
    promoter: false,
    venue: false
  });
  const [upcomingGigs, setUpcomingGigs] = useState(null); // null means loading, number means loaded
  const [gigsError, setGigsError] = useState(false);
  const [ytdRevenue, setYtdRevenue] = useState(null); // null means loading, number means loaded
  const [revenueChartData, setRevenueChartData] = useState([]); // Monthly revenue data from 2024 onwards
  const [thisYearGigs, setThisYearGigs] = useState(null); // Total gigs this year (completed + upcoming)
  const [expectedRevenue, setExpectedRevenue] = useState(null); // Expected revenue from upcoming gigs
  const [deals, setDeals] = useState([]); // All deals for the artist
  const [expandedDealId, setExpandedDealId] = useState(null); // Track expanded deal in events list

  // Documents state
  const [documents, setDocuments] = useState({
    pressKit: artistProfile?.documents?.pressKit || [],
    technicalRider: artistProfile?.documents?.technicalRider || [],
    contracts: artistProfile?.documents?.contracts || []
  });
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docCategory, setDocCategory] = useState(''); // pressKit, technicalRider, contracts
  const [newDoc, setNewDoc] = useState({ title: '', url: '' });

  // Fetch upcoming gigs and YTD revenue from backend
  useEffect(() => {
    if (!artist) return;

    const fetchUpcomingGigs = async () => {
      try {
        // Debug: log the artist object to see what fields it has
        console.log('ManageArtistScreen - Artist object:', artist);

        // Get artist's ID - check multiple possible field names (profileId is from representation relationships)
        const artistId = artist.profileId || artist.id || artist.id;

        console.log('ManageArtistScreen - Artist ID:', artistId);

        if (!artistId) {
          console.warn('Artist ID not found');
          setUpcomingGigs(0);
          return;
        }

        console.log('ManageArtistScreen - Fetching deals for artist:', artistId);

        // Fetch deals for this artist
        const response = await apiService.getDeals({ profileId: artistId });

        console.log('ManageArtistScreen - API response:', response);

        if (response && response.deals) {
          // Store all deals for events list
          setDeals(response.deals || []);

          const today = new Date();
          const yearStart = new Date(today.getFullYear(), 0, 1); // January 1st of current year

          // Count upcoming gigs with PENDING, NEGOTIATING, or ACCEPTED status
          const upcoming = response.deals.filter(deal => {
            const dealDate = new Date(deal.date);
            const hasUpcomingDate = dealDate >= today;
            const hasActiveStatus = ['PENDING', 'NEGOTIATING', 'ACCEPTED'].includes(deal.status);
            return hasUpcomingDate && hasActiveStatus;
          });

          setUpcomingGigs(upcoming.length);
          setGigsError(false);

          // Calculate This Year Gigs: only completed or past accepted deals this year
          const thisYearDeals = response.deals.filter(deal => {
            const dealDate = new Date(deal.date);
            const isThisYear = dealDate >= yearStart && dealDate <= today;
            const isCompleted = deal.status === 'COMPLETED';
            const isAcceptedAndPast = deal.status === 'ACCEPTED' && dealDate < today;
            return isThisYear && (isCompleted || isAcceptedAndPast);
          });
          setThisYearGigs(thisYearDeals.length);

          // Calculate YTD Revenue: sum all COMPLETED or past ACCEPTED deals from current year
          const ytdDeals = response.deals.filter(deal => {
            const dealDate = new Date(deal.date);
            const isThisYear = dealDate >= yearStart && dealDate <= today;
            const isCompleted = deal.status === 'COMPLETED';
            const isAcceptedAndPast = deal.status === 'ACCEPTED' && dealDate < today;
            return isThisYear && (isCompleted || isAcceptedAndPast);
          });

          // Fetch exchange rates to convert all deals to preferred currency
          if (ytdDeals.length > 0) {
            try {
              const ratesResponse = await apiService.getCurrentRates();
              const rates = ratesResponse.rates;

              // Convert each deal to preferred currency and sum
              let totalRevenue = 0;
              for (const deal of ytdDeals) {
                const dealCurrency = deal.currency || 'USD';
                const dealFee = parseFloat(deal.currentFee) || 0;

                // Convert deal fee to preferred currency
                let convertedFee = dealFee;
                if (dealCurrency !== preferredCurrency) {
                  // Convert to USD first if needed
                  const feeInUSD = dealCurrency === 'USD' ? dealFee : dealFee / rates[dealCurrency];
                  // Then convert from USD to preferred currency
                  convertedFee = preferredCurrency === 'USD' ? feeInUSD : feeInUSD * rates[preferredCurrency];
                }

                totalRevenue += convertedFee;
              }

              setYtdRevenue(Math.round(totalRevenue * 100) / 100); // Round to 2 decimal places
            } catch (rateError) {
              console.error('Error fetching exchange rates:', rateError);
              // Fallback: calculate without conversion (assume all in same currency)
              const total = ytdDeals.reduce((sum, deal) => sum + (parseFloat(deal.currentFee) || 0), 0);
              setYtdRevenue(Math.round(total * 100) / 100);
            }
          } else {
            // No YTD deals
            setYtdRevenue(0);
          }

          // Calculate Expected Revenue from upcoming gigs
          if (upcoming.length > 0) {
            try {
              const ratesResponse = await apiService.getCurrentRates();
              const rates = ratesResponse.rates;

              let totalExpected = 0;
              for (const deal of upcoming) {
                const dealCurrency = deal.currency || 'USD';
                const dealFee = parseFloat(deal.currentFee) || 0;

                // Convert to preferred currency
                let convertedFee = dealFee;
                if (dealCurrency !== preferredCurrency) {
                  const feeInUSD = dealCurrency === 'USD' ? dealFee : dealFee / rates[dealCurrency];
                  convertedFee = preferredCurrency === 'USD' ? feeInUSD : feeInUSD * rates[preferredCurrency];
                }

                totalExpected += convertedFee;
              }

              setExpectedRevenue(Math.round(totalExpected * 100) / 100);
            } catch (rateError) {
              console.error('Error fetching exchange rates for expected revenue:', rateError);
              const total = upcoming.reduce((sum, deal) => sum + (parseFloat(deal.currentFee) || 0), 0);
              setExpectedRevenue(Math.round(total * 100) / 100);
            }
          } else {
            setExpectedRevenue(0);
          }

          // Calculate monthly revenue data from 2024 onwards
          const startDate = new Date('2024-01-01');
          const historicalDeals = response.deals.filter(deal => {
            const dealDate = new Date(deal.date);
            const isFrom2024 = dealDate >= startDate;
            const isCompleted = deal.status === 'COMPLETED';
            const isAcceptedAndPast = deal.status === 'ACCEPTED' && dealDate < new Date();
            return isFrom2024 && (isCompleted || isAcceptedAndPast);
          });

          // Group by month/year
          const monthlyRevenue = {};
          for (const deal of historicalDeals) {
            const dealDate = new Date(deal.date);
            const monthKey = `${dealDate.getFullYear()}-${String(dealDate.getMonth() + 1).padStart(2, '0')}`;

            const dealCurrency = deal.currency || 'USD';
            const dealFee = parseFloat(deal.currentFee) || 0;

            // Convert to preferred currency
            let convertedFee = dealFee;
            if (dealCurrency !== preferredCurrency) {
              try {
                const ratesResponse = await apiService.getCurrentRates();
                const rates = ratesResponse.rates;
                const feeInUSD = dealCurrency === 'USD' ? dealFee : dealFee / rates[dealCurrency];
                convertedFee = preferredCurrency === 'USD' ? feeInUSD : feeInUSD * rates[preferredCurrency];
              } catch (err) {
                console.error('Error converting currency for chart:', err);
              }
            }

            if (!monthlyRevenue[monthKey]) {
              monthlyRevenue[monthKey] = 0;
            }
            monthlyRevenue[monthKey] += convertedFee;
          }

          // Generate array from 2024-01 to current month
          const chartData = [];
          const currentDate = new Date();
          let iterDate = new Date('2024-01-01');

          while (iterDate <= currentDate) {
            const monthKey = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, '0')}`;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[iterDate.getMonth()];
            const year = iterDate.getFullYear();

            chartData.push({
              monthKey,
              month: monthName,
              year: year,
              amount: Math.round(monthlyRevenue[monthKey] || 0)
            });

            // Move to next month
            iterDate.setMonth(iterDate.getMonth() + 1);
          }

          setRevenueChartData(chartData);
        } else {
          // No deals found, set to 0
          setUpcomingGigs(0);
          setYtdRevenue(0);
          setRevenueChartData([]);
          setGigsError(false);
        }
      } catch (error) {
        console.error('Error fetching upcoming gigs:', error);
        // Deals not migrated yet (Cluster 4) - show zeros instead of mock data
        setUpcomingGigs(0);
        setYtdRevenue(0);
        setGigsError(false);
      }
    };

    fetchUpcomingGigs();
  }, [artist, preferredCurrency]); // Re-run when currency changes

  // Fetch fresh artist profile data (including availableDates) when component mounts
  useEffect(() => {
    const fetchArtistProfile = async () => {
      try {
        const artistId = artist.profileId || artist.id || artist.id;

        if (!artistId) {
          console.warn('ManageArtistScreen - No artist ID found, using passed artist data');
          return;
        }

        console.log('[ManageArtistScreen] Fetching fresh artist profile data for:', artistId);
        const freshProfile = await apiService.getProfile(artistId);

        console.log('[ManageArtistScreen] Fresh profile received:', freshProfile);

        // Update artist profile state
        setArtistProfile(freshProfile);

        // Update available dates from fresh data
        setSelectedDates(new Set(freshProfile.availableDates || []));

        // Update travel schedule from fresh data
        setTravelSchedule(freshProfile.travelSchedule || []);

        // Update documents from fresh data
        setDocuments({
          pressKit: freshProfile.documents?.pressKit || [],
          technicalRider: freshProfile.documents?.technicalRider || [],
          contracts: freshProfile.documents?.contracts || []
        });

      } catch (error) {
        console.error('[ManageArtistScreen] Error fetching artist profile:', error);
      }
    };

    fetchArtistProfile();
  }, []); // Run once on mount

  // Sync documents when artistProfile updates
  useEffect(() => {
    if (artistProfile?.documents) {
      setDocuments({
        pressKit: artistProfile.documents.pressKit || [],
        technicalRider: artistProfile.documents.technicalRider || [],
        contracts: artistProfile.documents.contracts || []
      });
    }
  }, [artistProfile]);

  // Scroll to top when component mounts or when switching to dashboard tab
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Scroll revenue chart to show latest month
  useEffect(() => {
    if (activeTab === 'dashboard' && revenueChartData.length > 0) {
      // Wait for the chart to render
      setTimeout(() => {
        const chartScroll = document.querySelector('.revenue-chart-scroll');
        if (chartScroll) {
          // Scroll to the right (end of chart)
          chartScroll.scrollLeft = chartScroll.scrollWidth;
        }
      }, 100);
    }
  }, [activeTab, revenueChartData]);

  // Update edited artist info when artistProfile changes
  useEffect(() => {
    if (artistProfile) {
      setEditedArtistInfo({
        name: artistProfile.name || '',
        role: artistProfile.role || '',
        bio: artistProfile.bio || '',
        genres: artistProfile.genres || [],
        mixtape: artistProfile.mixtape || '',
        spotify: artistProfile.spotify || '',
        residentAdvisor: artistProfile.residentAdvisor || '',
        instagram: artistProfile.instagram || '',
        website: artistProfile.website || '',
        location: artistProfile.location || '',
        capacity: artistProfile.capacity || '',
        zone: artistProfile.zone || '',
        country: artistProfile.country || '',
        city: artistProfile.city || ''
      });
      setSelectedGenres(new Set(artistProfile.genres || []));
    }
  }, [artistProfile]);

  // Note: Form data is now initialized in the onClick handler of Edit button
  // to ensure we always use the latest artistProfile data

  if (!artist) return null;

  const toggleEventDetails = (eventId) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const openTravelModal = () => {
    const today = new Date();
    const dateFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setTravelFilter({
      zone: '',
      country: '',
      city: '',
      startDate: dateFormatted,
      endDate: dateFormatted
    });
    setShowTravelModal(true);
  };

  const handleZoneChange = (zone) => {
    setTravelFilter({
      ...travelFilter,
      zone,
      country: '',
      city: ''
    });
  };

  const handleCountryChange = (country) => {
    const zone = Object.entries(countriesByZone).find(([_, countries]) =>
      countries.includes(country)
    )?.[0] || '';

    setTravelFilter({
      ...travelFilter,
      zone,
      country,
      city: ''
    });
  };

  const handleCityChange = (city) => {
    if (!city) {
      setTravelFilter({
        ...travelFilter,
        city: ''
      });
      return;
    }

    const country = Object.entries(citiesByCountry).find(([_, cities]) =>
      cities.includes(city)
    )?.[0] || '';

    const zone = Object.entries(countriesByZone).find(([_, countries]) =>
      countries.includes(country)
    )?.[0] || '';

    setTravelFilter({
      ...travelFilter,
      zone,
      country,
      city
    });
  };

  // Artist info location handlers (for edit modal)
  const handleArtistZoneChange = (zone) => {
    setEditedArtistInfo({
      ...editedArtistInfo,
      zone,
      country: '',
      city: '',
      location: zone // Update location to just zone when zone changes
    });
  };

  const handleArtistCountryChange = (country) => {
    const zone = Object.entries(countriesByZone).find(([_, countries]) =>
      countries.includes(country)
    )?.[0] || '';

    setEditedArtistInfo({
      ...editedArtistInfo,
      zone,
      country,
      city: '',
      location: `${country}${zone ? `, ${zone}` : ''}` // Update location
    });
  };

  const handleArtistCityChange = (city) => {
    if (!city) {
      setEditedArtistInfo({
        ...editedArtistInfo,
        city: '',
        location: editedArtistInfo.country ?
          `${editedArtistInfo.country}${editedArtistInfo.zone ? `, ${editedArtistInfo.zone}` : ''}` :
          editedArtistInfo.zone
      });
      return;
    }

    // Find country for this city
    const country = Object.entries(citiesByCountry).find(([_, cities]) =>
      cities.includes(city)
    )?.[0] || '';

    // Find zone for this country
    const zone = Object.entries(countriesByZone).find(([_, countries]) =>
      countries.includes(country)
    )?.[0] || '';

    setEditedArtistInfo({
      ...editedArtistInfo,
      zone,
      country,
      city,
      location: `${city}, ${country}` // Update location as "City, Country"
    });
  };

  const saveTravelSchedule = async () => {
    if (travelFilter.zone || travelFilter.country || travelFilter.city) {
      // Validate that end date is not before start date
      if (travelFilter.startDate && travelFilter.endDate) {
        const startDate = new Date(travelFilter.startDate);
        const endDate = new Date(travelFilter.endDate);

        if (endDate < startDate) {
          alert('End date cannot be before start date. Please adjust your dates.');
          return;
        }

        // Check for overlapping schedules
        const hasOverlap = travelSchedule.some((schedule, idx) => {
          // Skip the schedule being edited
          if (editingScheduleIndex !== null && idx === editingScheduleIndex) {
            return false;
          }

          const existingStart = new Date(schedule.startDate);
          const existingEnd = new Date(schedule.endDate);

          // Check if date ranges overlap
          // Two date ranges overlap if: start1 <= end2 AND start2 <= end1
          return startDate <= existingEnd && existingStart <= endDate;
        });

        if (hasOverlap) {
          alert('This travel schedule overlaps with an existing schedule. Please choose different dates.');
          return;
        }
      }

      // Prepare the schedule data
      const scheduleData = {
        zone: travelFilter.zone || '',
        country: travelFilter.country || '',
        city: travelFilter.city || '',
        startDate: travelFilter.startDate || '',
        endDate: travelFilter.endDate || '',
        lookingFor: lookingFor
      };

      console.log('[ManageArtistScreen] Creating/editing schedule with data:', scheduleData);
      console.log('[ManageArtistScreen] travelFilter values:', {
        zone: travelFilter.zone,
        country: travelFilter.country,
        city: travelFilter.city
      });

      let updatedSchedule;
      if (editingScheduleIndex !== null) {
        // Editing existing schedule - preserve existing ID and merge new data
        const existingSchedule = travelSchedule[editingScheduleIndex];
        const updatedScheduleData = {
          ...existingSchedule,  // Preserve all existing fields (including id, etc.)
          ...scheduleData       // Override with new data
        };

        updatedSchedule = travelSchedule.map((schedule, idx) =>
          idx === editingScheduleIndex ? updatedScheduleData : schedule
        );

        console.log('[ManageArtistScreen] Editing existing schedule at index:', editingScheduleIndex);
      } else {
        // Adding new schedule
        scheduleData.id = Date.now();
        updatedSchedule = [...travelSchedule, scheduleData];

        console.log('[ManageArtistScreen] Adding new schedule with id:', scheduleData.id);
      }

      // Update local state immediately for instant feedback
      setTravelSchedule(updatedSchedule);

      // Save to backend
      try {
        console.log('[ManageArtistScreen] Saving travel schedule:', updatedSchedule);
        const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id || artist.id;

        // Save to backend
        const updatedProfile = await apiService.updateProfile(artistId, {
          travelSchedule: updatedSchedule
        });

        console.log('[ManageArtistScreen] Travel schedule saved successfully, refreshing profile');

        // Refresh artist profile from backend to get latest data
        const freshProfile = await apiService.getProfile(artistId);

        // Update artist profile state with fresh data
        setArtistProfile(freshProfile);
        setTravelSchedule(freshProfile.travelSchedule || []);

        console.log('[ManageArtistScreen] Profile refreshed with latest data');
      } catch (error) {
        console.error('[ManageArtistScreen] Failed to save travel schedule:', error);
        // Revert on error
        setTravelSchedule(travelSchedule);

        // Check if it's an authentication error
        if (error.message && error.message.includes('Token expired')) {
          alert('Your session has expired. Please log out and log back in.');
        } else if (error.message && error.message.includes('Unauthorized')) {
          alert('Authentication error. Please log out and log back in.');
        } else {
          alert('Failed to save travel schedule: ' + (error.message || 'Please try again'));
        }
      }
    }
    setShowTravelModal(false);
    setEditingScheduleIndex(null); // Reset editing index
  };

  const editTravelSchedule = (index) => {
    const schedule = travelSchedule[index];

    // Format dates for HTML date input (YYYY-MM-DD)
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Set travel filter with formatted dates
    setTravelFilter({
      zone: schedule.zone || '',
      country: schedule.country || '',
      city: schedule.city || '',
      startDate: formatDateForInput(schedule.startDate),
      endDate: formatDateForInput(schedule.endDate)
    });

    // Set looking for preferences
    setLookingFor({
      promoter: schedule.lookingFor?.promoter || false,
      venue: schedule.lookingFor?.venue || false
    });

    // Set the editing index so save knows to update instead of add
    setEditingScheduleIndex(index);

    setShowTravelModal(true);
  };

  const deleteTravelSchedule = (index) => {
    // Show confirmation dialog
    setScheduleToDelete(index);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteSchedule = async () => {
    if (scheduleToDelete === null) return;

    const updatedSchedule = travelSchedule.filter((_, i) => i !== scheduleToDelete);
    const previousSchedule = [...travelSchedule];

    // Update local state immediately
    setTravelSchedule(updatedSchedule);

    // Save to backend
    try {
      console.log('[ManageArtistScreen] Deleting travel schedule, new array:', updatedSchedule);
      const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id || artist.id;

      await apiService.updateProfile(artistId, {
        travelSchedule: updatedSchedule
      });

      console.log('[ManageArtistScreen] Travel schedule deleted successfully, refreshing profile');

      // Refresh artist profile from backend to get latest data
      const freshProfile = await apiService.getProfile(artistId);

      // Update artist profile state with fresh data
      setArtistProfile(freshProfile);
      setTravelSchedule(freshProfile.travelSchedule || []);

      console.log('[ManageArtistScreen] Profile refreshed with latest data');

      // Close confirmation dialog
      setShowDeleteConfirmation(false);
      setScheduleToDelete(null);
    } catch (error) {
      console.error('[ManageArtistScreen] Failed to delete travel schedule:', error);
      // Revert on error
      setTravelSchedule(previousSchedule);

      // Check if it's an authentication error
      if (error.message && error.message.includes('Token expired')) {
        alert('Your session has expired. Please log out and log back in.');
      } else if (error.message && error.message.includes('Unauthorized')) {
        alert('Authentication error. Please log out and log back in.');
      } else {
        alert('Failed to delete travel schedule: ' + (error.message || 'Please try again'));
      }

      // Close confirmation dialog
      setShowDeleteConfirmation(false);
      setScheduleToDelete(null);
    }
  };

  const cancelDeleteSchedule = () => {
    setShowDeleteConfirmation(false);
    setScheduleToDelete(null);
  };

  // Artist info save function (full profile edit)
  const handleSaveArtistInfo = async () => {
    try {
      const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id;

      if (!artistId) {
        alert('Artist ID not found');
        return;
      }

      // Update profile with all edited info
      const updatedData = {
        name: editedArtistInfo.name,
        role: editedArtistInfo.role,
        bio: editedArtistInfo.bio,
        genres: Array.from(selectedGenres),
        location: editedArtistInfo.location,
        zone: editedArtistInfo.zone,
        country: editedArtistInfo.country,
        city: editedArtistInfo.city,
        mixtape: editedArtistInfo.mixtape,
        spotify: editedArtistInfo.spotify,
        residentAdvisor: editedArtistInfo.residentAdvisor,
        instagram: editedArtistInfo.instagram,
        website: editedArtistInfo.website
      };

      if (editedArtistInfo.role === 'VENUE') {
        updatedData.capacity = editedArtistInfo.capacity;
      }

      await apiService.updateProfile(artistId, updatedData);

      // Fetch fresh profile data from backend to ensure sync
      const freshProfile = await apiService.getProfile(artistId);

      // Update local state with fresh data
      setArtistProfile(freshProfile);

      // Update selected genres to match fresh data
      setSelectedGenres(new Set(freshProfile.genres || []));

      // Always reload profile data to ensure sync across all views
      // This will update:
      // - Artist's own profile if they're viewing it
      // - Agent's profile with updated representingArtists array
      console.log('[ManageArtistScreen] Reloading AppContext profile data to sync changes');
      await reloadProfileData();

      console.log('[ManageArtistScreen] Artist info updated, profile refreshed with latest data');

      // Close edit screen
      setIsEditingArtistInfo(false);
      alert('Artist information updated successfully!');
    } catch (error) {
      console.error('Failed to update artist info:', error);
      alert('Failed to update artist information. Please try again.');
    }
  };

  // Genre toggle handler
  const handleGenreToggle = (genre) => {
    const newGenres = new Set(selectedGenres);
    if (newGenres.has(genre)) {
      newGenres.delete(genre);
    } else {
      newGenres.add(genre);
    }
    setSelectedGenres(newGenres);
  };

  const getLocationDisplay = (schedule) => {
    const parts = [];

    // Add each location part if it exists and is not empty
    if (schedule.city && schedule.city.trim()) {
      parts.push(schedule.city);
    }
    if (schedule.country && schedule.country.trim()) {
      parts.push(schedule.country);
    }
    if (schedule.zone && schedule.zone.trim()) {
      parts.push(schedule.zone);
    }

    // Return all parts joined with commas, or fallback
    return parts.length > 0 ? parts.join(', ') : 'No location';
  };

  const formatScheduleDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyWithSymbol = (amount, currency = 'USD') => {
    const symbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥'
    };

    const symbol = symbols[currency] || '$';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

    return `${symbol}${formatted}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return '✅';
      case 'pending-payment': return '⏳';
      case 'offer-pending': return '📝';
      default: return '📅';
    }
  };

  const getCurrencySymbol = (currency = 'USD') => {
    const symbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥'
    };
    return symbols[currency] || '$';
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'contract_to_send':
      case 'contract_to_sign':
        return <FileIcon />;
      case 'payment_to_mark_sent':
      case 'payment_to_confirm_received':
        return <DollarIcon />;
      case 'representation_request_received':
        return <MailIcon />;
      default:
        return <AlertIcon />;
    }
  };

  const renderDashboardTab = () => (
    <div className="dashboard-tab">
      {/* Hero Metrics - 2x2 Grid */}
      <div className="hero-metrics hero-metrics-four">
        {/* Top Row */}
        <div className="metric-card">
          <div className="metric-icon"><CalendarIcon /></div>
          <div className="metric-value">
            {thisYearGigs === null ? '...' : thisYearGigs}
          </div>
          <div className="metric-label">This Year Bookings</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><DollarIcon /></div>
          <div className="metric-value">
            {ytdRevenue === null ? '...' : formatCurrencyWithSymbol(ytdRevenue, preferredCurrency)}
          </div>
          <div className="metric-label">This Year Revenue</div>
        </div>
        {/* Bottom Row */}
        <div className="metric-card">
          <div className="metric-icon"><CalendarIcon /></div>
          <div className="metric-value">
            {upcomingGigs === null ? '...' : upcomingGigs}
            {gigsError && <span style={{ fontSize: '12px', color: '#999' }}>*</span>}
          </div>
          <div className="metric-label">Upcoming Bookings</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><DollarIcon /></div>
          <div className="metric-value">
            {expectedRevenue === null ? '...' : formatCurrencyWithSymbol(expectedRevenue, preferredCurrency)}
          </div>
          <div className="metric-label">Expected Revenue</div>
        </div>
      </div>

      {/* Action Items */}
      <div className="dashboard-section">
        <div className="section-header">
          <h3><AlertIcon /> Actions Required</h3>
          <span className="badge">{actionItems.length}</span>
        </div>
        <div className="action-items">
          {actionItems.length === 0 ? (
            <div className="action-empty">Nothing needs your attention for this artist right now.</div>
          ) : (
            actionItems.map(item => (
              <div key={item.id} className="action-item">
                <div className="action-icon">{getActionIcon(item.type)}</div>
                <div className="action-content">
                  <div className="action-title">{item.title}</div>
                  {item.subtitle && <div className="action-description">{item.subtitle}</div>}
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => handleActionClick(item.target)}>
                  {item.actionLabel}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="dashboard-section revenue-overview-section">
        <h3><TrendingUpIcon /> Revenue Overview</h3>
        <div className="revenue-chart-scroll">
          <div className="revenue-chart" style={{ minHeight: '200px' }}>
            {revenueChartData.length > 0 ? (
              (() => {
                // Calculate maxRevenue once outside the loop
                const maxRevenue = Math.max(...revenueChartData.map(d => d.amount), 1);
                const currencySymbol = getCurrencySymbol(preferredCurrency);

                return revenueChartData.map((item) => {
                  const height = maxRevenue > 0 ? (item.amount / maxRevenue) * 100 : 0;

                  return (
                    <div key={item.monthKey} className="chart-bar-container">
                      <div className="chart-bar" style={{ height: `${Math.max(height, 2)}%` }}>
                        {item.amount > 0 && (
                          <div className="chart-value">
                            {currencySymbol}{item.amount >= 1000 ? Math.round(item.amount / 1000) + 'K' : Math.round(item.amount)}
                          </div>
                        )}
                      </div>
                      <div className="chart-label">
                        {item.month}
                        <div className="chart-year">{item.year}</div>
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <div className="no-revenue-data">Loading revenue data...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderInlineCalendar = () => {
    const getDaysInMonth = (month, year) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month, year) => {
      return new Date(year, month, 1).getDay();
    };

    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth, currentYear);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Save available dates to backend
    const saveAvailableDatesToBackend = async (dates) => {
      try {
        const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id;

        if (!artistId) {
          console.error('[ManageArtistScreen] Cannot save available dates - Artist ID is missing');
          return;
        }

        console.log('[ManageArtistScreen] Saving available dates to backend for artist:', artistId, 'dates:', Array.from(dates));

        await apiService.updateProfile(artistId, {
          availableDates: Array.from(dates)
        });

        console.log('[ManageArtistScreen] Available dates saved successfully');

        // NOTE: We don't refresh the profile here because it would reset selectedDates
        // while the user is still clicking/dragging. The profile gets refreshed on mount.
      } catch (error) {
        console.error('[ManageArtistScreen] Failed to save available dates:', error);
      }
    };

    const handleDateClick = async (day) => {
      const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
      const newSelected = new Set(selectedDates);

      if (newSelected.has(dateKey)) {
        newSelected.delete(dateKey);
      } else {
        newSelected.add(dateKey);
      }

      setSelectedDates(newSelected);

      // Save to backend immediately
      await saveAvailableDatesToBackend(newSelected);
    };

    const handleDragStart = (day) => {
      setIsDragging(true);
      setDragStartDate(day);
      setIsActuallyDragging(false);
    };

    const handleDragEnter = (day) => {
      if (isDragging && dragStartDate) {
        setIsActuallyDragging(true);
        const start = Math.min(dragStartDate, day);
        const end = Math.max(dragStartDate, day);
        const startDateKey = `${currentYear}-${currentMonth + 1}-${dragStartDate}`;
        const newSelected = new Set();

        // Check if we're selecting or deselecting based on the start date
        const isSelecting = !selectedDates.has(startDateKey);

        // Copy all existing selected dates
        selectedDates.forEach(date => newSelected.add(date));

        for (let i = start; i <= end; i++) {
          const dateKey = `${currentYear}-${currentMonth + 1}-${i}`;
          if (isSelecting) {
            newSelected.add(dateKey);
          } else {
            newSelected.delete(dateKey);
          }
        }

        setSelectedDates(newSelected);
      }
    };

    const handleDragEnd = async () => {
      setIsDragging(false);
      setDragStartDate(null);
      setIsActuallyDragging(false);

      // Save to backend after drag completes
      await saveAvailableDatesToBackend(selectedDates);
    };

    const handleTouchStart = (day) => {
      handleDragStart(day);
    };

    const handleTouchMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && element.classList.contains('calendar-day') && !element.classList.contains('empty')) {
          const day = parseInt(element.textContent);
          if (!isNaN(day)) {
            handleDragEnter(day);
          }
        }
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    const getSchedulePosition = (day) => {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const current = new Date(dateStr);

      for (const schedule of travelSchedule) {
        const start = new Date(schedule.startDate);
        const end = new Date(schedule.endDate);

        if (current >= start && current <= end) {
          const isStart = current.getTime() === start.getTime();
          const isEnd = current.getTime() === end.getTime();
          const isSingle = isStart && isEnd;

          return {
            hasSchedule: true,
            isStart: isStart && !isSingle,
            isEnd: isEnd && !isSingle,
            isSingle: isSingle,
            isMiddle: !isStart && !isEnd,
            schedule: schedule  // Include the schedule object
          };
        }
      }

      return { hasSchedule: false };
    };

    const getLocationDisplayText = (schedule) => {
      if (!schedule) return '';
      // Priority: City → Country → Zone
      if (schedule.city) return schedule.city;
      if (schedule.country) return schedule.country;
      if (schedule.zone) return schedule.zone;
      return '';
    };

    const renderCalendarDays = () => {
      const days = [];
      const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

      // Render weekday headers
      weekDays.forEach(day => {
        days.push(
          <div key={`header-${day}`} className="calendar-weekday">
            {day}
          </div>
        );
      });

      // Empty cells for days before month starts
      for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(
          <div key={`empty-${i}`} className="calendar-day empty"></div>
        );
      }

      // Render days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${currentMonth + 1}-${day}`;
        const isSelected = selectedDates.has(dateKey);
        const schedulePos = getSchedulePosition(day);

        let scheduleClasses = '';
        if (schedulePos.hasSchedule) {
          if (schedulePos.isSingle) {
            scheduleClasses = 'schedule-single';
          } else if (schedulePos.isStart) {
            scheduleClasses = 'schedule-start';
          } else if (schedulePos.isEnd) {
            scheduleClasses = 'schedule-end';
          } else if (schedulePos.isMiddle) {
            scheduleClasses = 'schedule-middle';
          }
        }

        days.push(
          <div
            key={`day-${day}`}
            className={`calendar-day ${isSelected ? 'available' : ''} ${scheduleClasses}`}
            onClick={(e) => {
              if (!isActuallyDragging) {
                handleDateClick(day);
              }
            }}
            onMouseDown={(e) => {
              if (e.button === 2) return; // Ignore right-click
              e.preventDefault();
              handleDragStart(day);
            }}
            onMouseUp={() => {
              handleDragEnd();
            }}
            onMouseEnter={() => handleDragEnter(day)}
            onTouchStart={() => {
              handleTouchStart(day);
            }}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => {
              handleTouchEnd();
            }}
          >
            {day}
            {schedulePos.hasSchedule && (
              <div className="schedule-label">
                {getLocationDisplayText(schedulePos.schedule)}
              </div>
            )}
          </div>
        );
      }

      return days;
    };

    return (
      <div className="calendar-inline-wrapper">
        <div className="calendar-header-inline">
          <button className="calendar-nav-btn" onClick={goToPreviousMonth}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 16L6 10L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="calendar-month-info">
            <h4>{monthNames[currentMonth]} {currentYear}</h4>
            <p className="calendar-instructions">
              Tap dates to mark availability. Drag to select multiple dates.
            </p>
          </div>
          <button className="calendar-nav-btn" onClick={goToNextMonth}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M8 16L14 10L8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="calendar-grid">
          {renderCalendarDays()}
        </div>

        <div className="calendar-legend">
          <div className="legend-item">
            <span className="legend-dot available"></span>
            <span>Available</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot unavailable"></span>
            <span>Unavailable</span>
          </div>
        </div>
      </div>
    );
  };

  const renderUpcomingEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter upcoming deals
    const upcomingDeals = deals.filter(deal => {
      const dealDate = new Date(deal.date);
      dealDate.setHours(0, 0, 0, 0);
      return dealDate >= today && deal.status !== 'DECLINED';
    });

    // Cluster deals by month/year
    const clusters = {};
    upcomingDeals.forEach(deal => {
      const date = new Date(deal.date);
      const monthYear = `${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`;

      if (!clusters[monthYear]) {
        clusters[monthYear] = {
          monthYear,
          date: date,
          deals: []
        };
      }
      clusters[monthYear].deals.push(deal);
    });

    // Sort clusters by date (ascending for upcoming)
    const sortedClusters = Object.values(clusters).sort((a, b) => a.date - b.date);

    // Sort deals within each cluster
    sortedClusters.forEach(cluster => {
      cluster.deals.sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    };

    const getStatusBadgeClass = (status) => {
      switch (status) {
        case 'PENDING':
          return 'status-badge status-pending';
        case 'NEGOTIATING':
          return 'status-badge status-negotiating';
        case 'ACCEPTED':
          return 'status-badge status-accepted';
        case 'COMPLETED':
          return 'status-badge status-completed';
        default:
          return 'status-badge';
      }
    };

    const toggleDealExpanded = (dealId) => {
      setExpandedDealId(expandedDealId === dealId ? null : dealId);
    };

    if (upcomingDeals.length === 0) {
      return (
        <div className="no-events-message">
          <p>Coming Soon</p>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
            This feature is currently in development
          </p>
        </div>
      );
    }

    return (
      <div className="events-list-by-month">
        {sortedClusters.map(cluster => (
          <div key={cluster.monthYear} className="events-month-cluster">
            <div className="month-year-header">{cluster.monthYear}</div>
            <div className="bookings-list">
              {cluster.deals.map(deal => {
                const isExpanded = expandedDealId === deal.id;
                const dealDate = new Date(deal.date);
                const dayNumber = dealDate.getDate();
                const otherParty = deal.venue || deal.artist || {};

                // Check if this is a deal viewed by the artist via their agent
                const artistProfileId = artist.profileId || artist.id || artist.id;
                const isViaAgent = deal.artistId && deal.artistId === artistProfileId && deal.artist.id !== artistProfileId;

                return (
                  <div key={deal.id} className={`booking-card ${isExpanded ? 'expanded' : ''}`}>
                    <div className="booking-date-badge">
                      {dayNumber}
                    </div>
                    <div className="booking-compact-view">
                      <div
                        className="party-avatar"
                        onClick={() => toggleDealExpanded(deal.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {otherParty.avatar ? (
                          <img src={otherParty.avatar} alt={otherParty.name} />
                        ) : (
                          otherParty.name?.charAt(0).toUpperCase() || '?'
                        )}
                      </div>

                      <div
                        className="party-info"
                        onClick={() => toggleDealExpanded(deal.id)}
                        style={{ cursor: 'pointer', flex: 1 }}
                      >
                        <div className="party-name-role">
                          <h3>{otherParty.name || 'Unknown'}</h3>
                          {otherParty.role && (
                            <span className={`role-badge ${otherParty.role.toLowerCase()}`}>
                              {otherParty.role}
                            </span>
                          )}
                        </div>
                        <p className="party-location">{otherParty.location || 'Location TBD'}</p>
                        <div className="party-status-row">
                          <span className={getStatusBadgeClass(deal.status)}>
                            {deal.status}
                          </span>
                          {isViaAgent && (
                            <span className="via-agent-badge">
                              via agent
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        className="btn-expand-arrow"
                        onClick={() => toggleDealExpanded(deal.id)}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="booking-details">
                        {deal.eventName && (
                          <div className="booking-detail-row">
                            <span className="detail-label">Event:</span>
                            <span className="detail-value">{deal.eventName}</span>
                          </div>
                        )}
                        {deal.artistName && (
                          <div className="booking-detail-row">
                            <span className="detail-label">Artist:</span>
                            <span className="detail-value">{deal.artistName}</span>
                          </div>
                        )}
                        <div className="booking-detail-row">
                          <span className="detail-label">Venue:</span>
                          <span className="detail-value">
                            <div>{deal.venueName}</div>
                            {deal.venue?.location && (
                              <div className="detail-subtext">({deal.venue.location})</div>
                            )}
                          </span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="detail-label">Date:</span>
                          <span className="detail-value">{formatDate(deal.date)}</span>
                        </div>
                        {deal.startTime && deal.endTime && (
                          <div className="booking-detail-row">
                            <span className="detail-label">Event Time:</span>
                            <span className="detail-value">
                              {deal.startTime} - {deal.endTime}
                            </span>
                          </div>
                        )}
                        {deal.performanceType && (
                          <div className="booking-detail-row">
                            <span className="detail-label">Type:</span>
                            <span className="detail-value">{deal.performanceType}</span>
                          </div>
                        )}
                        {deal.setStartTime && deal.setEndTime && (
                          <div className="booking-detail-row">
                            <span className="detail-label">Set Time:</span>
                            <span className="detail-value">
                              {deal.setStartTime} - {deal.setEndTime}
                            </span>
                          </div>
                        )}
                        <div className="booking-detail-row">
                          <span className="detail-label">Fee:</span>
                          <span className="detail-value">
                            {deal.currency}{parseInt(deal.currentFee).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEventsTab = () => (
    <div className="events-tab">
      {/* Calendar View */}
      <div className="dashboard-section">
        <h3><CalendarIcon /> Calendar View</h3>
        {renderInlineCalendar()}

        {/* Travel Schedules */}
        <div className="travel-schedules-section">
          <div className="travel-schedules-header">
            <h3><PlaneIcon /> Travel Schedules</h3>
            <button className="btn btn-primary btn-sm" onClick={openTravelModal}>Add Schedule</button>
          </div>

          {travelSchedule.length === 0 ? (
            <div className="travel-schedules-empty">
              <p>No schedules added yet</p>
              <button className="btn-add-travel-schedule" onClick={openTravelModal}>
                + ADD TRAVEL SCHEDULE
              </button>
            </div>
          ) : (
            <div className="travel-schedules-list">
              {travelSchedule.map((schedule, index) => (
                <div key={index} className="travel-schedule-item">
                  <div className="schedule-location">
                    {getLocationDisplay(schedule)}
                  </div>
                  <div className="schedule-bottom-row">
                    {formatScheduleDate(schedule.startDate)} - {formatScheduleDate(schedule.endDate)}
                    <button className="icon-btn-edit" onClick={() => editTravelSchedule(index)} title="Edit schedule">
                      <EditIcon />
                    </button>
                    <button className="icon-btn-delete" onClick={() => deleteTravelSchedule(index)} title="Delete schedule">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event List */}
      <div className="dashboard-section">
        <div className="section-header">
          <h3><ListIcon /> Upcoming Events</h3>
        </div>
        {renderUpcomingEvents()}
      </div>
    </div>
  );

  // Document Management Functions
  const handleAddDocument = (category) => {
    setDocCategory(category);
    setNewDoc({ title: '', url: '' });
    setEditingDoc(null);
    setShowAddDocModal(true);
  };

  const handleEditDocument = (category, doc) => {
    setDocCategory(category);
    setNewDoc({ title: doc.title, url: doc.url });
    setEditingDoc(doc);
    setShowAddDocModal(true);
  };

  const handleSaveDocument = async () => {
    if (!newDoc.title || !newDoc.url) {
      alert('Please provide both title and URL');
      return;
    }

    const updatedDocuments = { ...documents };

    if (editingDoc) {
      // Edit existing document
      const index = updatedDocuments[docCategory].findIndex(d => d.id === editingDoc.id);
      if (index !== -1) {
        updatedDocuments[docCategory][index] = {
          ...editingDoc,
          title: newDoc.title,
          url: newDoc.url
        };
      }
    } else {
      // Add new document
      const newDocument = {
        id: Date.now().toString(),
        title: newDoc.title,
        url: newDoc.url,
        addedDate: new Date().toISOString()
      };
      updatedDocuments[docCategory].push(newDocument);
    }

    console.log('[ManageArtistScreen] Saving documents:', updatedDocuments);
    setDocuments(updatedDocuments);

    // Save to backend
    try {
      const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id;
      console.log('[ManageArtistScreen] Artist ID for save:', artistId);
      console.log('[ManageArtistScreen] Current user ID:', user.id);
      console.log('[ManageArtistScreen] Are they equal?', user.id === artistId);
      console.log('[ManageArtistScreen] artistProfile object:', artistProfile);

      if (artistId) {
        console.log('[ManageArtistScreen] Calling API to save documents...');
        const response = await apiService.updateProfile(artistId, { documents: updatedDocuments });
        console.log('[ManageArtistScreen] API response:', response);

        // Refetch the profile to get updated data
        console.log('[ManageArtistScreen] Refetching profile data...');
        const freshProfile = await apiService.getProfile(artistId);
        console.log('[ManageArtistScreen] Fresh profile received:', freshProfile);
        setArtistProfile(freshProfile);
        console.log('[ManageArtistScreen] Documents in fresh profile:', freshProfile.documents);

        // If this is the current user's profile, reload global context
        console.log('[ManageArtistScreen] Checking if should reload global context...');
        console.log('[ManageArtistScreen] Comparing user.id:', user.id, 'with artistId:', artistId);
        if (user.id === artistId || user.id === freshProfile.id) {
          console.log('[ManageArtistScreen] ✅ This is current user, reloading global context');
          await reloadProfileData();
        } else {
          console.log('[ManageArtistScreen] ❌ Not current user, skipping global context reload');
        }
      } else {
        console.error('[ManageArtistScreen] No artist ID found!');
      }
    } catch (error) {
      console.error('[ManageArtistScreen] Error saving documents:', error);
      alert('Failed to save document. Please try again.');
    }

    setShowAddDocModal(false);
    setNewDoc({ title: '', url: '' });
    setEditingDoc(null);
  };

  const handleDeleteDocument = async (category, docId) => {
    if (!window.confirm('Are you sure you want to delete this document link?')) {
      return;
    }

    const updatedDocuments = { ...documents };
    updatedDocuments[category] = updatedDocuments[category].filter(d => d.id !== docId);
    setDocuments(updatedDocuments);

    // Save to backend
    try {
      const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id;
      if (artistId) {
        await apiService.updateProfile(artistId, { documents: updatedDocuments });
        console.log('[ManageArtistScreen] Document deleted and saved to backend');

        // Refetch profile
        const freshProfile = await apiService.getProfile(artistId);
        setArtistProfile(freshProfile);

        // If this is the current user's profile, reload global context
        console.log('[ManageArtistScreen] Delete - Comparing user.id:', user.id, 'with artistId:', artistId);
        if (user.id === artistId || user.id === freshProfile.id) {
          console.log('[ManageArtistScreen] ✅ This is current user, reloading global context after delete');
          await reloadProfileData();
        } else {
          console.log('[ManageArtistScreen] ❌ Not current user after delete');
        }
      }
    } catch (error) {
      console.error('[ManageArtistScreen] Error deleting document:', error);
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      pressKit: 'Press Kit',
      technicalRider: 'Technical Rider',
      contracts: 'Contract'
    };
    return labels[category] || category;
  };

  // Documents Tab (Press Kit, Technical Riders, Contracts)
  const renderDocumentsTab = () => {
    const renderDocCategory = (category, icon, title, note = null) => (
      <div className="dashboard-section" key={category}>
        <div className="section-header">
          <h3>{icon} {title}</h3>
          {documents[category].length > 0 && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleAddDocument(category)}
            >
              + Add
            </button>
          )}
        </div>

        {documents[category].length === 0 ? (
          <div style={{
            padding: '20px 24px',
            textAlign: 'center'
          }}>
            {note && (
              <div style={{
                marginBottom: '12px',
                fontSize: '13px',
                color: '#888'
              }}>
                {note}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={() => handleAddDocument(category)}
              style={{
                padding: '10px 20px',
                fontSize: '14px'
              }}
            >
              + Add
            </button>
          </div>
        ) : (
          <div className="doc-list">
            {documents[category].map(doc => (
              <div key={doc.id} className="doc-item">
                <div className="doc-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="doc-name">{doc.title}</div>
                  <div className="doc-meta">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#FF3366',
                        textDecoration: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                        marginBottom: '4px'
                      }}
                    >
                      {doc.url}
                    </a>
                    {doc.addedDate && (
                      <div style={{
                        color: '#666',
                        fontSize: '12px'
                      }}>
                        + Added {new Date(doc.addedDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleEditDocument(category, doc)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDeleteDocument(category, doc.id)}
                    style={{ color: '#ff4444' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div className="artist-info-tab">
        {renderDocCategory('pressKit', <ImageIcon />, 'Press Kit', 'Add press photos, bio, EPK, or music samples')}
        {renderDocCategory('technicalRider', <SlidersIcon />, 'Technical Rider', 'Add tech rider, stage plot, or hospitality requirements')}
        {renderDocCategory('contracts', <FileTextIcon />, 'Contracts', 'Add contract templates. These can be customized per booking.')}
      </div>
    );
  };

  // Artist Info Tab (Editable Profile Information)
  const renderArtistInfoTab = () => {
    // Helper to get SoundCloud embed URL
    const getSoundCloudEmbedUrl = (url) => {
      if (!url) return null;
      let soundcloudUrl = url;
      if (soundcloudUrl.includes('m.soundcloud.com')) {
        soundcloudUrl = soundcloudUrl.replace('m.soundcloud.com', 'soundcloud.com');
      }
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(soundcloudUrl)}&color=%23ff3366&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
    };

    // Helper to get Spotify embed URL
    const getSpotifyEmbedUrl = (url) => {
      if (!url) return null;
      if (url.includes('/artist/')) {
        const artistId = url.split('/artist/')[1]?.split('?')[0];
        return `https://open.spotify.com/embed/artist/${artistId}`;
      }
      return url;
    };

    return (
      <div className="artist-info-tab">
        {/* Profile Info Box */}
        <div style={{
          padding: '20px',
          marginBottom: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          lineHeight: '1.4'
        }}>
          {/* Name */}
          <div style={{
            fontSize: '14px',
            fontWeight: '400',
            marginBottom: '4px',
            color: '#fff'
          }}>
            {artistProfile?.name || 'Artist Name'}
          </div>

          {/* Location */}
          {artistProfile?.location && (
            <div style={{
              fontSize: '14px',
              fontWeight: '400',
              color: '#888',
              marginBottom: '4px'
            }}>
              {artistProfile.location}
            </div>
          )}

          {/* Role */}
          {artistProfile?.role && (
            <div style={{
              fontSize: '14px',
              fontWeight: '400',
              color: '#e0e0e0',
              marginBottom: '4px'
            }}>
              {artistProfile.role}
            </div>
          )}

          {/* Genres */}
          {artistProfile?.genres && artistProfile.genres.length > 0 && (
            <div style={{
              fontSize: '14px',
              fontWeight: '400',
              color: '#888'
            }}>
              {artistProfile.genres.join(', ')}
            </div>
          )}
        </div>

        {/* Bio Section */}
        <div className="profile-bio" style={{
          padding: '20px',
          marginBottom: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          lineHeight: '1.6'
        }}>
          <p style={{ margin: 0, color: '#e0e0e0' }}>
            {artistProfile?.bio || 'No bio available'}
          </p>
        </div>

        {/* Latest Mix */}
        {artistProfile?.mixtape && (
          <div className="media-section" style={{ marginBottom: '24px' }}>
            <h3 style={{
              color: '#ff3366',
              fontSize: '12px',
              fontWeight: '600',
              letterSpacing: '1px',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              LATEST MIX
            </h3>
            <iframe
              src={getSoundCloudEmbedUrl(artistProfile.mixtape)}
              className="embed-iframe soundcloud-embed"
              title="SoundCloud Mix"
              allow="autoplay"
            />
          </div>
        )}

        {/* Spotify Artist */}
        {artistProfile?.role === 'ARTIST' && artistProfile?.spotify && (
          <div className="media-section" style={{ marginBottom: '24px' }}>
            <h3 style={{
              color: '#ff3366',
              fontSize: '12px',
              fontWeight: '600',
              letterSpacing: '1px',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              SPOTIFY ARTIST
            </h3>
            <iframe
              src={getSpotifyEmbedUrl(artistProfile.spotify)}
              className="embed-iframe spotify-embed"
              title="Spotify Artist Profile"
              allow="encrypted-media"
            />
          </div>
        )}

        {/* Events Section - RA Link */}
        {artistProfile?.role === 'ARTIST' && artistProfile?.residentAdvisor && (
          <div className="media-section" style={{ marginBottom: '24px' }}>
            <h3 style={{
              color: '#ff3366',
              fontSize: '12px',
              fontWeight: '600',
              letterSpacing: '1px',
              marginBottom: '12px',
              textTransform: 'uppercase'
            }}>
              EVENTS
            </h3>
            <button
              className="btn btn-outline"
              onClick={() => setShowRAEvents(true)}
              style={{
                width: '100%',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>View Upcoming Events</span>
            </button>
            <a
              href={artistProfile.residentAdvisor}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                marginTop: '16px',
                textAlign: 'center',
                color: '#888',
                fontSize: '14px',
                textDecoration: 'none'
              }}
            >
              View Full RA Profile →
            </a>
          </div>
        )}

        {/* Social Links */}
        <div className="social-links-buttons" style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          {artistProfile?.instagram && (
            <a
              href={`https://instagram.com/${artistProfile.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{ flex: '1', minWidth: '140px' }}
            >
              <span>Instagram</span>
            </a>
          )}
          {artistProfile?.website && (
            <a
              href={artistProfile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{ flex: '1', minWidth: '140px' }}
            >
              <span>Website</span>
            </a>
          )}
        </div>

        {/* Edit Button */}
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={async () => {
            try {
              // Fetch absolutely fresh data from backend before opening modal
              const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id || artist.id;
              console.log('[ManageArtistScreen] Fetching fresh profile before edit, artistId:', artistId);

              const freshProfile = await apiService.getProfile(artistId);
              console.log('[ManageArtistScreen] Fresh profile fetched:', freshProfile);

              // Update artistProfile state
              setArtistProfile(freshProfile);

              // Set form data with absolutely fresh data
              const freshData = {
                name: freshProfile?.name || '',
                role: freshProfile?.role || '',
                bio: freshProfile?.bio || '',
                genres: freshProfile?.genres || [],
                mixtape: freshProfile?.mixtape || '',
                spotify: freshProfile?.spotify || '',
                residentAdvisor: freshProfile?.residentAdvisor || '',
                instagram: freshProfile?.instagram || '',
                website: freshProfile?.website || '',
                location: freshProfile?.location || '',
                capacity: freshProfile?.capacity || '',
                zone: freshProfile?.zone || '',
                country: freshProfile?.country || '',
                city: freshProfile?.city || ''
              };

              console.log('[ManageArtistScreen] Setting editedArtistInfo to:', freshData);

              setEditedArtistInfo(freshData);
              setSelectedGenres(new Set(freshProfile?.genres || []));
              setIsEditingArtistInfo(true);
            } catch (error) {
              console.error('[ManageArtistScreen] Error fetching fresh profile:', error);
              alert('Failed to load artist data. Please try again.');
            }
          }}
        >
          Edit Artist Info
        </button>
      </div>
    );
  };

  // Render edit artist info form (full page)
  const renderEditArtistInfoForm = () => {
    return (
      <>
        <div className="edit-section">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              className="form-input"
              value={editedArtistInfo.name}
              disabled
              placeholder="Artist Name"
              style={{
                backgroundColor: '#0d0d0d',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            />
            <p style={{
              fontSize: '11px',
              color: '#666',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              Name cannot be changed by agents
            </p>
          </div>
          <div className="form-group">
            <label>Role</label>
            <select
              className="form-input"
              value={editedArtistInfo.role}
              disabled
              style={{
                backgroundColor: '#0d0d0d',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            >
              <option value="ARTIST">Artist</option>
              <option value="VENUE">Venue</option>
              <option value="PROMOTER">Promoter</option>
              <option value="AGENT">Agent</option>
            </select>
            <p style={{
              fontSize: '11px',
              color: '#666',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              Role cannot be changed by agents
            </p>
          </div>
          <div className="form-group">
            <label>Zone</label>
            <select
              className="form-input"
              value={editedArtistInfo.zone}
              onChange={(e) => handleArtistZoneChange(e.target.value)}
            >
              <option value="">Select Zone</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
          {editedArtistInfo.zone && (
            <div className="form-group">
              <label>Country</label>
              <select
                className="form-input"
                value={editedArtistInfo.country}
                onChange={(e) => handleArtistCountryChange(e.target.value)}
              >
                <option value="">Select Country</option>
                {countriesByZone[editedArtistInfo.zone]?.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}
          {editedArtistInfo.country && (
            <div className="form-group">
              <label>City</label>
              <select
                className="form-input"
                value={editedArtistInfo.city}
                onChange={(e) => handleArtistCityChange(e.target.value)}
              >
                <option value="">Select City</option>
                {citiesByCountry[editedArtistInfo.country]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}
          {editedArtistInfo.role === 'VENUE' && (
            <div className="form-group">
              <label>Capacity</label>
              <input
                type="number"
                className="form-input"
                value={editedArtistInfo.capacity}
                onChange={(e) => setEditedArtistInfo({...editedArtistInfo, capacity: e.target.value})}
                placeholder="Max capacity"
              />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>Bio</label>
            <textarea
              className="form-input"
              rows="4"
              value={editedArtistInfo.bio}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, bio: e.target.value})}
              placeholder="Tell us about the artist..."
            />
          </div>
        </div>

        <div className="edit-section" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label>Genres</label>
            <div
              className="genres-dropdown-trigger"
              onClick={() => setShowGenresDropdown(!showGenresDropdown)}
            >
              <span className="genres-selected-text">
                {selectedGenres.size > 0
                  ? `${selectedGenres.size} genre${selectedGenres.size > 1 ? 's' : ''} selected`
                  : 'Select genres'}
              </span>
              <span className="dropdown-arrow">{showGenresDropdown ? '▲' : '▼'}</span>
            </div>

            {showGenresDropdown && (
              <div className="genres-dropdown-content">
                <div className="genres-grid">
                  {(showAllGenres ? genresList : genresList.slice(0, 12)).map(genre => (
                    <label key={genre} className="genre-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedGenres.has(genre)}
                        onChange={() => handleGenreToggle(genre)}
                      />
                      <span className={selectedGenres.has(genre) ? 'selected' : ''}>
                        {genre}
                      </span>
                    </label>
                  ))}
                </div>
                {genresList.length > 12 && (
                  <button
                    className="show-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllGenres(!showAllGenres);
                    }}
                  >
                    {showAllGenres ? 'Show less' : `Show all ${genresList.length} genres`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="edit-section">
          <h3>Social Links</h3>
          <div className="form-group">
            <label>SoundCloud/Mixtape</label>
            <input
              type="url"
              className="form-input"
              value={editedArtistInfo.mixtape}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, mixtape: e.target.value})}
              placeholder="https://soundcloud.com/..."
            />
            <p style={{
              fontSize: '11px',
              color: '#888',
              marginTop: '4px',
              lineHeight: '1.4'
            }}>
              💡 If using a share link: Open it in your web browser, then copy the full URL from the address bar
            </p>
          </div>
          {editedArtistInfo.role === 'ARTIST' && (
            <>
              <div className="form-group">
                <label>Spotify Artist</label>
                <input
                  type="url"
                  className="form-input"
                  value={editedArtistInfo.spotify}
                  onChange={(e) => setEditedArtistInfo({...editedArtistInfo, spotify: e.target.value})}
                  placeholder="https://open.spotify.com/artist/..."
                />
                <p style={{
                  fontSize: '11px',
                  color: '#888',
                  marginTop: '4px',
                  lineHeight: '1.4'
                }}>
                  💡 If using a share link: Open it in your web browser, then copy the full URL from the address bar
                </p>
              </div>
              <div className="form-group">
                <label>Resident Advisor</label>
                <input
                  type="url"
                  className="form-input"
                  value={editedArtistInfo.residentAdvisor}
                  onChange={(e) => setEditedArtistInfo({...editedArtistInfo, residentAdvisor: e.target.value})}
                  placeholder="https://ra.co/dj/..."
                />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Instagram</label>
            <input
              type="text"
              className="form-input"
              value={editedArtistInfo.instagram}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, instagram: e.target.value})}
              placeholder="@username"
            />
          </div>
          <div className="form-group">
            <label>Website</label>
            <input
              type="url"
              className="form-input"
              value={editedArtistInfo.website}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, website: e.target.value})}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="form-actions" style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '10px',
          justifyContent: 'flex-end',
          padding: '16px 20px',
          borderTop: '1px solid #2a2a2a',
          marginTop: '20px'
        }}>
          <button
            className="btn btn-secondary"
            onClick={() => setIsEditingArtistInfo(false)}
            style={{ flex: 'none', minWidth: '120px' }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveArtistInfo}
            style={{ flex: 'none', minWidth: '140px' }}
          >
            Save Changes
          </button>
        </div>
      </>
    );
  };

  // If editing artist info, show full-page edit screen
  if (isEditingArtistInfo) {
    return (
      <div className="screen active edit-profile-screen">
        <div className="edit-profile-header">
          <button className="back-btn" onClick={() => setIsEditingArtistInfo(false)}>
            <CloseIcon />
          </button>
          <h1>Edit Artist Info</h1>
          <div style={{ width: '24px' }}></div>
        </div>
        <div className="edit-profile-content">
          {renderEditArtistInfoForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="screen active manage-artist-screen">
      <div className="manage-artist-header">
        <button className="back-btn" onClick={onClose}>
          <CloseIcon />
        </button>
        <h1>Manage</h1>
      </div>

      {/* Artist Info Bar */}
      <div className="artist-info-bar">
        <div className="artist-avatar-small">
          {artistProfile?.avatar ? (
            <img src={artistProfile.avatar} alt={artistProfile.name} />
          ) : (
            getInitial(artistProfile?.name || artist.name)
          )}
        </div>
        <div className="artist-info-text">
          <div className="artist-name">{artistProfile?.name || artist.name}</div>
          <div className="artist-location">{artistProfile?.location || artist.location}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Calendar
        </button>
        <button
          className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Info
        </button>
        <button
          className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Documents
        </button>
      </div>

      {/* Tab Content */}
      <div className="manage-artist-content">
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'events' && renderEventsTab()}
        {activeTab === 'info' && renderArtistInfoTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
      </div>

      {/* Travel Schedule Modal */}
      <Modal
        isOpen={showTravelModal}
        onClose={() => {
          setShowTravelModal(false);
          setEditingScheduleIndex(null);
        }}
        title="Add Travel Schedule"
        className="location-filter-modal"
      >
        <div className="location-filter-form">
          <div className="form-group">
            <label>Zone</label>
            <select
              value={travelFilter.zone}
              onChange={(e) => handleZoneChange(e.target.value)}
            >
              <option value="">All Zones</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>

          {travelFilter.zone && (
            <div className="form-group">
              <label>Country</label>
              <select
                value={travelFilter.country}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="">All Countries</option>
                {countriesByZone[travelFilter.zone]?.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}

          {travelFilter.country && (
            <div className="form-group">
              <label>City</label>
              <select
                value={travelFilter.city}
                onChange={(e) => handleCityChange(e.target.value)}
              >
                <option value="">All Cities</option>
                {citiesByCountry[travelFilter.country]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={travelFilter.startDate}
              onChange={(e) => setTravelFilter({...travelFilter, startDate: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={travelFilter.endDate}
              onChange={(e) => setTravelFilter({...travelFilter, endDate: e.target.value})}
            />
          </div>

          {/* Looking For Section */}
          <div className="looking-for-section">
            <h4>What are you looking for?</h4>
            <div className="looking-for-options">
              <label className="looking-for-option">
                <input
                  type="checkbox"
                  checked={lookingFor.promoter}
                  onChange={(e) => setLookingFor({...lookingFor, promoter: e.target.checked})}
                />
                <span>Promoters</span>
              </label>
              <label className="looking-for-option">
                <input
                  type="checkbox"
                  checked={lookingFor.venue}
                  onChange={(e) => setLookingFor({...lookingFor, venue: e.target.checked})}
                />
                <span>Venues</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-outline"
              onClick={() => {
                setShowTravelModal(false);
                setEditingScheduleIndex(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={saveTravelSchedule}
            >
              + Add Schedule
            </button>
          </div>
        </div>
      </Modal>

      {/* Artist Info Edit Modal */}
      <Modal
        key={modalKey}
        isOpen={showArtistInfoModal}
        onClose={() => setShowArtistInfoModal(false)}
        title="Edit Artist Information"
      >
        <div className="contact-edit-form" style={{maxHeight: '70vh', overflowY: 'auto', padding: '0 4px'}}>
          <div className="edit-section">
            <h3>Basic Information</h3>
            <div className="form-group">
              <label>Name</label>
            <input
              type="text"
              className="form-input"
              value={editedArtistInfo.name}
              disabled
              placeholder="Artist Name"
              style={{
                backgroundColor: '#0d0d0d',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            />
            <p style={{
              fontSize: '11px',
              color: '#666',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              Name cannot be changed by agents
            </p>
          </div>
          <div className="form-group">
            <label>Role</label>
            <select
              className="form-input"
              value={editedArtistInfo.role}
              disabled
              style={{
                backgroundColor: '#0d0d0d',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            >
              <option value="ARTIST">Artist</option>
              <option value="VENUE">Venue</option>
              <option value="PROMOTER">Promoter</option>
              <option value="AGENT">Agent</option>
            </select>
            <p style={{
              fontSize: '11px',
              color: '#666',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              Role cannot be changed by agents
            </p>
          </div>
          <div className="form-group">
            <label>Zone</label>
            <select
              className="form-input"
              value={editedArtistInfo.zone}
              onChange={(e) => handleArtistZoneChange(e.target.value)}
            >
              <option value="">Select Zone</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
            {console.log('[FORM RENDER] editedArtistInfo.zone:', editedArtistInfo.zone)}
            {console.log('[FORM RENDER] editedArtistInfo.country:', editedArtistInfo.country)}
            {console.log('[FORM RENDER] editedArtistInfo.city:', editedArtistInfo.city)}
          </div>
          {editedArtistInfo.zone && (
            <div className="form-group">
              <label>Country</label>
              <select
                className="form-input"
                value={editedArtistInfo.country}
                onChange={(e) => handleArtistCountryChange(e.target.value)}
              >
                <option value="">Select Country</option>
                {countriesByZone[editedArtistInfo.zone]?.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}
          {editedArtistInfo.country && (
            <div className="form-group">
              <label>City</label>
              <select
                className="form-input"
                value={editedArtistInfo.city}
                onChange={(e) => handleArtistCityChange(e.target.value)}
              >
                <option value="">Select City</option>
                {citiesByCountry[editedArtistInfo.country]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}
          {editedArtistInfo.role === 'VENUE' && (
            <div className="form-group">
              <label>Capacity</label>
              <input
                type="number"
                className="form-input"
                value={editedArtistInfo.capacity}
                onChange={(e) => setEditedArtistInfo({...editedArtistInfo, capacity: e.target.value})}
                placeholder="Max capacity"
              />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>Bio</label>
            <textarea
              className="form-input"
              rows="4"
              value={editedArtistInfo.bio}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, bio: e.target.value})}
              placeholder="Tell us about the artist..."
            />
          </div>
        </div>

        <div className="edit-section" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label>Genres</label>
            <div
              className="genres-dropdown-trigger"
              onClick={() => setShowGenresDropdown(!showGenresDropdown)}
            >
              <span className="genres-selected-text">
                {selectedGenres.size > 0
                  ? `${selectedGenres.size} genre${selectedGenres.size > 1 ? 's' : ''} selected`
                  : 'Select genres'}
              </span>
              <span className="dropdown-arrow">{showGenresDropdown ? '▲' : '▼'}</span>
            </div>

            {showGenresDropdown && (
              <div className="genres-dropdown-content">
                <div className="genres-grid">
                  {(showAllGenres ? genresList : genresList.slice(0, 12)).map(genre => (
                    <label key={genre} className="genre-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedGenres.has(genre)}
                        onChange={() => handleGenreToggle(genre)}
                      />
                      <span className={selectedGenres.has(genre) ? 'selected' : ''}>
                        {genre}
                      </span>
                    </label>
                  ))}
                </div>
                {genresList.length > 12 && (
                  <button
                    className="show-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllGenres(!showAllGenres);
                    }}
                  >
                    {showAllGenres ? 'Show less' : `Show all ${genresList.length} genres`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="edit-section">
          <h3>Social Links</h3>
          <div className="form-group">
            <label>SoundCloud/Mixtape</label>
            <input
              type="url"
              className="form-input"
              value={editedArtistInfo.mixtape}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, mixtape: e.target.value})}
              placeholder="https://soundcloud.com/..."
            />
            <p style={{
              fontSize: '11px',
              color: '#888',
              marginTop: '4px',
              lineHeight: '1.4'
            }}>
              💡 If using a share link: Open it in your web browser, then copy the full URL from the address bar
            </p>
          </div>
          {editedArtistInfo.role === 'ARTIST' && (
            <>
              <div className="form-group">
                <label>Spotify Artist</label>
                <input
                  type="url"
                  className="form-input"
                  value={editedArtistInfo.spotify}
                  onChange={(e) => setEditedArtistInfo({...editedArtistInfo, spotify: e.target.value})}
                  placeholder="https://open.spotify.com/artist/..."
                />
                <p style={{
                  fontSize: '11px',
                  color: '#888',
                  marginTop: '4px',
                  lineHeight: '1.4'
                }}>
                  💡 If using a share link: Open it in your web browser, then copy the full URL from the address bar
                </p>
              </div>
              <div className="form-group">
                <label>Resident Advisor</label>
                <input
                  type="url"
                  className="form-input"
                  value={editedArtistInfo.residentAdvisor}
                  onChange={(e) => setEditedArtistInfo({...editedArtistInfo, residentAdvisor: e.target.value})}
                  placeholder="https://ra.co/dj/..."
                />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Instagram</label>
            <input
              type="text"
              className="form-input"
              value={editedArtistInfo.instagram}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, instagram: e.target.value})}
              placeholder="@username"
            />
          </div>
          <div className="form-group">
            <label>Website</label>
            <input
              type="url"
              className="form-input"
              value={editedArtistInfo.website}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, website: e.target.value})}
              placeholder="https://..."
            />
          </div>
        </div>
        </div>

        <div className="form-actions" style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          padding: '16px 20px',
          borderTop: '1px solid #2a2a2a',
          marginTop: '20px'
        }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowArtistInfoModal(false)}
            style={{ flex: 'none', minWidth: '120px' }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveArtistInfo}
            style={{ flex: 'none', minWidth: '140px' }}
          >
            Save Changes
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmation}
        onClose={cancelDeleteSchedule}
        title="Delete Travel Schedule"
      >
        <div className="delete-confirmation">
          <p>Are you sure you want to delete this travel schedule?</p>
          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={cancelDeleteSchedule}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={confirmDeleteSchedule}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* RA Events Modal */}
      <RAEventsModal
        isOpen={showRAEvents}
        onClose={() => setShowRAEvents(false)}
        artistName={artistProfile?.name}
        raUrl={artistProfile?.residentAdvisor}
      />

      {/* Add/Edit Document Modal */}
      <AddContractModal
        isOpen={showAddDocModal}
        category={docCategory}
        categoryLabel={getCategoryLabel(docCategory)}
        initialTitle={editingDoc?.title || ''}
        initialUrl={editingDoc?.url || ''}
        initialType={editingDoc?.type || 'upload'}
        existingFileName={editingDoc?.file?.name || editingDoc?.title || ''}
        onClose={() => {
          setShowAddDocModal(false);
          setNewDoc({ title: '', url: '' });
          setEditingDoc(null);
        }}
        onSave={async (documentData) => {
          console.log('[ManageArtistScreen] Document data:', documentData);

          const updatedDocuments = { ...documents };

          if (editingDoc) {
            // Edit existing document
            const index = updatedDocuments[docCategory].findIndex(d => d.id === editingDoc.id);
            if (index !== -1) {
              updatedDocuments[docCategory][index] = {
                ...editingDoc,
                title: documentData.title,
                url: documentData.type === 'link' ? documentData.url : null,
                file: documentData.type === 'upload' ? (documentData.keepExistingFile ? editingDoc.file : documentData.file) : null,
                type: documentData.type // 'upload' or 'link'
              };
            }
          } else {
            // Add new document
            const newDocument = {
              id: Date.now().toString(),
              title: documentData.title,
              url: documentData.type === 'link' ? documentData.url : null,
              file: documentData.type === 'upload' ? documentData.file : null,
              type: documentData.type, // 'upload' or 'link'
              addedDate: new Date().toISOString()
            };
            updatedDocuments[docCategory].push(newDocument);
          }

          console.log('[ManageArtistScreen] Updated documents:', updatedDocuments);
          setDocuments(updatedDocuments);

          // Save to backend
          try {
            const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id;
            if (artistId) {
              await apiService.updateProfile(artistId, { documents: updatedDocuments });
              const freshProfile = await apiService.getProfile(artistId);
              setArtistProfile(freshProfile);
              alert('Document added successfully!');
            }
          } catch (error) {
            console.error('[ManageArtistScreen] Error saving document:', error);
            alert('Failed to save document. Please try again.');
          }

          setShowAddDocModal(false);
          setNewDoc({ title: '', url: '' });
          setEditingDoc(null);
        }}
      />
    </div>
  );
};

export default ManageArtistScreen;
