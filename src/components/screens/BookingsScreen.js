import React, { useState, useEffect, useRef , useMemo } from 'react';
import OverlayPortal from '../common/OverlayPortal';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { celebrateDealMilestones } from '../../utils/celebrations';
import * as contractService from '../../services/contractService';
import WorkflowTimeline from '../common/WorkflowTimeline';
import AddContractModal from '../common/AddContractModal';
import SignContractModal from '../common/SignContractModal';
import ShareDocumentsModal from '../common/ShareDocumentsModal';
import IssueInvoiceModal from '../common/IssueInvoiceModal';
import DraftContractModal from '../common/DraftContractModal';
import PdfViewerModal from '../common/PdfViewerModal';
import ImageLightbox from '../common/ImageLightbox';
import { deriveSignerCapacity, deriveRecipientName, isArtistSideForDeal, signatureIsArtistSide } from '../../utils/contractSigner';
import { toRepEntries, repEntryId, repEntryName, findRepEntry } from '../../utils/representation';
import { DOC_CATEGORIES, categoryStatus, documentsStillDue } from '../../utils/documentCategories';
import { summarizeDealPayment, dealDeadlines } from '../../utils/paymentSummary';
import { getAuthedBackendUrl, buildPaymentProofUrl, contractFileUrl, hasContractFile, isPdfFile } from '../../utils/urls';
import { subscribeToDeals } from '../../services/realtime';
import { OFF_STATUSES, formatFee, isConsentOnlyFor } from '../../utils/dealStatus';
import { bookingStatusLine, bookingStepsDone, isArtistViaAgent } from '../../utils/bookingStatus';
import LoadingGlobe from '../common/LoadingGlobe';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatTimestamp, formatEventDate } from '../../utils/dates';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { roleLabel, getAvatarClass } from '../../utils/roles';
import { Avatar } from '../desktop/primitives';

function validatePaymentProof(file) {
  if (!file) return 'A proof of payment is required';
  if (file.size > 10 * 1024 * 1024) return 'File must be 10 MB or smaller';
  if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
    return 'Proof must be a PDF or an image';
  }
  return null;
}

// Display status derived from the workflow state. Skipped steps do NOT
// promote the label (only voluntary completion does). Actions UI keeps
// advancing independently — gated by the per-step "resolved" checks.
// Display statuses in booking-flow order — the status filter lists them
// as they come; the two dead ends sit last and only ever apply to the
// Cancelled tab.
const DEAL_DISPLAY_STATUSES = ['PENDING', 'NEGOTIATING', 'ACCEPTED', 'CONTRACT SIGNED', 'DOCS SHARED', 'PAID', 'COMPLETED', 'DECLINED', 'CANCELLED'];
const statusesForTab = (tab) => DEAL_DISPLAY_STATUSES.filter((st) => OFF_STATUSES.includes(st) === (tab === 'declined'));

// Consent-only and venue-redacted cards carry no booking to show: no page.
const hasBookingPage = (deal, viewer) => !isConsentOnlyFor(deal, viewer) && !deal.redactedForVenue;

const getDealDisplayStatus = (deal) => {
  // Pre-acceptance statuses pass through unchanged.
  if (deal.status === 'PENDING' || deal.status === 'NEGOTIATING' || deal.status === 'DECLINED') {
    return deal.status;
  }
  // The two real end states. These are now recorded rather than inferred —
  // COMPLETED used to be guessed here from "fully paid and confirmed",
  // which disagreed with what badges counted, so a booking could read as
  // finished on this card while counting as unfinished everywhere else.
  if (deal.status === 'CANCELLED') return 'CANCELLED';
  if (deal.status === 'COMPLETED') return 'COMPLETED';
  const payment = deal.payment || {};
  const fullyPaidAndConfirmed = !!payment.fullPaymentProof?.confirmedAt
    || ((Number(deal.currentFee) || 0) > 0 && (Array.isArray(payment.depositHistory) ? payment.depositHistory : [])
        .reduce((s, e) => s + (e.confirmedAt ? (Number(e.amount) || 0) : 0), 0) >= (Number(deal.currentFee) || 0));
  // Paid in full but not yet closed by hand: the money is settled, the
  // booking is not. It reads as PAID rather than borrowing COMPLETED.
  if (fullyPaidAndConfirmed) return 'PAID';
  const docs = deal.sharedDocuments || {};
  const anyDocActivelyShared = DOC_CATEGORIES.some((c) => docs[c.key]?.documentId);
  if (anyDocActivelyShared) return 'DOCS SHARED';
  const contractActuallySigned = deal.contract?.status === 'FULLY_SIGNED' && !deal.contract?.skipped;
  if (contractActuallySigned) return 'CONTRACT SIGNED';
  return 'ACCEPTED';
};

