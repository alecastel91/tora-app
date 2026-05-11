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

const ChatScreen = ({ user, onClose, onOpenProfile }) => {
  const { user: currentUser, sendMessage, connectedUsers, reloadProfileData } = useAppContext();
  const { t } = useLanguage();
  const [inputMessage, setInputMessage] = useState('');
  const [userMessages, setUserMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper function to convert relative URLs to full backend URLs with auth
  const getFullUrl = (url) => {
    if (!url) return '';

    const token = localStorage.getItem('token');
    const profileId = currentUser?.id;

    // If already a full URL with query params, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log('[ChatScreen] URL is already full:', url);
      return url;
    }

    // Convert relative URL to full backend URL
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
    const backendBase = API_URL.replace('/api', ''); // Remove /api suffix

    // Add query parameters for authentication
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${backendBase}${url}${separator}profileId=${profileId}&token=${token}`;

    console.log('[ChatScreen] Converting relative URL:', url, '→', fullUrl);
    return fullUrl;
  };
  const [showMakeOffer, setShowMakeOffer] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showOfferDetails, setShowOfferDetails] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submittingCounter, setSubmittingCounter] = useState(false);
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
        connectionRequestId: msg.connectionRequest ? (msg.connectionRequest.id || msg.connectionRequest) : null,
        documentAttachment: msg.documentAttachment || null
      }));

      // Only update state when something actually changed — avoids
      // unnecessary re-renders that fight with scroll position and input focus
      setUserMessages(prev => {
        if (prev.length !== transformedMessages.length) return transformedMessages;
        const lastPrev = prev[prev.length - 1];
        const lastNew = transformedMessages[transformedMessages.length - 1];
        if (lastPrev?.timestamp !== lastNew?.timestamp) return transformedMessages;
        return prev;
      });

      // Fetch deal statuses for all messages with dealId
      const dealIds = transformedMessages
        .filter(msg => msg.dealId)
        .map(msg => msg.dealId);

      if (dealIds.length > 0) {
        const statuses = {};
        await Promise.all(
          dealIds.map(async (dealId) => {
            try {
              const dealResponse = await apiService.getDeal(dealId, currentUser.id);
              const deal = dealResponse.deal || dealResponse;
              statuses[dealId] = {
                status: deal.status,
                declineReason: deal.declineReason,
                declinedBy: deal.declinedBy
              };
            } catch (error) {
              console.error(`Error fetching deal ${dealId}:`, error);
            }
          })
        );
        setDealStatuses(statuses);
      }

      // Fetch connection request details for all messages with connectionRequestId
      const connectionRequestIds = transformedMessages
        .filter(msg => msg.connectionRequestId)
        .map(msg => msg.connectionRequestId);

      if (connectionRequestIds.length > 0) {
        const requests = {};
        await Promise.all(
          connectionRequestIds.map(async (requestId) => {
            try {
              const requestResponse = await apiService.getConnectionRequest(requestId);
              requests[requestId] = requestResponse;
            } catch (error) {
              console.error(`Error fetching connection request ${requestId}:`, error);
            }
          })
        );
        setConnectionRequests(requests);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (!isPoll) setUserMessages([]);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  // Fetch messages when component mounts
  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, user]);

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

  // Fetch artist profile for contract modal when agent opens it
  useEffect(() => {
    const fetchArtistForContract = async () => {
      if (showAddContractModal && currentUser.role === 'AGENT' && selectedOffer?.artist) {
        try {
          const artistId = selectedOffer.artist.id || selectedOffer.artist.id;
          console.log('[ChatScreen] Fetching artist profile for contract:', artistId);
          const artistProfile = await apiService.getProfile(artistId);
          console.log('[ChatScreen] Fetched artist profile:', artistProfile);
          setSelectedArtistForDocs(artistProfile);
        } catch (error) {
          console.error('[ChatScreen] Error fetching artist profile for contract:', error);
        }
      }
    };

    fetchArtistForContract();
  }, [showAddContractModal, currentUser.role, selectedOffer]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (inputMessage.trim()) {
      try {
        // Send message to backend
        await sendMessage(user.id, inputMessage);

        // Clear input
        setInputMessage('');

        // Refresh messages using the same logic as fetchMessages
        await fetchMessages();
      } catch (error) {
        console.error('Error sending message:', error);
      }
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
      // Send document as a special message
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

      // Close modal and refresh messages
      setShowDocumentPicker(false);
      await fetchMessages();
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Failed to send document. Please try again.');
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
    if (!selectedOffer) return;

    try {
      await apiService.acceptDeal(selectedOffer.id, currentUser.id);
      setShowOfferDetails(false);
      setSelectedOffer(null);
      // Refresh messages to show updated status
      fetchMessages();
    } catch (error) {
      console.error('Error accepting offer:', error);
      alert(error.message || 'Failed to accept offer');
    }
  };

  const handleDeclineOffer = async () => {
    if (!selectedOffer) return;

    if (!offerDeclineComment.trim()) {
      alert('Please provide a reason for declining');
      return;
    }

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
    if (!counterOfferData?.dealId) {
      alert('Deal information not found');
      return;
    }

    try {
      // Accept the deal in the backend (this updates status to ACCEPTED and creates system message)
      await apiService.acceptDeal(counterOfferData.dealId, currentUser.id);

      setShowCounterOfferDetails(false);

      // Refresh messages to show the acceptance system message
      fetchMessages();
    } catch (error) {
      console.error('Error accepting counter-offer:', error);
      alert(error.message || 'Failed to accept counter-offer');
    }
  };

  const handleDeclineCounterOffer = async () => {
    if (!declineComment.trim()) {
      alert('Please provide a reason for declining');
      return;
    }

    if (!counterOfferData?.dealId) {
      alert('Deal information not found');
      return;
    }

    try {
      // Decline the deal in the backend (this updates status to DECLINED and creates system message)
      await apiService.declineDeal(counterOfferData.dealId, currentUser.id, declineComment);

      setShowCounterOfferDetails(false);
      setShowDeclineComment(false);
      setDeclineComment('');

      // Refresh messages to show the decline system message
      fetchMessages();
    } catch (error) {
      console.error('Error declining counter-offer:', error);
      alert(error.message || 'Failed to decline counter-offer');
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
    if (!selectedRepresentationRequest) return;

    try {
      await apiService.acceptRepresentationRequest(selectedRepresentationRequest.id);

      // Close modal
      setShowRepresentationDetails(false);
      setSelectedRepresentationRequest(null);

      // Refresh messages to show updated status
      await fetchMessages();

      // Update the connection request cache
      const updatedRequest = await apiService.getConnectionRequest(selectedRepresentationRequest.id);
      setConnectionRequests(prev => ({
        ...prev,
        [selectedRepresentationRequest.id]: updatedRequest
      }));

      // Reload profile data to update representingArtists array
      await reloadProfileData();
    } catch (error) {
      console.error('Error accepting representation request:', error);
      alert(error.message || 'Failed to accept representation request');
    }
  };

  const handleDeclineRepresentation = async () => {
    if (!selectedRepresentationRequest) return;

    try {
      await apiService.declineRepresentationRequest(selectedRepresentationRequest.id);

      // Close modal
      setShowRepresentationDetails(false);
      setSelectedRepresentationRequest(null);

      // Refresh messages to show updated status
      await fetchMessages();

      // Update the connection request cache
      const updatedRequest = await apiService.getConnectionRequest(selectedRepresentationRequest.id);
      setConnectionRequests(prev => ({
        ...prev,
        [selectedRepresentationRequest.id]: updatedRequest
      }));
    } catch (error) {
      console.error('Error declining representation request:', error);
      alert(error.message || 'Failed to decline representation request');
    }
  };

  const handleSubmitReview = async () => {
    if (submittingCounter) return;

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

    setSubmittingCounter(true);
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
      setSubmittingCounter(false);
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

      const withdrawalMsg = messages.find(m => m.text && m.text.includes('withdrawn the contract'));
      const contractMsg = messages.find(m =>
        (m.documentAttachment && m.documentAttachment.category === 'contracts') ||
        (m.text && m.text.includes('Contract sent'))
      );
      const acceptanceMsg = messages.find(m => m.text && m.text.includes('Booking Confirmed!'));
      const declineMsg = messages.find(m => m.text && m.text.includes('Booking Offer Declined'));
      const offerMsg = messages.find(m => m.text && m.text.includes('New Booking Offer'));
      const counterOfferMsgs = messages.filter(m => m.text && m.text.startsWith('Counter-Offer:'));

      // Always show the original offer (so the negotiation start is visible)
      if (offerMsg) {
        filteredDealMessages.push(offerMsg);
      }

      // Always show all counter offers (each one is a separate moment in negotiation)
      counterOfferMsgs.forEach(m => filteredDealMessages.push(m));

      // Then add the latest workflow stage if any (these are separate cards)
      if (withdrawalMsg) {
        filteredDealMessages.push(withdrawalMsg);
      } else if (contractMsg) {
        filteredDealMessages.push(contractMsg);
      } else if (acceptanceMsg) {
        filteredDealMessages.push(acceptanceMsg);
      } else if (declineMsg) {
        filteredDealMessages.push(declineMsg);
      }
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
              <div className="message-with-timestamp">
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
                      <p className="offer-card-action">counter-offered</p>
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
                  <div className="message-with-timestamp">
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
              // Contract workflow card
              <div className="message-with-timestamp">
                <div className="offer-card-message">
                  <div className="offer-card-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', gap: '12px' }}>
                      <div className="offer-card-icon" style={{ backgroundColor: 'rgba(138, 43, 226, 0.15)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                      </div>
                      <div className="offer-card-text">
                        <p className="offer-card-name">{msg.isMe ? 'You' : user.name}</p>
                        <p className="offer-card-action">sent a contract</p>
                      </div>
                    </div>
                    {!msg.isMe && (
                      <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                        <a
                          href={msg.documentAttachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline"
                          style={{
                            flex: 1,
                            fontWeight: '600',
                            fontSize: '11px',
                            padding: '8px 10px',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          Open
                        </a>
                        <button
                          className="btn btn-primary"
                          style={{
                            flex: 1,
                            fontWeight: '600',
                            fontSize: '11px',
                            padding: '8px 10px'
                          }}
                          onClick={() => {
                            setSelectedContractData({
                              dealId: msg.dealId,
                              contractUrl: msg.documentAttachment.url,
                              senderName: user.name
                            });
                            setShowSignContractModal(true);
                          }}
                        >
                          ✓ Sign
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{
                            flex: 1,
                            fontWeight: '600',
                            fontSize: '11px',
                            padding: '8px 10px',
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
                        <button
                          className="btn btn-outline"
                          style={{
                            flex: 1,
                            fontWeight: '600',
                            fontSize: '11px',
                            padding: '8px 10px',
                            borderColor: 'rgba(255, 51, 51, 0.5)',
                            color: 'rgba(255, 51, 51, 1)'
                          }}
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
                              try {
                                await apiService.deleteDeal(msg.dealId, currentUser.id);
                                alert('Booking cancelled');
                                await fetchMessages();
                              } catch (err) {
                                alert(err.message || 'Failed to cancel booking');
                              }
                            }
                          }}
                        >
                          × Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {msg.isMe && (
                    <a
                      href={msg.documentAttachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-view-offer"
                      style={{ textDecoration: 'none' }}
                    >
                      View Contract
                    </a>
                  )}
                </div>
                <span className="message-timestamp">{formatMessageTime(msg.timestamp)}</span>
              </div>
            ) : msg.isSystem && msg.dealId ? (
              (() => {
                // Determine card type from the message text itself, so the original
                // offer card and the decline/accept cards are distinct entries.
                const isDeclineCard = msg.text && msg.text.includes('Booking Offer Declined');
                const isAcceptCard = msg.text && msg.text.includes('Booking Confirmed!');

                const isDeclined = isDeclineCard;
                const isAccepted = isAcceptCard;

                // For decline/accept cards, sender of the message is the one who acted
                const displayName = msg.isMe ? 'You' : user.name;

                return (
                  <div className="message-with-timestamp">
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
                      <a
                        href={getFullUrl(msg.documentAttachment.url)}
                        target="_blank"
                        rel="noopener noreferrer"
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
                      </a>
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
                    <a
                      href={msg.documentAttachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
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
                    </a>
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
                    disabled={!inputMessage.trim()}
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
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowOfferDeclineComment(true)}
                    >
                      Decline
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleOpenReview}
                    >
                      Review
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAcceptOffer}
                    >
                      Accept
                    </button>
                  </>
                )
              ) : selectedOffer && selectedOffer.status === 'ACCEPTED' ? (
                // Show Send Contract and Close for accepted offers
                <>
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowOfferDetails(false)}
                  >
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      console.log('[ChatScreen Send Contract] selectedOffer:', selectedOffer);
                      console.log('[ChatScreen Send Contract] artistId:', selectedOffer?.artistId);

                      // If this is an agent booking (has artistId), fetch artist profile FIRST
                      if (selectedOffer?.artistId) {
                        try {
                          console.log('[ChatScreen] Fetching artist profile BEFORE opening modal:', selectedOffer.bookedArtistId);
                          const profile = await apiService.getProfile(selectedOffer.bookedArtistId);
                          console.log('[ChatScreen] Artist profile fetched:', profile.name, 'Contracts:', profile.documents?.contracts?.length);
                          setSelectedArtistForDocs(profile);
                          // NOW open the modal after profile is loaded
                          setShowAddContractModal(true);
                          setShowOfferDetails(false);
                        } catch (err) {
                          console.error('Failed to fetch artist profile:', err);
                          alert('Failed to load artist profile. Please try again.');
                        }
                      } else {
                        // Not an agent booking, open modal directly
                        setShowAddContractModal(true);
                        setShowOfferDetails(false);
                      }
                    }}
                  >
                    Send Contract
                  </button>
                </>
              ) : (
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
              <button className="btn btn-primary btn-full-width" onClick={handleSubmitReview} disabled={submittingCounter}>
                {submittingCounter ? 'Sending...' : 'Send Counter-Offer'}
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
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowDeclineComment(true)}
                    >
                      Decline
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleReviewCounterOffer}
                    >
                      Review
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAcceptCounterOffer}
                    >
                      Accept
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
                    >
                      Decline
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAcceptRepresentation}
                    >
                      Accept
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

      {/* Document Picker Modal */}
      {showDocumentPicker && (
        <div className="modal-overlay" onClick={() => {
          setShowDocumentPicker(false);
          setSelectedArtistForDocs(null);
        }}>
          <div className="modal-content offer-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send Document</h3>
              <button className="modal-close" onClick={() => {
                setShowDocumentPicker(false);
                setSelectedArtistForDocs(null);
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {/* Agent: Show Artist Selector First */}
              {currentUser.role === 'AGENT' && !selectedArtistForDocs && !loadingArtistDocs && (
                <div>
                  <p style={{ fontSize: '14px', marginBottom: '16px', color: '#999' }}>
                    Select an artist to send their documents:
                  </p>
                  {currentUser.representingArtists && currentUser.representingArtists.length > 0 ? (
                    <div className="artist-selector-list">
                      {currentUser.representingArtists.map((artist) => (
                        <div
                          key={artist.profileId || artist.id}
                          className="artist-selector-item"
                          onClick={() => handleSelectArtist(artist)}
                          style={{
                            padding: '14px',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            marginBottom: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 51, 102, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 51, 102, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: '#2a2a2a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: '600'
                          }}>
                            {artist.avatar ? (
                              <img src={artist.avatar} alt={artist.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              artist.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>{artist.name}</div>
                            <div style={{ fontSize: '12px', color: '#888' }}>{artist.location}</div>
                          </div>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <p style={{ fontSize: '14px', color: '#999' }}>No represented artists</p>
                    </div>
                  )}
                </div>
              )}

              {/* Loading state while fetching artist documents */}
              {currentUser.role === 'AGENT' && loadingArtistDocs && (
                <div className="empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(255, 51, 102, 0.2)',
                    borderTop: '3px solid #FF3366',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                  }}></div>
                  <p style={{ fontSize: '14px', color: '#999' }}>Loading documents...</p>
                </div>
              )}

              {/* Show Documents (for Artists OR Agents after selecting artist) */}
              {(currentUser.role !== 'AGENT' || selectedArtistForDocs) && (() => {
                // Determine which documents to show
                const docsSource = currentUser.role === 'AGENT' ? selectedArtistForDocs : currentUser;

                return (
                  <>
                    {/* Back button for agents */}
                    {currentUser.role === 'AGENT' && selectedArtistForDocs && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedArtistForDocs(null)}
                        style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        Back to Artists
                      </button>
                    )}

                    {/* Artist name header for agents */}
                    {currentUser.role === 'AGENT' && selectedArtistForDocs && (
                      <div style={{
                        padding: '12px',
                        backgroundColor: 'rgba(255, 51, 102, 0.05)',
                        border: '1px solid rgba(255, 51, 102, 0.2)',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: '#2a2a2a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {selectedArtistForDocs.avatar ? (
                            <img src={selectedArtistForDocs.avatar} alt={selectedArtistForDocs.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            selectedArtistForDocs.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600' }}>{selectedArtistForDocs.name}'s Documents</div>
                          <div style={{ fontSize: '11px', color: '#888' }}>{selectedArtistForDocs.location}</div>
                        </div>
                      </div>
                    )}
              {/* Press Kit Documents */}
              {docsSource.documents?.pressKit && docsSource.documents.pressKit.length > 0 && (
                <div className="document-category-section">
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#FF3366' }}>
                    Press Kit
                  </h4>
                  <div className="document-list">
                    {docsSource.documents.pressKit.map((doc) => (
                      <div key={doc.id} className="document-item" style={{
                        padding: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                          </svg>
                          <span style={{ fontSize: '14px' }}>{doc.title}</span>
                        </div>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSendDocument(doc, 'pressKit')}
                        >
                          Send
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Rider Documents */}
              {docsSource.documents?.technicalRider && docsSource.documents.technicalRider.length > 0 && (
                <div className="document-category-section" style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#FF3366' }}>
                    Technical Rider
                  </h4>
                  <div className="document-list">
                    {docsSource.documents.technicalRider.map((doc) => (
                      <div key={doc.id} className="document-item" style={{
                        padding: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                          </svg>
                          <span style={{ fontSize: '14px' }}>{doc.title}</span>
                        </div>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSendDocument(doc, 'technicalRider')}
                        >
                          Send
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contract Documents */}
              <div className="document-category-section" style={{ marginTop: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#FF3366' }}>
                  Contracts
                </h4>
                <p style={{ fontSize: '12px', color: '#999', marginBottom: '12px', lineHeight: '1.5' }}>
                  Upload PDF contracts to be signed within TORA, or paste links to external signing platforms (DocuSign, HelloSign, Adobe Sign, etc.)
                </p>

                {docsSource.documents?.contracts && docsSource.documents.contracts.length > 0 && (
                  <div className="document-list" style={{ marginBottom: '12px' }}>
                    {docsSource.documents.contracts.map((doc) => (
                      <div key={doc.id} className="document-item" style={{
                        padding: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                          </svg>
                          <span style={{ fontSize: '14px' }}>{doc.title}</span>
                        </div>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSendDocument(doc, 'contracts')}
                        >
                          Send
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Contract Button */}
                <button
                  className="btn btn-outline"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    padding: '10px'
                  }}
                  onClick={() => setShowAddContractModal(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="11" x2="12" y2="17"></line>
                    <line x1="9" y1="14" x2="15" y2="14"></line>
                  </svg>
                  Add Contract (PDF or Link)
                </button>
              </div>

              {/* No Documents Message */}
              {(!docsSource.documents?.pressKit || docsSource.documents.pressKit.length === 0) &&
               (!docsSource.documents?.technicalRider || docsSource.documents.technicalRider.length === 0) &&
               (!docsSource.documents?.contracts || docsSource.documents.contracts.length === 0) && (
                <div className="empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 16px', opacity: 0.3 }}>
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <p style={{ fontSize: '14px', color: '#999' }}>No documents available</p>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    {currentUser.role === 'AGENT' ?
                      'This artist has no documents added to their profile' :
                      'Add documents to your profile to share them in chat'
                    }
                  </p>
                </div>
              )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

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
            try {
              // For now, just show alert - full implementation will save contract to deal
              console.log('Contract data:', contractData);

              // Ensure we have an ID for the contract
              const contractToSend = {
                id: contractData.existingContract?.id || Date.now().toString(),
                title: contractData.title,
                url: contractData.url,
                file: contractData.file,
                type: contractData.type
              };

              alert(`Contract "${contractData.title}" ready to send! (Full implementation with deal integration pending)`);
              // This will be implemented to send contract via apiService.sendContract(dealId, profileId, contractToSend)
            } catch (err) {
              alert(err.message || 'Failed to prepare contract');
            }
          }}
        />
      )}
    </div>
  );
};

export default ChatScreen;