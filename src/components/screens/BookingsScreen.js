import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import WorkflowTimeline from '../common/WorkflowTimeline';
import AddContractModal from '../common/AddContractModal';

const BookingsScreen = ({ onOpenChat, onNavigateToMessages }) => {
  const { user: currentUser, reloadProfileData } = useAppContext();

  // Helper function to convert relative URLs to full backend URLs with auth
  const getFullUrl = (url) => {
    if (!url) return '';

    const token = localStorage.getItem('token');
    const profileId = currentUser?.id;

    // If already a full URL with query params, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Convert relative URL to full backend URL
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
    const backendBase = API_URL.replace('/api', ''); // Remove /api suffix

    // Add query parameters for authentication
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${backendBase}${url}${separator}profileId=${profileId}&token=${token}`;

    return fullUrl;
  };

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'past', or 'declined'
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [dealToDelete, setDealToDelete] = useState(null);
  const [expandedDealId, setExpandedDealId] = useState(null);
  const [dealToDecline, setDealToDecline] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  // Workflow state
  const [showContractModal, setShowContractModal] = useState(false);
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDealForWorkflow, setSelectedDealForWorkflow] = useState(null);
  const [documentTypeToShare, setDocumentTypeToShare] = useState(null);
  const [artistProfile, setArtistProfile] = useState(null); // For agent bookings
  const [showWithdrawConfirmation, setShowWithdrawConfirmation] = useState(false);

  // Agent artist filter
  const [selectedArtistFilter, setSelectedArtistFilter] = useState('all');
  const representedArtists = currentUser?.role === 'AGENT' ? (currentUser.representingArtists || []) : [];
  const [dealToWithdraw, setDealToWithdraw] = useState(null);

  useEffect(() => {
    fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Reload profile data when contract or document modal opens to get latest documents
  useEffect(() => {
    if (showContractModal || showDocumentModal) {
      reloadProfileData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContractModal, showDocumentModal]);

  // Fetch artist profile when contract modal opens for agent bookings
  useEffect(() => {
    const fetchArtistProfile = async () => {
      console.log('[BookingsScreen] fetchArtistProfile triggered:', {
        showContractModal,
        showAddContractModal,
        hasDeal: !!selectedDealForWorkflow,
        artistId: selectedDealForWorkflow?.artistId,
        dealEvent: selectedDealForWorkflow?.eventName
      });

      if ((showContractModal || showAddContractModal) && selectedDealForWorkflow && selectedDealForWorkflow.artistId) {
        try {
          console.log('[BookingsScreen] Fetching artist profile:', selectedDealForWorkflow.artistId);
          const profile = await apiService.getProfile(selectedDealForWorkflow.artistId);
          console.log('[BookingsScreen] Artist profile fetched:', profile.name, 'Contracts:', profile.documents?.contracts?.length);
          setArtistProfile(profile);
        } catch (err) {
          console.error('Failed to fetch artist profile:', err);
          setArtistProfile(null);
        }
      } else {
        console.log('[BookingsScreen] No artistId or modal not open, clearing artistProfile');
        setArtistProfile(null);
      }
    };
    fetchArtistProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContractModal, showAddContractModal, selectedDealForWorkflow]);

  const fetchDeals = async () => {
    if (!currentUser || !currentUser.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch all deals for this user (both sent and received)
      const response = await apiService.getDeals({ profileId: currentUser.id });

      // DEBUG: Log deal artistId fields
      console.log('[fetchDeals] Fetched', response.deals?.length, 'deals');
      response.deals?.forEach((deal, idx) => {
        console.log(`[fetchDeals] Deal ${idx}:`, deal.eventName, 'bookedArtistId:', deal.bookedArtistId || 'NOT SET');
      });

      setDeals(response.deals || []);
    } catch (err) {
      console.error('Error fetching deals:', err);
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDeal = async (dealId) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await apiService.acceptDeal(dealId, currentUser.id);
      fetchDeals();
    } catch (err) {
      console.error('Error accepting deal:', err);
      alert(err.message || 'Failed to accept offer');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeclineDeal = async () => {
    if (actionBusy || !dealToDecline) return;

    if (!declineReason.trim()) {
      alert('Please provide a reason for declining');
      return;
    }

    setActionBusy(true);
    try {
      await apiService.declineDeal(dealToDecline, currentUser.id, declineReason);
      setDealToDecline(null);
      setDeclineReason('');
      fetchDeals();
    } catch (err) {
      console.error('Error declining deal:', err);
      alert(err.message || 'Failed to decline offer');
      setDealToDecline(null);
      setDeclineReason('');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteDeal = async () => {
    if (actionBusy || !dealToDelete) return;
    setActionBusy(true);
    try {
      await apiService.deleteDeal(dealToDelete, currentUser.id);
      setDealToDelete(null);
      fetchDeals();
    } catch (err) {
      console.error('Error deleting deal:', err);
      alert(err.message || 'Failed to delete offer');
      setDealToDelete(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleWithdrawContract = async () => {
    if (actionBusy || !dealToWithdraw) return;
    setActionBusy(true);
    try {
      await apiService.withdrawContract(dealToWithdraw.id, currentUser.id);
      setDealToWithdraw(null);
      setShowWithdrawConfirmation(false);
      fetchDeals();
      alert('Contract withdrawn successfully. You can now send a new contract.');
    } catch (err) {
      console.error('Error withdrawing contract:', err);
      alert(err.message || 'Failed to withdraw contract');
      setDealToWithdraw(null);
      setShowWithdrawConfirmation(false);
    } finally {
      setActionBusy(false);
    }
  };

  const toggleDealExpanded = (dealId) => {
    setExpandedDealId(expandedDealId === dealId ? null : dealId);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Filter deals into past, upcoming, and declined (with optional agent artist filter)
  const filterDeals = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return deals.filter(deal => {
      const dealDate = new Date(deal.date);
      dealDate.setHours(0, 0, 0, 0);

      // Agent artist filter: if a specific artist is selected, only show their deals
      if (selectedArtistFilter !== 'all' && currentUser?.role === 'AGENT') {
        const dealArtistId = deal.bookedArtistId || deal.artistId;
        if (dealArtistId !== selectedArtistFilter) return false;
      }

      if (activeTab === 'declined') {
        return deal.status === 'DECLINED';
      } else if (activeTab === 'upcoming') {
        return dealDate >= today && deal.status !== 'DECLINED';
      } else {
        return dealDate < today && deal.status !== 'DECLINED';
      }
    });
  };

  // Cluster deals by month and year
  const clusterDealsByMonth = (filteredDeals) => {
    const clusters = {};

    filteredDeals.forEach(deal => {
      const date = new Date(deal.date);
      const monthYear = `${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`;

      if (!clusters[monthYear]) {
        clusters[monthYear] = {
          monthYear,
          date: date, // Store date for sorting
          deals: []
        };
      }

      clusters[monthYear].deals.push(deal);
    });

    // Sort clusters by date
    const sortedClusters = Object.values(clusters).sort((a, b) => {
      if (activeTab === 'upcoming') {
        return a.date - b.date; // Ascending for upcoming
      } else {
        return b.date - a.date; // Descending for past
      }
    });

    // Sort deals within each cluster by date
    sortedClusters.forEach(cluster => {
      cluster.deals.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (activeTab === 'upcoming') {
          return dateA - dateB; // Ascending for upcoming
        } else {
          return dateB - dateA; // Descending for past
        }
      });
    });

    return sortedClusters;
  };

  const filteredDeals = filterDeals();
  const clusteredDeals = clusterDealsByMonth(filteredDeals);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'PENDING':
        return 'status-badge status-pending';
      case 'NEGOTIATING':
        return 'status-badge status-negotiating';
      case 'ACCEPTED':
        return 'status-badge status-accepted';
      case 'DECLINED':
        return 'status-badge status-declined';
      case 'COMPLETED':
        return 'status-badge status-completed';
      default:
        return 'status-badge';
    }
  };

  const renderDealCard = (deal) => {
    const isOutgoing = deal.initiator.id === currentUser.id;
    const otherParty = isOutgoing
      ? (deal.venue.id === currentUser.id ? deal.artist : deal.venue)
      : deal.initiator;
    const isExpanded = expandedDealId === deal.id;

    // Visibility + write-access flags for the deal card.
    //   isViaAgent — show the "via agent" sub-line (artist viewer + booker viewer when relevant).
    //   delegateToAgent — ARTIST viewer of an agent-led deal: their agent handles it.
    //   agentReadOnly — AGENT viewer of an ARTIST-DIRECT deal: see for visibility, but the
    //     artist is in charge; hide all workflow controls.
    //   hideWorkflow — either of the above hide-conditions applies.
    const artistRepresentedBy = Array.isArray(deal.artist?.representedBy)
      ? deal.artist.representedBy
      : (deal.artist?.representedBy ? [deal.artist.representedBy] : []);
    const isArtistViewerViaAgent = !!deal.bookedArtistId && currentUser.role === 'ARTIST';
    const isBookerViewerViaAgent =
      (currentUser.role === 'PROMOTER' || currentUser.role === 'VENUE') &&
      artistRepresentedBy.length > 0;
    const isViaAgent = isArtistViewerViaAgent || isBookerViewerViaAgent;
    const delegateToAgent = isArtistViewerViaAgent;
    const agentReadOnly =
      currentUser.role === 'AGENT' &&
      deal.artistId !== currentUser.id &&
      deal.venueId !== currentUser.id &&
      !deal.bookedArtistId;
    const hideWorkflow = delegateToAgent || agentReadOnly;
    const agentName = !isViaAgent
      ? null
      : isArtistViewerViaAgent
        ? (Array.isArray(currentUser.representedBy)
            ? (currentUser.representedBy.map(a => a.name || a.agentName).filter(Boolean).join(', ') || 'agent')
            : (currentUser.representedBy?.name || 'agent'))
        : (artistRepresentedBy.map(a => a.name || a.agentName).filter(Boolean).join(', ') || 'agent');

    // The booker's "Message" CTA should route to whoever is leading the
    // negotiation. When the artist has an agent, that's the agent.
    const primaryAgent = isBookerViewerViaAgent ? artistRepresentedBy[0] : null;
    const messageTarget = primaryAgent
      ? {
          id: primaryAgent.profileId,
          name: primaryAgent.name || agentName,
          role: 'AGENT',
        }
      : otherParty;

    const dealDate = new Date(deal.date);
    const dayNumber = dealDate.getDate();

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
              otherParty.name.charAt(0).toUpperCase()
            )}
          </div>

          <div
            className="party-info"
            onClick={() => toggleDealExpanded(deal.id)}
            style={{ cursor: 'pointer', flex: 1 }}
          >
            <div className="party-name-role">
              <h3>{otherParty.name}</h3>
              <span className={`role-badge ${otherParty.role.toLowerCase()}`}>
                {otherParty.role}
              </span>
            </div>
            {isViaAgent && agentName && (
              <p className="party-via-agent">via {agentName} · Agent</p>
            )}
            {agentReadOnly && (
              <p className="party-via-agent">via {deal.artist?.name || 'the artist'} · Artist-direct</p>
            )}
            <p className="party-location">
              {deal.city && deal.country ? `${deal.city}, ${deal.country}` : otherParty.location}
            </p>
            <div className="party-status-row">
              <span className={getStatusBadgeClass(deal.status)}>
                {deal.status}
              </span>
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
          <>
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
                  {(deal.city || deal.venue?.location) && (
                    <div className="detail-subtext">
                      ({deal.city && deal.country ? `${deal.city}, ${deal.country}` : deal.venue?.location})
                    </div>
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
                    <div>{deal.setStartTime} - {deal.setEndTime}</div>
                    {deal.setDuration && (
                      <div className="detail-subtext">({deal.setDuration} minutes)</div>
                    )}
                  </span>
                </div>
              )}
              <div className="booking-detail-row">
                <span className="detail-label">Fee:</span>
                <span className="detail-value booking-fee">
                  {Number.isInteger(deal.currentFee)
                    ? deal.currentFee.toLocaleString()
                    : deal.currentFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {deal.currency}
                </span>
              </div>
              {deal.extras && Object.keys(deal.extras).length > 0 && (
                <div className="booking-detail-row full-width">
                  <span className="detail-label">Extras:</span>
                  <div className="detail-value extras-list">
                    {Object.entries(deal.extras).map(([key, value]) => (
                      <div key={key} className="extra-item">
                        <div className="extra-content">
                          <strong style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</strong>
                          {value !== 'Included' && <span className="extra-note">: {value}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {deal.additionalTerms && (() => {
                // Try to parse additionalTerms as JSON and render like extras
                let parsedTerms = null;
                try {
                  const parsed = typeof deal.additionalTerms === 'string'
                    ? JSON.parse(deal.additionalTerms)
                    : deal.additionalTerms;
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    parsedTerms = parsed;
                  }
                } catch (e) { /* not JSON, render as text */ }

                return parsedTerms ? (
                  <div className="booking-detail-row full-width">
                    <span className="detail-label">Extras:</span>
                    <div className="detail-value extras-list">
                      {Object.entries(parsedTerms).filter(([, v]) => v).map(([key, value]) => (
                        <div key={key} className="extra-item">
                          <div className="extra-content">
                            <strong style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</strong>
                            {value !== 'Included' && value !== true && <span className="extra-note">: {value}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="booking-detail-row full-width">
                    <span className="detail-label">Additional Terms:</span>
                    <span className="detail-value">{deal.additionalTerms}</span>
                  </div>
                );
              })()}
              {deal.technicalRequirements && (
                <div className="booking-detail-row full-width">
                  <span className="detail-label">Technical:</span>
                  <span className="detail-value">{deal.technicalRequirements}</span>
                </div>
              )}
              {deal.paymentTerms && (
                <div className="booking-detail-row full-width">
                  <span className="detail-label">Payment Terms:</span>
                  <span className="detail-value">{deal.paymentTerms}</span>
                </div>
              )}
              {deal.notes && (
                <div className="booking-detail-row full-width">
                  <span className="detail-label">Notes:</span>
                  <span className="detail-value">{deal.notes}</span>
                </div>
              )}
            </div>

            {/* Workflow Timeline for ACCEPTED deals */}
            {deal.status === 'ACCEPTED' && !hideWorkflow && (
              <WorkflowTimeline deal={deal} />
            )}

            {/* Workflow Action Buttons for ACCEPTED deals - hidden when the agent handles it */}
            {deal.status === 'ACCEPTED' && !hideWorkflow && (
              <div className="workflow-actions">
                {/* Contract Actions */}
                {(!deal.contract || deal.contract.status === 'NOT_SENT') && (
                  <>
                    <button
                      className="btn btn-outline"
                      disabled={actionBusy}
                      onClick={async () => {
                        if (actionBusy) return;
                        console.log('[Send Contract Button] Clicked for deal:', deal.eventName);
                        console.log('[Send Contract Button] Deal artistId:', deal.bookedArtistId || 'NOT SET');
                        console.log('[Send Contract Button] Deal artist.id:', deal.artist?.id);

                        setSelectedDealForWorkflow(deal);

                        // If this is an agent booking (has artistId), fetch artist profile FIRST
                        if (deal.bookedArtistId) {
                          try {
                            console.log('[Send Contract Button] Fetching artist profile BEFORE opening modal:', deal.bookedArtistId);
                            const profile = await apiService.getProfile(deal.bookedArtistId);
                            console.log('[Send Contract Button] Artist profile fetched:', profile.name, 'Contracts:', profile.documents?.contracts?.length);
                            setArtistProfile(profile);
                            // NOW open the modal after profile is loaded
                            setShowAddContractModal(true);
                          } catch (err) {
                            console.error('Failed to fetch artist profile:', err);
                            alert('Failed to load artist profile. Please try again.');
                          }
                        } else {
                          // Not an agent booking, open modal directly
                          setShowAddContractModal(true);
                        }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      Send Contract
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={actionBusy}
                      onClick={async () => {
                        if (actionBusy) return;
                        if (window.confirm('Skip contract stage? You can still share documents and proceed with the booking.')) {
                          setActionBusy(true);
                          try {
                            await apiService.skipContract(deal.id, currentUser.id);
                            fetchDeals();
                          } catch (err) {
                            alert(err.message || 'Failed to skip contract');
                          } finally {
                            setActionBusy(false);
                          }
                        }
                      }}
                      style={{
                        marginLeft: '8px',
                        opacity: 0.7
                      }}
                    >
                      Skip Contract
                    </button>
                  </>
                )}
                {deal.contract && deal.contract.status !== 'NOT_SENT' && deal.contract.status !== 'FULLY_SIGNED' && (() => {
                  console.log('[BookingsScreen] Contract button debug:', {
                    dealId: deal.id,
                    eventName: deal.eventName,
                    contractStatus: deal.contract.status,
                    sentBy: deal.contract.sentBy,
                    sentById: deal.contract.sentBy?.id,
                    currentUserId: currentUser.id,
                    currentUserName: currentUser.name,
                    match: deal.contract.sentBy?.id === currentUser.id
                  });
                  const isSender = deal.contract.sentBy && deal.contract.sentBy.id === currentUser.id;

                  if (isSender) {
                    // Sender sees: View Contract and Withdraw Contract
                    return (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a
                          href={(() => {
                            // Construct the contract view URL from documentId
                            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
                            const backendBase = API_URL.replace('/api', '');
                            const token = localStorage.getItem('token');
                            const profileId = currentUser?.id;

                            // First try documentUrl if it exists and looks valid
                            if (deal.contract.documentUrl && deal.contract.documentUrl !== 'N/A') {
                              return getFullUrl(deal.contract.documentUrl);
                            }

                            // Otherwise construct URL from documentId
                            const documentId = deal.contract.documentId;
                            if (documentId) {
                              return `${backendBase}/api/contracts/view/${documentId}?profileId=${profileId}&token=${token}`;
                            }

                            // Fallback
                            return '#';
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline"
                          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          View Contract
                        </a>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setDealToWithdraw(deal);
                            setShowWithdrawConfirmation(true);
                          }}
                          style={{
                            borderColor: 'rgba(255, 165, 0, 0.5)',
                            color: 'rgba(255, 165, 0, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          Withdraw Contract
                        </button>
                      </div>
                    );
                  } else {
                    // Receiver sees: Sign Contract
                    return (
                      <button
                        className="btn btn-primary"
                        disabled={actionBusy}
                        onClick={async () => {
                          if (actionBusy) return;
                          setActionBusy(true);
                          try {
                            await apiService.signContract(deal.id, currentUser.id);
                            fetchDeals();
                          } catch (err) {
                            alert(err.message || 'Failed to sign contract');
                          } finally {
                            setActionBusy(false);
                          }
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 17l6 6 13-13"></path>
                        </svg>
                        Sign Contract
                      </button>
                    );
                  }
                })()}

                {/* Document Sharing Actions */}
                {deal.contract && deal.contract.status === 'FULLY_SIGNED' && (
                  <>
                    {(!deal.sharedDocuments?.pressKit?.shared) && (
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setSelectedDealForWorkflow(deal);
                          setDocumentTypeToShare('pressKit');
                          setShowDocumentModal(true);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                        </svg>
                        Share Press Kit
                      </button>
                    )}
                    {(!deal.sharedDocuments?.technicalRider?.shared) && (
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setSelectedDealForWorkflow(deal);
                          setDocumentTypeToShare('technicalRider');
                          setShowDocumentModal(true);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                        </svg>
                        Share Technical Rider
                      </button>
                    )}
                  </>
                )}

                {/* Payment Actions (only for venue/promoter) */}
                {deal.venue.id === currentUser.id && deal.payment && deal.payment.status !== 'FULLY_PAID' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedDealForWorkflow(deal);
                      setShowPaymentModal(true);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    Update Payment
                  </button>
                )}
              </div>
            )}

            {/* Action buttons - show when current user can accept/decline */}
            {/* For PENDING: recipient (not initiator) can accept/decline */}
            {/* For NEGOTIATING: the party who did NOT send the last counter-offer can accept/decline */}
            {(() => {
              const offerHistory = deal.offerHistory || [];
              const lastOffer = offerHistory.length > 0 ? offerHistory[offerHistory.length - 1] : null;
              const canRespond = lastOffer
                ? lastOffer.offeredBy !== currentUser.id  // Counter-offer: other party can respond
                : !isOutgoing;  // Initial offer: recipient can respond
              return canRespond;
            })() && !hideWorkflow && (deal.status === 'PENDING' || deal.status === 'NEGOTIATING') && (
              <div className="booking-actions">
                <button
                  className="btn btn-outline btn-decline"
                  onClick={() => setDealToDecline(deal.id)}
                >
                  Decline
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setExpandedDealId(null);
                    // Open ChatScreen and trigger Review modal — agent if leading.
                    if (onOpenChat) {
                      onOpenChat(messageTarget, deal);
                    }
                  }}
                >
                  Review
                </button>
                <button
                  className="btn btn-primary btn-accept"
                  onClick={() => handleAcceptDeal(deal.id)}
                  disabled={actionBusy}
                >
                  {actionBusy ? '...' : 'Accept'}
                </button>
              </div>
            )}

            {/* Info message — first-person "your agent" so artist-only */}
            {delegateToAgent && (
              <div className="via-agent-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="8"></line>
                </svg>
                <span>This booking is managed by your agent{agentName ? ` (${agentName})` : ''}.</span>
              </div>
            )}

            {/* Show chat button — hidden for artist viewer when handled by agent.
                Booker chats with the agent (messageTarget) when applicable. */}
            {!hideWorkflow && (
              <button
                className="btn btn-outline btn-chat"
                onClick={() => onOpenChat && onOpenChat(messageTarget)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Message
              </button>
            )}

            {/* Delete offer button (only for outgoing pending offers, not when agent handles it) */}
            {isOutgoing && !hideWorkflow && deal.status === 'PENDING' && (
              <button
                className="btn btn-outline btn-delete-offer-expanded"
                onClick={(e) => {
                  e.stopPropagation();
                  setDealToDelete(deal.id);
                }}
              >
                Delete Offer
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bookings-screen">
      <div className="bookings-tabs">
        <button
          className={`bookings-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming
          {activeTab === 'upcoming' && filteredDeals.length > 0 && (
            <span className="tab-badge">{filteredDeals.length}</span>
          )}
        </button>
        <button
          className={`bookings-tab ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Past
          {activeTab === 'past' && filteredDeals.length > 0 && (
            <span className="tab-badge">{filteredDeals.length}</span>
          )}
        </button>
        <button
          className={`bookings-tab ${activeTab === 'declined' ? 'active' : ''}`}
          onClick={() => setActiveTab('declined')}
        >
          Declined
          {activeTab === 'declined' && filteredDeals.length > 0 && (
            <span className="tab-badge">{filteredDeals.length}</span>
          )}
        </button>
      </div>

      {/* Agent artist filter dropdown */}
      {currentUser?.role === 'AGENT' && representedArtists.length > 0 && (
        <div className="agent-artist-filter">
          <select
            value={selectedArtistFilter}
            onChange={(e) => setSelectedArtistFilter(e.target.value)}
            className="agent-artist-select"
          >
            <option value="all">All Artists ({deals.length})</option>
            {representedArtists.map(artist => (
              <option key={artist.profileId} value={artist.profileId}>
                {artist.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bookings-content">
        {loading ? (
          <div className="bookings-loading">
            <div className="spinner"></div>
            <p>Loading bookings...</p>
          </div>
        ) : error ? (
          <div className="bookings-error">
            <p>{error}</p>
            <button className="btn btn-outline" onClick={fetchDeals}>
              Try Again
            </button>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="bookings-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <h3>No {activeTab === 'upcoming' ? 'upcoming' : activeTab === 'past' ? 'past' : 'declined'} bookings</h3>
            <p>
              {activeTab === 'upcoming'
                ? 'Start conversations and book gigs for upcoming events!'
                : activeTab === 'past'
                ? 'Your past bookings will appear here.'
                : 'Your declined offers will appear here.'
              }
            </p>
          </div>
        ) : (
          <div className="bookings-list">
            {clusteredDeals.map((cluster, index) => (
              <div key={index} className="bookings-cluster">
                <div className="cluster-header">
                  <h2>{cluster.monthYear}</h2>
                  <span className="cluster-count">{cluster.deals.length} offer{cluster.deals.length !== 1 ? 's' : ''}</span>
                </div>
                {cluster.deals.map(deal => renderDealCard(deal))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {dealToDelete && (
        <div className="delete-modal-overlay" onClick={() => setDealToDelete(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>Delete Offer</h3>
            </div>
            <div className="delete-modal-content">
              <p>Are you sure you want to delete this offer?</p>
              <p className="delete-modal-warning">This action cannot be undone.</p>
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => setDealToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteDeal}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : 'Delete Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Offer Modal */}
      {dealToDecline && (
        <div className="delete-modal-overlay" onClick={() => {
          setDealToDecline(null);
          setDeclineReason('');
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>Decline Offer</h3>
            </div>
            <div className="delete-modal-content">
              <p>Please provide a reason for declining this offer:</p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., Date conflict, budget doesn't work, etc."
                className="decline-reason-textarea"
                rows="4"
                autoFocus
              />
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setDealToDecline(null);
                  setDeclineReason('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeclineDeal}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : 'Decline Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Contract Modal */}
      {showContractModal && selectedDealForWorkflow && (
        <div className="delete-modal-overlay" onClick={() => {
          setShowContractModal(false);
          setSelectedDealForWorkflow(null);
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>Send Contract</h3>
            </div>
            <div className="delete-modal-content">
              <p style={{ marginBottom: '16px' }}>
                {artistProfile ? `Select a contract from ${artistProfile.name}'s documents:` : 'Select a contract from your documents:'}
              </p>
              <div className="document-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {(() => {
                  // Use artist's documents if available (agent booking), otherwise use current user's
                  const documentsSource = artistProfile || currentUser;
                  const contracts = documentsSource.documents?.contracts;

                  return contracts && Array.isArray(contracts) && contracts.length > 0 ? (
                    contracts.map(doc => (
                      <div
                        key={doc.id}
                        className="document-item"
                        style={{
                          padding: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={async () => {
                          if (actionBusy) return;
                          setActionBusy(true);
                          try {
                            await apiService.sendContract(
                              selectedDealForWorkflow.id,
                              currentUser.id,
                              doc
                            );
                            setShowContractModal(false);
                            setSelectedDealForWorkflow(null);
                            fetchDeals();
                          } catch (err) {
                            alert(err.message || 'Failed to send contract');
                          } finally {
                            setActionBusy(false);
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 51, 102, 0.1)';
                          e.currentTarget.style.borderColor = 'var(--primary-pink)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                      >
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{doc.title}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          {doc.addedDate ? new Date(doc.addedDate).toLocaleDateString() : 'No date'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', padding: '20px' }}>
                      No contracts available. Please add contracts to {artistProfile ? artistProfile.name + "'s" : 'your'} profile first.
                    </p>
                  );
                })()}
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowContractModal(false);
                  setSelectedDealForWorkflow(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Document Modal */}
      {showDocumentModal && selectedDealForWorkflow && documentTypeToShare && (
        <div className="delete-modal-overlay" onClick={() => {
          setShowDocumentModal(false);
          setSelectedDealForWorkflow(null);
          setDocumentTypeToShare(null);
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>Share {documentTypeToShare === 'pressKit' ? 'Press Kit' : 'Technical Rider'}</h3>
            </div>
            <div className="delete-modal-content">
              <p style={{ marginBottom: '16px' }}>Select a document to share:</p>
              <div className="document-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {currentUser.documents?.[documentTypeToShare] && Array.isArray(currentUser.documents[documentTypeToShare]) && currentUser.documents[documentTypeToShare].length > 0 ? (
                  currentUser.documents[documentTypeToShare].map(doc => (
                      <div
                        key={doc.id}
                        className="document-item"
                        style={{
                          padding: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={async () => {
                          if (actionBusy) return;
                          setActionBusy(true);
                          try {
                            await apiService.shareDocument(
                              selectedDealForWorkflow.id,
                              currentUser.id,
                              documentTypeToShare,
                              doc
                            );
                            setShowDocumentModal(false);
                            setSelectedDealForWorkflow(null);
                            setDocumentTypeToShare(null);
                            fetchDeals();
                          } catch (err) {
                            alert(err.message || 'Failed to share document');
                          } finally {
                            setActionBusy(false);
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 51, 102, 0.1)';
                          e.currentTarget.style.borderColor = 'var(--primary-pink)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                      >
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{doc.title}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          {doc.addedDate ? new Date(doc.addedDate).toLocaleDateString() : 'No date'}
                        </div>
                      </div>
                    ))
                ) : (
                  <p style={{ color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', padding: '20px' }}>
                    No {documentTypeToShare === 'pressKit' ? 'press kits' : 'technical riders'} available.
                  </p>
                )}
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowDocumentModal(false);
                  setSelectedDealForWorkflow(null);
                  setDocumentTypeToShare(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Payment Modal */}
      {showPaymentModal && selectedDealForWorkflow && (
        <div className="delete-modal-overlay" onClick={() => {
          setShowPaymentModal(false);
          setSelectedDealForWorkflow(null);
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>Update Payment Status</h3>
            </div>
            <div className="delete-modal-content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={actionBusy}
                  onClick={async () => {
                    if (actionBusy) return;
                    setActionBusy(true);
                    try {
                      await apiService.updatePayment(
                        selectedDealForWorkflow.id,
                        currentUser.id,
                        {
                          depositAmount: selectedDealForWorkflow.currentFee / 2,
                          paymentMethod: 'Bank Transfer'
                        }
                      );
                      setShowPaymentModal(false);
                      setSelectedDealForWorkflow(null);
                      fetchDeals();
                    } catch (err) {
                      alert(err.message || 'Failed to update payment');
                    } finally {
                      setActionBusy(false);
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  Mark Deposit Paid (50%)
                </button>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={actionBusy}
                  onClick={async () => {
                    if (actionBusy) return;
                    setActionBusy(true);
                    try {
                      await apiService.updatePayment(
                        selectedDealForWorkflow.id,
                        currentUser.id,
                        {
                          fullPayment: true,
                          paymentMethod: 'Bank Transfer'
                        }
                      );
                      setShowPaymentModal(false);
                      setSelectedDealForWorkflow(null);
                      fetchDeals();
                    } catch (err) {
                      alert(err.message || 'Failed to update payment');
                    } finally {
                      setActionBusy(false);
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l6 6 13-13"></path>
                  </svg>
                  Mark Full Payment Complete
                </button>
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedDealForWorkflow(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contract Modal */}
      {showAddContractModal && selectedDealForWorkflow && (
        <AddContractModal
          isOpen={showAddContractModal}
          category="contracts"
          categoryLabel="Contract"
          existingContracts={artistProfile?.documents?.contracts || currentUser?.documents?.contracts || []}
          onClose={() => {
            setShowAddContractModal(false);
            setSelectedDealForWorkflow(null);
          }}
          onSave={async (contractData) => {
            if (actionBusy) return;
            setActionBusy(true);
            try {
              await apiService.sendContract(
                selectedDealForWorkflow.id,
                currentUser.id,
                {
                  id: contractData.existingContract?.id || Date.now().toString(),
                  title: contractData.title,
                  url: contractData.url,
                  file: contractData.file,
                  type: contractData.type
                }
              );
              setShowAddContractModal(false);
              setSelectedDealForWorkflow(null);
              fetchDeals();
              alert('Contract sent successfully!');
            } catch (err) {
              alert(err.message || 'Failed to send contract');
            } finally {
              setActionBusy(false);
            }
          }}
        />
      )}

      {/* Withdraw Contract Confirmation Modal */}
      {showWithdrawConfirmation && dealToWithdraw && (
        <div className="delete-modal-overlay" onClick={() => {
          setShowWithdrawConfirmation(false);
          setDealToWithdraw(null);
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>Withdraw Contract</h3>
            </div>
            <div className="delete-modal-content">
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(255, 165, 0, 0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(255, 165, 0, 0.3)',
                marginBottom: '16px'
              }}>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                  ⚠️ This will remove the contract from the booking. The other party will be notified.
                </p>
              </div>
              <p style={{ marginBottom: '16px', fontSize: '14px', color: '#ccc' }}>
                Are you sure you want to withdraw the contract for <strong>{dealToWithdraw.eventName || 'this event'}</strong>?
              </p>
              <p style={{ fontSize: '13px', color: '#999', marginBottom: 0 }}>
                After withdrawal, you can send a corrected contract. The deal status will revert to ACCEPTED.
              </p>
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowWithdrawConfirmation(false);
                  setDealToWithdraw(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleWithdrawContract}
                disabled={actionBusy}
                style={{
                  backgroundColor: 'rgba(255, 165, 0, 0.8)',
                  borderColor: 'rgba(255, 165, 0, 1)'
                }}
              >
                Withdraw Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsScreen;
