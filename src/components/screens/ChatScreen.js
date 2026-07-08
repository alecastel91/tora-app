import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import contractService from '../../services/contractService';
import { subscribeToChat } from '../../services/realtime';
import MakeOfferModal from '../common/MakeOfferModal';
import SignContractModal from '../common/SignContractModal';
import ContractViewer from '../common/ContractViewer';
import AddContractModal from '../common/AddContractModal';
import ShareDocumentsModal from '../common/ShareDocumentsModal';
import PdfViewerModal from '../common/PdfViewerModal';
import { deriveSignerCapacity, deriveRecipientName, isArtistSideForDeal } from '../../utils/contractSigner';
import { DOC_CATEGORIES, DOC_CATEGORY_KEYS, BROADCAST_DOC_CATEGORY_KEYS, labelForCategory } from '../../utils/documentCategories';
import { getAuthedBackendUrl } from '../../utils/urls';

const ChatScreen = ({ user, onClose, onOpenProfile }) => {
  const { user: currentUser, sendMessage, connectedUsers, reloadProfileData } = useAppContext();
  const { t } = useLanguage();
  const [inputMessage, setInputMessage] = useState('');
  const [userMessages, setUserMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const getFullUrl = (url) => getAuthedBackendUrl(url, currentUser?.id);
  const [showMakeOffer, setShowMakeOffer] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showOfferDetails, setShowOfferDetails] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  // Single guard for any in-flight deal/representation action; gates buttons + handler early-returns.
  const [actionBusy, setActionBusy] = useState(false);
  const [showCounterOfferDetails, setShowCounterOfferDetails] = useState(false);
  const [counterOfferData, setCounterOfferData] = useState(null);
  const [counterOfferMessage, setCounterOfferMessage] = useState(null);
  const [showDeclineComment, setShowDeclineComment] = useState(false);
  const [declineComment, setDeclineComment] = useState('');
  const [showOfferDeclineComment, setShowOfferDeclineComment] = useState(false);
  const [offerDeclineComment, setOfferDeclineComment] = useState('');
  const [showDeclineReasonModal, setShowDeclineReasonModal] = useState(false);
  const [declineReasonData, setDeclineReasonData] = useState(null);
  const [dealStatuses, setDealStatuses] = useState({}); // Cache deal statuses
  const [connectionRequests, setConnectionRequests] = useState({}); // Cache connection requests
  const [showRepresentationDetails, setShowRepresentationDetails] = useState(false);
  const [selectedRepresentationRequest, setSelectedRepresentationRequest] = useState(null);
  const [reviewData, setReviewData] = useState({
    fee: '',
    currency: 'USD',
    extras: {},
    notes: ''
  });
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [selectedArtistForDocs, setSelectedArtistForDocs] = useState(null);
  const [loadingArtistDocs, setLoadingArtistDocs] = useState(false);
  const [showSignContractModal, setShowSignContractModal] = useState(false);
  const [showContractViewer, setShowContractViewer] = useState(false);
  const [selectedContractData, setSelectedContractData] = useState(null);
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [pendingContractToSign, setPendingContractToSign] = useState(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState(null);
  // When the user opens a contract from a chat card (not from the sign modal),
  // the parent owns the tracking — record this deal id so onLoaded knows
  // what to track. Sign modal opens leave this null and use viewConfirmedSignal.
  const [pdfViewerTrackDealId, setPdfViewerTrackDealId] = useState(null);
  // Bumped when the PdfViewer reports a successful PDF load — used as a
  // "really viewed" signal to gate the sign modal's submit.
  const [viewConfirmedSignal, setViewConfirmedSignal] = useState(0);
  // Deal IDs whose contract the user opened from a chat card during this
  // session. Used to unlock the sign modal immediately without waiting for
  // the async trackContractView round-trip to land in the DB.
  const [locallyViewedDealIds, setLocallyViewedDealIds] = useState(() => new Set());
  // Share-documents modal state — opened from the fully-signed contract
  // card so the artist side can pick docs without leaving the chat.
  const [shareDocsDeal, setShareDocsDeal] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const otherFileInputRef = useRef(null);

  // Fetch full artist profile when agent selects an artist
  const handleSelectArtist = async (artist) => {
    console.log('[ChatScreen] handleSelectArtist called with artist:', artist);
    setLoadingArtistDocs(true);
    try {
      // Fetch full profile data with documents
      const artistProfileId = artist.profileId || artist.id || artist.id;
      console.log('[ChatScreen] Fetching profile for artistProfileId:', artistProfileId);
      const fullProfile = await apiService.getProfile(artistProfileId);
      console.log('[ChatScreen] Fetched full profile:', fullProfile);
      console.log('[ChatScreen] Profile documents:', fullProfile.documents);
      setSelectedArtistForDocs(fullProfile);
    } catch (error) {
      console.error('[ChatScreen] Error fetching artist profile:', error);
      // Fallback to basic artist data if fetch fails
      setSelectedArtistForDocs(artist);
    } finally {
      setLoadingArtistDocs(false);
    }
  };

  // Function to fetch messages (can be called externally)
  // isPoll: when true, skip loading spinner and only update state if messages actually changed
  const fetchMessages = async (isPoll = false) => {
    if (!currentUser || !currentUser.id || !user || !user.id) {
      setLoading(false);
      return;
    }

    try {
      if (!isPoll) setLoading(true);
      const response = await apiService.getMessageThread(currentUser.id, user.id);

      // Transform backend messages to match the format expected by the UI
      const transformedMessages = (response.messages || []).map(msg => ({
        text: msg.text,
        timestamp: msg.createdAt,
        isMe: msg.from.id === currentUser.id,
        isSystem: msg.isSystemMessage || false,
        dealId: msg.dealId || null,
        deal: msg.deal || null,
        connectionRequestId: msg.connectionRequest ? (msg.connectionRequest.id || msg.connectionRequest) : null,
        documentAttachment: msg.documentAttachment || null
      }));

      // Backend now embeds the linked deal on each message, so we can
      // build dealStatuses from the same response — no second round-trip.
      const embeddedStatuses = {};
      for (const msg of (response.messages || [])) {
        if (msg.dealId && msg.deal && !embeddedStatuses[msg.dealId]) {
          embeddedStatuses[msg.dealId] = {
            status: msg.deal.status,
            declineReason: msg.deal.declineReason,
            declinedBy: msg.deal.declinedBy,
            deal: msg.deal,
          };
        }
      }

      // Update messages + deal statuses in the same render so chat cards
      // appear with their bottom-row CTAs already wired. React 18 batches
      // adjacent setStates so this resolves in a single commit.
      setUserMessages(prev => {
        if (prev.length !== transformedMessages.length) return transformedMessages;
        const lastPrev = prev[prev.length - 1];
        const lastNew = transformedMessages[transformedMessages.length - 1];
        if (lastPrev?.timestamp !== lastNew?.timestamp) return transformedMessages;
        return prev;
      });
      if (Object.keys(embeddedStatuses).length > 0) {
        setDealStatuses(embeddedStatuses);
      }

      // The thread response embeds each message's connectionRequest, so no
      // per-message fetch is needed. Attach a minimal `to` (the modal shows
      // "Awaiting response from {to.name}") from the two chat participants.
      const participants = { [currentUser.id]: currentUser, [user.id]: user };
      const requests = {};
      for (const msg of (response.messages || [])) {
        const cr = msg.connectionRequest;
        if (cr && cr.id && !requests[cr.id]) {
          requests[cr.id] = { ...cr, to: cr.to || participants[cr.toProfileId] || null };
        }
      }
      if (Object.keys(requests).length > 0) {
        setConnectionRequests(requests);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (!isPoll) setUserMessages([]);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  // Fetch messages when the chat pairing changes. Ids, not objects — the
  // AppContext poll republishes profile objects and would refetch the
  // whole thread every cycle.
  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, user?.id]);

  // Realtime: subscribe to new messages on this chat thread.
  // The backend broadcasts on the same channel after every message create.
  useEffect(() => {
    if (!currentUser?.id || !user?.id) return;
    const unsubscribe = subscribeToChat(currentUser.id, user.id, () => {
      fetchMessages(true);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, user?.id]);

  useEffect(() => {
    scrollToBottom();
    inputRef.current?.focus();
  }, [userMessages]);

  // Fetch artist profile for contract modal when agent opens it.
  // Depend on stable ids (not the whole selectedOffer object) — otherwise
  // every message refetch churns this effect and bursts the rate limiter.
  useEffect(() => {
    const fetchArtistForContract = async () => {
      if (showAddContractModal && currentUser?.role === 'AGENT' && selectedOffer?.artist?.id) {
        try {
          const artistProfile = await apiService.getProfile(selectedOffer.artist.id);
          setSelectedArtistForDocs(artistProfile);
        } catch (error) {
          console.error('[ChatScreen] Error fetching artist profile for contract:', error);
        }
      }
    };
    fetchArtistForContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddContractModal, currentUser?.role, selectedOffer?.artist?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (actionBusy) return;
    if (!inputMessage.trim()) return;
    setActionBusy(true);
    try {
      await sendMessage(user.id, inputMessage);
      setInputMessage('');
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setActionBusy(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendDocument = async (document, category) => {
    try {
      const documentMessage = {
        from: currentUser.id,
        to: user.id,
        text: `📎 ${document.title}`,
        isSystemMessage: false,
        documentAttachment: {
          id: document.id,
          title: document.title,
          url: document.url,
          category: category
        }
      };
      await apiService.sendDocumentMessage(documentMessage);
      setShowDocumentPicker(false);
      await fetchMessages();
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Failed to send document. Please try again.');
    }
  };

  // Ad-hoc file from device → upload → send as a chat-attachment
  // message. Unlike the categorized library sends above, this carries
  // no category, so the backend doesn't broadcast it into any deal's
  // sharedDocuments — it's a pure conversational attachment.
  const handleSendOtherFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File must be 10 MB or smaller.');
      return;
    }
    try {
      const uploaded = await apiService.uploadChatAttachment(file, currentUser.id);
      await apiService.sendDocumentMessage({
        from: currentUser.id,
        to: user.id,
        text: `📎 ${uploaded.originalName || file.name}`,
        isSystemMessage: false,
        documentAttachment: {
          id: uploaded.storagePath,
          title: uploaded.originalName || file.name,
          url: uploaded.fileUrl,
          category: 'attachment',
        },
      });
      setShowDocumentPicker(false);
      await fetchMessages();
    } catch (error) {
      console.error('Error uploading chat attachment:', error);
      alert(error.message || 'Failed to upload file. Please try again.');
    }
  };

  const handleViewOffer = async (dealId) => {
    console.log('handleViewOffer called with dealId:', dealId);
    try {
      const response = await apiService.getDeal(dealId, currentUser.id);
      const deal = response.deal || response;

      // If the deal has been countered, show the ORIGINAL offer values
      // (the original offer card is a snapshot of the first offer)
      const offerHistory = Array.isArray(deal.offerHistory) ? deal.offerHistory : [];
      const hasCounterOffers = offerHistory.length > 1;

      let displayedOffer = deal;
      if (hasCounterOffers) {
        const original = offerHistory[0];
        displayedOffer = {
          ...deal,
          currentFee: original.fee,
          currency: original.currency || deal.currency,
          additionalTerms: original.additionalTerms || null,
          notes: original.notes || null,
          isHistoricalView: true
        };
      }

      setSelectedOffer(displayedOffer);
      setShowOfferDetails(true);
    } catch (error) {
      console.error('Error fetching offer details:', error);
    }
  };

  const handleViewDeclineReason = async (dealId) => {
    try {
      const response = await apiService.getDeal(dealId, currentUser.id);
      const deal = response.deal || response;
      setDeclineReasonData(deal);
      setShowDeclineReasonModal(true);
    } catch (error) {
      console.error('Error fetching decline reason:', error);
    }
  };

  const handleAcceptOffer = async () => {
    if (actionBusy || !selectedOffer) return;
    setActionBusy(true);
    try {
      await apiService.acceptDeal(selectedOffer.id, currentUser.id);
      setShowOfferDetails(false);
      setSelectedOffer(null);
      // Refresh messages to show updated status
      fetchMessages();
    } catch (error) {
      console.error('Error accepting offer:', error);
      alert(error.message || 'Failed to accept offer');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeclineOffer = async () => {
    if (actionBusy || !selectedOffer) return;

    if (!offerDeclineComment.trim()) {
      alert('Please provide a reason for declining');
      return;
    }

    setActionBusy(true);
    try {
      // Decline deal with reason - this will update the deal status
      await apiService.declineDeal(selectedOffer.id, currentUser.id, offerDeclineComment);

      setShowOfferDetails(false);
      setShowOfferDeclineComment(false);
      setOfferDeclineComment('');
      setSelectedOffer(null);
      // Refresh messages to show updated status
      fetchMessages();
    } catch (error) {
      console.error('Error declining offer:', error);
      alert(error.message || 'Failed to decline offer');
    } finally {
      setActionBusy(false);
    }
  };

  const handleOpenReview = () => {
    console.log('handleOpenReview called', selectedOffer);
    if (!selectedOffer) {
      console.log('No selected offer');
      return;
    }

    // Pre-fill review form with current offer values
    const newReviewData = {
      fee: selectedOffer.currentFee || '',
      currency: selectedOffer.currency || 'USD',
      extras: selectedOffer.extras || {},
      notes: ''
    };
    console.log('Setting review data:', newReviewData);
    setReviewData(newReviewData);
    console.log('Opening review modal');
    setShowReviewModal(true);
  };

  const handleViewCounterOffer = (msg) => {
    console.log('[ChatScreen] handleViewCounterOffer - message:', msg);
    console.log('[ChatScreen] dealId from message:', msg.dealId);

    if (!msg.dealId) {
      alert('This counter-offer was created with an old version and cannot be accepted/declined. Please send a new counter-offer.');
      return;
    }

    // Parse the counter-offer message
    const messageText = msg.text;
    const lines = messageText.split('\n');
    const parsed = {
      dealId: msg.dealId,  // Extract dealId from the message object
      fee: '',
      currency: '',
      extras: {},
      notes: ''
    };

    let currentSection = '';

    lines.forEach(line => {
      if (line.startsWith('Fee:')) {
        // Match e.g. "Fee: 1,500 USD" or "Fee: 1,500.50 USD"
        const feeMatch = line.match(/Fee:\s*([\d,.]+)\s+(\w+)/);
        if (feeMatch) {
          parsed.fee = feeMatch[1];
          parsed.currency = feeMatch[2];
        }
      } else if (line.startsWith('Extras:')) {
        currentSection = 'extras';
      } else if (line.startsWith('Notes:')) {
        currentSection = 'notes';
        parsed.notes = line.replace('Notes:', '').trim();
      } else if (currentSection === 'extras' && line.trim().startsWith('•')) {
        const extraLine = line.replace('•', '').trim();
        const colonIndex = extraLine.indexOf(':');
        if (colonIndex > -1) {
          const key = extraLine.substring(0, colonIndex).trim();
          const value = extraLine.substring(colonIndex + 1).trim();
          // Convert "Travel In" -> "travelIn", "Travel Out" -> "travelOut", etc.
          const camelKey = key.split(' ').map((word, index) =>
            index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join('');
          parsed.extras[camelKey] = value;
        } else {
          // Convert "Travel In" -> "travelIn", etc.
          const camelKey = extraLine.split(' ').map((word, index) =>
            index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join('');
          parsed.extras[camelKey] = 'Included';
        }
      } else if (currentSection === 'notes' && line.trim()) {
        parsed.notes += '\n' + line.trim();
      }
    });

    setCounterOfferData(parsed);
    setCounterOfferMessage(msg);
    setShowCounterOfferDetails(true);
  };

  const handleAcceptCounterOffer = async () => {
    if (actionBusy) return;
    if (!counterOfferData?.dealId) {
      alert('Deal information not found');
      return;
    }

    setActionBusy(true);
    try {
      await apiService.acceptDeal(counterOfferData.dealId, currentUser.id);
      setShowCounterOfferDetails(false);
      fetchMessages();
    } catch (error) {
      console.error('Error accepting counter-offer:', error);
      alert(error.message || 'Failed to accept counter-offer');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeclineCounterOffer = async () => {
    if (actionBusy) return;
    if (!declineComment.trim()) {
      alert('Please provide a reason for declining');
      return;
    }
    if (!counterOfferData?.dealId) {
      alert('Deal information not found');
      return;
    }

    setActionBusy(true);
    try {
      await apiService.declineDeal(counterOfferData.dealId, currentUser.id, declineComment);
      setShowCounterOfferDetails(false);
      setShowDeclineComment(false);
      setDeclineComment('');
      fetchMessages();
    } catch (error) {
      console.error('Error declining counter-offer:', error);
      alert(error.message || 'Failed to decline counter-offer');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReviewCounterOffer = async () => {
    // Fetch the full deal so handleSubmitReview has selectedOffer.id available
    try {
      const response = await apiService.getDeal(counterOfferData.dealId, currentUser.id);
      const deal = response.deal || response;
      setSelectedOffer(deal);
    } catch (error) {
      console.error('Error fetching deal for counter-offer review:', error);
      alert('Failed to load deal information');
      return;
    }

    // Open review modal with counter-offer data pre-filled
    setReviewData({
      fee: counterOfferData.fee.replace(/,/g, ''),
      currency: counterOfferData.currency,
      extras: counterOfferData.extras,
      notes: ''
    });
    setShowCounterOfferDetails(false);
    setShowReviewModal(true);
  };

  // Representation request handlers
  const handleViewRepresentation = (requestId) => {
    const request = connectionRequests[requestId];
    if (request) {
      setSelectedRepresentationRequest(request);
      setShowRepresentationDetails(true);
    }
  };

  const handleAcceptRepresentation = async () => {
    if (actionBusy || !selectedRepresentationRequest) return;
    setActionBusy(true);
    try {
      await apiService.acceptRepresentationRequest(selectedRepresentationRequest.id);

      setShowRepresentationDetails(false);
      setSelectedRepresentationRequest(null);

      await fetchMessages();

      const updatedRequest = await apiService.getConnectionRequest(selectedRepresentationRequest.id);
      setConnectionRequests(prev => ({
        ...prev,
        [selectedRepresentationRequest.id]: updatedRequest
      }));

      await reloadProfileData();
    } catch (error) {
      console.error('Error accepting representation request:', error);
      alert(error.message || 'Failed to accept representation request');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeclineRepresentation = async () => {
    if (actionBusy || !selectedRepresentationRequest) return;
    setActionBusy(true);
    try {
      await apiService.declineRepresentationRequest(selectedRepresentationRequest.id);

      setShowRepresentationDetails(false);
      setSelectedRepresentationRequest(null);

      await fetchMessages();

      const updatedRequest = await apiService.getConnectionRequest(selectedRepresentationRequest.id);
      setConnectionRequests(prev => ({
        ...prev,
        [selectedRepresentationRequest.id]: updatedRequest
      }));
    } catch (error) {
      console.error('Error declining representation request:', error);
      alert(error.message || 'Failed to decline representation request');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitReview = async () => {
    if (actionBusy) return;

    const dealId = selectedOffer?.id || counterOfferData?.dealId;
    if (!dealId) {
      alert('Deal information not found. Please close and try again.');
      return;
    }

    const feeStr = String(reviewData.fee || '').trim();
    if (!feeStr || isNaN(parseFloat(feeStr)) || parseFloat(feeStr) <= 0) {
      alert('Please enter a valid fee amount');
      return;
    }

    setActionBusy(true);
    try {
      const feeValue = Math.round(parseFloat(feeStr) * 100) / 100;

      const extras = {};
      if (reviewData.extras && Object.keys(reviewData.extras).length > 0) {
        Object.entries(reviewData.extras).forEach(([key, value]) => {
          if (value) extras[key] = value;
        });
      }

      await apiService.counterDeal(dealId, {
        profileId: currentUser.id,
        fee: feeValue,
        currency: reviewData.currency,
        additionalTerms: Object.keys(extras).length > 0 ? JSON.stringify(extras) : null,
        notes: reviewData.notes || null
      });

      setShowReviewModal(false);
      setShowOfferDetails(false);
      setReviewData({ fee: '', currency: 'USD', extras: {}, notes: '' });

      fetchMessages();
    } catch (error) {
      console.error('Error submitting counter-offer:', error);
      alert(error.message || 'Failed to submit counter-offer');
    } finally {
      setActionBusy(false);
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const getAvatarClass = (role) => {
    const roleClass = {
      'ARTIST': 'avatar-artist',
      'VENUE': 'avatar-venue',
      'PROMOTER': 'avatar-promoter',
      'AGENT': 'avatar-agent'
    };
    return roleClass[role] || 'avatar-artist';
  };

  const formatMessageTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  const shouldShowDateSeparator = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.timestamp).toDateString();
    const prevDate = new Date(prevMsg.timestamp).toDateString();
    return currentDate !== prevDate;
  };

  const formatDateSeparator = (timestamp) => {
    const msgDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) {
      return t('messages.today');
    } else if (msgDate.toDateString() === yesterday.toDateString()) {
      return t('messages.yesterday');
    } else {
      // Get localized day and month names
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

      const weekday = t(`dateFormat.${weekdays[msgDate.getDay()]}`);
      const month = t(`dateFormat.${months[msgDate.getMonth()]}`);
      const day = msgDate.getDate();

      return `${weekday}, ${month} ${day}`;
    }
  };

  // Check if current user can make offers to the chat partner
  // Only Venue/Promoter can initiate booking offers to Artist/Agent
  const canMakeOffer = () => {
    if (!currentUser || !user) return false;

    const myRole = currentUser.role;
    const theirRole = user.role;

    // Only Venues and Promoters can make booking offers to Artists and Agents
    if ((myRole === 'VENUE' || myRole === 'PROMOTER') && (theirRole === 'ARTIST' || theirRole === 'AGENT')) {
      return true;
    }

    return false;
  };

  // Filter messages to show workflow stages instead of all messages
  // For each dealId, only show the latest stage (contract > acceptance > offer)
  const getFilteredMessages = () => {
    // Group messages by dealId
    const dealMessages = {};
    const nonDealMessages = [];

    console.log('🔍 ChatScreen: Filtering messages, total:', userMessages.length);

    userMessages.forEach(msg => {
      if (msg.dealId) {
        if (!dealMessages[msg.dealId]) {
          dealMessages[msg.dealId] = [];
        }
        dealMessages[msg.dealId].push(msg);
        console.log('  Deal message:', {
          dealId: msg.dealId,
          text: msg.text?.substring(0, 50),
          hasDoc: !!msg.documentAttachment,
          docCategory: msg.documentAttachment?.category
        });
      } else {
        nonDealMessages.push(msg);
      }
    });

    // For each deal, determine which messages to show
    // - Always show the original offer + all counter-offers (negotiation history)
    // - Plus the latest workflow stage (withdrawal > contract > acceptance) if it exists
    const filteredDealMessages = [];
    Object.keys(dealMessages).forEach(dealId => {
      const messages = dealMessages[dealId];
      console.log(`  📋 Deal ${dealId}: ${messages.length} messages`);

      const offerMsg = messages.find(m => m.text && m.text.includes('New Booking Offer'));
      const counterOfferMsgs = messages.filter(m => m.text && m.text.startsWith('Counter-Offer:'));

      // Always show the original offer (so the negotiation start is visible)
      if (offerMsg) {
        filteredDealMessages.push(offerMsg);
      }

      // Always show all counter offers (each one is a separate moment in negotiation)
      counterOfferMsgs.forEach(m => filteredDealMessages.push(m));

      // Document share + skip + payment events — each is its own card in the
      // chat history. Renderer recognises them by text prefix.
      messages.forEach(m => {
        if (!m.text) return;
        const isShare = m.documentAttachment && BROADCAST_DOC_CATEGORY_KEYS.includes(m.documentAttachment.category);
        const isSkip = m.text.includes('marked Press Kit as not needed') || m.text.includes('marked Technical Rider as not needed') || m.text.includes('marked Hospitality Rider as not needed');
        const isPayment = m.text.startsWith('💰');
        if (isShare || isSkip || isPayment) {
          filteredDealMessages.push(m);
        }
      });

      // Walk the deal's messages in chronological order. Contract messages
      // are kept; subsequent signature/withdrawal events are folded into the
      // most recent contract card so the card itself reflects current state.
      const sortedMsgs = [...messages].sort(
        (a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt)
      );
      const contractCardsByDeal = [];
      sortedMsgs.forEach((m) => {
        const isContract = (m.documentAttachment && m.documentAttachment.category === 'contracts')
          || (m.text && (m.text.includes('Contract sent') || m.text.includes('sent and signed a contract')));
        const isWithdrawal = m.text && m.text.includes('withdrawn the contract');
        const isFullySigned = m.text && (m.text.includes('Contract fully signed') || m.text.includes('fully signed'));
        const isPartialSigned = m.text && !isFullySigned && m.text.includes('signed the contract');
        const isAccept = m.text && m.text.includes('Booking Confirmed!');
        const isDecline = m.text && m.text.includes('Booking Offer Declined');

        if (isContract) {
          const card = { ...m, _withdrawn: false, _signedByOne: false, _fullySigned: false };
          contractCardsByDeal.push(card);
          filteredDealMessages.push(card);
        } else if (isWithdrawal) {
          const lastActive = [...contractCardsByDeal].reverse().find((c) => !c._withdrawn);
          if (lastActive) {
            lastActive._withdrawn = true;
            lastActive._withdrawnAt = m.timestamp || m.createdAt;
            lastActive._withdrawnBy = m.fromProfileId;
          }
        } else if (isFullySigned) {
          const lastActive = [...contractCardsByDeal].reverse().find((c) => !c._withdrawn);
          if (lastActive) {
            lastActive._fullySigned = true;
            lastActive._fullySignedAt = m.timestamp || m.createdAt;
          }
        } else if (isPartialSigned) {
          const lastActive = [...contractCardsByDeal].reverse().find((c) => !c._withdrawn && !c._fullySigned);
          if (lastActive) {
            lastActive._signedByOne = true;
            lastActive._partialSignedAt = m.timestamp || m.createdAt;
            lastActive._partialSignedBy = m.fromProfileId;
          }
        } else if (isAccept || isDecline) {
          filteredDealMessages.push(m);
        }
      });
    });

    // Combine and sort by timestamp
    const allMessages = [...nonDealMessages, ...filteredDealMessages];
    allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    console.log('🔍 Final filtered messages:', allMessages.length);

    return allMessages;
  };

  const filteredMessages = getFilteredMessages();

  return (
    <div className="chat-screen active">
      <div className="chat-header">
        <button className="back-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div
          className="chat-user-info"
          onClick={() => {
            if (!(user.isDeleted || user.deleted) && onOpenProfile) {
              onOpenProfile(user);
            }
          }}
          style={{ cursor: user.isDeleted || user.deleted ? 'default' : 'pointer' }}
        >
          <div className={`chat-avatar ${user.isDeleted || user.deleted ? 'avatar-deleted' : getAvatarClass(user.role)}`}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              getInitial(user.name)
            )}
          </div>
          <div className="chat-user-details">
            <h3 style={{ color: user.isDeleted || user.deleted ? '#888' : 'inherit' }}>{user.name}</h3>
            <span className="chat-role" style={{ color: user.isDeleted || user.deleted ? '#888' : 'inherit' }}>{user.role}</span>
            <span className="chat-location">{user.location}</span>
          </div>
        </div>
      </div>

      {/* Banner for deleted profiles */}
      {(user.isDeleted || user.deleted) && (
        <div className="chat-deleted-banner">
          <span>This profile is no longer active</span>
        </div>
      )}

      <div className="chat-messages">
        {filteredMessages.length === 0 && (
          <div className="chat-empty">
            <p>{t('messages.startConversationWith')} {user.name}</p>
            <span>{t('messages.sendMessageToBegin')}</span>
          </div>
        )}
        {filteredMessages.map((msg, index) => (
          <React.Fragment key={index}>
            {shouldShowDateSeparator(msg, filteredMessages[index - 1]) && (
              <div className="date-separator">
                <span>{formatDateSeparator(msg.timestamp)}</span>
              </div>
            )}
            {msg.text && msg.text.startsWith('Counter-Offer:') ? (
              <div className={`message-with-timestamp ${msg.isMe ? "card-sent" : "card-received"}`}>
                <div className="offer-card-message">
                  <div className="offer-card-content">
                    <div className="offer-card-icon counter-offer-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 1 21 5 17 9"></polyline>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                        <polyline points="7 23 3 19 7 15"></polyline>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                      </svg>
                    </div>
                    <div className="offer-card-text">
                      <p className="offer-card-name">{msg.isMe ? 'You' : user.name}</p>
                      <p className="offer-card-action">
                        counter-offered{msg.deal?.eventName ? ` · ${msg.deal.eventName}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn btn-outline btn-view-offer"
                    onClick={() => handleViewCounterOffer(msg)}
                  >
                    View Details
                  </button>
                </div>
                <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>
              </div>
            ) : msg.isSystem && msg.connectionRequestId ? (
              (() => {
                const request = connectionRequests[msg.connectionRequestId];
                if (!request) return null;

                const isAccepted = request.status === 'ACCEPTED';
                const isDeclined = request.status === 'REJECTED';
                const isPending = request.status === 'PENDING';
                const isRepresentationRequest = request.type === 'REPRESENTATION_REQUEST';
                const displayName = msg.isMe ? 'You' : user.name;

                // Check if the current user is the recipient (not the sender)
                const isRecipient = !msg.isMe;

                // Extract the custom message from the system message text
                const customMessage = request.message || '';

                return (
                  <div className={`message-with-timestamp ${msg.isMe ? "card-sent" : "card-received"}`}>
                    <div className="offer-card-message">
                      <div className="offer-card-content">
                        <div className={`offer-card-icon ${isDeclined ? 'declined-offer-icon' : isAccepted ? 'accepted-offer-icon' : ''}`}>
                          {isDeclined ? (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="15" y1="9" x2="9" y2="15"></line>
                              <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                          ) : isAccepted ? (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="9 12 11 14 15 10"></polyline>
                            </svg>
                          ) : (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="9" cy="7" r="4"></circle>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                          )}
                        </div>
                        <div className="offer-card-text">
                          <p className="offer-card-name">{displayName}</p>
                          <p className="offer-card-action">
                            {isDeclined ? 'declined representation' : isAccepted ? 'accepted representation' : 'sent representation request'}
                          </p>
                        </div>
                      </div>
                      <button
                        className="btn btn-outline btn-view-offer"
                        onClick={() => handleViewRepresentation(msg.connectionRequestId)}
                      >
                        View
                      </button>
                    </div>
                    <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                );
              })()
            ) : msg.documentAttachment && msg.documentAttachment.category === 'contracts' && msg.dealId ? (
              // Contract workflow card. If the contract was later withdrawn,
              // we render the same card in a muted "withdrawn" state with
              // the action buttons removed.
              (() => {
                const cachedDealForDocs = dealStatuses[msg.dealId]?.deal;
                const pendingDocCategories = msg._fullySigned && cachedDealForDocs && isArtistSideForDeal(cachedDealForDocs, currentUser)
                  ? DOC_CATEGORY_KEYS.filter((k) => {
                      const entry = cachedDealForDocs.sharedDocuments?.[k];
                      return !entry?.documentId && !entry?.skipped;
                    })
                  : [];
                const showDocActions = pendingDocCategories.length > 0;
                return (
              <div className={`message-with-timestamp ${msg.isMe ? "card-sent" : "card-received"}`}>
                <div
                  className="offer-card-message"
                  style={{
                    ...(msg._withdrawn ? { opacity: 0.75 } : {}),
                    ...(showDocActions ? { flexDirection: 'column', alignItems: 'stretch' } : {}),
                  }}
                >
                  <div style={showDocActions ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%' } : { display: 'contents' }}>
                  <div className="offer-card-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', gap: '12px' }}>
                      <div
                        className="offer-card-icon"
                        style={{
                          color: msg._withdrawn ? 'rgba(255, 165, 0, 1)' : 'rgba(138, 43, 226, 1)',
                        }}
                      >
                        {msg._withdrawn ? (
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        ) : (
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                        )}
                      </div>
                      <div className="offer-card-text">
                        <p className="offer-card-name">{msg.isMe ? 'You' : user.name}</p>
                        <p className="offer-card-action">
                          {msg._withdrawn ? 'sent a contract — later withdrawn'
                            : msg._fullySigned ? 'contract fully signed'
                            : msg._signedByOne ? 'contract signed — waiting for the other party'
                            : 'sent a contract'}
                          {msg.deal?.eventName ? ` · ${msg.deal.eventName}` : ''}
                        </p>
                      </div>
                    </div>
                    {!msg._withdrawn && !msg._fullySigned && !msg._signedByOne && !msg.isMe && (
                      <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setPdfViewerUrl(getFullUrl(msg.documentAttachment.url));
                            // Defer trackContractView until PdfViewer fires
                            // onLoaded — closing before load shouldn't count.
                            setPdfViewerTrackDealId(msg.dealId || null);
                            if (msg.dealId) {
                              setLocallyViewedDealIds((prev) => {
                                if (prev.has(msg.dealId)) return prev;
                                const next = new Set(prev);
                                next.add(msg.dealId);
                                return next;
                              });
                            }
                          }}
                          className="btn btn-outline btn-card-action"
                          style={{ flex: 1 }}
                        >
                          Open
                        </button>
                        <button
                          className="btn btn-primary btn-card-action"
                          style={{ flex: 1 }}
                          onClick={async () => {
                            // Pre-check whether this profile has already viewed
                            // the contract anywhere — if so, the sign modal
                            // unlocks immediately without forcing a re-open.
                            // Trust the local "opened in this session" flag
                            // first so the trackContractView race can't strand
                            // a user who just clicked Open seconds ago.
                            let initiallyViewed = locallyViewedDealIds.has(msg.dealId);
                            if (!initiallyViewed) {
                              try {
                                const deal = await apiService.getDeal(msg.dealId);
                                const viewedBy = deal?.contract?.viewedBy || [];
                                initiallyViewed = viewedBy.some((v) => v.profile === currentUser.id);
                              } catch (_) { /* default to false */ }
                            }
                            setSelectedContractData({
                              dealId: msg.dealId,
                              contractUrl: msg.documentAttachment.url,
                              senderName: user.name,
                              initiallyViewed,
                            });
                            setShowSignContractModal(true);
                          }}
                        >
                          ✓ Sign
                        </button>
                        <button
                          className="btn btn-outline btn-card-action"
                          style={{
                            flex: 1,
                            borderColor: 'rgba(255, 165, 0, 0.5)',
                            color: 'rgba(255, 165, 0, 1)'
                          }}
                          onClick={async () => {
                            const comment = prompt('Please provide details about the modifications you need:');
                            if (comment && comment.trim()) {
                              try {
                                // Send modification request as a chat message
                                await sendMessage(user.id, `Contract Modification Request: ${comment}`);
                                alert('Modification request sent to ' + user.name);
                                // Refresh messages to show the new request
                                await fetchMessages();
                              } catch (err) {
                                alert(err.message || 'Failed to send modification request');
                              }
                            }
                          }}
                        >
                          ✎ Edit
                        </button>
                      </div>
                    )}
                  </div>
                  {!msg._withdrawn && msg.isMe && (
                    <button
                      type="button"
                      onClick={() => setPdfViewerUrl(getFullUrl(msg.documentAttachment.url))}
                      className="btn btn-outline btn-view-offer"
                    >
                      View Contract
                    </button>
                  )}
                  {(msg._fullySigned || msg._signedByOne) && !msg.isMe && (
                    <button
                      type="button"
                      onClick={() => setPdfViewerUrl(getFullUrl(msg.documentAttachment.url))}
                      className="btn btn-outline btn-view-offer"
                    >
                      View Contract
                    </button>
                  )}
                  </div>
                  {showDocActions && (
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <span style={{ fontSize: '11px', color: '#888', marginRight: 'auto' }}>
                        Documents pending
                      </span>
                      <button
                        className="btn btn-skip"
                        onClick={async () => {
                          const list = pendingDocCategories.map(labelForCategory).join(', ');
                          if (!window.confirm(`Skip ${list} for this booking?`)) return;
                          try {
                            for (const cat of pendingDocCategories) {
                              // eslint-disable-next-line no-await-in-loop
                              await apiService.skipDocument(msg.dealId, currentUser.id, cat);
                            }
                            await fetchMessages();
                          } catch (err) {
                            alert(err.message || 'Failed to skip documents');
                          }
                        }}
                      >
                        Skip
                      </button>
                      <button
                        className="btn btn-primary btn-card-action"
                        onClick={() => setShareDocsDeal(cachedDealForDocs)}
                      >
                        Share Documents
                      </button>
                    </div>
                  )}
                </div>
                <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>
              </div>
                );
              })()
            ) : msg.documentAttachment && BROADCAST_DOC_CATEGORY_KEYS.includes(msg.documentAttachment.category) ? (
              (() => {
                return (
                  <div className={`message-with-timestamp ${msg.isMe ? "card-sent" : "card-received"}`}>
                    <div className="offer-card-message">
                      <div className="offer-card-content">
                        <div className="offer-card-icon" style={{ color: 'rgba(255,255,255,0.55)' }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                          </svg>
                        </div>
                        <div className="offer-card-text">
                          <p className="offer-card-name">{msg.isMe ? 'You' : user.name}</p>
                          <p className="offer-card-action">shared {labelForCategory(msg.documentAttachment.category)}{msg.documentAttachment.title ? ` · ${msg.documentAttachment.title}` : ''}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPdfViewerUrl(getFullUrl(msg.documentAttachment.url))}
                        className="btn btn-outline btn-card-action"
                      >
                        Open
                      </button>
                    </div>
                    <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                );
              })()
            ) : msg.isSystem && msg.dealId && msg.text && (msg.text.includes('marked Press Kit as not needed') || msg.text.includes('marked Technical Rider as not needed') || msg.text.includes('marked Hospitality Rider as not needed')) ? (
              (() => {
                const which = msg.text.includes('Press Kit') ? 'Press Kit' : msg.text.includes('Technical Rider') ? 'Technical Rider' : 'Hospitality Rider';
                return (
                  <div className={`message-with-timestamp ${msg.isMe ? "card-sent" : "card-received"}`}>
                    <div className="offer-card-message">
                      <div className="offer-card-content">
                        <div className="offer-card-icon" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </div>
                        <div className="offer-card-text">
                          <p className="offer-card-name">{msg.isMe ? 'You' : user.name}</p>
                          <p className="offer-card-action">skipped {which} for this booking</p>
                        </div>
                      </div>
                    </div>
                    <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                );
              })()
            ) : msg.isSystem && msg.dealId && msg.text && msg.text.startsWith('💰') ? (
              (() => {
                const isFull = msg.text.includes('Full payment');
                return (
                  <div className={`message-with-timestamp ${msg.isMe ? "card-sent" : "card-received"}`}>
                    <div className="offer-card-message">
                      <div className="offer-card-content">
                        <div className="offer-card-icon" style={{ color: '#00C875' }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                          </svg>
                        </div>
                        <div className="offer-card-text">
                          <p className="offer-card-name">{msg.isMe ? 'You' : user.name}</p>
                          <p className="offer-card-action">{isFull ? 'recorded full payment' : 'recorded a deposit payment'}</p>
                          <p style={{ margin: '3px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{msg.previewText || (msg.text.split('\n').pop() || '')}</p>
                        </div>
                      </div>
                    </div>
                    <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                );
              })()
            ) : msg.isSystem && msg.dealId ? (
              (() => {
                // Determine card type from the message text itself, so the original
                // offer card and the decline/accept/withdrawal cards are distinct entries.
                const isDeclineCard = msg.text && msg.text.includes('Booking Offer Declined');
                const isAcceptCard = msg.text && msg.text.includes('Booking Confirmed!');
                const isDeclined = isDeclineCard;
                const isAccepted = isAcceptCard;

                // For decline/accept cards, sender of the message is the one who acted
                const displayName = msg.isMe ? 'You' : user.name;

                const cachedDeal = dealStatuses[msg.dealId]?.deal;
                const showContractActions = isAccepted
                  && cachedDeal
                  && isArtistSideForDeal(cachedDeal, currentUser)
                  && (!cachedDeal.contract?.status || cachedDeal.contract.status === 'NOT_SENT');

                return (
                  <div className={`message-with-timestamp ${msg.isMe ? "card-sent" : "card-received"}`}>
                    <div
                      className="offer-card-message"
                      style={showContractActions ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
                        <div className="offer-card-content">
                          <div className={`offer-card-icon ${isDeclined ? 'declined-offer-icon' : isAccepted ? 'accepted-offer-icon' : ''}`}>
                            {isDeclined ? (
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                              </svg>
                            ) : isAccepted ? (
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="9 12 11 14 15 10"></polyline>
                              </svg>
                            ) : (
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                                <polygon points="12,11.5 13.2,14 15.8,14.3 13.9,16.1 14.4,18.7 12,17.4 9.6,18.7 10.1,16.1 8.2,14.3 10.8,14" fill="currentColor" stroke="none"></polygon>
                              </svg>
                            )}
                          </div>
                          <div className="offer-card-text">
                            <p className="offer-card-name">{displayName}</p>
                            <p className="offer-card-action">
                              {isDeclined ? 'declined offer' : isAccepted ? 'accepted offer' : 'sent an offer'}
                              {msg.deal?.eventName ? ` · ${msg.deal.eventName}` : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          className="btn btn-outline btn-view-offer"
                          onClick={() => {
                            if (isDeclined) {
                              handleViewDeclineReason(msg.dealId);
                            } else {
                              handleViewOffer(msg.dealId);
                            }
                          }}
                        >
                          {isDeclined ? 'View Reason' : 'View Details'}
                        </button>
                      </div>
                      {showContractActions && (
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          marginTop: '10px',
                          paddingTop: '10px',
                          borderTop: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          <span style={{ fontSize: '11px', color: '#888', marginRight: 'auto' }}>
                            Contract pending
                          </span>
                          <button
                            className="btn btn-skip"
                            onClick={async () => {
                              if (!window.confirm('Skip contract stage? You can still share documents and proceed.')) return;
                              try {
                                await apiService.skipContract(msg.dealId, currentUser.id);
                                await fetchMessages();
                              } catch (err) {
                                alert(err.message || 'Failed to skip contract');
                              }
                            }}
                          >
                            Skip
                          </button>
                          <button
                            className="btn btn-primary btn-card-action"
                            onClick={async () => {
                              try {
                                setSelectedOffer(cachedDeal);
                                if (cachedDeal.bookedArtistId) {
                                  const profile = await apiService.getProfile(cachedDeal.bookedArtistId);
                                  setSelectedArtistForDocs(profile);
                                }
                                setShowAddContractModal(true);
                              } catch (err) {
                                alert(err.message || 'Failed to open contract flow');
                              }
                            }}
                          >
                            Send Contract
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                );
              })()
            ) : msg.isSystem ? (
              <div className="message-system">
                <p>{msg.text}</p>
              </div>
            ) : msg.documentAttachment ? (
              <div className={`message ${msg.isMe ? 'message-sent' : 'message-received'}`}>
                {(!msg.isMe && index === 0) || (index > 0 && userMessages[index - 1].isMe !== msg.isMe) ? (
                  <div className="message-group">
                    <div className="message-bubble document-message">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                          <polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                        <div>
                          <p style={{ fontWeight: '600', marginBottom: '2px' }}>{msg.documentAttachment.title}</p>
                          <p style={{ fontSize: '11px', opacity: 0.7, textTransform: 'capitalize' }}>
                            {msg.documentAttachment.category === 'pressKit' ? 'Press Kit' :
                             msg.documentAttachment.category === 'technicalRider' ? 'Technical Rider' : 'Contract'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPdfViewerUrl(getFullUrl(msg.documentAttachment.url))}
                        className="btn btn-sm"
                        style={{
                          width: '100%',
                          marginTop: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          fontWeight: '600'
                        }}
                      >
                        Open Document
                      </button>
                      {!msg.isMe && msg.documentAttachment.category === 'contracts' && msg.dealId && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexDirection: 'column' }}>
                          <button
                            className="btn btn-primary"
                            style={{
                              width: '100%',
                              fontWeight: '600',
                              fontSize: '13px'
                            }}
                            onClick={async () => {
                              try {
                                await apiService.signContract(msg.dealId, currentUser.id);
                                alert('Contract signed successfully!');
                                // Refresh messages
                                const response = await apiService.getMessageThread(currentUser.id, user.id);
                                const transformedMessages = (response.messages || []).map(m => ({
                                  text: m.text,
                                  timestamp: m.createdAt,
                                  isMe: m.from.id === currentUser.id,
                                  isSystem: m.isSystemMessage || false,
                                  dealId: m.dealId || null,
                                  deal: m.deal || null,
                                  connectionRequestId: m.connectionRequest ? (m.connectionRequest.id || m.connectionRequest) : null,
                                  documentAttachment: m.documentAttachment || null
                                }));
                                setUserMessages(transformedMessages);
                              } catch (err) {
                                alert(err.message || 'Failed to sign contract');
                              }
                            }}
                          >
                            ✓ Sign Contract
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{
                              width: '100%',
                              fontWeight: '600',
                              fontSize: '13px',
                              borderColor: 'rgba(255, 165, 0, 0.5)',
                              color: 'rgba(255, 165, 0, 1)'
                            }}
                            onClick={() => {
                              const comment = prompt('Please provide details about the modifications you need:');
                              if (comment && comment.trim()) {
                                // TODO: Send modification request to backend
                                alert('Modification request sent: ' + comment);
                              }
                            }}
                          >
                            ✎ Request Modification
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{
                              width: '100%',
                              fontWeight: '600',
                              fontSize: '13px',
                              borderColor: 'rgba(255, 51, 51, 0.5)',
                              color: 'rgba(255, 51, 51, 1)'
                            }}
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
                                try {
                                  await apiService.cancelDeal(msg.dealId, currentUser.id);
                                  alert('Booking cancelled');
                                  // Refresh messages
                                  const response = await apiService.getMessageThread(currentUser.id, user.id);
                                  const transformedMessages = (response.messages || []).map(m => ({
                                    text: m.text,
                                    timestamp: m.createdAt,
                                    isMe: m.from.id === currentUser.id,
                                    isSystem: m.isSystemMessage || false,
                                    dealId: m.dealId || null,
                                    connectionRequestId: m.connectionRequest ? (m.connectionRequest.id || m.connectionRequest) : null,
                                    documentAttachment: m.documentAttachment || null
                                  }));
                                  setUserMessages(transformedMessages);
                                } catch (err) {
                                  alert(err.message || 'Failed to cancel booking');
                                }
                              }
                            }}
                          >
                            × Cancel Booking
                          </button>
                        </div>
                      )}
                      <span className="message-time">{formatMessageTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="message-bubble document-message">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <polyline points="13 2 13 9 20 9"></polyline>
                      </svg>
                      <div>
                        <p style={{ fontWeight: '600', marginBottom: '2px' }}>{msg.documentAttachment.title}</p>
                        <p style={{ fontSize: '11px', opacity: 0.7, textTransform: 'capitalize' }}>
                          {msg.documentAttachment.category === 'pressKit' ? 'Press Kit' :
                           msg.documentAttachment.category === 'technicalRider' ? 'Technical Rider' : 'Contract'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdfViewerUrl(getFullUrl(msg.documentAttachment.url))}
                      className="btn btn-sm"
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        fontWeight: '600'
                      }}
                    >
                      Open Document
                    </button>
                    {!msg.isMe && msg.documentAttachment.category === 'contracts' && msg.dealId && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexDirection: 'column' }}>
                        <button
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            fontWeight: '600',
                            fontSize: '13px'
                          }}
                          onClick={async () => {
                            try {
                              await apiService.signContract(msg.dealId, currentUser.id);
                              alert('Contract signed successfully!');
                              // Refresh messages
                              const response = await apiService.getMessageThread(currentUser.id, user.id);
                              const transformedMessages = (response.messages || []).map(m => ({
                                text: m.text,
                                timestamp: m.createdAt,
                                isMe: m.from.id === currentUser.id,
                                isSystem: m.isSystemMessage || false,
                                dealId: m.dealId || null,
                                connectionRequestId: m.connectionRequest ? (m.connectionRequest.id || m.connectionRequest) : null,
                                documentAttachment: m.documentAttachment || null
                              }));
                              setUserMessages(transformedMessages);
                            } catch (err) {
                              alert(err.message || 'Failed to sign contract');
                            }
                          }}
                        >
                          ✓ Sign Contract
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{
                            width: '100%',
                            fontWeight: '600',
                            fontSize: '13px',
                            borderColor: 'rgba(255, 165, 0, 0.5)',
                            color: 'rgba(255, 165, 0, 1)'
                          }}
                          onClick={() => {
                            const comment = prompt('Please provide details about the modifications you need:');
                            if (comment && comment.trim()) {
                              // TODO: Send modification request to backend
                              alert('Modification request sent: ' + comment);
                            }
                          }}
                        >
                          ✎ Request Modification
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{
                            width: '100%',
                            fontWeight: '600',
                            fontSize: '13px',
                            borderColor: 'rgba(255, 51, 51, 0.5)',
                            color: 'rgba(255, 51, 51, 1)'
                          }}
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
                              try {
                                await apiService.cancelDeal(msg.dealId, currentUser.id);
                                alert('Booking cancelled');
                                // Refresh messages
                                const response = await apiService.getMessageThread(currentUser.id, user.id);
                                const transformedMessages = (response.messages || []).map(m => ({
                                  text: m.text,
                                  timestamp: m.createdAt,
                                  isMe: m.from.id === currentUser.id,
                                  isSystem: m.isSystemMessage || false,
                                  dealId: m.dealId || null,
                                  connectionRequestId: m.connectionRequest ? (m.connectionRequest.id || m.connectionRequest) : null,
                                  documentAttachment: m.documentAttachment || null
                                }));
                                setUserMessages(transformedMessages);
                              } catch (err) {
                                alert(err.message || 'Failed to cancel booking');
                              }
                            }
                          }}
                        >
                          × Cancel Booking
                        </button>
                      </div>
                    )}
                    <span className="message-time">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className={`message ${msg.isMe ? 'message-sent' : 'message-received'}`}>
                {(!msg.isMe && index === 0) || (index > 0 && userMessages[index - 1].isMe !== msg.isMe) ? (
                  <div className="message-group">
                    <div className="message-bubble">
                      <p>{msg.text}</p>
                      <span className="message-time">{formatMessageTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="message-bubble">
                    <p>{msg.text}</p>
                    <span className="message-time">{formatMessageTime(msg.timestamp)}</span>
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {(() => {
        // Check if there's a pending connection request sent by current user
        const hasPendingRequest = Object.values(connectionRequests).some(req =>
          req && req.status === 'PENDING' && req.type === 'CONNECTION_REQUEST' && req.from === currentUser.id
        );

        // User is deleted
        if (user.isDeleted || user.deleted) {
          return (
            <div className="chat-input-disabled">
              <p>You cannot send messages to inactive profiles</p>
            </div>
          );
        }

        // User is connected - show full chat functionality
        if (connectedUsers.has(user.id || user.id)) {
          return (
            <>
              {canMakeOffer() && (
                <div className="chat-offer-button-container">
                  <button
                    className="btn-make-offer"
                    onClick={() => setShowMakeOffer(true)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="3" y1="9" x2="21" y2="9"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <path d="M9 16l2 2 4-4"></path>
                    </svg>
                    Make an Offer
                  </button>
                </div>
              )}
              <div className="chat-input-container">
                <div className="chat-input-wrapper">
                  <button
                    className="attachment-btn"
                    onClick={() => setShowDocumentPicker(true)}
                    title="Attach document"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={t('messages.writeYourMessage')}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="chat-input"
                  />
                  <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!inputMessage.trim() || actionBusy}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </>
          );
        }

        // User has pending sent connection request - show disabled message
        if (hasPendingRequest) {
          return (
            <div className="chat-input-disabled">
              <p>Connection request pending. You can send messages once {user.name} accepts your request.</p>
            </div>
          );
        }

        // Not connected - show cannot send message
        return (
          <div className="chat-input-disabled">
            <p>You are not connected with {user.name}. You cannot send messages unless you connect.</p>
          </div>
        );
      })()}

      <MakeOfferModal
        isOpen={showMakeOffer}
        onClose={() => setShowMakeOffer(false)}
        recipientProfile={user}
        onSuccess={() => {
          // Refresh messages to show the new offer immediately
          fetchMessages();
        }}
      />

      {/* Offer Details Modal */}
      {showOfferDetails && selectedOffer && (
        <div className="modal-overlay" onClick={() => setShowOfferDetails(false)}>
          <div className="modal-content offer-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Offer Details</h3>
              <button className="modal-close" onClick={() => setShowOfferDetails(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="offer-detail-section">
                {selectedOffer.eventName && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Event:</span>
                    <span className="detail-value">{selectedOffer.eventName}</span>
                  </div>
                )}
                <div className="offer-detail-row">
                  <span className="detail-label">Venue:</span>
                  <span className="detail-value">
                    <div>{selectedOffer.venueName}</div>
                    {(selectedOffer.city || selectedOffer.venue?.location) && (
                      <div className="detail-subtext">
                        ({selectedOffer.city && selectedOffer.country ? `${selectedOffer.city}, ${selectedOffer.country}` : selectedOffer.venue?.location})
                      </div>
                    )}
                  </span>
                </div>
                <div className="offer-detail-row">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">
                    {new Date(selectedOffer.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                {selectedOffer.startTime && selectedOffer.endTime && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Event Time:</span>
                    <span className="detail-value">
                      {selectedOffer.startTime} - {selectedOffer.endTime}
                    </span>
                  </div>
                )}
                {selectedOffer.performanceType && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{selectedOffer.performanceType}</span>
                  </div>
                )}
                {selectedOffer.setStartTime && selectedOffer.setEndTime && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Set Time:</span>
                    <span className="detail-value">
                      <div>{selectedOffer.setStartTime} - {selectedOffer.setEndTime}</div>
                      {selectedOffer.setDuration && (
                        <div className="detail-subtext">({selectedOffer.setDuration} minutes)</div>
                      )}
                    </span>
                  </div>
                )}
                <div className="offer-detail-row">
                  <span className="detail-label">Fee:</span>
                  <span className="detail-value offer-fee">
                    {Number.isInteger(selectedOffer.currentFee)
                      ? selectedOffer.currentFee.toLocaleString()
                      : selectedOffer.currentFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedOffer.currency}
                  </span>
                </div>
                {selectedOffer.extras && Object.keys(selectedOffer.extras).length > 0 && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Extras:</span>
                    <div className="detail-value extras-list">
                      {Object.entries(selectedOffer.extras).map(([key, value]) => (
                        <div key={key} className="extra-item">
                          <div className="extra-header">
                            <strong style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}:</strong>
                          </div>
                          {value !== 'Included' && (
                            <div className="extra-note">{value}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedOffer.additionalTerms && (() => {
                  let parsedTerms = null;
                  try {
                    const parsed = typeof selectedOffer.additionalTerms === 'string'
                      ? JSON.parse(selectedOffer.additionalTerms)
                      : selectedOffer.additionalTerms;
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                      parsedTerms = parsed;
                    }
                  } catch (e) { /* not JSON */ }

                  return parsedTerms ? (
                    <div className="offer-detail-row">
                      <span className="detail-label">Extras:</span>
                      <div className="detail-value extras-list">
                        {Object.entries(parsedTerms).filter(([, v]) => v).map(([key, value]) => (
                          <div key={key} className="extra-item">
                            <div className="extra-header">
                              <strong style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}:</strong>
                            </div>
                            {value !== 'Included' && value !== true && (
                              <div className="extra-note">{value}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="offer-detail-row">
                      <span className="detail-label">Additional Terms:</span>
                      <span className="detail-value">{selectedOffer.additionalTerms}</span>
                    </div>
                  );
                })()}
                {selectedOffer.technicalRequirements && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Technical:</span>
                    <span className="detail-value">{selectedOffer.technicalRequirements}</span>
                  </div>
                )}
                {selectedOffer.paymentTerms && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Payment Terms:</span>
                    <span className="detail-value">{selectedOffer.paymentTerms}</span>
                  </div>
                )}
                {selectedOffer.notes && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Notes:</span>
                    <span className="detail-value">{selectedOffer.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {selectedOffer && !selectedOffer.isHistoricalView && (selectedOffer.status === 'PENDING' || selectedOffer.status === 'NEGOTIATING') &&
               (() => {
                 // Determine who can respond: the party who did NOT send the last offer
                 const offerHistory = selectedOffer.offerHistory || [];
                 const lastOffer = offerHistory.length > 0 ? offerHistory[offerHistory.length - 1] : null;
                 if (lastOffer) {
                   // Counter-offer exists: the other party can respond
                   return lastOffer.offeredBy !== currentUser.id;
                 }
                 // No counter-offers: the recipient (not initiator) can respond
                 const isArtistOrAgent = selectedOffer.artist?.id === currentUser.id ||
                   (currentUser.role === 'AGENT' && selectedOffer.bookedArtistId &&
                    currentUser.representingArtists?.some(a => a.profileId === selectedOffer.bookedArtistId)) ||
                   (currentUser.role === 'AGENT' && selectedOffer.artist?.id &&
                    currentUser.representingArtists?.some(a => a.profileId === selectedOffer.artist.id));
                 const isVenue = selectedOffer.venue?.id === currentUser.id;
                 const isInitiator = selectedOffer.initiator?.id === currentUser.id;
                 return (isArtistOrAgent || isVenue) && !isInitiator;
               })() ? (
                // Show Decline/Review/Accept for the party who can respond
                showOfferDeclineComment ? (
                  <div className="decline-comment-container">
                    <div className="decline-comment-textarea-wrapper">
                      <label className="decline-comment-label">Please provide a reason for declining:</label>
                      <textarea
                        value={offerDeclineComment}
                        onChange={(e) => setOfferDeclineComment(e.target.value)}
                        placeholder="Enter your reason here..."
                        className="form-textarea decline-comment-textarea"
                        rows="5"
                      />
                    </div>
                    <div className="decline-comment-actions">
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setShowOfferDeclineComment(false);
                          setOfferDeclineComment('');
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleDeclineOffer}
                        disabled={actionBusy}
                      >
                        {actionBusy ? '...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowOfferDeclineComment(true)}
                      disabled={actionBusy}
                    >
                      Decline
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleOpenReview}
                      disabled={actionBusy}
                    >
                      Review
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAcceptOffer}
                      disabled={actionBusy}
                    >
                      {actionBusy ? '...' : 'Accept'}
                    </button>
                  </>
                )
              ) : selectedOffer && selectedOffer.status === 'ACCEPTED' ? (() => {
                // Reflect the current contract state. Send/Skip CTAs are only
                // valid when no contract has been sent yet; once the contract
                // is in flight or signed, show a status message instead.
                const contractStatus = selectedOffer.contract?.status;
                const isSentOrLater = contractStatus && contractStatus !== 'NOT_SENT';
                const isFullySigned = contractStatus === 'FULLY_SIGNED';
                const onArtistSide = isArtistSideForDeal(selectedOffer, currentUser);
                const otherName = onArtistSide
                  ? (selectedOffer.venue?.name || 'the other party')
                  : (selectedOffer.artist?.name || 'the artist side');

                if (isFullySigned) {
                  return (
                    <span style={{ color: '#888', fontSize: '13px', textAlign: 'center', width: '100%' }}>
                      Contract fully signed — see the contract card in the chat.
                    </span>
                  );
                }
                if (isSentOrLater) {
                  return (
                    <span style={{ color: '#888', fontSize: '13px', textAlign: 'center', width: '100%' }}>
                      {onArtistSide
                        ? `Contract sent — waiting for ${otherName} to countersign.`
                        : `Contract awaiting your signature — open the contract card in the chat to sign.`}
                    </span>
                  );
                }

                // No contract sent yet.
                return onArtistSide ? (
                  <>
                    <button
                      className="btn btn-secondary"
                      disabled={actionBusy}
                      onClick={async () => {
                        if (actionBusy) return;
                        if (!window.confirm('Skip contract stage? You can still share documents and proceed with the booking.')) return;
                        setActionBusy(true);
                        try {
                          await apiService.skipContract(selectedOffer.id, currentUser.id);
                          setShowOfferDetails(false);
                          fetchMessages();
                        } catch (err) {
                          alert(err.message || 'Failed to skip contract');
                        } finally {
                          setActionBusy(false);
                        }
                      }}
                    >
                      Skip Contract
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={actionBusy}
                      onClick={async () => {
                        if (selectedOffer?.bookedArtistId) {
                          try {
                            const profile = await apiService.getProfile(selectedOffer.bookedArtistId);
                            setSelectedArtistForDocs(profile);
                            setShowAddContractModal(true);
                            setShowOfferDetails(false);
                          } catch (err) {
                            console.error('Failed to fetch artist profile:', err);
                            alert('Failed to load artist profile. Please try again.');
                          }
                        } else {
                          setShowAddContractModal(true);
                          setShowOfferDetails(false);
                        }
                      }}
                    >
                      Send Contract
                    </button>
                  </>
                ) : (
                  <span style={{ color: '#888', fontSize: '13px', textAlign: 'center', width: '100%' }}>
                    Waiting for the contract from the artist side
                  </span>
                );
              })() : (
                // Show Close for sent offers or declined
                <button
                  className="btn btn-outline"
                  onClick={() => setShowOfferDetails(false)}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review/Counter-Offer Modal */}
      {showReviewModal && (
        <div className="modal active review-modal-wrapper" onClick={() => setShowReviewModal(false)}>
          <div className="review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Review Offer</h3>
              <button className="modal-close" onClick={() => setShowReviewModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="review-form">
                <div className="form-group">
                  <label>Fee Amount *</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={reviewData.fee}
                    onChange={(e) => setReviewData({ ...reviewData, fee: e.target.value })}
                    onWheel={(e) => e.target.blur()}
                    placeholder="0"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Currency</label>
                  <select
                    value={reviewData.currency}
                    onChange={(e) => setReviewData({ ...reviewData, currency: e.target.value })}
                    className="form-select currency-select-full"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Extras</label>
                  <div className="extras-list">
                    <div className="extra-item">
                      <div className="extra-checkbox-row">
                        <input
                          type="checkbox"
                          id="travelIn"
                          checked={!!reviewData.extras.travelIn}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, travelIn: e.target.checked ? (reviewData.extras.travelIn || 'Included') : '' }
                          })}
                        />
                        <label htmlFor="travelIn">Travel In</label>
                      </div>
                      {!!reviewData.extras.travelIn && (
                        <input
                          type="text"
                          value={typeof reviewData.extras.travelIn === 'string' ? reviewData.extras.travelIn : 'Included'}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, travelIn: e.target.value }
                          })}
                          placeholder="Add details..."
                          className="extra-note-input"
                        />
                      )}
                    </div>

                    <div className="extra-item">
                      <div className="extra-checkbox-row">
                        <input
                          type="checkbox"
                          id="travelOut"
                          checked={!!reviewData.extras.travelOut}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, travelOut: e.target.checked ? (reviewData.extras.travelOut || 'Included') : '' }
                          })}
                        />
                        <label htmlFor="travelOut">Travel Out</label>
                      </div>
                      {!!reviewData.extras.travelOut && (
                        <input
                          type="text"
                          value={typeof reviewData.extras.travelOut === 'string' ? reviewData.extras.travelOut : 'Included'}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, travelOut: e.target.value }
                          })}
                          placeholder="Add details..."
                          className="extra-note-input"
                        />
                      )}
                    </div>

                    <div className="extra-item">
                      <div className="extra-checkbox-row">
                        <input
                          type="checkbox"
                          id="transportation"
                          checked={!!reviewData.extras.transportation}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, transportation: e.target.checked ? (reviewData.extras.transportation || 'Included') : '' }
                          })}
                        />
                        <label htmlFor="transportation">Transportation</label>
                      </div>
                      {!!reviewData.extras.transportation && (
                        <input
                          type="text"
                          value={typeof reviewData.extras.transportation === 'string' ? reviewData.extras.transportation : 'Included'}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, transportation: e.target.value }
                          })}
                          placeholder="Add details..."
                          className="extra-note-input"
                        />
                      )}
                    </div>

                    <div className="extra-item">
                      <div className="extra-checkbox-row">
                        <input
                          type="checkbox"
                          id="accommodation"
                          checked={!!reviewData.extras.accommodation}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, accommodation: e.target.checked ? (reviewData.extras.accommodation || 'Included') : '' }
                          })}
                        />
                        <label htmlFor="accommodation">Accommodation</label>
                      </div>
                      {!!reviewData.extras.accommodation && (
                        <input
                          type="text"
                          value={typeof reviewData.extras.accommodation === 'string' ? reviewData.extras.accommodation : 'Included'}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, accommodation: e.target.value }
                          })}
                          placeholder="Add details..."
                          className="extra-note-input"
                        />
                      )}
                    </div>

                    <div className="extra-item">
                      <div className="extra-checkbox-row">
                        <input
                          type="checkbox"
                          id="meals"
                          checked={!!reviewData.extras.meals}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, meals: e.target.checked ? (reviewData.extras.meals || 'Included') : '' }
                          })}
                        />
                        <label htmlFor="meals">Meals</label>
                      </div>
                      {!!reviewData.extras.meals && (
                        <input
                          type="text"
                          value={typeof reviewData.extras.meals === 'string' ? reviewData.extras.meals : 'Included'}
                          onChange={(e) => setReviewData({
                            ...reviewData,
                            extras: { ...reviewData.extras, meals: e.target.value }
                          })}
                          placeholder="Add details..."
                          className="extra-note-input"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>General Notes</label>
                  <textarea
                    value={reviewData.notes}
                    onChange={(e) => setReviewData({ ...reviewData, notes: e.target.value })}
                    placeholder="Add any additional comments or conditions..."
                    className="form-textarea"
                    rows="3"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary btn-full-width" onClick={handleSubmitReview} disabled={actionBusy}>
                {actionBusy ? 'Sending...' : 'Send Counter-Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter-Offer Details Modal */}
      {showCounterOfferDetails && counterOfferData && (
        <div className="modal-overlay" onClick={() => setShowCounterOfferDetails(false)}>
          <div className="modal-content offer-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Counter-Offer Details</h3>
              <button className="modal-close" onClick={() => setShowCounterOfferDetails(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="offer-detail-section">
                <div className="offer-detail-row">
                  <span className="detail-label">Fee:</span>
                  <span className="detail-value offer-fee">
                    {counterOfferData.fee} {counterOfferData.currency}
                  </span>
                </div>
                {counterOfferData.extras && Object.keys(counterOfferData.extras).length > 0 && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Extras:</span>
                    <div className="detail-value extras-list">
                      {Object.entries(counterOfferData.extras).map(([key, value]) => (
                        <div key={key} className="extra-item">
                          <div className="extra-header">
                            <strong>{key}:</strong>
                          </div>
                          {value !== 'Included' && (
                            <div className="extra-note">{value}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {counterOfferData.notes && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Notes:</span>
                    <span className="detail-value">{counterOfferData.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {counterOfferMessage && !counterOfferMessage.isMe ? (
                showDeclineComment ? (
                  <div className="decline-comment-container">
                    <div className="decline-comment-textarea-wrapper">
                      <label className="decline-comment-label">Please provide a reason for declining:</label>
                      <textarea
                        value={declineComment}
                        onChange={(e) => setDeclineComment(e.target.value)}
                        placeholder="Enter your reason here..."
                        className="form-textarea decline-comment-textarea"
                        rows="5"
                      />
                    </div>
                    <div className="decline-comment-actions">
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setShowDeclineComment(false);
                          setDeclineComment('');
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleDeclineCounterOffer}
                        disabled={actionBusy}
                      >
                        {actionBusy ? '...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowDeclineComment(true)}
                      disabled={actionBusy}
                    >
                      Decline
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleReviewCounterOffer}
                      disabled={actionBusy}
                    >
                      Review
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAcceptCounterOffer}
                      disabled={actionBusy}
                    >
                      {actionBusy ? '...' : 'Accept'}
                    </button>
                  </>
                )
              ) : (
                <button
                  className="btn btn-outline"
                  onClick={() => setShowCounterOfferDetails(false)}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decline Reason Modal */}
      {showDeclineReasonModal && declineReasonData && (
        <div className="modal-overlay" onClick={() => setShowDeclineReasonModal(false)}>
          <div className="modal-content offer-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Decline Reason</h3>
              <button className="modal-close" onClick={() => setShowDeclineReasonModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="offer-detail-section">
                <div className="offer-detail-row">
                  <span className="detail-label">Declined By:</span>
                  <span className="detail-value">
                    {declineReasonData.declinedBy && declineReasonData.declinedBy.id === currentUser.id
                      ? 'You'
                      : (declineReasonData.declinedBy?.name || 'Unknown')}
                  </span>
                </div>
                <div className="offer-detail-row">
                  <span className="detail-label">Reason:</span>
                  <span className="detail-value">
                    {declineReasonData.declineReason || 'No reason provided'}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowDeclineReasonModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Representation Request Details Modal */}
      {showRepresentationDetails && selectedRepresentationRequest && (
        <div className="modal-overlay" onClick={() => setShowRepresentationDetails(false)}>
          <div className="modal-content offer-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Representation Request</h3>
              <button className="modal-close" onClick={() => setShowRepresentationDetails(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="offer-detail-section" style={{ marginBottom: '24px' }}>
                {selectedRepresentationRequest.message && (
                  <div className="offer-detail-row">
                    <span className="detail-label">Message:</span>
                    <span className="detail-value representation-message">
                      {selectedRepresentationRequest.message}
                    </span>
                  </div>
                )}
                {!selectedRepresentationRequest.message && (
                  <div className="offer-detail-row">
                    <span className="detail-value representation-no-message" style={{ textAlign: 'center', color: '#888' }}>
                      No message included with this request.
                    </span>
                  </div>
                )}
              </div>
              {selectedRepresentationRequest.status === 'PENDING' && (
                selectedRepresentationRequest.toProfileId === currentUser?.id ? (
                  <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={handleDeclineRepresentation}
                      disabled={actionBusy}
                    >
                      {actionBusy ? '...' : 'Decline'}
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAcceptRepresentation}
                      disabled={actionBusy}
                    >
                      {actionBusy ? '...' : 'Accept'}
                    </button>
                  </div>
                ) : (
                  <div className="offer-status-message" style={{ justifyContent: 'center' }}>
                    <span>Awaiting response from {selectedRepresentationRequest.to?.name || 'the other party'}</span>
                  </div>
                )
              )}
              {selectedRepresentationRequest.status === 'ACCEPTED' && (
                <div className="offer-status-message accepted">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="9 12 11 14 15 10"></polyline>
                  </svg>
                  <span>This request has been accepted</span>
                </div>
              )}
              {selectedRepresentationRequest.status === 'REJECTED' && (
                <div className="offer-status-message declined">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  <span>This request has been declined</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paperclip share modal — library docs (Press Kit / Tech Rider /
          Hospitality Rider) auto-broadcast into active deals between the
          two parties via the backend. "Other file" uploads an ad-hoc PDF
          or image with no workflow binding. */}
      {showDocumentPicker && (() => {
        const docsOwner = currentUser.role === 'AGENT'
          ? (selectedArtistForDocs || null)
          : currentUser;
        const needsArtistSelector = currentUser.role === 'AGENT' && !selectedArtistForDocs && !loadingArtistDocs;
        const categories = DOC_CATEGORIES.filter((c) => c.broadcast);
        const closeModal = () => {
          setShowDocumentPicker(false);
          setSelectedArtistForDocs(null);
        };
        return (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content offer-details-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
              <div className="modal-header">
                <h3>Share with {user.name}</h3>
                <button className="modal-close" onClick={closeModal}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                {needsArtistSelector && (
                  <div>
                    <p style={{ fontSize: '14px', marginBottom: '16px', color: '#999' }}>
                      Select an artist to send their documents:
                    </p>
                    {(currentUser.representingArtists || []).length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#888' }}>
                        You don't represent any artists yet. Add one in <strong>Profile &gt; Represented Artists</strong>.
                      </p>
                    ) : (
                      <div>
                        {currentUser.representingArtists.map((artist) => (
                          <div
                            key={artist.profileId || artist.id}
                            onClick={() => handleSelectArtist(artist)}
                            style={{
                              padding: '14px',
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                              marginBottom: '10px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,51,102,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,51,102,0.5)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                          >
                            <div style={{ fontSize: '15px', fontWeight: 600 }}>{artist.name}</div>
                            <div style={{ fontSize: '12px', color: '#888' }}>{artist.location}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {loadingArtistDocs && (
                  <p style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '20px' }}>Loading…</p>
                )}

                {!needsArtistSelector && !loadingArtistDocs && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {currentUser.role === 'AGENT' && selectedArtistForDocs && (
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        Sharing on behalf of <strong style={{ color: '#fff' }}>{selectedArtistForDocs.name}</strong> · <button onClick={() => setSelectedArtistForDocs(null)} style={{ background: 'transparent', border: 'none', color: '#FF3366', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>change</button>
                      </div>
                    )}
                    {categories.map((cat) => {
                      const docs = docsOwner?.documents?.[cat.key] || [];
                      return (
                        <div key={cat.key} style={{
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '10px',
                          padding: '14px',
                          background: 'rgba(255,255,255,0.02)',
                        }}>
                          <strong style={{ fontSize: '14px', display: 'block', marginBottom: '10px' }}>{cat.label}</strong>
                          {docs.length === 0 ? (
                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                              No {cat.label.toLowerCase()} in {currentUser.role === 'AGENT' ? `${selectedArtistForDocs?.name || 'their'} library` : 'your library'}. Add one in <strong>Profile &gt; Manage &gt; Documents</strong>.
                            </p>
                          ) : (
                            docs.map((doc) => (
                              <div
                                key={doc.id}
                                onClick={() => handleSendDocument(doc, cat.key)}
                                title={doc.title}
                                style={{
                                  padding: '10px 12px',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '6px',
                                  marginBottom: '6px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,51,102,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,51,102,0.5)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                              >
                                {doc.title}
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}

                    <div style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '14px',
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                      <strong style={{ fontSize: '14px', display: 'block', marginBottom: '10px' }}>Other file</strong>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        style={{ display: 'none' }}
                        ref={otherFileInputRef}
                        onChange={(e) => handleSendOtherFile(e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        onClick={() => otherFileInputRef.current?.click()}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px dashed rgba(255,51,102,0.5)',
                          borderRadius: '6px',
                          background: 'rgba(255,51,102,0.05)',
                          color: '#FF3366',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Upload PDF or image
                      </button>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', margin: '6px 0 0 0' }}>
                        Ad-hoc file — sent only in this conversation. Max 10 MB.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sign Contract Modal */}
      {showSignContractModal && selectedContractData && (
        <SignContractModal
          isOpen={showSignContractModal}
          onClose={() => {
            setShowSignContractModal(false);
            setSelectedContractData(null);
          }}
          onSign={async (signatureData) => {
            try {
              const token = localStorage.getItem('token');
              await contractService.signContract(
                selectedContractData.dealId,
                currentUser.id,
                signatureData,
                token
              );
              alert('Contract signed successfully!');
              await fetchMessages();
              setShowSignContractModal(false);
              setSelectedContractData(null);
            } catch (err) {
              throw new Error(err.message || 'Failed to sign contract');
            }
          }}
          contractUrl={selectedContractData.contractUrl}
          dealId={selectedContractData.dealId}
          senderName={selectedContractData.senderName}
          initiallyViewed={!!selectedContractData.initiallyViewed}
          viewConfirmedSignal={viewConfirmedSignal}
          onContractViewed={async () => {
            // Fired only after the PDF actually loaded — write the
            // server-side view record at the same point.
            try {
              await contractService.trackContractView(
                selectedContractData.dealId,
                currentUser.id,
                0,
                localStorage.getItem('token')
              );
            } catch (err) {
              console.error('Failed to track view:', err);
            }
          }}
          onOpenContract={() => setPdfViewerUrl(getFullUrl(selectedContractData.contractUrl))}
        />
      )}

      {/* Contract Viewer Modal */}
      {showContractViewer && selectedContractData && (
        <ContractViewer
          isOpen={showContractViewer}
          onClose={() => {
            setShowContractViewer(false);
            setSelectedContractData(null);
          }}
          contractUrl={selectedContractData.contractUrl}
          dealId={selectedContractData.dealId}
          onTrackView={async (viewDuration) => {
            try {
              const token = localStorage.getItem('token');
              await contractService.trackContractView(
                selectedContractData.dealId,
                currentUser.id,
                viewDuration,
                token
              );
            } catch (err) {
              console.error('Failed to track contract view:', err);
            }
          }}
        />
      )}

      {/* Add Contract Modal */}
      {showAddContractModal && (
        <AddContractModal
          isOpen={showAddContractModal}
          onClose={() => {
            setShowAddContractModal(false);
            // Clear artist profile when closing modal
            if (currentUser.role === 'AGENT') {
              setSelectedArtistForDocs(null);
            }
          }}
          existingContracts={
            selectedOffer?.artistId && selectedArtistForDocs
              ? selectedArtistForDocs?.documents?.contracts || []
              : currentUser?.documents?.contracts || []
          }
          onSave={async (contractData) => {
            // Hand the chosen contract to the sign-and-send modal so the
            // sender can pre-sign before delivery.
            setPendingContractToSign({
              documentData: {
                id: contractData.existingContract?.id || Date.now().toString(),
                title: contractData.title,
                url: contractData.url,
                file: contractData.file,
                type: contractData.type,
              },
              deal: selectedOffer,
            });
            setShowAddContractModal(false);
          }}
        />
      )}

      <ShareDocumentsModal
        isOpen={!!shareDocsDeal}
        deal={shareDocsDeal}
        currentUser={currentUser}
        onClose={() => setShareDocsDeal(null)}
        onDealUpdated={() => { fetchMessages(); }}
      />

      {pendingContractToSign && (
        <SignContractModal
          isOpen={true}
          mode="sign-and-send"
          recipientName={deriveRecipientName(pendingContractToSign.deal, currentUser)}
          signerCapacity={deriveSignerCapacity(pendingContractToSign.deal, currentUser)}
          contractUrl={pendingContractToSign.documentData?.url}
          dealId={pendingContractToSign.deal?.id}
          onOpenContract={() => setPdfViewerUrl(getFullUrl(pendingContractToSign.documentData?.url))}
          onClose={() => setPendingContractToSign(null)}
          onSign={async (signatureData) => {
            try {
              await apiService.sendAndSignContract(
                pendingContractToSign.deal.id,
                currentUser.id,
                pendingContractToSign.documentData,
                signatureData,
              );
              setPendingContractToSign(null);
              await fetchMessages();
              alert('Contract sent and signed successfully!');
            } catch (err) {
              throw new Error(err.message || 'Failed to send and sign contract');
            }
          }}
        />
      )}

      <PdfViewerModal
        url={pdfViewerUrl}
        onClose={() => { setPdfViewerUrl(null); setPdfViewerTrackDealId(null); }}
        onLoaded={() => {
          setViewConfirmedSignal((n) => n + 1);
          // Chat-card path: parent owns the server-side tracking.
          // Sign-modal path: pdfViewerTrackDealId is null and the
          // sign modal's own onContractViewed callback handles tracking.
          if (pdfViewerTrackDealId) {
            contractService.trackContractView(
              pdfViewerTrackDealId,
              currentUser.id,
              0,
              localStorage.getItem('token'),
            ).catch((err) => console.error('Failed to track view:', err));
          }
        }}
      />
    </div>
  );
};

export default ChatScreen;
