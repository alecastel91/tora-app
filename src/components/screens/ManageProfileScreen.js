import React, { useState, useEffect } from 'react';
import { CloseIcon, CalendarIcon, DollarIcon, TrendingUpIcon, ImageIcon, SlidersIcon, FileTextIcon, FileIcon, AlertIcon } from '../../utils/icons';
import CalendarScreen from './CalendarScreen';
import AddContractModal from '../common/AddContractModal';
import PdfViewerModal from '../common/PdfViewerModal';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { uploadDocument } from '../../services/contractService';
import { getActionIcon, handleActionTarget } from '../../utils/actionItems';
import { getAuthedBackendUrl, isBackendFileUrl } from '../../utils/urls';

const ManageProfileScreen = ({ onClose, onSwitchTab = () => {} }) => {
  const { user, preferredCurrency, reloadProfileData } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, calendar, documents
  const [upcomingGigs, setUpcomingGigs] = useState(null);
  const [ytdRevenue, setYtdRevenue] = useState(null);
  const [revenueChartData, setRevenueChartData] = useState([]);
  const [thisYearGigs, setThisYearGigs] = useState(null);
  const [expectedRevenue, setExpectedRevenue] = useState(null);
  const [deals, setDeals] = useState([]);
  const [actionItems, setActionItems] = useState([]);

  // Documents state - different for different roles
  const isPromoterOrVenue = user?.role === 'PROMOTER' || user?.role === 'VENUE';

  // Initialize documents based on role
  const getInitialDocuments = () => {
    if (isPromoterOrVenue) {
      return user?.documents?.general || [];
    }
    return {
      pressKit: user?.documents?.pressKit || [],
      technicalRider: user?.documents?.technicalRider || [],
      hospitalityRider: user?.documents?.hospitalityRider || [],
      contracts: user?.documents?.contracts || []
    };
  };

  const [documents, setDocuments] = useState(getInitialDocuments());
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docCategory, setDocCategory] = useState('');
  const [newDoc, setNewDoc] = useState({ title: '', url: '' });
  const [pdfViewerUrl, setPdfViewerUrl] = useState(null);

  // Decide where a doc.url should open. Backend-proxied files open in the
  // in-app PdfViewer modal (so the auth token rides along). External links
  // (Drive, Dropbox, etc.) open in a new tab.
  const openDocument = (doc) => {
    if (!doc?.url) return;
    if (isBackendFileUrl(doc)) {
      setPdfViewerUrl(getAuthedBackendUrl(doc.url, user?.id));
    } else {
      window.open(doc.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Fetch fresh profile data on mount
  useEffect(() => {
    const fetchFreshProfile = async () => {
      console.log('[ManageProfileScreen] Component mounted, fetching fresh profile data');
      await reloadProfileData();
    };
    fetchFreshProfile();
  }, []); // Run once on mount

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    apiService
      .getActionSummary(user.id)
      .then((res) => { if (!cancelled) setActionItems(res.items || []); })
      .catch((err) => console.error('[ManageProfileScreen] action summary failed', err));
    return () => { cancelled = true; };
  }, [user?.id]);

  const getCurrencySymbol = (currency) => {
    const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
    return symbols[currency] || '$';
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000) {
      return `${Math.round(amount / 1000)}K`;
    }
    return Math.round(amount).toString();
  };

  const formatCurrencyWithSymbol = (amount, currency) => {
    const symbol = getCurrencySymbol(currency);
    if (amount >= 1000) {
      return `${symbol}${Math.round(amount / 1000)}K`;
    }
    return `${symbol}${Math.round(amount)}`;
  };

  // Fetch dashboard data - matches ManageArtistScreen logic
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.id) {
        console.log('[ManageProfileScreen] No user.id, skipping dashboard fetch');
        return;
      }

      try {
        console.log('[ManageProfileScreen] Fetching deals for user:', user.id);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yearStart = new Date(today.getFullYear(), 0, 1);

        // Fetch deals using profileId parameter
        const response = await apiService.getDeals({ profileId: user.id });
        console.log('[ManageProfileScreen] Deals response:', response);

        if (response && response.deals && response.deals.length > 0) {
          setDeals(response.deals);

          // Count upcoming gigs with PENDING, NEGOTIATING, or ACCEPTED status
          const upcoming = response.deals.filter(deal => {
            const dealDate = new Date(deal.date);
            const hasUpcomingDate = dealDate >= today;
            const hasActiveStatus = ['PENDING', 'NEGOTIATING', 'ACCEPTED'].includes(deal.status);
            return hasUpcomingDate && hasActiveStatus;
          });
          setUpcomingGigs(upcoming.length);

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

              let totalRevenue = 0;
              for (const deal of ytdDeals) {
                const dealCurrency = deal.currency || 'USD';
                const dealFee = parseFloat(deal.currentFee) || 0;

                let convertedFee = dealFee;
                if (dealCurrency !== preferredCurrency) {
                  const feeInUSD = dealCurrency === 'USD' ? dealFee : dealFee / rates[dealCurrency];
                  convertedFee = preferredCurrency === 'USD' ? feeInUSD : feeInUSD * rates[preferredCurrency];
                }

                totalRevenue += convertedFee;
              }

              setYtdRevenue(Math.round(totalRevenue * 100) / 100);
            } catch (rateError) {
              console.error('Error fetching exchange rates:', rateError);
              const total = ytdDeals.reduce((sum, deal) => sum + (parseFloat(deal.currentFee) || 0), 0);
              setYtdRevenue(Math.round(total * 100) / 100);
            }
          } else {
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

            iterDate.setMonth(iterDate.getMonth() + 1);
          }

          setRevenueChartData(chartData);

          console.log('[ManageProfileScreen] Dashboard metrics set:', {
            upcomingGigs: upcoming.length,
            thisYearGigs: thisYearDeals.length,
            ytdRevenue: ytdDeals.length
          });
        } else {
          // No deals found
          setUpcomingGigs(0);
          setYtdRevenue(0);
          setThisYearGigs(0);
          setExpectedRevenue(0);
          setRevenueChartData([]);
        }

      } catch (error) {
        console.error('[ManageProfileScreen] Error fetching dashboard data:', error);
        // Set to 0 on error
        setUpcomingGigs(0);
        setYtdRevenue(0);
        setThisYearGigs(0);
        setExpectedRevenue(0);
      }
    };

    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, preferredCurrency]);

  // Sync documents when user changes - different structure based on role
  // Only sync on initial mount or when user.id changes (not on every user update)
  useEffect(() => {
    console.log('[ManageProfileScreen] User.id changed, syncing documents. Role:', user?.role);
    console.log('[ManageProfileScreen] User documents:', user?.documents);

    if (isPromoterOrVenue) {
      // Promoter/Venue: flat array
      const generalDocs = user?.documents?.general || [];
      console.log('[ManageProfileScreen] Setting Promoter/Venue documents (array):', generalDocs);
      setDocuments(generalDocs);
    } else {
      // Artist: categorized object
      const categorizedDocs = {
        pressKit: user?.documents?.pressKit || [],
        technicalRider: user?.documents?.technicalRider || [],
        hospitalityRider: user?.documents?.hospitalityRider || [],
        contracts: user?.documents?.contracts || []
      };
      console.log('[ManageProfileScreen] Setting Artist documents (object):', categorizedDocs);
      setDocuments(categorizedDocs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only re-sync when user ID changes, not on every user update

  // Document handlers - different logic for Promoter/Venue vs Artist
  const handleAddDocument = (category) => {
    if (isPromoterOrVenue) {
      // Promoter/Venue: no category needed
      setNewDoc({ title: '', url: '' });
      setEditingDoc(null);
      setShowAddDocModal(true);
    } else {
      // Artist: category-based
      setDocCategory(category);
      setNewDoc({ title: '', url: '' });
      setEditingDoc(null);
      setShowAddDocModal(true);
    }
  };

  const handleEditDocument = (category, doc) => {
    if (isPromoterOrVenue) {
      // Promoter/Venue: doc is the first param (no category)
      setNewDoc({ title: category.title, url: category.url });
      setEditingDoc(category);
      setShowAddDocModal(true);
    } else {
      // Artist: category-based
      setDocCategory(category);
      setNewDoc({ title: doc.title, url: doc.url });
      setEditingDoc(doc);
      setShowAddDocModal(true);
    }
  };

  const handleSaveDocument = async () => {
    if (!newDoc.title || !newDoc.url) {
      alert('Please provide both title and URL');
      return;
    }

    let updatedDocuments;

    if (isPromoterOrVenue) {
      // Promoter/Venue: flat array
      if (editingDoc) {
        updatedDocuments = documents.map(d =>
          d.id === editingDoc.id
            ? { ...editingDoc, title: newDoc.title, url: newDoc.url, addedDate: new Date().toISOString() }
            : d
        );
      } else {
        const newDocument = {
          id: Date.now().toString(),
          title: newDoc.title,
          url: newDoc.url,
          addedDate: new Date().toISOString()
        };
        updatedDocuments = [...documents, newDocument];
      }
    } else {
      // Artist: categorized object
      updatedDocuments = { ...documents };
      if (editingDoc) {
        const index = updatedDocuments[docCategory].findIndex(d => d.id === editingDoc.id);
        if (index !== -1) {
          updatedDocuments[docCategory][index] = {
            ...editingDoc,
            title: newDoc.title,
            url: newDoc.url,
            addedDate: new Date().toISOString()
          };
        }
      } else {
        const newDocument = {
          id: Date.now().toString(),
          title: newDoc.title,
          url: newDoc.url,
          addedDate: new Date().toISOString()
        };
        updatedDocuments[docCategory].push(newDocument);
      }
    }

    console.log('[ManageProfileScreen] Saving documents:', updatedDocuments);
    setDocuments(updatedDocuments);

    // Save to backend
    try {
      console.log('[ManageProfileScreen] Calling API to save documents for user:', user.id);
      const response = await apiService.updateProfile(user.id, {
        documents: isPromoterOrVenue ? { general: updatedDocuments } : updatedDocuments
      });
      console.log('[ManageProfileScreen] API response:', response);

      console.log('[ManageProfileScreen] Reloading profile data...');
      await reloadProfileData();
      console.log('[ManageProfileScreen] Profile data reloaded');
    } catch (error) {
      console.error('[ManageProfileScreen] Error saving document:', error);
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

    let updatedDocuments;

    if (isPromoterOrVenue) {
      // Promoter/Venue: category is actually docId (flat array)
      updatedDocuments = documents.filter(d => d.id !== category);
    } else {
      // Artist: categorized object
      updatedDocuments = { ...documents };
      updatedDocuments[category] = updatedDocuments[category].filter(d => d.id !== docId);
    }

    setDocuments(updatedDocuments);

    // Save to backend
    try {
      await apiService.updateProfile(user.id, {
        documents: isPromoterOrVenue ? { general: updatedDocuments } : updatedDocuments
      });
      await reloadProfileData();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      pressKit: 'Press Kit',
      technicalRider: 'Technical Rider',
      hospitalityRider: 'Hospitality Rider',
      contracts: 'Contract'
    };
    return labels[category] || 'Document';
  };

  // Handle tab change with fresh data fetch for documents
  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (tab === 'documents') {
      console.log('[ManageProfileScreen] Switching to documents tab, fetching fresh data');
      await reloadProfileData();
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };

  // Dashboard Tab
  const renderDashboardTab = () => {
    const isPromoterOrVenue = user?.role === 'PROMOTER' || user?.role === 'VENUE';
    const revenueLabel = isPromoterOrVenue ? 'Costs' : 'Revenue';

    return (
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
          <div className="metric-label">{`This Year ${revenueLabel}`}</div>
        </div>
        {/* Bottom Row */}
        <div className="metric-card">
          <div className="metric-icon"><CalendarIcon /></div>
          <div className="metric-value">
            {upcomingGigs === null ? '...' : upcomingGigs}
          </div>
          <div className="metric-label">Upcoming Bookings</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><DollarIcon /></div>
          <div className="metric-value">
            {expectedRevenue === null ? '...' : formatCurrencyWithSymbol(expectedRevenue, preferredCurrency)}
          </div>
          <div className="metric-label">{`Expected ${revenueLabel}`}</div>
        </div>
      </div>

      {/* Actions Required Section */}
      <div className="dashboard-section actions-required-section">
        <h3><AlertIcon /> Actions Required {actionItems.length > 0 && <span className="action-count">({actionItems.length})</span>}</h3>
        <div className="action-items">
          {actionItems.length === 0 ? (
            <div className="action-empty">Nothing needs your attention right now.</div>
          ) : (
            actionItems.map((item) => {
              const Icon = getActionIcon(item.type);
              return (
                <div key={item.id} className="action-item">
                  <div className="action-icon"><Icon /></div>
                  <div className="action-content">
                    <div className="action-title">{item.title}</div>
                    {item.subtitle && <div className="action-subtitle">{item.subtitle}</div>}
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => handleActionTarget(item.target, { onSwitchTab, onClose })}>
                    {item.actionLabel}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Revenue/Costs Chart */}
      <div className="dashboard-section revenue-overview-section">
        <h3><TrendingUpIcon /> {revenueLabel} Overview</h3>
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
  };

  // Documents Tab
  const renderDocumentsTab = () => {
    console.log('[ManageProfileScreen] Rendering documents tab. Current documents state:', documents);

    // Promoter/Venue: Simple flat list
    if (isPromoterOrVenue) {
      return (
        <div className="artist-info-tab">
          <div className="dashboard-section">
            <div className="section-header">
              <div>
                <h3><FileIcon /> Documents</h3>
                <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0 0' }}>
                  Add important documents like contracts, licenses, permits, insurance, financial records, technical specs, etc.
                </p>
              </div>
              <button
                onClick={() => handleAddDocument()}
                aria-label="Add document"
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
            </div>

            {documents.length === 0 ? (
              <div style={{
                padding: '40px 24px',
                textAlign: 'center',
                color: '#888'
              }}>
                <FileIcon style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                <p style={{ marginBottom: '16px' }}>No documents added yet</p>
                <button
                  className="btn btn-primary"
                  onClick={() => handleAddDocument()}
                >
                  + Add Your First Document
                </button>
              </div>
            ) : (
              <div className="doc-list">
                {documents.map(doc => (
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
                            {isBackendFileUrl(doc) ? 'View file' : 'Open link ↗'}
                          </button>
                        )}
                        {doc.addedDate && (
                          <div style={{
                            color: '#666',
                            fontSize: '12px'
                          }}>
                            Added {new Date(doc.addedDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleEditDocument(doc)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleDeleteDocument(doc.id)}
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
        </div>
      );
    }

    // Artist: Categorized rendering (original code)
    const renderDocCategory = (category, icon, title, note = null) => {
      console.log(`[ManageProfileScreen] Rendering ${category}, count:`, documents[category].length);
      return (
      <div className="dashboard-section" key={category}>
        <div className="section-header">
          <h3>{icon} {title}</h3>
          {documents[category].length > 0 && (
            <button
              onClick={() => handleAddDocument(category)}
              aria-label={`Add ${title}`}
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
                padding: '8px 16px',
                fontSize: '12px'
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
                        {doc.type === 'upload' || doc.url.startsWith('/api/') ? 'View file' : 'Open link ↗'}
                      </button>
                    )}
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
    };

    return (
      <div className="artist-info-tab">
        {renderDocCategory('pressKit', <ImageIcon />, 'Press Kit', 'Add press photos, bio, EPK, or music samples')}
        {renderDocCategory('technicalRider', <SlidersIcon />, 'Technical Rider', 'Add stage plot, sound + lighting requirements, equipment list')}
        {renderDocCategory('hospitalityRider', <SlidersIcon />, 'Hospitality Rider', 'Add accommodation, meals, transport, dressing room requirements')}
        {renderDocCategory('contracts', <FileTextIcon />, 'Contracts', 'Add contract templates. These can be customized per booking.')}
      </div>
    );
  };

  return (
    <div className="screen active manage-artist-screen">
      <div className="manage-artist-header">
        <button className="back-btn" onClick={onClose}>
          <CloseIcon />
        </button>
        <h1>Manage {user?.name || 'Profile'}</h1>
      </div>

      {/* Artist Info Bar */}
      <div className="artist-info-bar">
        <div className="artist-avatar-small">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} />
          ) : (
            getInitial(user?.name)
          )}
        </div>
        <div className="artist-info-text">
          <div className="artist-name">{user?.name}</div>
          <div className="artist-location">{user?.location}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => handleTabChange('calendar')}
        >
          Calendar
        </button>
        <button
          className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => handleTabChange('documents')}
        >
          Documents
        </button>
      </div>

      {/* Tab Content */}
      <div className="manage-artist-content relative isolate">
        {/* faint engineering grid fading from the top (quiet-premium backdrop) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 -z-10 bg-grid opacity-40
                     [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
        />
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'calendar' && <CalendarScreen embedded={true} />}
        {activeTab === 'documents' && renderDocumentsTab()}
      </div>

      {/* Add/Edit Document Modal */}
      <AddContractModal
        isOpen={showAddDocModal}
        category={docCategory}
        categoryLabel={getCategoryLabel(docCategory)}
        initialTitle={editingDoc?.title || ''}
        initialUrl={editingDoc?.url || ''}
        initialType={editingDoc?.type || 'link'}
        existingFileName={editingDoc?.file?.name || editingDoc?.title || ''}
        submitLabel={editingDoc ? 'Save' : 'Add'}
        submittingLabel="Saving…"
        onClose={() => {
          setShowAddDocModal(false);
          setNewDoc({ title: '', url: '' });
          setEditingDoc(null);
        }}
        onSave={async (documentData) => {
          let updatedDocuments;

          if (isPromoterOrVenue) {
            if (editingDoc) {
              updatedDocuments = documents.map(d =>
                d.id === editingDoc.id
                  ? {
                      ...editingDoc,
                      title: documentData.title,
                      url: documentData.url,
                      type: documentData.type,
                      addedDate: new Date().toISOString()
                    }
                  : d
              );
            } else {
              updatedDocuments = [...documents, {
                id: Date.now().toString(),
                title: documentData.title,
                url: documentData.url,
                type: documentData.type,
                addedDate: new Date().toISOString()
              }];
            }
          } else {
            updatedDocuments = { ...documents };
            if (editingDoc) {
              const index = updatedDocuments[docCategory].findIndex(d => d.id === editingDoc.id);
              if (index !== -1) {
                updatedDocuments[docCategory][index] = {
                  ...editingDoc,
                  title: documentData.title,
                  url: documentData.url,
                  type: documentData.type,
                  addedDate: new Date().toISOString()
                };
              }
            } else {
              updatedDocuments[docCategory].push({
                id: Date.now().toString(),
                title: documentData.title,
                url: documentData.url,
                type: documentData.type,
                addedDate: new Date().toISOString()
              });
            }
          }

          try {
            const documentsToSave = isPromoterOrVenue
              ? { general: updatedDocuments }
              : updatedDocuments;
            await apiService.updateProfile(user.id, { documents: documentsToSave });
            setDocuments(updatedDocuments);
            await reloadProfileData();
            alert('Document added successfully!');
          } catch (error) {
            console.error('[ManageProfileScreen] Failed to save document:', error);
            alert('Failed to save document. Please try again.');
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

export default ManageProfileScreen;