// focusDealId — desktop v3 inspector mode (components/desktop/BookingsBoard):
// `undefined` (the default) is the full screen as always; null/an id renders
// ONLY that deal's expanded card, with every action and modal intact, inside
// the board's right-hand pane. The phone never passes it.
const BookingsScreen = ({ onOpenChat, onNavigateToMessages, isActive = true, onActionCountChange, focusDealId }) => {
  const focusMode = focusDealId !== undefined;
  const { t } = useLanguage();
  const { user: currentUser, reloadProfileData } = useAppContext();
  const getFullUrl = (url, dealId) => getAuthedBackendUrl(url, currentUser?.id, dealId);

  const openContractPdf = (deal) => {
    const url = contractFileUrl(deal, currentUser?.id);
    if (url) setPdfViewerUrl(url);
    else appAlert(t('bookings.noContractFile')); // a status without a file must not fail silently
  };

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'past', or 'declined'
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [dealToDelete, setDealToDelete] = useState(null);
  // The booking open as its own page (phone). null = the list.
  const [openDealId, setOpenDealId] = useState(null);
  const listScrollTop = useRef(0);
  const [dealToDecline, setDealToDecline] = useState(null);
  const [dealToCancel, setDealToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [dealToSettle, setDealToSettle] = useState(null);
  const [settleNote, setSettleNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');

  // Workflow state
  const [showContractModal, setShowContractModal] = useState(false);
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [invoiceDeal, setInvoiceDeal] = useState(null);
  const [draftContractDeal, setDraftContractDeal] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDepositAgain, setShowDepositAgain] = useState(false); // reveal the deposit block for a further instalment
  const [selectedDealForWorkflow, setSelectedDealForWorkflow] = useState(null);
  const [documentTypeToShare, setDocumentTypeToShare] = useState(null);
  const [artistProfile, setArtistProfile] = useState(null); // For agent bookings
  const [showWithdrawConfirmation, setShowWithdrawConfirmation] = useState(false);

  // Agent artist filter
  const [selectedArtistFilter, setSelectedArtistFilter] = useState('all');
  // Inline card filters: display status + "needs my action".
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const selectTab = (tab) => {
    setActiveTab(tab);
    if (!statusesForTab(tab).includes(statusFilter)) setStatusFilter('all');
  };
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
    if (isPdfFile(meta)) {
      setPdfViewerUrl(url);
    } else {
      setProofImageUrl(url);
    }
  };
  // A notification row (bell) can ask for one booking: refetch, then once the
  // list holds it, switch to its tab and open its page.
  const pendingOpenDealId = useRef(null);
  useEffect(() => {
    // The desktop inspector (focus mode) is driven by BookingsBoard's selection.
    if (focusMode) return undefined;
    const onOpen = (e) => { pendingOpenDealId.current = e.detail?.dealId || null; fetchDeals(); };
    window.addEventListener('tora:open-deal', onOpen);
    return () => window.removeEventListener('tora:open-deal', onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const id = pendingOpenDealId.current;
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    pendingOpenDealId.current = null;
    const day = new Date(deal.date); day.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    selectTab(OFF_STATUSES.includes(deal.status) ? 'declined' : day >= today ? 'upcoming' : 'past');
    setActionFilter('all');
    if (!hasBookingPage(deal, currentUser)) {
      // Consent requests have no page: bring the card into view.
      setTimeout(() => document.getElementById(`booking-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    } else {
      openDeal(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals]);
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
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (isActive) {
      fetchDeals(); // silent after first load — cheap freshness on every visit
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubscribe = subscribeToDeals(currentUser.id, () => {
      if (isActiveRef.current) fetchDeals();
      // hidden tab: the unconditional refetch-on-activation covers it
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

    if (!hasLoadedRef.current) setLoading(true); // silent refresh after first load
    setError('');

    try {
      // Fetch all deals for this user (both sent and received). In parallel,
      // pull the action-summary so we know which cards are actionable (same
      // logic that drives the Bookings tab dot). Failure is non-fatal — the
      // list still renders, just without highlights.
      const [response, actionData] = await Promise.all([
        apiService.getDeals({ profileId: currentUser.id }),
        apiService.getActionSummary(currentUser.id).catch(() => null),
      ]);
      setDeals(response.deals || []);
      setHasMoreDeals(!!response.hasMore);
      hasLoadedRef.current = true;
      // An accepted offer and a countersigned contract both reach one side as
      // news rather than as a button they pressed, so the moment is noticed
      // here rather than raised at an action site. An agent's roster ids count
      // as theirs — a deal they run is their win too.
      celebrateDealMilestones(
        currentUser.id,
        response.deals || [],
        (currentUser.representingArtists || []).map((a) => a.profileId || a.id),
      );
      // Keep the tab-bar dot in sync with this authoritative refetch (runs on
      // load and after every action), so handling the last action clears the
      // dot immediately instead of lingering until the next 30s poll.
      onActionCountChange?.(new Set((actionData?.items || []).map((i) => i?.target?.params?.dealId).filter(Boolean)).size);
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

  // A booking the artist runs themselves can go to one of their agents.
  const canHandOver = (deal) => currentUser?.role === 'ARTIST' && deal.artistId === currentUser.id
    && !deal.bookedArtistId && !deal.agentId && ['PENDING', 'NEGOTIATING', 'ACCEPTED'].includes(deal.status);
  // Only the owner's own profile says which agent links are dormant.
  const [dormantAgentIds, setDormantAgentIds] = useState(() => new Set());
  const checkDormant = toRepEntries(currentUser?.representedBy).length > 0 && deals.some(canHandOver);
  useEffect(() => {
    if (!checkDormant) return undefined;
    let cancelled = false;
    apiService.getProfile(currentUser.id)
      .then((full) => {
        if (!cancelled) setDormantAgentIds(new Set((full?.representedByProfiles || []).filter((a) => a.dormant).map((a) => a.id)));
      })
      .catch(() => { /* the server still refuses a dormant agent */ });
    return () => { cancelled = true; };
  }, [currentUser?.id, checkDormant]);

  const handleHandToAgent = async (deal, agent) => {
    if (actionBusy) return;
    const name = repEntryName(agent);
    if (!(await appConfirm(t('bookings.handToAgentConfirm', { name })))) return;
    setActionBusy(true);
    try {
      await apiService.handDealToAgent(deal.id, currentUser.id, repEntryId(agent));
      await fetchDeals();
      reloadProfileData();
    } catch (err) {
      const refusal = { OWN_OFFER_PENDING: 'bookings.handOwnOffer', CONTRACT_IN_PROGRESS: 'bookings.handContractOpen', NOT_ACTIVE_AGENT: 'bookings.handAgentUnavailable', AGENT_UNAVAILABLE: 'bookings.handAgentUnavailable', ALREADY_AGENT_LED: 'bookings.handAlreadyLed' }[err.code];
      appAlert(t(refusal || 'bookings.handFailed', { name }));
      if (refusal) fetchDeals();
    } finally {
      setActionBusy(false);
    }
  };

  const handleAcceptDeal = async (dealId) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await apiService.acceptDeal(dealId, currentUser.id);
      fetchDeals();
      reloadProfileData();
    } catch (err) {
      console.error('Error accepting deal:', err);
      appAlert(err.message || t('chat.failedToAcceptOffer'));
    } finally {
      setActionBusy(false);
    }
  };

  // Event-venue consent: this profile is the TORA venue a promoter tagged for
  // an event they want to hold here (eventVenueId === me, not a deal party).
  const handleConfirmEventVenue = async (dealId) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await apiService.confirmEventVenue(dealId);
      fetchDeals();
      reloadProfileData();
    } catch (err) {
      console.error('Error confirming event venue:', err);
      appAlert(err.message || t('bookings.venueConsentFailed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeclineEventVenue = async (dealId) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await apiService.declineEventVenue(dealId);
      fetchDeals();
      reloadProfileData();
    } catch (err) {
      console.error('Error declining event venue:', err);
      appAlert(err.message || t('bookings.venueConsentFailed'));
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
      reloadProfileData();
    } catch (err) {
      console.error('Error declining deal:', err);
      appAlert(err.message || t('chat.failedToDeclineOffer'));
      setDealToDecline(null);
      setDeclineReason('');
    } finally {
      setActionBusy(false);
    }
  };

  // Closing the booking out. Completing states a fact; cancelling records one
  // with a reason attached, because the reason is what the reliability record
  // is eventually built from.
  const handleCompleteDeal = async (deal) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await apiService.completeDeal(deal.id, currentUser.id);
      fetchDeals();
      reloadProfileData();
    } catch (err) {
      console.error('Error completing booking:', err);
      appAlert(err.message || t('bookings.completeFailed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelDeal = async () => {
    if (actionBusy || !dealToCancel) return;

    if (!cancelReason.trim()) {
      appAlert(t('bookings.cancelReasonRequired'));
      return;
    }

    setActionBusy(true);
    try {
      await apiService.cancelDeal(dealToCancel.id, currentUser.id, cancelReason);
      setDealToCancel(null);
      setCancelReason('');
      fetchDeals();
      reloadProfileData();
    } catch (err) {
      console.error('Error cancelling booking:', err);
      appAlert(err.message || t('bookings.cancelFailed'));
      setDealToCancel(null);
      setCancelReason('');
    } finally {
      setActionBusy(false);
    }
  };

  // Closing the money question on a booking that was called off. Only the
  // side owed the fee can answer it, and neither answer moves money — TORA
  // records what happened, it doesn't collect.
  const handleSettlePayment = async (outcome) => {
    if (actionBusy || !dealToSettle) return;
    setActionBusy(true);
    try {
      await apiService.settlePayment(dealToSettle.id, currentUser.id, outcome, settleNote);
      setDealToSettle(null);
      setSettleNote('');
      fetchDeals();
    } catch (err) {
      console.error('Error settling payment:', err);
      appAlert(err.message || t('bookings.settleFailed'));
      setDealToSettle(null);
      setSettleNote('');
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
      reloadProfileData();
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

  // The page replaces the list inside the same scroller: remember where the
  // list was, start the page at the top, and put the list back on close.
  const scroller = () => document.querySelector('.app-content');
  const openDeal = (dealId) => {
    if (!openDealId) listScrollTop.current = scroller()?.scrollTop || 0;
    setOpenDealId(dealId);
    requestAnimationFrame(() => { const el = scroller(); if (el) el.scrollTop = 0; });
  };
  const closeDeal = () => {
    setOpenDealId(null);
    requestAnimationFrame(() => { const el = scroller(); if (el) el.scrollTop = listScrollTop.current; });
  };


  const isConsentOnlyDeal = (deal) => isConsentOnlyFor(deal, currentUser);

  // Pending consent requests surface as their own action cards at the top.
  const pendingConsentDeals = deals.filter(
    (d) => isConsentOnlyDeal(d) && d.eventVenueStatus === 'PENDING'
  );

  // Filter deals into past, upcoming, and declined (with optional agent artist filter)
  const filterDeals = (tab = activeTab) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return deals.filter(deal => {
      const dealDate = new Date(deal.date);
      dealDate.setHours(0, 0, 0, 0);

      // Pending venue-consent requests render separately (not in the list).
      if (isConsentOnlyDeal(deal) && deal.eventVenueStatus === 'PENDING') return false;

      // Agent artist filter: if a specific artist is selected, only show their deals
      if (selectedArtistFilter !== 'all' && currentUser?.role === 'AGENT') {
        const dealArtistId = deal.bookedArtistId || deal.artistId;
        if (dealArtistId !== selectedArtistFilter) return false;
      }

      // A booking that isn't happening must not sit in the calendar next to
      // ones that are — that is the whole point of being able to cancel. Both
      // ways a booking dies (declined before acceptance, cancelled after) land
      // in the same tab.
      const isOff = deal.status === 'DECLINED' || deal.status === 'CANCELLED';

      if (tab === 'declined') {
        return isOff;
      } else if (tab === 'upcoming') {
        return dealDate >= today && !isOff;
      } else {
        return dealDate < today && !isOff;
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

  // "Needs my action" and the tab badges use the SAME rule as the sentence on
  // the card (bookingStatusLine.mine) — a red sentence and the filter must
  // never disagree about whose move it is.
  // Pending doc categories drive the Share Documents CTA, the Skip button and
  // the status sentence — one derivation for all three.
  const pendingDocCategoriesFor = (deal) => (
    (documentsStillDue(deal) && isArtistSideForDeal(deal, currentUser))
      ? DOC_CATEGORIES.filter((c) => categoryStatus(deal.sharedDocuments, c.key) === 'pending')
      : []);
  const statusLineById = useMemo(() => new Map(deals.map((d) => [
    d.id, bookingStatusLine(d, currentUser, t, { hasPendingDocs: pendingDocCategoriesFor(d).length > 0 }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ])), [deals, currentUser?.id, currentUser?.role, t]);
  const isMyMove = (deal) => !!statusLineById.get(deal.id)?.mine;

  // Inline filters apply to the list only — the tab badges keep counting
  // every actionable deal, filtered or not.
  const filteredDeals = useMemo(() => filterDeals().filter((d) =>
    (actionFilter !== 'needed' || isMyMove(d))
    && (statusFilter === 'all' || statusFilter === getDealDisplayStatus(d))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deals, activeTab, selectedArtistFilter, actionFilter, statusFilter, currentUser?.id, currentUser?.role]);

  // Badge counts = bookings waiting on THIS user, per tab. They used to show
  // filteredDeals.length on the open tab only, which just restated the number
  // of cards already on screen. Counting actions instead means the badge says
  // where the work is — including on tabs you aren't looking at, which is the
  // whole reason to put a number on a tab at all.
  //
  // Computed once for all three tabs: the JSX reads each count twice (the
  // `> 0` guard and the value), which as a function meant six passes over
  // every deal on every render.
  const actionCounts = useMemo(() => {
    const empty = { upcoming: 0, past: 0, declined: 0 };
    return Object.keys(empty).reduce((acc, tab) => ({
      ...acc,
      [tab]: filterDeals(tab).filter(isMyMove).length,
    }), empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, selectedArtistFilter, currentUser?.id, currentUser?.role]);
  // Next show: the soonest confirmed booking leads the Upcoming list as a
  // photo card; the rest stay grouped by month.
  const nextShow = useMemo(() => (activeTab === 'upcoming' && actionFilter === 'all' && statusFilter === 'all'
    ? filteredDeals
        .filter((d) => d.status === 'ACCEPTED' && hasBookingPage(d, currentUser) && !d.limitedVisibility)
        .reduce((soonest, d) => (!soonest || new Date(d.date) < new Date(soonest.date) ? d : soonest), null)
    : null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filteredDeals, activeTab, actionFilter, statusFilter, currentUser?.id]);
  // A page whose booking left the list (deleted, withdrawn, past the first
  // page on a refresh) closes back to the list.
  useEffect(() => {
    if (openDealId && !loading && !deals.some((d) => d.id === openDealId)) closeDeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, openDealId, loading]);
  // Consent-only cards have no page: those stay in the list.
  const openedDeal = openDealId
    ? deals.find((d) => d.id === openDealId && hasBookingPage(d, currentUser)) || null
    : null;
  // Month groups only matter while the list is on screen.
  const clusteredDeals = useMemo(() => (openedDeal || focusMode
    ? []
    : clusterDealsByMonth(nextShow ? filteredDeals.filter((d) => d.id !== nextShow.id) : filteredDeals)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filteredDeals, nextShow, openedDeal, focusMode, activeTab, t]);

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
      case 'CANCELLED':
        return 'status-badge status-declined';
      case 'PAID':
        // Money settled, booking not yet closed out. Had no case at all, so
        // it fell through to an unstyled grey pill while every neighbouring
        // status carried a colour.
        return 'status-badge status-accepted';
      case 'COMPLETED':
        return 'status-badge status-completed';
      default:
        return 'status-badge';
    }
  };

  // Localized display helpers. Maps are memoized on the language (t identity)
  // — the render loop calls these hundreds of times per bookings page, so
  // rebuilding the maps per call was thousands of t() lookups per render.
  const labelMaps = useMemo(() => ({
    status: {
      'PENDING': t('bookings.statusPending'),
      'NEGOTIATING': t('bookings.statusNegotiating'),
      'DECLINED': t('bookings.statusDeclined'),
      'CANCELLED': t('bookings.statusCancelled'),
      'PAID': t('bookings.statusPaid'),
      'COMPLETED': t('bookings.statusCompleted'),
      'DOCS SHARED': t('bookings.statusDocsShared'),
      'CONTRACT SIGNED': t('bookings.statusContractSigned'),
      'ACCEPTED': t('bookings.statusAccepted'),
    },
    docCat: {
      pressKit: t('chat.pressKit'),
      technicalRider: t('chat.technicalRider'),
      hospitalityRider: t('chat.hospitalityRider'),
      invoice: t('chat.invoice'),
    },
    extra: {
      travelIn: t('chat.travelIn'),
      travelOut: t('chat.travelOut'),
      transportation: t('chat.transportation'),
      accommodation: t('chat.accommodation'),
      meals: t('chat.meals'),
    },
  }), [t]);
  const statusLabel = (s) => labelMaps.status[s] || s;
  const docCatLabel = (cat) => labelMaps.docCat[cat.key] || cat.label;
  const extraLabel = (key) => labelMaps.extra[key] || key.replace(/([A-Z])/g, ' $1').trim();

  // Minimal venue awareness/consent card. The promoter↔venue conversation
  // happened offline — the venue is only giving a greenlight, so this shows NO
  // capacity/rooms/fee, just who wants to hold what, when, and Confirm/Decline
  // (while PENDING). Confirmed/declined states show a status line instead.
  const renderConsentCard = (deal) => {
    const promoterName = deal.initiator?.name || deal.venue?.name || t('bookings.aPromoter');
    const dateStr = formatEventDate(deal.date, t('dateFormat.locale'), {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const status = deal.eventVenueStatus;
    return (
      <div key={deal.id} className="mb-4 rounded-2xl border border-infrared/40 bg-[#101015] p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded-lg bg-infrared/15 border border-infrared/40 text-infrared
                           text-[8px] font-semibold uppercase tracking-[0.18em] font-tech">
            {t('bookings.venueRequestBadge')}
          </span>
        </div>
        <p className="m-0 mb-1 text-[15px] font-semibold font-space-grotesk tracking-[-0.01em] text-white">
          {t('bookings.venueConsentTitle', { promoter: promoterName, date: dateStr })}
        </p>
        {deal.eventName && (
          <p className="m-0 mb-3 text-[12px] text-white/45">
            {deal.eventName}
          </p>
        )}
        {status === 'PENDING' ? (
          <>
            <p className="m-0 mb-3 text-[12px] leading-relaxed text-white/45">
              {t('bookings.venueConsentBody')}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                className="btn btn-primary"
                disabled={actionBusy}
                onClick={() => handleConfirmEventVenue(deal.id)}
              >
                {t('bookings.venueConsentConfirm')}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={actionBusy}
                onClick={() => handleDeclineEventVenue(deal.id)}
              >
                {t('bookings.venueConsentDecline')}
              </button>
            </div>
          </>
        ) : (
          <p className="m-0 text-[12px] font-medium text-white/60">
            {status === 'CONFIRMED'
              ? t('bookings.venueConsentConfirmed')
              : t('bookings.venueConsentDeclined')}
          </p>
        )}
      </div>
    );
  };

  // variant: 'row' (list), 'hero' (next show) or 'page' (the booking page).
  const renderDealCard = (deal, variant = 'row') => {
    // A deal the current profile sees ONLY as the tagged event-venue (or any
    // deal the backend redacted for a venue viewer) has no fee/offer/contract
    // data — it must never render the money booking card. Show the minimal
    // venue awareness/consent card instead, whatever the consent status.
    if (!hasBookingPage(deal, currentUser)) {
      return renderConsentCard(deal);
    }
    const isOutgoing = deal.initiator.id === currentUser.id;
    const otherParty = isOutgoing
      ? (deal.venue.id === currentUser.id ? deal.artist : deal.venue)
      : deal.initiator;

    // Who the card is about. The booker sees the ARTIST being booked, never
    // the agent who sent or answers the offer (that agent gets the "via"
    // line); the artist side sees the booker. otherParty stays the chat
    // counterpart.
    const shownParty = (isArtistSideForDeal(deal, currentUser) ? deal.venue : deal.artist) || otherParty;

    // Visibility + write-access flags for the deal card.
    //   isViaAgent — show the "via agent" sub-line (artist viewer + booker viewer when relevant).
    //   delegateToAgent — ARTIST viewer of an agent-led deal: their agent handles it.
    //   agentReadOnly — AGENT viewer of an ARTIST-DIRECT deal: see for visibility, but the
    //     artist is in charge; hide all workflow controls.
    //   hideWorkflow — either of the above hide-conditions applies.
    const artistRepresentedBy = toRepEntries(deal.artist?.representedBy);
    const isArtistViewerViaAgent = isArtistViaAgent(deal, currentUser);
    // Booker only sees "via agent" when the deal itself was agent-led
    // (bookedArtistId set). An artist-direct booking with an artist who
    // happens to have agents stays clean — no via line.
    const isBookerViewerViaAgent =
      !!deal.bookedArtistId &&
      (currentUser.role === 'PROMOTER' || currentUser.role === 'VENUE') &&
      artistRepresentedBy.length > 0;
    const isViaAgent = isArtistViewerViaAgent || isBookerViewerViaAgent;
    const delegateToAgent = isArtistViewerViaAgent;
    // Roster awareness: the server already decided this agent isn't running
    // the deal and stripped its commercials (limitedVisibility). The legacy
    // clause still covers artist-direct rows served before that flag existed.
    const limitedView = deal.limitedVisibility === true;
    const agentReadOnly =
      limitedView || (
        currentUser.role === 'AGENT' &&
        deal.artistId !== currentUser.id &&
        deal.venueId !== currentUser.id &&
        !deal.bookedArtistId
      );
    const hideWorkflow = delegateToAgent || agentReadOnly;
    const handOverAgents = canHandOver(deal)
      ? toRepEntries(currentUser.representedBy).filter((a) => repEntryId(a) && !dormantAgentIds.has(repEntryId(a)))
      : [];
    // An artist can have several — often regional — agents, but exactly one
    // runs this deal (`deal.agentId`). Name that one; only fall back to
    // listing every agent on legacy deals that predate the column.
    const viewerAgentPool = isArtistViewerViaAgent
      ? toRepEntries(currentUser.representedBy)
      : artistRepresentedBy;
    const dealAgentEntry = findRepEntry(viewerAgentPool, deal.agentId);
    // Naming rule, in order: the deal's agent when we can name them; the whole
    // pool only on legacy deals that carry no agentId (there, any of them
    // genuinely might be running it); otherwise a generic label — listing
    // every agent for a deal we KNOW belongs to one of them would name
    // co-agents who have no mandate on it.
    const agentName = !isViaAgent
      ? null
      : (repEntryName(dealAgentEntry)
          || (deal.agentId
                ? t('bookings.agentGeneric')
                : viewerAgentPool.map(repEntryName).filter(Boolean).join(', '))
          || t('bookings.agentGeneric'));

    // The booker's "Message" CTA should route to whoever is leading the
    // negotiation — the deal's own agent, not an arbitrary co-agent.
    const primaryAgentId = deal.agentId || (isBookerViewerViaAgent ? repEntryId(artistRepresentedBy[0]) : null);
    const messageTarget = (isBookerViewerViaAgent && primaryAgentId)
      ? {
          id: primaryAgentId,
          name: repEntryName(dealAgentEntry) || agentName,
          role: 'AGENT',
        }
      : otherParty;

    const pendingDocCategories = pendingDocCategoriesFor(deal);
    const statusLine = statusLineById.get(deal.id);

    const contractSlot = () => (
      <>
                {/* Contract Actions. Only the artist side initiates contracts;
                    venue/promoter sees a quiet hint instead. An empty contract
                    = {} (fresh ACCEPTED deal) has no .status set yet — treat
                    it the same as NOT_SENT. */}
                {(!deal.contract || !deal.contract.status || deal.contract.status === 'NOT_SENT') && !isArtistSideForDeal(deal, currentUser) && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
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
                    {/* Draft from the member's own template, then the same sign-and-send step. */}
                    <button className="btn btn-outline" disabled={actionBusy} onClick={() => setDraftContractDeal(deal)}>
                      {t('contracts.draftButton')}
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
                  // Gate by whether MY side has already signed, not by which
                  // side I am on: either party can be the one who sent the
                  // contract (the beta seeds a venue-signed one to artists),
                  // and the side that has not signed yet must get Sign.
                  const onArtistSide = isArtistSideForDeal(deal, currentUser);
                  const isFullySigned = deal.contract.status === 'FULLY_SIGNED';
                  const otherPartyName = onArtistSide
                    ? (deal.venue?.name || t('bookings.theVenue'))
                    : (deal.artist?.name || t('bookings.theArtist'));
                  const sigs = Array.isArray(deal.contract.signatures) ? deal.contract.signatures : [];
                  const sigIsArtistSide = (sig) => signatureIsArtistSide(sig, deal);
                  const mySideSigned = sigs.some((sig) => sigIsArtistSide(sig) === onArtistSide)
                    // A SENT contract with no signature record was sent-and-signed by its sender.
                    || (sigs.length === 0 && deal.contract.status === 'SENT' && (deal.contract.sentBy ? deal.contract.sentBy === currentUser.id : onArtistSide));

                  // Only the sender may withdraw (server rule) — the party who
                  // countersigned a received contract has nothing to withdraw.
                  const canWithdraw = deal.contract.sentBy ? deal.contract.sentBy === currentUser.id : onArtistSide;

                  if (mySideSigned) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {!isFullySigned && (
                          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
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
                        {canWithdraw && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setDealToWithdraw(deal);
                            setShowWithdrawConfirmation(true);
                          }}
                          style={{
                            borderColor: 'rgba(255,193,7,0.5)',
                            color: 'rgba(255,193,7,1)',
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
                        )}
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
                                const fresh = await apiService.getDeal(deal.id, currentUser.id);
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
                {deal.contract && deal.contract.status === 'FULLY_SIGNED' && hasContractFile(deal) && (
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

                {/* Once both sides signed: who signed and when (own side
                    first) plus the certificate that carries the drawn
                    signatures. Before that the waiting line says it all. */}
                {deal.contract?.status === 'FULLY_SIGNED' && (deal.contract.signatures || []).length > 0 && (() => {
                  // "Your signature" = signed by this profile; the agent's
                  // signature shows under their name on the artist's card.
                  const mine = (sig) => sig.signedBy === currentUser.id;
                  const sigs = [...deal.contract.signatures].sort((a, b) => mine(b) - mine(a));
                  const certPath = deal.contract.certificateOfCompletion?.storagePath;
                  return (
                    <div className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-left">
                      <div className="mb-1.5 text-[10px] font-tech uppercase tracking-[0.15em] text-white/45">{t('bookings.signaturesTitle')}</div>
                      {sigs.map((sig, i) => (
                        <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-[12px] leading-relaxed">
                          <span className={mine(sig) ? 'text-infrared font-medium' : 'text-white/80'}>
                            {mine(sig) ? t('bookings.yourSignature') : sig.fullName}
                          </span>
                          {mine(sig) && sig.fullName && <span className="text-white/50">{sig.fullName}</span>}
                          <span className="text-white/45">
                            {formatTimestamp(sig.signedAt, t('dateFormat.locale'))}
                          </span>
                        </div>
                      ))}
                      {certPath && (
                        <button
                          type="button"
                          className="mt-2 cursor-pointer border-none bg-transparent p-0 text-[12px] text-white/60 underline hover:text-white"
                          onClick={() => setPdfViewerUrl(getFullUrl(`/api/contracts/files/${encodeURIComponent(certPath)}`, deal.id))}
                        >
                          {t('bookings.viewCertificate')}
                        </button>
                      )}
                    </div>
                  );
                })()}


      </>
    );

    const paymentSlot = () => (
      <>
                {/* Confirm receipt — artist-side only, whenever money has been
                    marked but not confirmed. Keyed on the payment summary, not
                    on payment.status: a seeded or legacy payment without that
                    field still has a deposit waiting for the artist. */}
                {deal.payment && (() => {
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
                        setShowDepositAgain(false);
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

      </>
    );

    const displayStatus = getDealDisplayStatus(deal);
    const photo = deal.eventImage || shownParty.avatar || null;
    const locale = t('dateFormat.locale');
    const feeText = formatFee(deal.currentFee) != null ? `${formatFee(deal.currentFee)} ${deal.currency}` : null;
    const statusPill = <span className={getStatusBadgeClass(displayStatus)}>{statusLabel(displayStatus)}</span>;

    // The tagged TORA venue's consent, shown wherever the booking is.
    const consentPills = (
      <>
        {deal.eventVenueStatus === 'PENDING' && (
          <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300
                           text-[8px] font-semibold uppercase tracking-[0.15em] font-tech">
            {t('bookings.awaitingVenue')}
          </span>
        )}
        {deal.eventVenueStatus === 'CONFIRMED' && (
          <span className="px-2 py-0.5 rounded-lg bg-[#43E97B]/15 border border-[#43E97B]/40 text-[#43E97B]
                           text-[8px] font-semibold uppercase tracking-[0.15em] font-tech">
            {t('bookings.venueConfirmedBadge')}
          </span>
        )}
        {deal.eventVenueStatus === 'DECLINED' && (
          <span className="px-2 py-0.5 rounded-lg bg-infrared/15 border border-infrared/40 text-infrared
                           text-[8px] font-semibold uppercase tracking-[0.15em] font-tech">
            {t('bookings.venueDeclinedBadge')}
          </span>
        )}
      </>
    );

    // Who the booking is for, or who runs it. Rows show the first line, the
    // page shows them all.
    const subLines = [
      deal.bookedArtistName && deal.bookedArtistId !== currentUser.id && deal.bookedArtistId !== shownParty.id
        && t('bookings.forArtist', { name: deal.bookedArtistName }),
      isViaAgent && agentName && t('bookings.viaAgent', { name: agentName }),
      agentReadOnly && t(limitedView && deal.bookedArtistId ? 'bookings.viaOtherAgent' : 'bookings.viaArtistDirect',
        { name: deal.artist?.name || t('chat.theArtistSide') }),
    ].filter(Boolean);
    const rowSub = subLines[0];

    const photoBox = (className) => (photo
      ? <img src={photo} alt="" className={className} loading="lazy" />
      : <div className={`${className} booking-photo-fallback ${getAvatarClass(shownParty.role)}`} aria-hidden="true">{shownParty.name.charAt(0).toUpperCase()}</div>);

    // ── List row ──
    if (variant === 'row') {
      return (
        <button
          type="button"
          key={deal.id}
          id={`booking-${deal.id}`}
          className={`booking-row${statusLine?.mine ? ' is-mine' : ''}`}
          onClick={() => openDeal(deal.id)}
        >
          {photoBox('booking-row-photo')}
          <span className="booking-row-body">
            <span className="booking-row-top">
              <span className="booking-row-when">
                {[formatEventDate(deal.date, locale, { weekday: 'short', day: 'numeric', month: 'short', year: undefined }), deal.city].filter(Boolean).join(' · ')}
              </span>
              {statusPill}
            </span>
            <span className="booking-row-title">{deal.eventName || shownParty.name}</span>
            <span className="booking-row-party">
              {shownParty.name} · <span className={`booking-role-${shownParty.role.toLowerCase()}`}>{roleLabel(shownParty.role, t)}</span>
            </span>
            {rowSub && <span className="booking-row-sub">{rowSub}</span>}
            {statusLine && (
              <span className={`booking-status-line${statusLine.mine ? ' is-mine' : ''}`}>{statusLine.text}</span>
            )}
            {feeText && <span className="booking-row-fee">{feeText}</span>}
            {deal.eventVenueStatus && <span className="flex flex-wrap gap-1.5">{consentPills}</span>}
          </span>
        </button>
      );
    }

    // ── Next show: the soonest confirmed booking, as a photo card ──
    if (variant === 'hero') {
      const steps = Object.values(bookingStepsDone(deal));
      const current = steps.indexOf(false);
      return (
        <button type="button" key={deal.id} id={`booking-${deal.id}`} className="booking-hero" onClick={() => openDeal(deal.id)}>
          <span className="booking-hero-media">
            {photoBox('booking-hero-img')}
            <span className="booking-hero-shade" />
            <span className="booking-hero-date">
              <span>{formatEventDate(deal.date, locale, { month: 'short', day: undefined, year: undefined })}</span>
              <strong>{new Date(deal.date).getUTCDate()}</strong>
            </span>
            <span className="booking-hero-status">{statusPill}</span>
            <span className="booking-hero-text">
              <span className="booking-hero-title">{deal.eventName || t('bookings.booking')}</span>
              <span className="booking-hero-sub">
                {[deal.city, deal.eventStage, deal.setStartTime && deal.setEndTime ? `${deal.setStartTime} – ${deal.setEndTime}` : null].filter(Boolean).join(' · ')}
              </span>
            </span>
          </span>
          <span className="booking-hero-body">
            <span className="booking-hero-party">
              <Avatar profile={shownParty} className="h-[34px] w-[34px] text-[14px]" />
              <span className="min-w-0 flex-1">
                <span className="booking-hero-party-name">{shownParty.name}</span>
                <span className={`booking-role-${shownParty.role.toLowerCase()} booking-hero-party-role`}>{roleLabel(shownParty.role, t)}</span>
                {rowSub && <span className="booking-row-sub">{rowSub}</span>}
              </span>
              {feeText && <span className="booking-hero-fee">{feeText}</span>}
            </span>
            <span className="booking-hero-steps" aria-label={t('bookings.stepsDone', { n: steps.filter(Boolean).length, total: steps.length })}>
              {steps.map((done, i) => (
                <span key={i} className={done ? 'is-done' : i === current ? 'is-current' : ''} />
              ))}
            </span>
            {statusLine && (
              <span className={`booking-status-line${statusLine.mine ? ' is-mine' : ''}`}>{statusLine.text}</span>
            )}
          </span>
        </button>
      );
    }

    // ── The booking page ──
    const offerHistory = deal.offerHistory || [];
    const lastOffer = offerHistory.length > 0 ? offerHistory[offerHistory.length - 1] : null;
    // PENDING: the recipient answers. NEGOTIATING: whoever did NOT send the last counter.
    const canRespond = (lastOffer ? lastOffer.offeredBy !== currentUser.id : !isOutgoing)
      && !hideWorkflow && (deal.status === 'PENDING' || deal.status === 'NEGOTIATING');
    // Buttons for what is due now live in the Next step box.
    const timelineShown = deal.status === 'ACCEPTED' && !hideWorkflow;
    const artistSide = isArtistSideForDeal(deal, currentUser);
    // Sending, signing and withdrawing live in the Next step box until both have signed.
    const contractOpen = deal.contract?.status !== 'FULLY_SIGNED' && !deal.contract?.skipped;
    // "Completed" is a claim about something that already happened.
    const eventPassed = !!deal.date && new Date(deal.date) <= new Date();
    const skipPendingDocs = async () => {
      if (actionBusy) return;
      const labels = pendingDocCategories.map((c) => docCatLabel(c)).join(', ');
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
    };
    // Reopen a skipped contract (artist side): undoes an accidental skip.
    const unskipContract = async () => {
      if (actionBusy) return;
      if (!(await appConfirm(t('chat.unskipContractConfirm')))) return;
      setActionBusy(true);
      try {
        await apiService.unskipContract(deal.id, currentUser.id);
        fetchDeals();
      } catch (err) {
        appAlert(err.message || t('chat.failedToUnskipContract'));
      } finally {
        setActionBusy(false);
      }
    };
    // The booking's paperwork, one row each: tap opens what has been shared.
    const contractStatus = deal.contract?.status || 'NOT_SENT';
    const docRows = [
      {
        key: 'contract',
        label: t('bookings.docContract'),
        ...(deal.contract?.skipped
          ? { status: t('bookings.docStatusSkipped'), tone: 'muted' }
          : {
            FULLY_SIGNED: { status: t('bookings.docStatusSigned'), tone: 'done' },
            NOT_SENT: { status: t('bookings.docStatusNotSent'), tone: 'pending' },
          }[contractStatus] || { status: t('bookings.docStatusAwaitingSignature'), tone: 'pending' }),
        open: hasContractFile(deal) ? () => openContractPdf(deal) : null,
      },
      ...DOC_CATEGORIES.map((cat) => {
        const state = categoryStatus(deal.sharedDocuments, cat.key);
        const entry = deal.sharedDocuments?.[cat.key];
        return {
          key: cat.key,
          label: docCatLabel(cat),
          status: state === 'shared' ? t('bookings.docStatusShared') : state === 'skipped' ? t('bookings.docStatusSkipped') : t('bookings.docStatusPending'),
          tone: state === 'shared' ? 'done' : state === 'skipped' ? 'muted' : 'pending',
          open: state === 'shared' && entry?.documentUrl
            ? () => setPdfViewerUrl(getFullUrl(entry.documentUrl))
            : (artistSide && deal.contract?.status === 'FULLY_SIGNED' ? () => { setSelectedDealForWorkflow(deal); setShowDocumentModal(true); } : null),
        };
      }),
    ];
    // The bar: Message, plus the answer to an offer. A cancelled booking's
    // money buttons stay in its settlement block.
    const showBar = !limitedView;

    const terms = [
      feeText && { label: t('bookings.termFee'), value: feeText },
      deal.setStartTime && deal.setEndTime
        ? { label: t('bookings.termSet'), value: `${deal.setStartTime} – ${deal.setEndTime}` }
        : (deal.startTime && deal.endTime && { label: t('bookings.termEventTime'), value: deal.startTime === 'TBC' ? t('offer.timeTbc') : `${deal.startTime} – ${deal.endTime}` }),
      (deal.eventStage || deal.performanceType) && { label: deal.eventStage ? t('bookings.termStage') : t('bookings.termPerformance'), value: deal.eventStage || deal.performanceType },
      deal.eventCapacity && { label: t('bookings.termCapacity'), value: Number(deal.eventCapacity).toLocaleString(locale) },
    ].filter(Boolean);

    // The details list, as label / value pairs (labels lose the trailing
    // colon the older card layout used).
    const lbl = (key) => t(key).replace(/\s*[:：]\s*$/, '');
    const extrasText = (() => {
      let extras = null;
      if (deal.additionalTerms) {
        try {
          const parsed = typeof deal.additionalTerms === 'string' ? JSON.parse(deal.additionalTerms) : deal.additionalTerms;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) extras = parsed;
        } catch (e) { /* free text, shown as additional terms */ }
      }
      if (!extras && deal.extras && Object.keys(deal.extras).length > 0) extras = deal.extras;
      if (!extras) return null;
      return Object.entries(extras).filter(([, v]) => v)
        .map(([k, v]) => (v === 'Included' || v === true ? extraLabel(k) : `${extraLabel(k)}: ${v}`)).join(', ');
    })();
    const freeTerms = !extrasText && deal.additionalTerms && typeof deal.additionalTerms === 'string' ? deal.additionalTerms : null;
    const lineupNames = Array.isArray(deal.lineup) ? deal.lineup.map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean) : [];
    const { depositDeadline, finalPaymentDeadline } = dealDeadlines(deal);
    const facts = [
      deal.artistName && { label: lbl('bookings.artistLabel'), value: deal.artistName },
      (deal.venueName || deal.city) && { label: lbl('chat.venueLabel'), value: deal.venueName || '', sub: deal.city && deal.country ? `${deal.city}, ${deal.country}` : deal.city },
      deal.startTime && deal.endTime && { label: lbl('chat.eventTimeLabel'), value: deal.startTime === 'TBC' ? t('offer.timeTbc') : `${deal.startTime} – ${deal.endTime}` },
      deal.setStartTime && deal.setEndTime && { label: lbl('chat.setTimeLabel'), value: `${deal.setStartTime} – ${deal.setEndTime}`, sub: deal.setDuration ? t('chat.durationMinutes', { n: deal.setDuration }) : null },
      deal.performanceType && { label: lbl('offer.performanceType'), value: deal.performanceType },
      deal.eventRoomsCount != null && deal.eventRoomsCount !== '' && { label: lbl('offer.eventRooms'), value: String(deal.eventRoomsCount) },
      lineupNames.length > 0 && { label: lbl('offer.lineup'), value: lineupNames.join(', ') },
      deal.entranceFee != null && deal.entranceFee !== '' && { label: lbl('offer.tickets'), value: `${Number(deal.entranceFee).toLocaleString(locale)} ${deal.entranceFeeCurrency || deal.currency}`, sub: deal.entranceFeeNote },
      extrasText && { label: lbl('chat.extrasLabel'), value: extrasText },
      freeTerms && { label: lbl('chat.additionalTermsLabel'), value: freeTerms },
      deal.technicalRequirements && { label: lbl('chat.technicalLabel'), value: deal.technicalRequirements },
      depositDeadline && { label: lbl('offer.depositDeadline'), value: formatEventDate(depositDeadline, locale) },
      finalPaymentDeadline && { label: lbl('offer.finalPaymentDeadline'), value: formatEventDate(finalPaymentDeadline, locale) },
    ].filter(Boolean);

    return (
      <div key={deal.id} id={`booking-${deal.id}`} className="booking-page">
        <div className="booking-page-hero">
          {photoBox('booking-page-hero-img')}
          <div className="booking-page-hero-shade" />
          {!focusMode && (
            <button type="button" className="booking-page-round booking-page-back" aria-label={t('bookings.backToBookings')} onClick={closeDeal}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            </button>
          )}
          <div className="booking-page-hero-text">
            <div className="flex flex-wrap items-center gap-1.5">{statusPill}{consentPills}</div>
            <h2 className="booking-page-title">{deal.eventName || t('bookings.booking')}</h2>
            <p className="booking-page-when">
              {formatEventDate(deal.date, locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {(deal.city || deal.venue?.location) && ` · ${deal.city && deal.country ? `${deal.city}, ${deal.country}` : (deal.city || deal.venue?.location)}`}
            </p>
          </div>
        </div>

        <div className="booking-page-body">
          <div className="booking-page-party">
            <Avatar profile={shownParty} className="h-11 w-11 text-[17px]" />
            <div className="min-w-0 flex-1">
              <p className="booking-page-party-name">{shownParty.name}</p>
              <p className="booking-page-party-role">
                <span className={`booking-role-${shownParty.role.toLowerCase()}`}>{roleLabel(shownParty.role, t)}</span>
                {shownParty.location ? ` · ${shownParty.location}` : ''}
              </p>
              {subLines.map((line) => <p key={line} className="party-via-agent">{line}</p>)}
            </div>
          </div>

          {deal.eventVenueStatus === 'PENDING' && (
            <p className="m-0 text-[12px] leading-relaxed text-white/45">{t('bookings.awaitingVenueHint')}</p>
          )}
          {limitedView && (
            <p className="m-0 text-[12px] leading-relaxed text-white/40">
              {t(deal.agentId ? 'bookings.limitedViewNote' : 'bookings.limitedViewDirect')}
            </p>
          )}
          {handOverAgents.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {handOverAgents.map((agent) => (
                <button key={repEntryId(agent)} type="button" className="btn btn-outline btn-sm" disabled={actionBusy} onClick={() => handleHandToAgent(deal, agent)}>
                  {t('bookings.handToAgent', { name: repEntryName(agent) })}
                </button>
              ))}
            </div>
          )}

          {terms.length > 0 && (
            <dl className="booking-terms">
              {terms.map((term) => (
                <div key={term.label} className="booking-term">
                  <dt>{term.label}</dt>
                  <dd>{term.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {statusLine && (
            <section className={`booking-next${statusLine.mine ? ' is-mine' : ''}`} aria-label={t('bookings.nextStep')}>
              <span className="booking-next-eyebrow">{statusLine.mine ? t('bookings.nextStepYours') : t('bookings.nextStep')}</span>
              <p className="booking-next-text">{statusLine.text}</p>
              {timelineShown && (
                <div className="workflow-actions booking-next-actions">
                  {contractOpen && contractSlot()}
                  {statusLine.key === 'shareDocs' && (
                    <>
                      <button className="btn btn-primary" onClick={() => { setSelectedDealForWorkflow(deal); setShowDocumentModal(true); }}>
                        {t('chat.shareDocuments')}
                      </button>
                      <button className="btn btn-skip" disabled={actionBusy} onClick={skipPendingDocs}>
                        {t('bookings.skipDocuments')}
                      </button>
                    </>
                  )}
                  {paymentSlot()}
                  {eventPassed && artistSide && (
                    <button className="btn btn-primary" disabled={actionBusy} onClick={() => handleCompleteDeal(deal)}>
                      {actionBusy ? '...' : t('bookings.markCompleted')}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {delegateToAgent && (
            <div className="via-agent-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="8"></line>
              </svg>
              <span>{agentName ? t('bookings.managedByAgentNamed', { name: agentName }) : t('bookings.managedByAgent')}</span>
            </div>
          )}

          {timelineShown && (
            <section>
              <h3 className="booking-page-h">{t('bookings.progressHeading')}</h3>
              <WorkflowTimeline deal={deal} onViewPaymentDetails={() => setDepositHistoryDeal(deal)} />
            </section>
          )}

          {(deal.status === 'ACCEPTED' || deal.status === 'COMPLETED') && !hideWorkflow && (
            <section>
              <div className="booking-page-h-row">
                <h3 className="booking-page-h">{t('bookings.documentsHeading')}</h3>
                {artistSide && deal.contract?.status === 'FULLY_SIGNED' && (
                  <button type="button" className="booking-page-link" onClick={() => { setSelectedDealForWorkflow(deal); setShowDocumentModal(true); }}>
                    {t('bookings.manageDocuments')}
                  </button>
                )}
              </div>
              <ul className="booking-docs">
                {docRows.map((row) => (
                  <li key={row.key}>
                    <button type="button" className="booking-doc" disabled={!row.open} onClick={row.open || undefined}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                      <span className="booking-doc-name">{row.label}</span>
                      <span className={`booking-doc-status is-${row.tone}`}>{row.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {deal.contract?.status === 'FULLY_SIGNED' && <div className="workflow-actions booking-docs-contract">{contractSlot()}</div>}
              {artistSide && deal.contract?.skipped === true && deal.status !== 'COMPLETED' && (
                <button className="btn btn-outline btn-sm booking-docs-extra" disabled={actionBusy} onClick={unskipContract}>
                  {t('chat.unskipContract')}
                </button>
              )}
              {artistSide && (
                <button className="btn btn-outline btn-sm booking-docs-extra" onClick={() => setInvoiceDeal(deal)}>
                  {deal.sharedDocuments?.invoices?.length ? t('invoices.issueAnother') : t('invoices.issueButton')}
                </button>
              )}
            </section>
          )}

          {facts.length > 0 && (
            <section>
              <h3 className="booking-page-h">{t('bookings.detailsHeading')}</h3>
              <dl className="booking-facts">
                {facts.map((f) => (
                  <div key={f.label} className="booking-fact">
                    <dt>{f.label}</dt>
                    <dd>
                      {f.value}
                      {f.sub && <span className="booking-fact-sub">{f.sub}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {deal.notes && (
            <section>
              <h3 className="booking-page-h">{t('bookings.notes')}</h3>
              <p className="booking-page-notes">{deal.notes}</p>
            </section>
          )}

          {/* Why a booking ended, kept visible. A cancellation with no stated
              reason is the thing people argue about later. */}
          {deal.status === 'CANCELLED' && (() => {
            const settlement = deal.payment?.settlement;
            const summary = summarizeDealPayment(deal);
            const isOwedSide = isArtistSideForDeal(deal, currentUser);
            const isBookerSide = deal.venue.id === currentUser.id;
            // A fee was agreed or money moved: something for the two of them to settle.
            const hasMoneyQuestion = summary.hasAnyPayment || summary.totalFee > 0;

            return (
              <div className="cancelled-settlement">
                {deal.cancelReason && (
                  <div className="cancelled-reason-note">
                    <strong>{t('bookings.cancelledReasonLabel')}</strong> {deal.cancelReason}
                  </div>
                )}

                {hasMoneyQuestion && (() => {
                  // Money marked by the payer but not yet acknowledged.
                  const awaiting = Math.max(0, summary.totalMarked - summary.totalConfirmed);
                  const canConfirm = isOwedSide && awaiting > 0;

                  return (
                    <div className="cancelled-payment-row">
                      <span className="cancelled-payment-figure">
                        {t('bookings.paidSoFar')} {formatFee(summary.totalConfirmed)}
                        {summary.totalFee > 0 && ` / ${formatFee(summary.totalFee)}`} {summary.currency}
                        {awaiting > 0 && (
                          <>
                            {' · '}
                            <em className="cancelled-payment-awaiting">
                              {t('bookings.awaitingConfirmation', { amount: `${formatFee(awaiting)} ${summary.currency}` })}
                            </em>
                          </>
                        )}
                      </span>

                      {settlement ? (
                        <span className={`settlement-pill ${settlement.outcome}`}>
                          {settlement.outcome === 'settled' ? t('bookings.paymentSettled') : t('bookings.paymentWaived')}
                        </span>
                      ) : (
                        <div className="cancelled-payment-actions">
                          {summary.hasAnyPayment && (
                            <button className="btn btn-outline btn-sm" onClick={() => setDepositHistoryDeal(deal)}>
                              {t('bookings.viewDetailsLink')}
                            </button>
                          )}
                          {isBookerSide && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                setSelectedDealForWorkflow(deal);
                                setShowDepositAgain(false);
                                setShowPaymentModal(true);
                              }}
                            >
                              {t('bookings.updatePayment')}
                            </button>
                          )}
                          {canConfirm && (
                            <button className="btn btn-primary btn-sm" onClick={() => setDepositHistoryDeal(deal)}>
                              {t('bookings.confirmReceipt')}
                            </button>
                          )}
                          {isOwedSide && !canConfirm && (
                            <button className="btn btn-primary btn-sm" onClick={() => { setDealToSettle(deal); setSettleNote(''); }}>
                              {t('bookings.resolvePayment')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {settlement?.note && <p className="settlement-note">{settlement.note}</p>}
              </div>
            );
          })()}

          {/* Closing a confirmed booking early stays available, quietly. */}
          {timelineShown && (
            <button type="button" className="booking-page-cancel" disabled={actionBusy} onClick={() => { setDealToCancel(deal); setCancelReason(''); }}>
              {t('bookings.cancelBooking')}
            </button>
          )}

          {isOutgoing && !hideWorkflow && deal.status === 'PENDING' && (
            <button type="button" className="booking-page-cancel" onClick={() => setDealToDelete(deal.id)}>
              {t('bookings.deleteOffer')}
            </button>
          )}
        </div>

        {/* Your move, always at the bottom of the page */}
        {showBar && (
          <div className="booking-page-bar">
            {canRespond && (
              <button
                type="button"
                className="booking-page-bar-chat"
                aria-label={t('bookings.messageName', { name: messageTarget?.name || otherParty.name })}
                onClick={() => onOpenChat && onOpenChat(messageTarget)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </button>
            )}
            {canRespond ? (
              <>
                <button type="button" className="booking-page-bar-text" onClick={() => setDealToDecline(deal.id)}>
                  {t('search.decline')}
                </button>
                <button type="button" className="btn btn-outline booking-page-bar-btn" onClick={() => onOpenChat && onOpenChat(messageTarget, deal)}>
                  {t('chat.review')}
                </button>
                <button type="button" className="btn btn-primary booking-page-bar-btn" disabled={actionBusy} onClick={() => handleAcceptDeal(deal.id)}>
                  {actionBusy ? '...' : t('messages.accept')}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-outline booking-page-bar-btn" onClick={() => onOpenChat && onOpenChat(messageTarget)}>
                {t('search.message')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bookings-screen${focusMode ? ' bookings-screen--focus' : ''}`}>
      {focusMode && focusDealId && (() => {
        const deal = deals.find((d) => d.id === focusDealId);
        if (deal) return renderDealCard(deal, 'page');
        return loading || !hasLoadedRef.current ? <LoadingGlobe label={t('bookings.loadingBookings')} /> : null;
      })()}
      {!focusMode && openedDeal && renderDealCard(openedDeal, 'page')}
      {/* isolate wraps ONLY in-flow content so the -z-10 backdrop stays visible;
          overlays (delete modal, etc.) live outside it. */}
      {!focusMode && !openedDeal && (
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
          onClick={() => selectTab('upcoming')}
        >
          {t('bookings.tabUpcoming')}
          {actionCounts.upcoming > 0 && (
            <span className="tab-badge">{actionCounts.upcoming}</span>
          )}
        </button>
        <button
          className={`bookings-tab ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => selectTab('past')}
        >
          {t('bookings.tabPast')}
          {actionCounts.past > 0 && (
            <span className="tab-badge">{actionCounts.past}</span>
          )}
        </button>
        <button
          className={`bookings-tab ${activeTab === 'declined' ? 'active' : ''}`}
          onClick={() => selectTab('declined')}
        >
          {t('bookings.tabDeclined')}
          {actionCounts.declined > 0 && (
            <span className="tab-badge">{actionCounts.declined}</span>
          )}
        </button>
      </div>

      {deals.length > 0 && (
        <div className="bookings-filters">
          <button
            type="button"
            className={`bookings-needs-chip${actionFilter === 'needed' ? ' is-on' : ''}`}
            aria-pressed={actionFilter === 'needed'}
            onClick={() => setActionFilter(actionFilter === 'needed' ? 'all' : 'needed')}
          >
            <span className="bookings-needs-dot" aria-hidden="true" />
            {t('bookings.needsYou', { n: actionCounts[activeTab] })}
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="agent-artist-select bookings-filter-select"
            aria-label={t('bookings.filterStatus')}
          >
            <option value="all">{t('bookings.filterStatus')}: {t('bookings.filterAllStatuses')}</option>
            {statusesForTab(activeTab).map((value) => (
              <option key={value} value={value}>{labelMaps.status[value]}</option>
            ))}
          </select>
        </div>
      )}

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
        {!loading && !error && activeTab === 'upcoming' && pendingConsentDeals.length > 0 && (
          <div className="bookings-list mb-2">
            {pendingConsentDeals.map((deal) => renderConsentCard(deal))}
          </div>
        )}
        {loading ? (
          <LoadingGlobe label={t('bookings.loadingBookings')} />
        ) : error ? (
          <div className="bookings-error">
            <p>{error}</p>
            <button className="btn btn-outline" onClick={fetchDeals}>
              {t('common.retry')}
            </button>
          </div>
        ) : filteredDeals.length === 0 && !(activeTab === 'upcoming' && pendingConsentDeals.length > 0) ? (
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
            {nextShow && (
              <section className="bookings-next-show" aria-label={t('bookings.nextShow')}>
                <h2 className="bookings-next-show-label">{t('bookings.nextShow')}</h2>
                {renderDealCard(nextShow, 'hero')}
              </section>
            )}
            {clusteredDeals.map((cluster, index) => (
              <div key={index} className="bookings-cluster">
                <div className="cluster-header">
                  <h2>{cluster.monthYear}</h2>
                  <span className="cluster-count">{cluster.deals.length !== 1 ? t('bookings.offersCount', { n: cluster.deals.length }) : t('bookings.offerCount', { n: cluster.deals.length })}</span>
                </div>
                {cluster.deals.map(deal => renderDealCard(deal, 'row'))}
              </div>
            ))}
            {hasMoreDeals && (
              <button
                type="button"
                onClick={loadOlderDeals}
                disabled={loadingOlderDeals}
                className="mx-auto my-4 block px-4 py-2 rounded-full border border-white/15 bg-[#0c0c11] text-xs
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
      )}

      {/* Custom Delete Confirmation Modal */}
      {dealToDelete && (
        <OverlayPortal><div className="delete-modal-overlay" onClick={() => setDealToDelete(null)}>
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
        </div></OverlayPortal>
      )}

      {/* Decline Offer Modal */}
      {dealToSettle && (
        <div className="delete-modal-overlay" onClick={() => { setDealToSettle(null); setSettleNote(''); }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>{t('bookings.resolvePayment')}</h3>
            </div>
            <div className="delete-modal-content">
              <p>{t('bookings.resolvePaymentExplainer')}</p>
              <textarea
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                placeholder={t('bookings.resolvePaymentNotePlaceholder')}
                className="decline-reason-textarea"
                rows="3"
              />
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => handleSettlePayment('waived')}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : t('bookings.markWaived')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSettlePayment('settled')}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : t('bookings.markSettled')}
              </button>
            </div>
          </div>
        </div>
      )}

      {dealToCancel && (
        <OverlayPortal><div className="delete-modal-overlay" onClick={() => {
          setDealToCancel(null);
          setCancelReason('');
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>{t('bookings.cancelBooking')}</h3>
            </div>
            <div className="delete-modal-content">
              <p>{t('bookings.cancelBookingWarning')}</p>
              <p>{t('bookings.cancelReasonLabel')}</p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('bookings.cancelExamplePlaceholder')}
                className="decline-reason-textarea"
                rows="4"
                autoFocus
              />
            </div>
            <div className="delete-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setDealToCancel(null);
                  setCancelReason('');
                }}
              >
                {t('bookings.keepBooking')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleCancelDeal}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : t('bookings.confirmCancelBooking')}
              </button>
            </div>
          </div>
        </div></OverlayPortal>
      )}

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
        <OverlayPortal><div className="delete-modal-overlay" onClick={() => {
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
                          {doc.addedDate ? new Date(doc.addedDate).toLocaleDateString(t('dateFormat.locale')) : t('bookings.noDate')}
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
        </div></OverlayPortal>
      )}

      <DraftContractModal
        isOpen={!!draftContractDeal}
        deal={draftContractDeal}
        currentUser={currentUser}
        onClose={() => setDraftContractDeal(null)}
        onReady={(documentData) => {
          // Same shape AddContractModal hands over: the sign-and-send modal takes it from here.
          setPendingContractToSign({ documentData, deal: draftContractDeal });
        }}
      />

      <IssueInvoiceModal
        isOpen={!!invoiceDeal}
        deal={invoiceDeal}
        currentUser={currentUser}
        onClose={() => setInvoiceDeal(null)}
        onIssued={(updatedDeal) => { if (updatedDeal?.id) setDeals((prev) => prev.map((d) => (d.id === updatedDeal.id ? { ...d, ...updatedDeal } : d))); }}
      />

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
        <OverlayPortal><div className="delete-modal-overlay" onClick={() => {
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
                border: `1px dashed ${paymentProofFile ? 'rgba(67,233,123,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontWeight: 600 }}>
                  Proof of payment * <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(PDF or image, max 10MB)</span>
                </label>
                {paymentProofFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>{paymentProofFile.name}</strong>
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '6px', fontSize: '11px' }}>
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
                  <label className="btn btn-outline btn-sm" style={{ display: 'inline-flex', cursor: 'pointer' }}>
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
                {/* Once a deposit is marked, the balance is what is offered; the
                    deposit block is replaced by what was sent and when, with a
                    way back for a further instalment. */}
                {(() => {
                  const paySummary = summarizeDealPayment(selectedDealForWorkflow);
                  const last = paySummary.history[paySummary.history.length - 1];
                  const depositSent = paySummary.markedDeposit > 0;
                  return depositSent && !showDepositAgain ? (
                    <p className="payment-deposit-sent">
                      {last
                        ? t('bookings.depositAlreadySent', { amount: `${formatFee(last.amount)} ${paySummary.currency}`, date: formatTimestamp(last.date, t('dateFormat.locale')) })
                        : t('bookings.depositAlreadySent', { amount: `${formatFee(paySummary.markedDeposit)} ${paySummary.currency}`, date: '' })}
                      {' '}
                      <button type="button" className="link-btn" onClick={() => setShowDepositAgain(true)}>{t('bookings.addAnotherDeposit')}</button>
                    </p>
                  ) : null;
                })()}
                {(summarizeDealPayment(selectedDealForWorkflow).markedDeposit === 0 || showDepositAgain) && (
                <div style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '14px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontWeight: 600 }}>
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
                )}
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
        </div></OverlayPortal>
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
          onDraftFromTemplate={() => {
            setShowAddContractModal(false);
            setDraftContractDeal(selectedDealForWorkflow);
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

        const renderRow = ({ label, amount, date, confirmedAt, proof, proofUrl, canConfirm, onConfirm, onViewProof }) => (
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
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                {date ? new Date(date).toLocaleString(t('dateFormat.locale'), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
              {confirmedAt && (
                <div style={{ fontSize: '10px', color: 'rgba(67,233,123,1)', marginTop: '2px' }}>
                  ✓ Receipt confirmed · {new Date(confirmedAt).toLocaleDateString(t('dateFormat.locale'), { day: '2-digit', month: 'short' })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, alignItems: 'stretch' }}>
              {/* An image proof is shown right here, so the amount, the slip and
                  the Confirm button sit in one view. PDFs still open the viewer. */}
              {proof?.storagePath && proofUrl && (proof.contentType || '').startsWith('image/') && (
                <img src={proofUrl} alt={t('bookings.proofOfPayment')} onClick={onViewProof}
                  style={{ width: '120px', maxHeight: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', cursor: 'zoom-in' }} />
              )}
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
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
                  Confirmed received: <strong style={{ color: '#fff' }}>{totalConfirmed} {currency}</strong>
                  {totalFee > 0 && <> of <strong style={{ color: '#fff' }}>{totalFee} {currency}</strong></>}
                  {totalMarked > totalConfirmed && (
                    <span style={{ color: 'rgba(67,233,123,0.85)' }}> · {totalMarked - totalConfirmed} {currency} awaiting confirmation</span>
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
                    proofUrl: buildPaymentProofUrl(depositHistoryDeal.id, currentUser?.id, 'deposit', i),
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
                    proofUrl: buildPaymentProofUrl(depositHistoryDeal.id, currentUser?.id, 'full'),
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

      <ImageLightbox url={proofImageUrl} title={t('bookings.proofOfPayment')} onClose={() => setProofImageUrl(null)} />

      {/* Withdraw Contract Confirmation Modal */}
      {showWithdrawConfirmation && dealToWithdraw && (
        <OverlayPortal><div className="delete-modal-overlay" onClick={() => {
          setShowWithdrawConfirmation(false);
          setDealToWithdraw(null);
        }}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>{t('bookings.withdrawContract')}</h3>
            </div>
            <div className="delete-modal-content">
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(222,42,87,0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(222,42,87,0.45)',
                marginBottom: '16px'
              }}>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                  This will remove the contract from the booking. The other party will be notified.
                </p>
              </div>
              <p style={{ marginBottom: '16px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                Are you sure you want to withdraw the contract for <strong>{dealToWithdraw.eventName || 'this event'}</strong>?
              </p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: 0 }}>
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
              >
                {t('bookings.withdrawContract')}
              </button>
            </div>
          </div>
        </div></OverlayPortal>
      )}
    </div>
  );
};

// Keep-mounted tabs re-render on every App state change; memo keeps
// hidden tabs cheap when their props are unchanged.
export { getDealDisplayStatus, DEAL_DISPLAY_STATUSES };
export default React.memo(BookingsScreen);
