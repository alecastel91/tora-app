import React, { useState, useEffect } from 'react';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { CloseIcon } from '../../utils/icons';
import apiService from '../../services/api';
import ViewProfileScreen from '../screens/ViewProfileScreen';
import LoadingGlobe from './LoadingGlobe';
import { useLanguage } from '../../contexts/LanguageContext';

const SearchAgentsModal = ({ onClose, onSelectAgent, currentArtistId, onOpenChat }) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [sentRequestIds, setSentRequestIds] = useState(new Set());
  const [acceptedRequestIds, setAcceptedRequestIds] = useState(new Set());
  const [declinedRequestIds, setDeclinedRequestIds] = useState(new Set());
  const [connectedIds, setConnectedIds] = useState(new Set());
  const [pendingConnectionIds, setPendingConnectionIds] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [receivedRequestIds, setReceivedRequestIds] = useState(new Set());
  const [representingAgents, setRepresentingAgents] = useState([]); // Current representing agents (array)

  // Fetch sent requests on mount (but NOT the full agent list — search only)
  useEffect(() => {
    console.log('[SearchAgentsModal] Mounting - fetching request data for artist:', currentArtistId);
    fetchSentRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount

  const fetchSentRequests = async () => {
    try {
      const data = await apiService.getProfileData(currentArtistId);

      console.log('[SearchAgentsModal] Profile data received:', {
        artistId: currentArtistId,
        sentRequestsCount: data.sentRequests?.length,
        receivedRequestsCount: data.requests?.length,
        representedBy: data.profile?.representedBy
      });

      console.log('[SearchAgentsModal] All received requests:', data.requests);

      // Extract IDs of agents we've sent PENDING representation requests to
      const sentRequestedAgentIds = (data.sentRequests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'PENDING')
        .map(req => req.to.id);

      // Extract IDs of agents who sent us PENDING representation OR connection requests
      const receivedRepRequestAgentIds = (data.requests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'PENDING')
        .map(req => req.from.id || req.from);

      const receivedConnRequestAgentIds = (data.requests || [])
        .filter(req => req.type === 'CONNECTION_REQUEST' && req.status === 'PENDING')
        .map(req => req.from.id || req.from);

      console.log('[SearchAgentsModal] Received CONNECTION_REQUEST IDs:', receivedConnRequestAgentIds);

      const receivedRequestedAgentIds = [...receivedRepRequestAgentIds, ...receivedConnRequestAgentIds];

      // Check representedBy field (source of truth for Artist's representation status)
      // representedBy is now an array of agents
      const representedByRaw = data.profile?.representedBy;
      const representedByArray = Array.isArray(representedByRaw)
        ? representedByRaw
        : (representedByRaw ? [representedByRaw] : []);
      const representedByAgentIds = representedByArray
        .map(a => (a.agentId?.toString?.() || a.agentId || a.profileId?.toString?.() || a.profileId))
        .filter(Boolean);

      // Also check ACCEPTED representation requests for backward compatibility
      const acceptedRequestedAgentIds = (data.sentRequests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'ACCEPTED')
        .map(req => req.to.id);

      const acceptedReceivedAgentIds = (data.requests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'ACCEPTED')
        .map(req => req.from.id || req.from);

      // Combine both sent and received pending requests
      const allPendingRequestIds = [...sentRequestedAgentIds, ...receivedRequestedAgentIds];

      // Combine all accepted: from representedBy field + ACCEPTED requests
      const allAcceptedRequestIds = [
        ...representedByAgentIds,
        ...acceptedRequestedAgentIds,
        ...acceptedReceivedAgentIds
      ];

      console.log('[SearchAgentsModal] Accepted agent IDs:', {
        representedByAgentIds,
        acceptedRequestedAgentIds,
        acceptedReceivedAgentIds,
        allAcceptedRequestIds
      });

      // Store the representing agents data (if any exist)
      if (representedByArray.length > 0) {
        setRepresentingAgents(representedByArray);
        console.log('[SearchAgentsModal] Representing agents:', representedByArray);
      } else {
        setRepresentingAgents([]);
      }

      setSentRequestIds(new Set(allPendingRequestIds));
      setAcceptedRequestIds(new Set(allAcceptedRequestIds));
      setReceivedRequestIds(new Set(receivedRequestedAgentIds)); // Track received requests separately

      // Extract IDs of agents who DECLINED our representation requests
      const declinedAgentIds = (data.sentRequests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'REJECTED')
        .map(req => req.to.id);
      setDeclinedRequestIds(new Set(declinedAgentIds));

      // Extract IDs of agents we're connected to
      // Use connectedProfileIds from backend (already processed)
      const connectedAgentIds = data.connectedProfileIds || [];

      console.log('[SearchAgentsModal] Connection data:', {
        connectedProfileIdsCount: connectedAgentIds.length,
        connectedIds: connectedAgentIds
      });

      setConnectedIds(new Set(connectedAgentIds));

      // Extract IDs of agents with pending connection requests (both sent and received)
      const sentPendingConnectionAgentIds = (data.sentRequests || [])
        .filter(req => req.type === 'CONNECTION_REQUEST' && req.status === 'PENDING')
        .map(req => req.to.id);

      const receivedPendingConnectionAgentIds = (data.requests || [])
        .filter(req => req.type === 'CONNECTION_REQUEST' && req.status === 'PENDING')
        .map(req => req.from.id || req.from);

      const allPendingConnectionIds = [...sentPendingConnectionAgentIds, ...receivedPendingConnectionAgentIds];
      setPendingConnectionIds(new Set(allPendingConnectionIds));

      console.log('[SearchAgentsModal] Final state:', {
        connectedCount: connectedAgentIds.length,
        pendingCount: allPendingConnectionIds.length,
        representationRequestsCount: allPendingRequestIds.length,
        pendingConnectionIds: allPendingConnectionIds,
        receivedRequestIds: receivedRequestedAgentIds
      });
    } catch (error) {
      console.error('[SearchAgentsModal] Error fetching sent requests:', error);
    }
  };

  const fetchAgents = async (query = '') => {
    setLoading(true);
    try {
      const params = {
        roles: 'AGENT', // Only search for agents
        skipLocationFilter: 'true' // Show all agents regardless of location
      };

      if (query) {
        params.search = query;
      }

      const response = await apiService.searchProfiles(params);

      // Backend returns { profiles: [...], isPremium, userCity, userCountry }
      const profiles = response.profiles || response || [];

      // Filter out current artist's profile (just in case)
      const filteredAgents = profiles.filter(profile => {
        const profileId = profile.id;
        return profileId !== currentArtistId;
      });

      setAgents(filteredAgents);
      setHasSearched(true);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchAgents(searchQuery);
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear results when input is cleared
    if (value.length === 0) {
      setAgents([]);
      setHasSearched(false);
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };

  const handleCardClick = (agent) => {
    setViewingProfile(agent.id);
  };

  const handleConnectClick = (agent) => {
    // Show connection modal when user clicks "Connect"
    setSelectedAgent(agent);
    setConnectionMessage(''); // Reset message
    setShowConnectionModal(true);
  };

  const handleRequestClick = (agent) => {
    // Show message modal when user clicks "Send Request"
    setSelectedAgent(agent);
    setMessageText(''); // Reset message
    setShowMessageModal(true);
  };

  const handleSendRequest = async () => {
    if (!selectedAgent) return;

    setSending(true);
    try {
      const agentId = selectedAgent.id;

      // Call the parent's onSelectAgent function with the agent and message
      await onSelectAgent(selectedAgent, messageText);

      // Update local state to show "Requested" immediately
      setSentRequestIds(prev => new Set([...prev, agentId]));

      // Close the message modal
      setShowMessageModal(false);
      setSelectedAgent(null);
      setMessageText('');

      // Refetch data to update UI
      await fetchSentRequests();

    } catch (error) {
      console.error('Error in handleSendRequest:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendConnection = async () => {
    if (!selectedAgent) return;

    setSending(true);
    try {
      const agentId = selectedAgent.id;

      // Send connection request (from currentArtistId to agentId)
      await apiService.sendConnectionRequest(currentArtistId, agentId, connectionMessage);

      // Update local state to show "Requested" immediately
      setPendingConnectionIds(prev => new Set([...prev, agentId]));

      // Close the connection modal
      setShowConnectionModal(false);
      setSelectedAgent(null);
      setConnectionMessage('');

      // Refetch data to update UI
      await fetchSentRequests();

    } catch (error) {
      console.error('Error sending connection request:', error);
      appAlert(t('findAgent.failedToSendConnection'));
    } finally {
      setSending(false);
    }
  };

  const handleCancelConnection = () => {
    setShowConnectionModal(false);
    setSelectedAgent(null);
    setConnectionMessage('');
  };

  const handleCancelMessage = () => {
    setShowMessageModal(false);
    setSelectedAgent(null);
    setMessageText('');
  };

  const handleCancelRepresentation = async (agent) => {
    const agentId = agent.id;

    // Show confirmation dialog
    const confirmed = await appConfirm(
      t('findAgent.cancelRepresentationConfirm', { name: agent.name }),
      { danger: true }
    );

    if (!confirmed) return;

    setSending(true);
    try {
      console.log('[SearchAgentsModal] Cancelling representation with agent:', agentId);

      // Call API to cancel representation
      await apiService.cancelRepresentation({ agentId, currentProfileId: currentArtistId });

      console.log('[SearchAgentsModal] Representation cancelled successfully');

      // Remove this agent from the representing agents array
      setRepresentingAgents(prev => prev.filter(a => {
        const aId = a.agentId?.id || a.agentId || a.profileId;
        return String(aId) !== String(agentId);
      }));

      // Remove from acceptedRequestIds
      setAcceptedRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });

      // Refetch data to update UI
      await fetchSentRequests();
      await fetchAgents(searchQuery);

      appAlert(t('findAgent.representationCancelled'));

    } catch (error) {
      console.error('Error cancelling representation:', error);
      appAlert(t('findAgent.failedToCancelRepresentation'));
    } finally {
      setSending(false);
    }
  };

  const handleReviewClick = async (agent) => {
    try {
      const agentId = agent.id;
      // Fetch the full profile data to get the request details
      const data = await apiService.getProfileData(currentArtistId);

      // Find the request from this agent (either representation or connection)
      const request = (data.requests || []).find(req => {
        const fromId = req.from.id || req.from;
        return String(fromId) === String(agentId) &&
               (req.type === 'REPRESENTATION_REQUEST' || req.type === 'CONNECTION_REQUEST') &&
               req.status === 'PENDING';
      });

      if (request) {
        setReviewingRequest(request);
        setSelectedAgent(agent);
        setShowReviewModal(true);
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
    }
  };

  const handleAcceptRepresentation = async () => {
    if (!reviewingRequest || !selectedAgent) return;

    setSending(true);
    try {
      const requestId = reviewingRequest.id;
      const agentId = selectedAgent.id;

      // Accept the request (either representation or connection)
      await apiService.acceptRequest(requestId);

      // Update local state based on request type
      if (reviewingRequest.type === 'CONNECTION_REQUEST') {
        // For connection requests, update connected state
        setConnectedIds(prev => new Set([...prev, agentId]));
      } else {
        // For representation requests, update accepted state
        setAcceptedRequestIds(prev => new Set([...prev, agentId]));
      }

      // Remove from received and sent request lists
      setReceivedRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
      setSentRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });

      // Close modal
      setShowReviewModal(false);
      setReviewingRequest(null);
      setSelectedAgent(null);

      // Refetch data to update UI
      await fetchSentRequests();

    } catch (error) {
      console.error('Error accepting request:', error);
      appAlert(t('findAgent.failedToAccept'));
    } finally {
      setSending(false);
    }
  };

  const handleDeclineRepresentation = async () => {
    if (!reviewingRequest || !selectedAgent) return;

    setSending(true);
    try {
      const requestId = reviewingRequest.id;

      // Decline the representation request
      await apiService.declineRequest(requestId);

      // Update local state
      const agentId = selectedAgent.id;
      setDeclinedRequestIds(prev => new Set([...prev, agentId]));
      setReceivedRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
      setSentRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });

      // Close modal
      setShowReviewModal(false);
      setReviewingRequest(null);
      setSelectedAgent(null);

      // Refetch data to update UI
      await fetchSentRequests();

    } catch (error) {
      console.error('Error declining representation request:', error);
      appAlert(t('findAgent.failedToDecline'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Main Search Screen */}
      <div className="screen active search-agents-screen">
        <div className="search-agents-header">
          <button className="back-btn" onClick={onClose}>
            <CloseIcon />
          </button>
          <h1>{t('findAgent.title')}</h1>
        </div>

        <div className="search-agents-content">
          {/* Representing Agents Section (shown at top) */}
          {representingAgents.length > 0 && (
            <div style={{
              marginBottom: '12px',
              padding: '8px 10px',
              backgroundColor: 'rgba(255, 51, 102, 0.05)',
              border: '1px solid rgba(255, 51, 102, 0.2)',
              borderRadius: '6px'
            }}>
              <div style={{
                fontSize: '9px',
                fontWeight: '600',
                color: '#FF3366',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {representingAgents.length === 1 ? t('findAgent.currentAgent') : t('findAgent.currentAgents')}
              </div>
              {representingAgents.map((agent, index) => (
                <div key={agent.agentId?.id || agent.agentId || agent.profileId || index} className="artist-item" style={{ marginBottom: index < representingAgents.length - 1 ? '8px' : '0', gap: '10px' }}>
                  <div
                    className="artist-info clickable"
                    onClick={() => {
                      const agentData = agent.agentId;
                      if (agentData) {
                        handleCardClick(agentData);
                      }
                    }}
                  >
                    <div className="artist-avatar">
                      {agent.agentId?.avatar ? (
                        <img src={agent.agentId.avatar} alt={agent.agentId.name || agent.name} />
                      ) : (
                        getInitial(agent.agentId?.name || agent.name || 'A')
                      )}
                    </div>
                    <div className="artist-details">
                      <h4>{agent.agentId?.name || agent.name}</h4>
                      <p className="artist-location">{agent.agentId?.location || agent.location}</p>
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      const agentData = agent.agentId;
                      if (agentData) {
                        handleCancelRepresentation(agentData);
                      }
                    }}
                  >
                    {t('findAgent.remove')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder={t('findAgent.searchPlaceholder')}
              value={searchQuery}
              onChange={handleSearchInputChange}
              className="search-input"
            />
            <button type="submit" className="btn btn-primary">
              {t('findAgent.search')}
            </button>
          </form>

          {/* Loading State */}
          {loading && (
            <LoadingGlobe label={t('findAgent.searchingAgents')} />
          )}

          {/* Prompt to search */}
          {!loading && !hasSearched && (
            <div className="flex flex-col items-center py-16 text-center">
              <span aria-hidden className="text-white/15 [&>svg]:w-9 [&>svg]:h-9 mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <p className="text-sm text-white/50 m-0">{t('findAgent.promptTitle')}</p>
              <p className="text-xs text-white/30 mt-1.5 m-0">{t('findAgent.promptSubtitle')}</p>
            </div>
          )}

          {/* Results */}
          {!loading && hasSearched && (
            <div className="artists-list">
              {agents.length === 0 ? (
                <div className="empty-state">
                  <p>{t('findAgent.noAgentsFound')}</p>
                  {searchQuery && (
                    <p className="empty-state-hint">{t('findAgent.tryDifferentSearch')}</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Info banner about connection requirement */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 mb-4 text-[11px] leading-relaxed text-white/45">
                    {t('findAgent.connectionRequirement')}
                  </div>

                  <div className="results-header">
                    <p>{agents.length === 1 ? t('findAgent.agentFound', { count: agents.length }) : t('findAgent.agentsFound', { count: agents.length })}</p>
                  </div>
                  {/* Filter out representing agents from search results (shown at top) */}
                  {(() => {
                    const representingAgentIds = new Set(
                      representingAgents.map(a => String(a.agentId?.id || a.agentId || a.profileId)).filter(Boolean)
                    );
                    const filteredAgents = agents.filter(agent => {
                      return !representingAgentIds.has(String(agent.id));
                    });
                    return filteredAgents;
                  })().map((agent) => {
                    const agentId = agent.id;
                    const hasRequested = sentRequestIds.has(agentId);
                    const hasAccepted = acceptedRequestIds.has(agentId);
                    const wasDeclined = declinedRequestIds.has(agentId);
                    const isConnected = connectedIds.has(agentId);
                    const hasPendingConnection = pendingConnectionIds.has(agentId);
                    const hasReceivedRequest = receivedRequestIds.has(agentId);

                    // Simplified button logic: always show Send Request (greyed out if not connected)
                    let buttonText = t('findAgent.sendRequest');
                    let buttonClass = 'btn-primary';
                    let buttonDisabled = false;
                    let buttonAction = () => handleRequestClick(agent);

                    if (hasAccepted) {
                      buttonText = t('findAgent.representing');
                      buttonClass = 'btn-success';
                      buttonDisabled = true;
                      buttonAction = null;
                    } else if (wasDeclined) {
                      buttonText = t('findAgent.declined');
                      buttonClass = 'btn-secondary';
                      buttonDisabled = true;
                      buttonAction = null;
                    } else if (hasRequested) {
                      // Already sent representation request
                      buttonText = t('findAgent.pending');
                      buttonClass = 'btn-secondary';
                      buttonDisabled = true;
                      buttonAction = null;
                    } else if (!isConnected) {
                      // Not connected - grey out the button
                      buttonText = t('findAgent.sendRequest');
                      buttonClass = 'btn-disabled';
                      buttonDisabled = true;
                      buttonAction = null;
                    }

                    return (
                      <div key={agentId} className="artist-item">
                        <div
                          className="artist-info clickable"
                          onClick={() => handleCardClick(agent)}
                        >
                          <div
                            className="artist-avatar"
                            style={agent.avatar ? undefined : { background: 'linear-gradient(135deg, #34E3A0 0%, #00C875 100%)' }}
                          >
                            {agent.avatar ? (
                              <img src={agent.avatar} alt={agent.name} />
                            ) : (
                              getInitial(agent.name)
                            )}
                          </div>
                          <div className="artist-details">
                            <h4>{agent.name}</h4>
                            <p className="artist-location">{agent.location}</p>
                          </div>
                        </div>
                        <div className="agent-action-buttons">
                          {(hasAccepted || isConnected) && onOpenChat && (
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenChat(agent);
                              }}
                            >
                              {t('findAgent.message')}
                            </button>
                          )}
                          <button
                            className={`btn btn-sm ${buttonClass}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!buttonDisabled && buttonAction) {
                                buttonAction();
                              }
                            }}
                            disabled={buttonDisabled}
                          >
                            {buttonText}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile View Screen - rendered on top */}
      {viewingProfile && (
        <ViewProfileScreen
          profileId={viewingProfile}
          onClose={() => setViewingProfile(null)}
        />
      )}

      {/* Connection Modal - rendered on top of everything */}
      {showConnectionModal && selectedAgent && (
        <div className="modal-overlay" onClick={handleCancelConnection}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('findAgent.connectWith', { name: selectedAgent.name })}</h2>
              <button className="close-btn" onClick={handleCancelConnection}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                {t('findAgent.sendConnectionRequestTo')} <strong>{selectedAgent.name}</strong>
              </p>

              <div className="form-group">
                <label>{t('findAgent.messageOptional')}</label>
                <textarea
                  value={connectionMessage}
                  onChange={(e) => setConnectionMessage(e.target.value)}
                  placeholder={t('findAgent.connectionPlaceholder')}
                  rows={5}
                  className="form-control"
                  maxLength={500}
                />
                <small className="character-count">{connectionMessage.length}/500</small>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={handleCancelConnection}
                disabled={sending}
              >
                {t('findAgent.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSendConnection}
                disabled={sending}
              >
                {sending ? t('findAgent.sending') : t('findAgent.connect')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal - rendered on top of everything */}
      {showMessageModal && selectedAgent && (
        <div className="modal-overlay" onClick={handleCancelMessage}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('findAgent.sendRepresentationRequest')}</h2>
              <button className="close-btn" onClick={handleCancelMessage}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                {t('findAgent.sendingRepRequestTo')} <strong>{selectedAgent.name}</strong>
              </p>

              <div className="form-group">
                <label>{t('findAgent.messageOptional')}</label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t('findAgent.messagePlaceholder')}
                  rows={5}
                  className="form-control"
                  maxLength={500}
                />
                <small className="character-count">{messageText.length}/500</small>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={handleCancelMessage}
                disabled={sending}
              >
                {t('findAgent.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSendRequest}
                disabled={sending}
              >
                {sending ? t('findAgent.sending') : t('findAgent.sendRequest')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Representation Request Modal */}
      {showReviewModal && selectedAgent && reviewingRequest && (
        <div className="modal-overlay" onClick={() => {
          setShowReviewModal(false);
          setSelectedAgent(null);
          setReviewingRequest(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {reviewingRequest.type === 'CONNECTION_REQUEST'
                  ? t('findAgent.connectionRequestFrom', { name: selectedAgent.name })
                  : t('findAgent.representationRequestFrom', { name: selectedAgent.name })}
              </h2>
              <button className="close-btn" onClick={() => {
                setShowReviewModal(false);
                setSelectedAgent(null);
                setReviewingRequest(null);
              }}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <div className="review-modal-profile">
                <div className="artist-avatar">
                  {selectedAgent.avatar ? (
                    <img src={selectedAgent.avatar} alt={selectedAgent.name} />
                  ) : (
                    getInitial(selectedAgent.name)
                  )}
                </div>
                <div className="review-modal-info">
                  <h3>{selectedAgent.name}</h3>
                  <p className="artist-location">{selectedAgent.location}</p>
                  <span className={`role-badge ${selectedAgent.role.toLowerCase()}`}>
                    {selectedAgent.role}
                  </span>
                </div>
              </div>

              {reviewingRequest.message && reviewingRequest.message.trim() ? (
                <div className="review-modal-message">
                  <label>{t('findAgent.messageLabel')}</label>
                  <div className="message-content">{reviewingRequest.message}</div>
                </div>
              ) : (
                <div className="review-modal-message">
                  <p className="system-message-text">
                    {reviewingRequest.type === 'CONNECTION_REQUEST'
                      ? t('findAgent.wantsToConnect', { name: selectedAgent.name })
                      : t('findAgent.wantsToRepresentYou', { name: selectedAgent.name })}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={handleDeclineRepresentation}
                disabled={sending}
              >
                {sending ? t('findAgent.processing') : t('findAgent.decline')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAcceptRepresentation}
                disabled={sending}
              >
                {sending ? t('findAgent.processing') : t('findAgent.accept')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SearchAgentsModal;
