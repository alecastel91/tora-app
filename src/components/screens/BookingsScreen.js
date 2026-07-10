import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import * as contractService from '../../services/contractService';
import WorkflowTimeline from '../common/WorkflowTimeline';
import AddContractModal from '../common/AddContractModal';
import SignContractModal from '../common/SignContractModal';
import ShareDocumentsModal from '../common/ShareDocumentsModal';
import PdfViewerModal from '../common/PdfViewerModal';
import { deriveSignerCapacity, deriveRecipientName, isArtistSideForDeal } from '../../utils/contractSigner';
import { DOC_CATEGORIES, categoryStatus } from '../../utils/documentCategories';
import { summarizeDealPayment } from '../../utils/paymentSummary';
import { getAuthedBackendUrl, buildPaymentProofUrl } from '../../utils/urls';
import { subscribeToDeals } from '../../services/realtime';
import LoadingGlobe from '../common/LoadingGlobe';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';

function validatePaymentProof(file) {
  if (!file) return 'A proof of payment is required';
  if (file.size > 10 * 1024 * 1024) return 'File must be 10 MB or smaller';
  if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
    return 'Proof must be a PDF or an image';
  }
  return null;
}

const BookingsScreen = ({ onOpenChat, onNavigateToMessages, isActive = true }) => {
  const { t } = useLanguage();
  const { user: currentUser, reloadProfileData } = useAppContext();
  const getFullUrl = (url) => getAuthedBackendUrl(url, currentUser?.id);

  const openContractPdf = (deal) => {
    let url = null;
    if (deal?.contract?.documentUrl && deal.contract.documentUrl !== 'N/A') {
      url = getFullUrl(deal.contract.documentUrl);
    } else if (deal?.contract?.documentId) {
      url = getFullUrl(`/api/contracts/view/${deal.contract.documentId}`);
    }
    if (url) setPdfViewerUrl(url);
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
  const [pendingContractToSign, setPendingContractToSign] = useState(null); // { documentData, deal }
  const [recipientSignData, setRecipientSignData] = useState(null); // { deal, contractUrl, senderName, initiallyViewed }
  const [pdfViewerUrl, setPdfViewerUrl] = useState(null);
  const [viewConfirmedSignal, setViewConfirmedSignal] = useState(0);
  const [depositInput, setDepositInput] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [proofImageUrl, setProofImageUrl] = useState(null);
  const [depositHistoryDeal, setDepositHistoryDeal] = useState(null);


  const openProof = (deal, type, proofMeta, index = null) => {
    const url = buildPaymentProofUrl(deal.id, currentUser?.id, type, index);
    const meta = proofMeta || (type === 'full' ? deal.payment?.fullPaymentProof : deal.payment?.depositProof);
    const isPdf = meta?.contentType === 'application/pdf'
      || (meta?.originalName || '').toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setPdfViewerUrl(url);
    } else {
      setProofImageUrl(url);
    }
  };
  useEffect(() => {
    fetchDeals();
    // Depend on the stable id, not the whole user object — otherwise
    // every reloadProfileData() (fired on modal open) churns this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Realtime: refetch deals when the backend broadcasts a deal_update
  // touching this profile (their own deals OR any artist they represent).
  // While this keep-mounted tab is hidden, just mark the list stale and
  // refetch once on reveal instead of on every broadcast.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const staleRef = useRef(false);
  useEffect(() => {
    if (isActive && staleRef.current) {
      staleRef.current = false;
      fetchDeals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubscribe = subscribeToDeals(currentUser.id, () => {
      if (isActiveRef.current) fetchDeals();
      else staleRef.current = true;
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (showContractModal || showDocumentModal) {
      reloadProfileData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContractModal, showDocumentModal]);

  // Fetch artist profile when ANY workflow modal opens that needs the
  // artist's library — contracts, document-sharing, and the add-contract
  // picker. Depend on stable ids to avoid rate-limit bursts.
  useEffect(() => {
    const fetchArtistProfile = async () => {
      if ((showContractModal || showAddContractModal) && selectedDealForWorkflow?.artistId) {
        try {
          const profile = await apiService.getProfile(selectedDealForWorkflow.artistId);
          setArtistProfile(profile);
        } catch (err) {
          console.error('Failed to fetch artist profile:', err);
          setArtistProfile(null);
        }
      } else {
        setArtistProfile(null);
      }
    };
    fetchArtistProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContractModal, showAddContractModal, selectedDealForWorkflow?.artistId]);

  const [hasMoreDeals, setHasMoreDeals] = useState(false);
  const [loadingOlderDeals, setLoadingOlderDeals] = useState(false);

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
      setDeals(response.deals || []);
      setHasMoreDeals(!!response.hasMore);
    } catch (err) {
      console.error('Error fetching deals:', err);
      setError(err.message || t('bookings.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Older pages: deals arrive newest-first, so the oldest loaded deal is
  // the cursor for the next page.
  const loadOlderDeals = async () => {
    const oldest = deals[deals.length - 1];
    if (loadingOlderDeals || !oldest?.id) return;
    setLoadingOlderDeals(true);
    try {
      const response = await apiService.getDeals({ profileId: currentUser.id, before: oldest.id });
      const older = response.deals || [];
      setHasMoreDeals(!!response.hasMore);
      setDeals(prev => [...prev, ...older.filter(d => !prev.some(p => p.id === d.id))]);
    } catch (err) {
      console.error('Error loading older bookings:', err);
    } finally {
      setLoadingOlderDeals(false);
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
      appAlert(err.message || t('chat.failedToAcceptOffer'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeclineDeal = async () => {
    if (actionBusy || !dealToDecline) return;

    if (!declineReason.trim()) {
      appAlert(t('chat.provideDeclineReason'));
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
      appAlert(err.message || t('chat.failedToDeclineOffer'));
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
      appAlert(err.message || t('bookings.deleteOfferFailed'));
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
      appAlert(t('bookings.contractWithdrawnSuccess'));
    } catch (err) {
      console.error('Error withdrawing contract:', err);
      appAlert(err.message || t('bookings.withdrawFailed'));
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
    return date.toLocaleDateString(t('dateFormat.locale'), {
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
      const monthYear = `${date.toLocaleString(t('dateFormat.locale'), { month: 'long' })} ${date.getFullYear()}`;

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
      case 'CONTRACT SIGNED':
        return 'status-badge status-accepted';
      case 'DOCS SHARED':
        return 'status-badge status-accepted';
      case 'DECLINED':
        return 'status-badge status-declined';
      case 'COMPLETED':
        return 'status-badge status-completed';
      default:
        return 'status-badge';
    }
  };

  // Display status derived from the workflow state. Skipped steps do NOT
  // promote the label (only voluntary completion does). Actions UI keeps
  // advancing independently — gated by the per-step "resolved" checks.
  const getDealDisplayStatus = (deal) => {
    // Pre-acceptance statuses pass through unchanged.
    if (deal.status === 'PENDING' || deal.status === 'NEGOTIATING' || deal.status === 'DECLINED') {
      return deal.status;
    }
    const payment = deal.payment || {};
    const fullyPaidAndConfirmed = !!payment.fullPaymentProof?.confirmedAt
      || ((Number(deal.currentFee) || 0) > 0 && (Array.isArray(payment.depositHistory) ? payment.depositHistory : [])
          .reduce((s, e) => s + (e.confirmedAt ? (Number(e.amount) || 0) : 0), 0) >= (Number(deal.currentFee) || 0));
    if (fullyPaidAndConfirmed) return 'COMPLETED';
    const docs = deal.sharedDocuments || {};
    const anyDocActivelyShared = DOC_CATEGORIES.some((c) => docs[c.key]?.documentId);
    if (anyDocActivelyShared) return 'DOCS SHARED';
    const contractActuallySigned = deal.contract?.status === 'FULLY_SIGNED' && !deal.contract?.skipped;
    if (contractActuallySigned) return 'CONTRACT SIGNED';
    return 'ACCEPTED';
  };

  // Localized display helpers (status enums / roles / doc categories / extras keys)
  const statusLabel = (s) => ({
    'PENDING': t('bookings.statusPending'),
    'NEGOTIATING': t('bookings.statusNegotiating'),
    'DECLINED': t('bookings.statusDeclined'),
    'COMPLETED': t('bookings.statusCompleted'),
    'DOCS SHARED': t('bookings.statusDocsShared'),
    'CONTRACT SIGNED': t('bookings.statusContractSigned'),
    'ACCEPTED': t('bookings.statusAccepted'),
  }[s] || s);
  const roleLabel = (r) => ({
    ARTIST: t('search.roleArtist'),
    VENUE: t('search.roleVenue'),
    PROMOTER: t('search.rolePromoter'),
    AGENT: t('search.roleAgent'),
  }[r] || r);
  const docCatLabel = (cat) => ({
    pressKit: t('chat.pressKit'),
    technicalRider: t('chat.technicalRider'),
    hospitalityRider: t('chat.hospitalityRider'),
    invoice: t('chat.invoice'),
  }[cat.key] || cat.label);
  const extraLabel = (key) => ({
    travelIn: t('chat.travelIn'),
    travelOut: t('chat.travelOut'),
    transportation: t('chat.transportation'),
    accommodation: t('chat.accommodation'),
    meals: t('chat.meals'),
  }[key] || key.replace(/([A-Z])/g, ' $1').trim());

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
    // Booker only sees "via agent" when the deal itself was agent-led
    // (bookedArtistId set). An artist-direct booking with an artist who
    // happens to have agents stays clean — no via line.
    const isBookerViewerViaAgent =
      !!deal.bookedArtistId &&
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

    // Pre-derive once: pending doc categories drive both the Share Documents
    // CTA label and the Skip Documents button render. Used in two separate
    // JSX blocks lower down — compute here so we don't run DOC_CATEGORIES
    // .filter twice per card.
    const pendingDocCategories = (deal.contract?.status === 'FULLY_SIGNED' && isArtistSideForDeal(deal, currentUser))
      ? DOC_CATEGORIES.filter(c => categoryStatus(deal.sharedDocuments, c.key) === 'pending')
      : [];
    const hasPendingDocs = pendingDocCategories.length > 0;

    return (
      <div key={deal.id} className={`booking-card ${isExpanded ? 'expanded' : ''}`}>
        <div className="booking-date-badge">
          <span className="booking-date-month">
            {dealDate.toLocaleDateString(t('dateFormat.locale'), { month: 'short' })}
          </span>
          <span className="booking-date-day">{dayNumber}</span>
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
                {roleLabel(otherParty.role)}
              </span>
            </div>
            {/* Artist label — shown whenever the deal is for a represented
                artist and the viewer isn't that artist. Agents viewing their
                roster need this to tell their bookings apart at a glance. */}
            {deal.bookedArtistId && deal.bookedArtistName && deal.bookedArtistId !== currentUser.id && (
              <p className="party-via-agent" style={{ color: '#bbb' }}>{t('bookings.forArtist', { name: deal.bookedArtistName })}</p>
            )}
            {isViaAgent && agentName && (
              <p className="party-via-agent">{t('bookings.viaAgent', { name: agentName })}</p>
            )}
            {agentReadOnly && (
              <p className="party-via-agent">{t('bookings.viaArtistDirect', { name: deal.artist?.name || t('chat.theArtistSide') })}</p>
            )}
            <p className="party-location">
              {deal.city && deal.country ? `${deal.city}, ${deal.country}` : otherParty.location}
            </p>
            {!isExpanded && (
            <p className="m-0 mb-2 text-[12px] font-space-grotesk font-medium text-white/85 truncate">
              {deal.eventName || t('bookings.booking')}
              <span className="text-white/30"> · </span>
              <span className="text-infrared font-semibold">
                {Number.isInteger(deal.currentFee)
                  ? deal.currentFee.toLocaleString()
                  : deal.currentFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {deal.currency}
              </span>
            </p>
            )}
            <div className="party-status-row">
              {(() => {
                const displayStatus = getDealDisplayStatus(deal);
                return (
                  <span className={getStatusBadgeClass(displayStatus)}>
                    {statusLabel(displayStatus)}
                  </span>
                );
              })()}
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
            {(deal.eventName || deal.performanceType) && (
              <div className="flex items-center gap-2.5 mb-2">
                <h3 className="m-0 text-[16px] font-semibold font-space-grotesk tracking-[-0.01em] text-white truncate">
                  {deal.eventName || t('bookings.booking')}
                </h3>
                {deal.performanceType && (
                  <span className="shrink-0 px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/60
                                   text-[8px] font-medium uppercase tracking-[0.15em] font-tech">
                    {deal.performanceType}
                  </span>
                )}
              </div>
            )}
            <div className="booking-details">
              {deal.artistName && (
                <div className="booking-detail-row">
                  <span className="detail-label">{t('bookings.artistLabel')}</span>
                  <span className="detail-value">{deal.artistName}</span>
                </div>
              )}
              <div className="booking-detail-row">
                <span className="detail-label">{t('chat.venueLabel')}</span>
                <span className="detail-value">
                  <div>{deal.venueName}</div>
                  {(deal.city || deal.venue?.location) && (
                    <div className="detail-subtext">
                      ({deal.city && deal.country ? `${deal.city}, ${deal.country}` : deal.venue?.location})
                    </div>
                  )}
                </span>
              </div>
              {deal.startTime && deal.endTime && (
                <div className="booking-detail-row">
                  <span className="detail-label">{t('chat.eventTimeLabel')}</span>
                  <span className="detail-value">
                    {deal.startTime} - {deal.endTime}
                  </span>
                </div>
              )}
              {deal.setStartTime && deal.setEndTime && (
                <div className="booking-detail-row">
                  <span className="detail-label">{t('chat.setTimeLabel')}</span>
                  <span className="detail-value">
                    <div>{deal.setStartTime} - {deal.setEndTime}</div>
                    {deal.setDuration && (
                      <div className="detail-subtext">{t('chat.durationMinutes', { n: deal.setDuration })}</div>
                    )}
                  </span>
                </div>
              )}
              <div className="booking-detail-row">
                <span className="detail-label">{t('chat.feeLabel')}</span>
                <span className="detail-value booking-fee">
                  {Number.isInteger(deal.currentFee)
                    ? deal.currentFee.toLocaleString()
                    : deal.currentFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {deal.currency}
                </span>
              </div>
              {(() => {
                // Resolve the current extras: counter-offer additionalTerms (when JSON)
                // takes precedence over the original deal.extras since counters never
                // touch deal.extras. Without this, both render under "Extras:" and
                // we see the section twice.
                let latestExtras = null;
                if (deal.additionalTerms) {
                  try {
                    const parsed = typeof deal.additionalTerms === 'string'
                      ? JSON.parse(deal.additionalTerms)
                      : deal.additionalTerms;
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                      latestExtras = parsed;
                    }
                  } catch (e) { /* fall through to free-text rendering below */ }
                }
                if (!latestExtras && deal.extras && Object.keys(deal.extras).length > 0) {
                  latestExtras = deal.extras;
                }

                return (
                  <>
                    {latestExtras && Object.keys(latestExtras).length > 0 && (
                      <div className="booking-detail-row full-width">
                        <span className="detail-label">{t('chat.extrasLabel')}</span>
                        <div className="detail-value extras-list">
                          {Object.entries(latestExtras).filter(([, v]) => v).map(([key, value]) => (
                            <div key={key} className="extra-item">
                              <div className="extra-content">
                                <strong style={{ textTransform: 'capitalize' }}>{extraLabel(key)}</strong>
                                {value !== 'Included' && value !== true && <span className="extra-note">: {value}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!latestExtras && deal.additionalTerms && (
                      <div className="booking-detail-row full-width">
                        <span className="detail-label">{t('chat.additionalTermsLabel')}</span>
                        <span className="detail-value">{deal.additionalTerms}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {deal.technicalRequirements && (
                <div className="booking-detail-row full-width">
                  <span className="detail-label">{t('chat.technicalLabel')}</span>
                  <span className="detail-value">{deal.technicalRequirements}</span>
                </div>
              )}
              {deal.paymentTerms && (
                <div className="booking-detail-row full-width">
                  <span className="detail-label">{t('chat.paymentTermsLabel')}</span>
                  <span className="detail-value">{deal.paymentTerms}</span>
                </div>
              )}
            </div>
            {deal.notes && (
              <div className="mb-4 -mt-1">
                <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/30 font-tech">{t('bookings.notes')}</p>
                <p className="m-0 text-[12px] leading-relaxed text-white/45">{deal.notes}</p>
              </div>
            )}

            {/* Workflow Timeline for ACCEPTED deals */}
            {deal.status === 'ACCEPTED' && !hideWorkflow && (
              <WorkflowTimeline deal={deal} onViewPaymentDetails={() => setDepositHistoryDeal(deal)} />
            )}

            {/* Workflow Action Buttons for ACCEPTED deals - hidden when the agent handles it */}
            {deal.status === 'ACCEPTED' && !hideWorkflow && (
              <div className="workflow-actions">
                {/* Contract Actions. Only the artist side initiates contracts;
                    venue/promoter sees a quiet hint instead. An empty contract
                    = {} (fresh ACCEPTED deal) has no .status set yet — treat
                    it the same as NOT_SENT. */}
                {(!deal.contract || !deal.contract.status || deal.contract.status === 'NOT_SENT') && !isArtistSideForDeal(deal, currentUser) && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#888' }}>
                    {t('chat.waitingForContractArtistSide')}
                  </p>
                )}
                {(!deal.contract || !deal.contract.status || deal.contract.status === 'NOT_SENT') && isArtistSideForDeal(deal, currentUser) && (
                  <>
                    <button
                      className="btn btn-primary"
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
                            appAlert(t('chat.failedToLoadArtistProfile'));
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
                      {t('chat.sendContract')}
                    </button>
                    <button
                      className="btn btn-skip"
                      disabled={actionBusy}
                      onClick={async () => {
                        if (actionBusy) return;
                        if (await appConfirm(t('chat.skipContractConfirmBooking'))) {
                          setActionBusy(true);
                          try {
                            await apiService.skipContract(deal.id, currentUser.id);
                            fetchDeals();
                          } catch (err) {
                            appAlert(err.message || t('chat.failedToSkipContract'));
                          } finally {
                            setActionBusy(false);
                          }
                        }
                      }}
                    >
                      {t('chat.skipContract')}
                    </button>
                  </>
                )}
                {deal.contract && deal.contract.status && deal.contract.status !== 'NOT_SENT' && deal.contract.status !== 'FULLY_SIGNED' && (() => {
                  // Side-based gate: artist side initiates contracts (via
                  // send-and-sign), so they always see View + Withdraw.
                  // Only the venue/booker side ever sees Sign Contract.
                  // Falling back on per-signature matching was unreliable
                  // across profile switches and old SENT-without-signature
                  // test deals.
                  const onArtistSide = isArtistSideForDeal(deal, currentUser);
                  const isFullySigned = deal.contract.status === 'FULLY_SIGNED';
                  const otherPartyName = onArtistSide
                    ? (deal.venue?.name || t('bookings.theVenue'))
                    : (deal.artist?.name || t('bookings.theArtist'));

                  if (onArtistSide) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {!isFullySigned && (
                          <span style={{ fontSize: '12px', color: '#888' }}>
                            {t('bookings.waitingCountersign', { name: otherPartyName })}
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => openContractPdf(deal)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          {t('chat.viewContract')}
                        </button>
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
                          {t('bookings.withdrawContract')}
                        </button>
                        </div>
                      </div>
                    );
                  } else {
                    // Other side hasn't signed yet — they can preview the
                    // contract without committing, or jump into the full
                    // sign modal (draw signature + name + consent +
                    // view-required gate).
                    return (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => openContractPdf(deal)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          {t('chat.viewContract')}
                        </button>
                        <button
                          className="btn btn-primary"
                          disabled={actionBusy}
                          onClick={async () => {
                            if (actionBusy) return;
                            setActionBusy(true);
                            try {
                              let initiallyViewed = false;
                              try {
                                const fresh = await apiService.getDeal(deal.id);
                                const viewedBy = fresh?.contract?.viewedBy || [];
                                initiallyViewed = viewedBy.some((v) => v.profile === currentUser.id);
                              } catch (_) { /* default false */ }
                              setRecipientSignData({
                                deal,
                                contractUrl: deal.contract.documentUrl,
                                senderName: otherPartyName,
                                initiallyViewed,
                              });
                            } finally {
                              setActionBusy(false);
                            }
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 17l6 6 13-13"></path>
                          </svg>
                          {t('contract.signContract')}
                        </button>
                      </div>
                    );
                  }
                })()}

                {/* Once both parties have signed, anyone in the deal can
                    pull up the signed contract for reference. Surfaced
                    first so it's the most prominent post-signing action. */}
                {deal.contract && deal.contract.status === 'FULLY_SIGNED' && (deal.contract.documentUrl || deal.contract.documentId) && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => openContractPdf(deal)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    {t('chat.viewContract')}
                  </button>
                )}

                {/* Document Sharing — artist-side only. Stays visible after
                    everything is shared/skipped so the artist can revisit. */}
                {deal.contract?.status === 'FULLY_SIGNED' && isArtistSideForDeal(deal, currentUser) && (
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setSelectedDealForWorkflow(deal);
                      setShowDocumentModal(true);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                    {hasPendingDocs ? t('chat.shareDocuments') : t('bookings.manageDocuments')}
                  </button>
                )}

                {/* Documents recap — show what's been shared / skipped /
                    pending for this booking. Visible to both sides. Shared
                    categories are clickable and open the document in the
                    PDF viewer so the booker can actually review them. */}
                {deal.contract && deal.contract.status === 'FULLY_SIGNED' && (
                  <div style={{ width: '100%', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                    {DOC_CATEGORIES.map(cat => {
                      const status = categoryStatus(deal.sharedDocuments, cat.key);
                      const entry = deal.sharedDocuments?.[cat.key];
                      const palette = status === 'shared'
                        ? { bg: 'rgba(80,200,120,0.15)', fg: 'rgba(80,200,120,1)', symbol: '✓' }
                        : status === 'skipped'
                          ? { bg: 'rgba(255,255,255,0.06)', fg: '#888', symbol: '—' }
                          : { bg: 'rgba(255,165,0,0.12)', fg: 'rgba(255,165,0,1)', symbol: '·' };
                      const pillContent = (
                        <>
                          <span aria-hidden="true">{palette.symbol}</span>
                          {docCatLabel(cat)}
                          {' ' + (status === 'shared' ? t('bookings.suffixShared') : status === 'skipped' ? t('bookings.suffixSkipped') : t('bookings.suffixPending'))}
                        </>
                      );
                      const sharedStyle = {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 9px',
                        background: palette.bg,
                        color: palette.fg,
                        borderRadius: '12px',
                        fontWeight: 500,
                      };
                      if (status === 'shared' && entry?.documentUrl) {
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setPdfViewerUrl(getFullUrl(entry.documentUrl))}
                            style={{ ...sharedStyle, border: 'none', cursor: 'pointer', fontSize: '11px' }}
                            title={t('chat.openDocument')}
                          >
                            {pillContent}
                          </button>
                        );
                      }
                      return (
                        <span key={cat.key} style={sharedStyle}>
                          {pillContent}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Skip Documents — sits below the recap pills so it reads
                    as "and skip the rest" rather than standalone. */}
                {hasPendingDocs && (
                  <button
                    className="btn btn-skip"
                    disabled={actionBusy}
                    onClick={async () => {
                      if (actionBusy) return;
                      const labels = pendingDocCategories.map(c => docCatLabel(c)).join(', ');
                      if (!(await appConfirm(t('bookings.skipDocsStagesConfirm', { list: labels })))) return;
                      setActionBusy(true);
                      try {
                        for (const cat of pendingDocCategories) {
                          // eslint-disable-next-line no-await-in-loop
                          await apiService.skipDocument(deal.id, currentUser.id, cat.key);
                        }
                        fetchDeals();
                      } catch (err) {
                        appAlert(err.message || t('chat.failedToSkipDocuments'));
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                  >
                    {t('bookings.skipDocuments')}
                  </button>
                )}

                {/* Confirm receipt — artist-side only, only when there's an
                    unconfirmed payment entry. The compact payment summary
                    pill is gone now that WorkflowTimeline's payment-progress
                    block has an inline "view details" CTA. */}
                {deal.payment && (deal.payment.status === 'DEPOSIT_PAID' || deal.payment.status === 'FULLY_PAID') && (() => {
                  const summary = summarizeDealPayment(deal);
                  const { history, fullPaymentMarked, fullPaymentConfirmed } = summary;
                  const onArtistSide = isArtistSideForDeal(deal, currentUser);
                  const unconfirmedDeposit = onArtistSide && history.some(e => !e.confirmedAt);
                  const unconfirmedFull = onArtistSide && fullPaymentMarked && !fullPaymentConfirmed;
                  if (!unconfirmedDeposit && !unconfirmedFull) return null;
                  return (
                    <button
                      type="button"
                      className="btn btn-primary btn-card-action"
                      disabled={actionBusy}
                      onClick={() => setDepositHistoryDeal(deal)}
                    >
                      {t('bookings.confirmReceipt')}
                    </button>
                  );
                })()}

                {/* Payment Actions (venue/promoter only). Unlock only once the
                    artist side has committed to the contract — i.e. the
                    contract is at least artist-signed, or was skipped. Avoids
                    bookers paying into a deal nobody's signed yet. */}
                {deal.venue.id === currentUser.id && deal.payment && deal.payment.status !== 'FULLY_PAID' && (() => {
                  const cStatus = deal.contract?.status;
                  const contractCommitted = cStatus === 'ARTIST_SIGNED'
                    || cStatus === 'VENUE_SIGNED'
                    || cStatus === 'FULLY_SIGNED'
                    || deal.contract?.skipped === true;
                  if (!contractCommitted) return null;
                  return (
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        setSelectedDealForWorkflow(deal);
                        setShowPaymentModal(true);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                      {t('bookings.updatePayment')}
                    </button>
                  );
                })()}

                {/* Message — kept inside workflow-actions when the deal is
                    accepted so all the booking-card CTAs (View Contract,
                    Share Documents, Update Payment, Message) sit in one
                    visually-consistent row. */}
                {!hideWorkflow && (
                  <button
                    className="btn btn-outline"
                    onClick={() => onOpenChat && onOpenChat(messageTarget)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {t('search.message')}
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
                  {t('search.decline')}
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
                  {t('chat.review')}
                </button>
                <button
                  className="btn btn-primary btn-accept"
                  onClick={() => handleAcceptDeal(deal.id)}
                  disabled={actionBusy}
                >
                  {actionBusy ? '...' : t('messages.accept')}
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

            {/* Standalone Message button — for ACCEPTED + workflow-visible
                cards Message lives inside .workflow-actions instead, so this
                only renders when that row isn't on screen. */}
            {(hideWorkflow || deal.status !== 'ACCEPTED') && (
              <button
                className="btn btn-outline btn-chat"
                onClick={() => onOpenChat && onOpenChat(messageTarget)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                {t('search.message')}
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
                {t('bookings.deleteOffer')}
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bookings-screen">
      {/* isolate wraps ONLY in-flow content so the -z-10 backdrop stays visible;
          overlays (delete modal, etc.) live outside it. */}
      <div className="relative isolate">
      {/* faint engineering grid fading from the top (quiet-premium backdrop) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-5 -top-5 h-48 -z-10 bg-grid
                   [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
      />
      <div className="bookings-tabs">
        <button
          className={`bookings-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {t('bookings.tabUpcoming')}
          {activeTab === 'upcoming' && filteredDeals.length > 0 && (
            <span className="tab-badge">{filteredDeals.length}</span>
          )}
        </button>
        <button
          className={`bookings-tab ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {t('bookings.tabPast')}
          {activeTab === 'past' && filteredDeals.length > 0 && (
            <span className="tab-badge">{filteredDeals.length}</span>
          )}
        </button>
        <button
          className={`bookings-tab ${activeTab === 'declined' ? 'active' : ''}`}
          onClick={() => setActiveTab('declined')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {t('bookings.tabDeclined')}
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
          <LoadingGlobe label={t('bookings.loadingBookings')} />
        ) : error ? (
          <div className="bookings-error">
            <p>{error}</p>
            <button className="btn btn-outline" onClick={fetchDeals}>
              {t('common.retry')}
            </button>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="bookings-empty">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <h3>No {activeTab === 'upcoming' ? 'upcoming' : activeTab === 'past' ? 'past' : 'declined'} bookings</h3>
            <p>
              {activeTab === 'upcoming'
                ? t('bookings.emptyUpcoming')
                : activeTab === 'past'
                ? t('bookings.emptyPast')
                : t('bookings.emptyDeclined')
              }
            </p>
          </div>
        ) : (
          <div className="bookings-list">
            {clusteredDeals.map((cluster, index) => (
              <div key={index} className="bookings-cluster">
                <div className="cluster-header">
                  <h2>{cluster.monthYear}</h2>
                  <span className="cluster-count">{cluster.deals.length !== 1 ? t('bookings.offersCount', { n: cluster.deals.length }) : t('bookings.offerCount', { n: cluster.deals.length })}</span>
                </div>
                {cluster.deals.map(deal => renderDealCard(deal))}
              </div>
            ))}
            {hasMoreDeals && (
              <button
                type="button"
                onClick={loadOlderDeals}
                disabled={loadingOlderDeals}
                className="mx-auto my-4 block px-4 py-2 rounded-full border border-white/15 bg-white/[0.04] text-xs
                           uppercase tracking-[0.12em] text-white/60 font-tech cursor-pointer hover:text-white
                           hover:border-white/30 transition-colors disabled:opacity-50"
              >
                {loadingOlderDeals ? t('chat.loading') : t('bookings.loadOlderBookings')}
              </button>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {dealToDelete && (
        <div className="delete-modal-overlay" onClick={() => setDealToDelete(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>{t('bookings.deleteOffer')}</h3>
            </div>
            <div className="delete-modal-content">
              <p>{t('bookings.deleteOfferConfirm')}</p>
              <p className="delete-modal-warning">This action cannot be undone.</p>
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => setDealToDelete(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteDeal}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : t('bookings.deleteOffer')}
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
              <h3>{t('bookings.declineOffer')}</h3>
            </div>
            <div className="delete-modal-content">
              <p>{t('chat.declineReasonLabel')}</p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder={t('bookings.declineExamplePlaceholder')}
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
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeclineDeal}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : t('bookings.declineOffer')}
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
              <h3>{t('chat.sendContract')}</h3>
            </div>
            <div className="delete-modal-content">
              <p style={{ marginBottom: '16px' }}>
                {artistProfile ? t('bookings.selectContractFrom', { name: artistProfile.name }) : t('bookings.selectContractYours')}
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
                        onClick={() => {
                          // Sign-and-send: open the sign modal first; submission
                          // will fire send + sender's signature in one transaction.
                          setPendingContractToSign({
                            documentData: doc,
                            deal: selectedDealForWorkflow,
                          });
                          setShowContractModal(false);
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
                          {doc.addedDate ? new Date(doc.addedDate).toLocaleDateString() : t('bookings.noDate')}
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
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareDocumentsModal
        isOpen={showDocumentModal && !!selectedDealForWorkflow}
        deal={selectedDealForWorkflow}
        currentUser={currentUser}
        onClose={() => {
          setShowDocumentModal(false);
          setSelectedDealForWorkflow(null);
          setDocumentTypeToShare(null);
        }}
        onDealUpdated={(updatedDeal) => {
          // Optimistic: splice the latest deal payload back into the deals
          // array right away so the booking-card status badge reflects
          // share/unshare/skip changes the instant the user clicks them —
          // no waiting on fetchDeals to round-trip. fetchDeals still runs
          // afterwards to reconcile with the canonical server state.
          if (updatedDeal?.id) {
            setDeals((prev) => prev.map((d) => (d.id === updatedDeal.id ? { ...d, ...updatedDeal } : d)));
          }
          fetchDeals();
        }}
      />

      {/* Update Payment Modal */}
      {showPaymentModal && selectedDealForWorkflow && (
        <div className="delete-modal-overlay" onClick={() => {
          setShowPaymentModal(false);
          setSelectedDealForWorkflow(null);
          setDepositInput('');
          setPaymentProofFile(null);
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>{t('bookings.updatePaymentStatus')}</h3>
            </div>
            <div className="delete-modal-content">
              {/* Proof of payment — required for both deposit and full
                  payment. Accepts PDF or any image format. */}
              <div style={{
                marginBottom: '14px',
                padding: '12px',
                border: `1px dashed ${paymentProofFile ? 'rgba(80,200,120,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '8px', fontWeight: 600 }}>
                  Proof of payment * <span style={{ color: '#666', fontWeight: 400 }}>(PDF or image, max 10MB)</span>
                </label>
                {paymentProofFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>{paymentProofFile.name}</strong>
                      <span style={{ color: '#888', marginLeft: '6px', fontSize: '11px' }}>
                        ({(paymentProofFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentProofFile(null)}
                      style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {t('viewProfile.remove')}
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'inline-block', padding: '7px 14px', backgroundColor: '#FF3366', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {t('bookings.chooseFile')}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;
                        const err = validatePaymentProof(file);
                        if (err) { appAlert(err); return; }
                        setPaymentProofFile(file);
                      }}
                      style={{ display: 'none' }}
                      disabled={actionBusy}
                    />
                  </label>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '14px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '8px', fontWeight: 600 }}>
                    Deposit transferred ({selectedDealForWorkflow.currency || 'USD'} · total fee {selectedDealForWorkflow.currentFee})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={depositInput}
                    onChange={(e) => setDepositInput(e.target.value)}
                    disabled={actionBusy}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      marginBottom: '10px',
                    }}
                  />
                  <button
                    className="btn btn-outline"
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={actionBusy}
                    onClick={async () => {
                      if (actionBusy) return;
                      const amount = parseFloat(depositInput);
                      if (!Number.isFinite(amount) || amount <= 0) {
                        appAlert(t('bookings.depositGreaterThanZero'));
                        return;
                      }
                      const totalFee = Number(selectedDealForWorkflow.currentFee) || 0;
                      if (totalFee && amount > totalFee) {
                        appAlert(t('bookings.depositExceedsFee', { fee: totalFee }));
                        return;
                      }
                      const proofErr = validatePaymentProof(paymentProofFile);
                      if (proofErr) { appAlert(proofErr); return; }
                      setActionBusy(true);
                      try {
                        await apiService.updatePayment(
                          selectedDealForWorkflow.id,
                          currentUser.id,
                          {
                            depositAmount: amount,
                            paymentMethod: 'Bank Transfer',
                            proofFile: paymentProofFile,
                          }
                        );
                        setShowPaymentModal(false);
                        setSelectedDealForWorkflow(null);
                        setDepositInput('');
                        setPaymentProofFile(null);
                        fetchDeals();
                      } catch (err) {
                        appAlert(err.message || t('bookings.updatePaymentFailed'));
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    {t('bookings.markDepositPaid')}
                  </button>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={actionBusy}
                  onClick={async () => {
                    if (actionBusy) return;
                    const proofErr = validatePaymentProof(paymentProofFile);
                    if (proofErr) { appAlert(proofErr); return; }
                    setActionBusy(true);
                    try {
                      await apiService.updatePayment(
                        selectedDealForWorkflow.id,
                        currentUser.id,
                        {
                          fullPayment: true,
                          paymentMethod: 'Bank Transfer',
                          proofFile: paymentProofFile,
                        }
                      );
                      setShowPaymentModal(false);
                      setSelectedDealForWorkflow(null);
                      setPaymentProofFile(null);
                      fetchDeals();
                    } catch (err) {
                      appAlert(err.message || t('bookings.updatePaymentFailed'));
                    } finally {
                      setActionBusy(false);
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l6 6 13-13"></path>
                  </svg>
                  {t('bookings.markFullPaymentComplete')}
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
                {t('common.cancel')}
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
            // Sign-and-send: hand the chosen contract to the sign modal.
            // Submission there fires the combined send + signature in one call.
            setPendingContractToSign({
              documentData: {
                id: contractData.existingContract?.id || Date.now().toString(),
                title: contractData.title,
                url: contractData.url,
                file: contractData.file,
                type: contractData.type,
              },
              deal: selectedDealForWorkflow,
            });
            setShowAddContractModal(false);
          }}
        />
      )}

      {/* Sign-and-send modal: sender signs before delivery */}
      {recipientSignData && (
        <SignContractModal
          isOpen={true}
          mode="sign"
          senderName={recipientSignData.senderName}
          signerCapacity={deriveSignerCapacity(recipientSignData.deal, currentUser)}
          contractUrl={recipientSignData.contractUrl}
          dealId={recipientSignData.deal?.id}
          initiallyViewed={recipientSignData.initiallyViewed}
          viewConfirmedSignal={viewConfirmedSignal}
          onContractViewed={async () => {
            try {
              await contractService.trackContractView(
                recipientSignData.deal.id,
                currentUser.id,
                0,
                localStorage.getItem('token'),
              );
            } catch (err) {
              console.error('Failed to track view:', err);
            }
          }}
          onOpenContract={() => setPdfViewerUrl(getFullUrl(recipientSignData.contractUrl))}
          onClose={() => setRecipientSignData(null)}
          onSign={async (signatureData) => {
            try {
              await contractService.signContract(
                recipientSignData.deal.id,
                currentUser.id,
                signatureData,
                localStorage.getItem('token'),
              );
              setRecipientSignData(null);
              fetchDeals();
              appAlert(t('chat.contractSignedSuccess'));
            } catch (err) {
              throw new Error(err.message || t('chat.failedToSignContract'));
            }
          }}
        />
      )}

      {pendingContractToSign && (
        <SignContractModal
          isOpen={true}
          mode="sign-and-send"
          recipientName={deriveRecipientName(pendingContractToSign.deal, currentUser)}
          signerCapacity={deriveSignerCapacity(pendingContractToSign.deal, currentUser)}
          contractUrl={pendingContractToSign.documentData?.url}
          dealId={pendingContractToSign.deal?.id}
          onOpenContract={() => setPdfViewerUrl(getFullUrl(pendingContractToSign.documentData?.url))}
          onClose={() => {
            setPendingContractToSign(null);
            setSelectedDealForWorkflow(null);
          }}
          onSign={async (signatureData) => {
            try {
              await apiService.sendAndSignContract(
                pendingContractToSign.deal.id,
                currentUser.id,
                pendingContractToSign.documentData,
                signatureData,
              );
              setPendingContractToSign(null);
              setSelectedDealForWorkflow(null);
              fetchDeals();
              appAlert(t('chat.contractSentAndSignedSuccess'));
            } catch (err) {
              throw new Error(err.message || t('chat.failedToSendAndSignContract'));
            }
          }}
        />
      )}

      <PdfViewerModal
        url={pdfViewerUrl}
        onClose={() => setPdfViewerUrl(null)}
        onLoaded={() => setViewConfirmedSignal((n) => n + 1)}
      />

      {/* Deposit history modal — one row per installment with its own
          proof link. Opens when the recap pill is clicked on a deal that
          has more than one deposit. Rendered via portal so the .app-container
          overflow:hidden + max-width:428px doesn't clip the overlay on iOS. */}
      {depositHistoryDeal && createPortal((() => {
        const summary = summarizeDealPayment(depositHistoryDeal);
        const { history, currency, totalFee, totalMarked, totalConfirmed, fullPaymentAmount } = summary;
        const fullProof = depositHistoryDeal.payment?.fullPaymentProof;
        const onArtistSide = isArtistSideForDeal(depositHistoryDeal, currentUser);

        const renderRow = ({ label, amount, date, confirmedAt, proof, canConfirm, onConfirm, onViewProof }) => (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
            padding: '10px 12px',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {label} · {amount} {currency}
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                {date ? new Date(date).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
              {confirmedAt && (
                <div style={{ fontSize: '10px', color: 'rgba(80,200,120,1)', marginTop: '2px' }}>
                  ✓ Receipt confirmed · {new Date(confirmedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, alignItems: 'stretch' }}>
              {proof?.storagePath && (
                <button type="button" onClick={onViewProof} className="btn btn-outline btn-card-action" style={{ whiteSpace: 'nowrap' }}>
                  {t('bookings.viewProof')}
                </button>
              )}
              {canConfirm && (
                <button
                  type="button"
                  className="btn btn-primary btn-card-action"
                  disabled={actionBusy}
                  onClick={onConfirm}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {t('bookings.confirmReceipt')}
                </button>
              )}
            </div>
          </div>
        );

        return (
          <div className="delete-modal-overlay" onClick={() => setDepositHistoryDeal(null)}>
            <div className="delete-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
              <div className="delete-modal-header">
                <h3>{t('bookings.payments')}</h3>
              </div>
              <div className="delete-modal-content">
                <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>
                  Confirmed received: <strong style={{ color: '#fff' }}>{totalConfirmed} {currency}</strong>
                  {totalFee > 0 && <> of <strong style={{ color: '#fff' }}>{totalFee} {currency}</strong></>}
                  {totalMarked > totalConfirmed && (
                    <span style={{ color: 'rgba(80,200,120,0.85)' }}> · {totalMarked - totalConfirmed} {currency} awaiting confirmation</span>
                  )}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '50dvh', overflowY: 'auto' }}>
                  {history.map((entry, i) => renderRow({
                    label: history.length > 1 ? t('bookings.depositN', { n: i + 1 }) : t('bookings.deposit'),
                    amount: entry.amount,
                    date: entry.date,
                    confirmedAt: entry.confirmedAt,
                    proof: entry.proof,
                    canConfirm: onArtistSide && !entry.confirmedAt,
                    onConfirm: async () => {
                      if (actionBusy) return;
                      setActionBusy(true);
                      try {
                        const updated = await apiService.confirmPaymentReceipt(depositHistoryDeal.id, currentUser.id, 'deposit', i);
                        setDepositHistoryDeal(updated.deal || depositHistoryDeal);
                        fetchDeals();
                      } catch (err) {
                        appAlert(err.message || t('bookings.confirmReceiptFailed'));
                      } finally {
                        setActionBusy(false);
                      }
                    },
                    onViewProof: () => openProof(depositHistoryDeal, 'deposit', entry.proof, i),
                  }))}
                  {fullProof && renderRow({
                    label: t('bookings.fullPayment'),
                    amount: fullPaymentAmount,
                    date: depositHistoryDeal.payment?.fullPaymentDate,
                    confirmedAt: fullProof.confirmedAt,
                    proof: fullProof,
                    canConfirm: onArtistSide && !fullProof.confirmedAt,
                    onConfirm: async () => {
                      if (actionBusy) return;
                      setActionBusy(true);
                      try {
                        const updated = await apiService.confirmPaymentReceipt(depositHistoryDeal.id, currentUser.id, 'full');
                        setDepositHistoryDeal(updated.deal || depositHistoryDeal);
                        fetchDeals();
                      } catch (err) {
                        appAlert(err.message || t('bookings.confirmReceiptFailed'));
                      } finally {
                        setActionBusy(false);
                      }
                    },
                    onViewProof: () => openProof(depositHistoryDeal, 'full', fullProof),
                  })}
                </div>
              </div>
              <div className="delete-modal-actions">
                <button className="btn btn-outline" onClick={() => setDepositHistoryDeal(null)}>{t('common.close')}</button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* Image proof viewer (PDF proofs go through the PdfViewer modal above) */}
      {proofImageUrl && createPortal(
        <div className="modal-overlay" onClick={() => setProofImageUrl(null)} style={{ padding: 0, zIndex: 10001 }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '100vw',
              // 100dvh accounts for mobile browser chrome — 100vh on iOS
              // pushes the close button off-screen when the URL bar shows.
              height: '100dvh',
              maxHeight: '100dvh',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 0,
            }}
          >
            <div className="modal-header" style={{ padding: '12px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#1a1a1a', zIndex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>{t('bookings.proofOfPayment')}</h3>
              <button className="modal-close" onClick={() => setProofImageUrl(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', padding: '16px' }}>
              <img
                src={proofImageUrl}
                alt="Proof of payment"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextSibling;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', color: '#ff6b6b', textAlign: 'center', maxWidth: '420px' }}>
                <p style={{ marginBottom: '8px' }}>{t('bookings.imageLoadFailed')}</p>
                <p style={{ fontSize: '12px', color: '#888' }}>
                  Open in a new tab to see browser-level details:&nbsp;
                  <a href={proofImageUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#FF3366' }}>direct link</a>
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Withdraw Contract Confirmation Modal */}
      {showWithdrawConfirmation && dealToWithdraw && (
        <div className="delete-modal-overlay" onClick={() => {
          setShowWithdrawConfirmation(false);
          setDealToWithdraw(null);
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>{t('bookings.withdrawContract')}</h3>
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
                {t('bookings.withdrawNotice')}
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
                {t('common.cancel')}
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
                {t('bookings.withdrawContract')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsScreen;
