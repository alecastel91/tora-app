import React, { useState, useEffect } from 'react';
import { soundcloudEmbedUrl, spotifyEmbedUrl } from '../../utils/mediaLinks';
import { roleLabel } from '../../utils/roles';
import { getCurrencySymbol } from '../../utils/currencies';
import RevenueChart from '../common/RevenueChart';
import { CloseIcon, CalendarIcon, DollarIcon, AlertIcon, TrendingUpIcon, ImageIcon, SlidersIcon, FileTextIcon } from "../../utils/icons";
import Modal from '../common/Modal';
import AddContractModal from '../common/AddContractModal';
import PdfViewerModal from '../common/PdfViewerModal';
import { zones, countriesByZone, citiesByCountry, genresList, getZoneFromCountry } from '../../data/profiles';
import apiService from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { localizeActionItem, getActionIcon, handleActionTarget } from '../../utils/actionItems';
import { getAuthedBackendUrl, isBackendFileUrl } from '../../utils/urls';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { raProfileUrl } from '../../utils/urls';

const ManageArtistScreen = ({ artist, onClose, onSwitchTab = () => {} }) => {
  const { user, preferredCurrency, reloadProfileData } = useAppContext();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, info, documents (calendar: Tour > Calendar > artist)
  const [artistProfile, setArtistProfile] = useState(artist); // Store full artist profile
  const [actionItems, setActionItems] = useState([]);

  // Cached representingArtists entries use `profileId`; full Profile objects use `id`. Accept either.
  const artistProfileId = artist?.profileId || artist?.id;

  useEffect(() => {
    if (!user?.id || !artistProfileId) return;
    let cancelled = false;
    apiService
      .getActionSummary(user.id, { artistProfileId })
      .then((res) => { if (!cancelled) setActionItems(res.items || []); })
      .catch((err) => console.error('[ManageArtistScreen] action summary failed', err));
    return () => { cancelled = true; };
  }, [user?.id, artistProfileId]);
  
   // Track which schedule is being edited

  // Delete confirmation state

  // RA Events modal state

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
  
  const [upcomingGigs, setUpcomingGigs] = useState(null); // null means loading, number means loaded
  const [gigsError, setGigsError] = useState(false);
  const [ytdRevenue, setYtdRevenue] = useState(null); // null means loading, number means loaded
  const [revenueEvents, setRevenueEvents] = useState([]); // [{date, amount}] in preferred currency
  const [thisYearGigs, setThisYearGigs] = useState(null); // Total gigs this year (completed + upcoming)
  const [expectedRevenue, setExpectedRevenue] = useState(null); // Expected revenue from upcoming gigs
  const [deals, setDeals] = useState([]); // All deals for the artist
   // Track expanded deal in events list

  // Documents state
  const [documents, setDocuments] = useState({
    pressKit: artistProfile?.documents?.pressKit || [],
    technicalRider: artistProfile?.documents?.technicalRider || [],
    hospitalityRider: artistProfile?.documents?.hospitalityRider || [],
    contracts: artistProfile?.documents?.contracts || []
  });
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docCategory, setDocCategory] = useState(''); // pressKit, technicalRider, contracts
  const [newDoc, setNewDoc] = useState({ title: '', url: '' });
  const [pdfViewerUrl, setPdfViewerUrl] = useState(null);

  const openDocument = (doc) => {
    if (!doc?.url) return;
    if (isBackendFileUrl(doc)) {
      setPdfViewerUrl(getAuthedBackendUrl(doc.url, user?.id));
    } else {
      window.open(doc.url, '_blank', 'noopener,noreferrer');
    }
  };

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
                  // missing rate (rate-API outage) must not NaN the sum
                  const feeInUSD = dealCurrency === 'USD' || !rates[dealCurrency] ? dealFee : dealFee / rates[dealCurrency];
                  // Then convert from USD to preferred currency
                  convertedFee = preferredCurrency === 'USD' || !rates[preferredCurrency] ? feeInUSD : feeInUSD * rates[preferredCurrency];
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
                  // missing rate (rate-API outage) must not NaN the sum
                  const feeInUSD = dealCurrency === 'USD' || !rates[dealCurrency] ? dealFee : dealFee / rates[dealCurrency];
                  convertedFee = preferredCurrency === 'USD' || !rates[preferredCurrency] ? feeInUSD : feeInUSD * rates[preferredCurrency];
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

          // Revenue events for the chart (converted once to the preferred currency)
          const startDate = new Date('2024-01-01');
          const historicalDeals = response.deals.filter(deal => {
            const dealDate = new Date(deal.date);
            const isFrom2024 = dealDate >= startDate;
            const isCompleted = deal.status === 'COMPLETED';
            const isAcceptedAndPast = deal.status === 'ACCEPTED' && dealDate < new Date();
            return isFrom2024 && (isCompleted || isAcceptedAndPast);
          });

          let chartRates = null;
          if (historicalDeals.some(d => (d.currency || 'USD') !== preferredCurrency)) {
            try {
              chartRates = (await apiService.getCurrentRates()).rates;
            } catch (err) {
              console.error('Error fetching rates for chart:', err);
            }
          }
          setRevenueEvents(historicalDeals.map(deal => {
            const dealCurrency = deal.currency || 'USD';
            const dealFee = parseFloat(deal.currentFee) || 0;
            let amount = dealFee;
            if (dealCurrency !== preferredCurrency && chartRates) {
              const feeInUSD = dealCurrency === 'USD' ? dealFee : dealFee / chartRates[dealCurrency];
              amount = preferredCurrency === 'USD' ? feeInUSD : feeInUSD * chartRates[preferredCurrency];
            }
            return { date: deal.date, amount };
          }));
        } else {
          // No deals found, set to 0
          setUpcomingGigs(0);
          setYtdRevenue(0);
          setRevenueEvents([]);
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

        // Update travel schedvelSchedule || []);

        // Update documents from fresh data
        setDocuments({
          pressKit: freshProfile.documents?.pressKit || [],
          technicalRider: freshProfile.documents?.technicalRider || [],
          hospitalityRider: freshProfile.documents?.hospitalityRider || [],
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
        hospitalityRider: artistProfile.documents.hospitalityRider || [],
        contracts: artistProfile.documents.contracts || []
      });
    }
  }, [artistProfile]);

  // Scroll to top when component mounts or when switching to dashboard tab
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Scroll revenue chart to show latest month

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
    const zone = getZoneFromCountry(country) || '';

    setEditedArtistInfo({
      ...editedArtistInfo,
      zone,
      country,
      city: '',
      location: `${country}${zone ? `, ${zone}` : ''}` // Update location
    });
  };

  const handleArtistCityChange = (city) => {
    // The country and zone stay as picked; the city only refines the
    // location label (a city name can exist under several countries).
    const { country, zone } = editedArtistInfo;
    const location = [city || null, country || null, !country && zone ? zone : null].filter(Boolean).join(', ');
    setEditedArtistInfo({ ...editedArtistInfo, city: city || '', location });
  };

  // Artist info save function (full profile edit)
  const handleSaveArtistInfo = async () => {
    try {
      const artistId = artistProfile?.profileId || artistProfile?.id || artistProfile?.id;

      if (!artistId) {
        appAlert(t('manageArtist.artistIdNotFound'));
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
      appAlert(t('manageArtist.artistInfoUpdated'));
    } catch (error) {
      console.error('Failed to update artist info:', error);
      appAlert(t('manageArtist.artistInfoUpdateFailed'));
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

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };

  const formatCurrencyWithSymbol = (amount, currency = 'USD') => {
    const symbol = getCurrencySymbol(currency);
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

    return `${symbol}${formatted}`;
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
          <div className="metric-label">{t('manageArtist.thisYearBookings')}</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><DollarIcon /></div>
          <div className="metric-value">
            {ytdRevenue === null ? '...' : formatCurrencyWithSymbol(ytdRevenue, preferredCurrency)}
          </div>
          <div className="metric-label">{t('manageArtist.thisYearRevenue')}</div>
        </div>
        {/* Bottom Row */}
        <div className="metric-card">
          <div className="metric-icon"><CalendarIcon /></div>
          <div className="metric-value">
            {upcomingGigs === null ? '...' : upcomingGigs}
            {gigsError && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>*</span>}
          </div>
          <div className="metric-label">{t('manageArtist.upcomingBookings')}</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><DollarIcon /></div>
          <div className="metric-value">
            {expectedRevenue === null ? '...' : formatCurrencyWithSymbol(expectedRevenue, preferredCurrency)}
          </div>
          <div className="metric-label">{t('manageArtist.expectedRevenue')}</div>
        </div>
      </div>

      {/* Action Items */}
      <div className="dashboard-section">
        <div className="section-header">
          <h3><AlertIcon /> {t('manageArtist.actionsRequired')}</h3>
          <span className="badge">{actionItems.length}</span>
        </div>
        <div className="action-items">
          {actionItems.length === 0 ? (
            <div className="action-empty">{t('manageArtist.nothingNeedsAttention')}</div>
          ) : (
            actionItems.map(item => {
              const Icon = getActionIcon(item.type);
              const localized = localizeActionItem(item, t);
              return (
                <div key={item.id} className={`action-item${item.urgent ? ' urgent' : ''}`}>
                  <div className="action-icon"><Icon /></div>
                  <div className="action-content">
                    <div className="action-title">{localized.title}</div>
                    {item.subtitle && <div className="action-description">{item.subtitle}</div>}
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => handleActionTarget(item.target, { onSwitchTab, onClose })}>
                    {localized.actionLabel}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="dashboard-section revenue-overview-section">
        <h3><TrendingUpIcon /> {t('manageArtist.revenueOverview')}</h3>
        <RevenueChart events={revenueEvents} currencySymbol={getCurrencySymbol(preferredCurrency)} />
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

  const handleDeleteDocument = async (category, docId) => {
    if (!(await appConfirm(t('manageArtist.deleteDocumentConfirm'), { danger: true }))) {
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
      pressKit: t('manageArtist.pressKit'),
      technicalRider: t('manageArtist.technicalRider'),
      hospitalityRider: t('manageArtist.hospitalityRider'),
      contracts: t('manageArtist.contract')
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
              onClick={() => handleAddDocument(category)}
              aria-label={t('manageArtist.addCategory', { title })}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '22px',
                fontWeight: 700,
                lineHeight: 1,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              +
            </button>
          )}
        </div>

        {documents[category].length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.015] px-5 py-4 text-center">
            {note && (
              <div className="mb-3 text-[11px] leading-relaxed text-white/35">
                {note}
              </div>
            )}
            <button
              className="btn btn-primary btn-small"
              onClick={() => handleAddDocument(category)}
            >
              + {t('manageArtist.add')}
            </button>
          </div>
        ) : (
          <div className="doc-list">
            {documents[category].map(doc => (
              <div key={doc.id} className="doc-item">
                <div className="doc-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="doc-name">{doc.title}</div>
                  <div className="doc-meta">
                    {doc.url && (
                      <button
                        type="button"
                        onClick={() => openDocument(doc)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: '#FF3366',
                          textDecoration: 'none',
                          marginBottom: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {isBackendFileUrl(doc) ? t('manageArtist.viewFile') : t('manageArtist.openLink')}
                      </button>
                    )}
                    {doc.addedDate && (
                      <div className="text-[10px] uppercase tracking-[0.08em] text-white/30">
                        {t('manageArtist.addedDate', { date: new Date(doc.addedDate).toLocaleDateString() })}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleEditDocument(category, doc)}
                  >
                    {t('manageArtist.edit')}
                  </button>
                  <button
                    className="bg-transparent border-none cursor-pointer text-[10px] uppercase tracking-[0.1em]
                               font-tech text-white/35 hover:text-role-venue transition-colors"
                    onClick={() => handleDeleteDocument(category, doc.id)}
                  >
                    {t('manageArtist.delete')}
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
        {renderDocCategory('pressKit', <ImageIcon />, t('manageArtist.pressKit'), t('manageArtist.pressKitNote'))}
        {renderDocCategory('technicalRider', <SlidersIcon />, t('manageArtist.technicalRider'), t('manageArtist.technicalRiderNote'))}
        {renderDocCategory('hospitalityRider', <SlidersIcon />, t('manageArtist.hospitalityRider'), t('manageArtist.hospitalityRiderNote'))}
        {renderDocCategory('contracts', <FileTextIcon />, t('manageArtist.contracts'), t('manageArtist.contractsNote'))}
      </div>
    );
  };

  // Artist Info Tab (Editable Profile Information)
  const renderArtistInfoTab = () => {
    const artistEmbeds = { soundcloud: soundcloudEmbedUrl(artistProfile?.mixtape), spotify: spotifyEmbedUrl(artistProfile?.spotify) };

    return (
      <div className="artist-info-tab">
        {/* Profile Info Box */}
        <div className="mb-4 rounded-2xl border border-white/10 bg-[#0c0c11] p-5 leading-relaxed">
          <div className="text-base font-semibold text-white">
            {artistProfile?.name || t('manageArtist.artistName')}
          </div>
          {artistProfile?.location && (
            <div className="mt-0.5 text-sm text-white/45">{artistProfile.location}</div>
          )}
          {artistProfile?.role && (
            <div className="mt-2 inline-block rounded-full border border-role-artist/60 px-2.5 py-0.5 text-[10px] font-tech uppercase tracking-[0.15em] text-role-artist">
              {roleLabel(artistProfile.role, t)}
            </div>
          )}
          {artistProfile?.genres && artistProfile.genres.length > 0 && (
            <div className="mt-2 text-xs text-white/45">{artistProfile.genres.join(', ')}</div>
          )}
        </div>

        {/* Bio Section */}
        <div className="mb-5 rounded-2xl border border-white/10 bg-[#0c0c11] p-5">
          <p className="m-0 text-sm leading-relaxed text-white/75">
            {artistProfile?.bio || t('manageArtist.noBioAvailable')}
          </p>
        </div>

        {/* Latest Mix */}
        {artistEmbeds.soundcloud && (
          <div className="media-section" style={{ marginBottom: '24px' }}>
            <h3 className="mb-3 text-[11px] font-tech font-semibold uppercase tracking-[0.15em] text-infrared">
              {t('manageArtist.latestMix')}
            </h3>
            <iframe
              src={artistEmbeds.soundcloud}
              className="embed-iframe soundcloud-embed"
              title={t('manageArtist.soundcloudMix')}
              allow="autoplay"
            />
          </div>
        )}

        {/* Spotify Artist */}
        {artistProfile?.role === 'ARTIST' && artistEmbeds.spotify && (
          <div className="media-section" style={{ marginBottom: '24px' }}>
            <h3 className="mb-3 text-[11px] font-tech font-semibold uppercase tracking-[0.15em] text-infrared">
              {t('manageArtist.spotifyArtistHeading')}
            </h3>
            <iframe
              src={artistEmbeds.spotify}
              className="embed-iframe spotify-embed"
              title={t('manageArtist.spotifyArtistProfile')}
              allow="encrypted-media"
            />
          </div>
        )}

        {/* Events Section - RA Link */}
        {artistProfile?.role === 'ARTIST' && artistProfile?.residentAdvisor && (
          <div className="media-section" style={{ marginBottom: '24px' }}>
            <a
              href={raProfileUrl(artistProfile.residentAdvisor)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
            >
              <span style={{ fontSize: '10px', fontWeight: 700 }}>RA</span>
              <span>{t('manageArtist.viewFullRaProfile')}</span>
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
              <span>{t('manageArtist.instagram')}</span>
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
              <span>{t('manageArtist.website')}</span>
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
              appAlert(t('manageArtist.loadArtistFailed'));
            }
          }}
        >
          {t('manageArtist.editArtistInfo')}
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
            <label>{t('manageArtist.name')}</label>
            <input
              type="text"
              className="form-input"
              value={editedArtistInfo.name}
              disabled
              placeholder={t('manageArtist.artistName')}
              style={{
                backgroundColor: '#0d0d0d',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            />
            <p style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              {t('manageArtist.nameCannotBeChanged')}
            </p>
          </div>
          <div className="form-group">
            <label>{t('manageArtist.role')}</label>
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
              <option value="ARTIST">{t('manageArtist.artist')}</option>
              <option value="VENUE">{t('manageArtist.venue')}</option>
              <option value="PROMOTER">{t('manageArtist.promoter')}</option>
              <option value="AGENT">{t('manageArtist.agent')}</option>
            </select>
            <p style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              {t('manageArtist.roleCannotBeChanged')}
            </p>
          </div>
          <div className="form-group">
            <label>{t('manageArtist.zone')}</label>
            <select
              className="form-input"
              value={editedArtistInfo.zone}
              onChange={(e) => handleArtistZoneChange(e.target.value)}
            >
              <option value="">{t('manageArtist.selectZone')}</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
          {editedArtistInfo.zone && (
            <div className="form-group">
              <label>{t('manageArtist.country')}</label>
              <select
                className="form-input"
                value={editedArtistInfo.country}
                onChange={(e) => handleArtistCountryChange(e.target.value)}
              >
                <option value="">{t('manageArtist.selectCountry')}</option>
                {countriesByZone[editedArtistInfo.zone]?.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}
          {editedArtistInfo.country && (
            <div className="form-group">
              <label>{t('manageArtist.city')}</label>
              <select
                className="form-input"
                value={editedArtistInfo.city}
                onChange={(e) => handleArtistCityChange(e.target.value)}
              >
                <option value="">{t('manageArtist.selectCity')}</option>
                {citiesByCountry[editedArtistInfo.country]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}
          {editedArtistInfo.role === 'VENUE' && (
            <div className="form-group">
              <label>{t('manageArtist.capacity')}</label>
              <input
                type="number"
                className="form-input"
                value={editedArtistInfo.capacity}
                onChange={(e) => setEditedArtistInfo({...editedArtistInfo, capacity: e.target.value})}
                placeholder={t('manageArtist.maxCapacity')}
              />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>{t('manageArtist.bio')}</label>
            <textarea
              className="form-input"
              rows="4"
              value={editedArtistInfo.bio}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, bio: e.target.value})}
              placeholder={t('manageArtist.bioPlaceholder')}
            />
          </div>
        </div>

        <div className="edit-section" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label>{t('manageArtist.genres')}</label>
            <div
              className="genres-dropdown-trigger"
              onClick={() => setShowGenresDropdown(!showGenresDropdown)}
            >
              <span className="genres-selected-text">
                {selectedGenres.size > 0
                  ? (selectedGenres.size > 1
                      ? t('manageArtist.genresSelected', { count: selectedGenres.size })
                      : t('manageArtist.genreSelected', { count: selectedGenres.size }))
                  : t('manageArtist.selectGenres')}
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
                    {showAllGenres ? t('manageArtist.showLess') : t('manageArtist.showAllGenres', { count: genresList.length })}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="edit-section">
          <h3>{t('manageArtist.socialLinks')}</h3>
          <div className="form-group">
            <label>{t('manageArtist.soundcloudMixtape')}</label>
            <input
              type="url"
              className="form-input"
              value={editedArtistInfo.mixtape}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, mixtape: e.target.value})}
              placeholder="https://soundcloud.com/..."
            />
            <p style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '4px',
              lineHeight: '1.4'
            }}>
              {t('manageArtist.shareLinkHint')}
            </p>
          </div>
          {editedArtistInfo.role === 'ARTIST' && (
            <>
              <div className="form-group">
                <label>{t('manageArtist.spotifyArtist')}</label>
                <input
                  type="url"
                  className="form-input"
                  value={editedArtistInfo.spotify}
                  onChange={(e) => setEditedArtistInfo({...editedArtistInfo, spotify: e.target.value})}
                  placeholder="https://open.spotify.com/artist/..."
                />
                <p style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.4)',
                  marginTop: '4px',
                  lineHeight: '1.4'
                }}>
                  {t('manageArtist.shareLinkHint')}
                </p>
              </div>
              <div className="form-group">
                <label>{t('manageArtist.residentAdvisor')}</label>
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
            <label>{t('manageArtist.instagram')}</label>
            <input
              type="text"
              className="form-input"
              value={editedArtistInfo.instagram}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, instagram: e.target.value})}
              placeholder="@username"
            />
          </div>
          <div className="form-group">
            <label>{t('manageArtist.website')}</label>
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
            {t('manageArtist.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveArtistInfo}
            style={{ flex: 'none', minWidth: '140px' }}
          >
            {t('manageArtist.saveChanges')}
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
          <h1>{t('manageArtist.editArtistInfo')}</h1>
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
        <h1>{t('manageArtist.manage')}</h1>
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
          {t('manageArtist.dashboard')}
        </button>
        <button
          className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          {t('manageArtist.info')}
        </button>
        <button
          className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          {t('manageArtist.documents')}
        </button>
      </div>

      {/* Tab Content */}
      <div className="manage-artist-content relative isolate">
        {/* faint engineering grid fading from the top (quiet-premium backdrop) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-5 -top-5 h-40 -z-10 bg-grid
                     [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
        />
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'info' && renderArtistInfoTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
      </div>

      {/* Artist Info Edit Modal */}
      <Modal
        key={modalKey}
        isOpen={showArtistInfoModal}
        onClose={() => setShowArtistInfoModal(false)}
        title={t('manageArtist.editArtistInformation')}
      >
        <div className="contact-edit-form" style={{maxHeight: '70vh', overflowY: 'auto', padding: '0 4px'}}>
          <div className="edit-section">
            <h3>{t('manageArtist.basicInformation')}</h3>
            <div className="form-group">
              <label>{t('manageArtist.name')}</label>
            <input
              type="text"
              className="form-input"
              value={editedArtistInfo.name}
              disabled
              placeholder={t('manageArtist.artistName')}
              style={{
                backgroundColor: '#0d0d0d',
                cursor: 'not-allowed',
                opacity: 0.6
              }}
            />
            <p style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              {t('manageArtist.nameCannotBeChanged')}
            </p>
          </div>
          <div className="form-group">
            <label>{t('manageArtist.role')}</label>
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
              <option value="ARTIST">{t('manageArtist.artist')}</option>
              <option value="VENUE">{t('manageArtist.venue')}</option>
              <option value="PROMOTER">{t('manageArtist.promoter')}</option>
              <option value="AGENT">{t('manageArtist.agent')}</option>
            </select>
            <p style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              {t('manageArtist.roleCannotBeChanged')}
            </p>
          </div>
          <div className="form-group">
            <label>{t('manageArtist.zone')}</label>
            <select
              className="form-input"
              value={editedArtistInfo.zone}
              onChange={(e) => handleArtistZoneChange(e.target.value)}
            >
              <option value="">{t('manageArtist.selectZone')}</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
          {editedArtistInfo.zone && (
            <div className="form-group">
              <label>{t('manageArtist.country')}</label>
              <select
                className="form-input"
                value={editedArtistInfo.country}
                onChange={(e) => handleArtistCountryChange(e.target.value)}
              >
                <option value="">{t('manageArtist.selectCountry')}</option>
                {countriesByZone[editedArtistInfo.zone]?.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}
          {editedArtistInfo.country && (
            <div className="form-group">
              <label>{t('manageArtist.city')}</label>
              <select
                className="form-input"
                value={editedArtistInfo.city}
                onChange={(e) => handleArtistCityChange(e.target.value)}
              >
                <option value="">{t('manageArtist.selectCity')}</option>
                {citiesByCountry[editedArtistInfo.country]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}
          {editedArtistInfo.role === 'VENUE' && (
            <div className="form-group">
              <label>{t('manageArtist.capacity')}</label>
              <input
                type="number"
                className="form-input"
                value={editedArtistInfo.capacity}
                onChange={(e) => setEditedArtistInfo({...editedArtistInfo, capacity: e.target.value})}
                placeholder={t('manageArtist.maxCapacity')}
              />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>{t('manageArtist.bio')}</label>
            <textarea
              className="form-input"
              rows="4"
              value={editedArtistInfo.bio}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, bio: e.target.value})}
              placeholder={t('manageArtist.bioPlaceholder')}
            />
          </div>
        </div>

        <div className="edit-section" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label>{t('manageArtist.genres')}</label>
            <div
              className="genres-dropdown-trigger"
              onClick={() => setShowGenresDropdown(!showGenresDropdown)}
            >
              <span className="genres-selected-text">
                {selectedGenres.size > 0
                  ? (selectedGenres.size > 1
                      ? t('manageArtist.genresSelected', { count: selectedGenres.size })
                      : t('manageArtist.genreSelected', { count: selectedGenres.size }))
                  : t('manageArtist.selectGenres')}
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
                    {showAllGenres ? t('manageArtist.showLess') : t('manageArtist.showAllGenres', { count: genresList.length })}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="edit-section">
          <h3>{t('manageArtist.socialLinks')}</h3>
          <div className="form-group">
            <label>{t('manageArtist.soundcloudMixtape')}</label>
            <input
              type="url"
              className="form-input"
              value={editedArtistInfo.mixtape}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, mixtape: e.target.value})}
              placeholder="https://soundcloud.com/..."
            />
            <p style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '4px',
              lineHeight: '1.4'
            }}>
              {t('manageArtist.shareLinkHint')}
            </p>
          </div>
          {editedArtistInfo.role === 'ARTIST' && (
            <>
              <div className="form-group">
                <label>{t('manageArtist.spotifyArtist')}</label>
                <input
                  type="url"
                  className="form-input"
                  value={editedArtistInfo.spotify}
                  onChange={(e) => setEditedArtistInfo({...editedArtistInfo, spotify: e.target.value})}
                  placeholder="https://open.spotify.com/artist/..."
                />
                <p style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.4)',
                  marginTop: '4px',
                  lineHeight: '1.4'
                }}>
                  {t('manageArtist.shareLinkHint')}
                </p>
              </div>
              <div className="form-group">
                <label>{t('manageArtist.residentAdvisor')}</label>
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
            <label>{t('manageArtist.instagram')}</label>
            <input
              type="text"
              className="form-input"
              value={editedArtistInfo.instagram}
              onChange={(e) => setEditedArtistInfo({...editedArtistInfo, instagram: e.target.value})}
              placeholder="@username"
            />
          </div>
          <div className="form-group">
            <label>{t('manageArtist.website')}</label>
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
            {t('manageArtist.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveArtistInfo}
            style={{ flex: 'none', minWidth: '140px' }}
          >
            {t('manageArtist.saveChanges')}
          </button>
        </div>
      </Modal>

      {/* RA Events Modal */}

      {/* Add/Edit Document Modal */}
      <AddContractModal
        isOpen={showAddDocModal}
        category={docCategory}
        categoryLabel={getCategoryLabel(docCategory)}
        initialTitle={editingDoc?.title || ''}
        initialUrl={editingDoc?.url || ''}
        initialType={editingDoc?.type || 'upload'}
        existingFileName={editingDoc?.file?.name || editingDoc?.title || ''}
        submitLabel={editingDoc ? t('manageArtist.save') : t('manageArtist.add')}
        submittingLabel={t('manageArtist.saving')}
        onClose={() => {
          setShowAddDocModal(false);
          setNewDoc({ title: '', url: '' });
          setEditingDoc(null);
        }}
        onSave={async (documentData) => {
          console.log('[ManageArtistScreen] Document data:', documentData);

          const updatedDocuments = { ...documents };

          if (editingDoc) {
            // Edit existing document. AddContractModal uploads the file
            // first and returns documentData.url (backend proxy path) — we
            // store that for both upload and link types so the doc is
            // viewable later. If editing without changing the file, fall
            // back to the previous url.
            const index = updatedDocuments[docCategory].findIndex(d => d.id === editingDoc.id);
            if (index !== -1) {
              updatedDocuments[docCategory][index] = {
                ...editingDoc,
                title: documentData.title,
                url: documentData.url || editingDoc.url || null,
                storagePath: documentData.storagePath || editingDoc.storagePath || null,
                type: documentData.type, // 'upload' or 'link'
                addedDate: new Date().toISOString()
              };
            }
          } else {
            // Add new document
            const newDocument = {
              id: Date.now().toString(),
              title: documentData.title,
              url: documentData.url || null,
              storagePath: documentData.storagePath || null,
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
              appAlert(t('manageArtist.documentAdded'));
            }
          } catch (error) {
            console.error('[ManageArtistScreen] Error saving document:', error);
            appAlert(t('manageArtist.saveDocumentFailed'));
          }

          setShowAddDocModal(false);
          setNewDoc({ title: '', url: '' });
          setEditingDoc(null);
        }}
      />

      <PdfViewerModal url={pdfViewerUrl} onClose={() => setPdfViewerUrl(null)} />
    </div>
  );
};

export default ManageArtistScreen;
