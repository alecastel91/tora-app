import React, { useState, useEffect } from 'react';
import { CloseIcon } from '../../utils/icons';
import apiService from '../../services/api';
import ViewProfileScreen from '../screens/ViewProfileScreen';
import LoadingGlobe from './LoadingGlobe';

const SearchArtistsModal = ({ onClose, onSelectArtist, currentAgentId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [artists, setArtists] = useState([]);
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
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [receivedRequestIds, setReceivedRequestIds] = useState(new Set());

  // Fetch sent requests on mount (but NOT the full artist list — search only)
  useEffect(() => {
    console.log('[SearchArtistsModal] Mounting - fetching request data for agent:', currentAgentId);
    fetchSentRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount

  const fetchSentRequests = async () => {
    try {
      const data = await apiService.getProfileData(currentAgentId);

      console.log('[SearchArtistsModal] Profile data received:', {
        agentId: currentAgentId,
        sentRequestsCount: data.sentRequests?.length,
        receivedRequestsCount: data.requests?.length,
        representingArtistsCount: data.profile?.representingArtists?.length
      });

      // Extract IDs of artists we've sent PENDING representation requests to
      const sentRequestedArtistIds = (data.sentRequests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'PENDING')
        .map(req => String(req.to.id || req.to));

      // Extract IDs of artists who sent us PENDING representation OR connection requests
      const receivedRepRequestArtistIds = (data.requests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'PENDING')
        .map(req => String(req.from.id || req.from));

      const receivedConnRequestArtistIds = (data.requests || [])
        .filter(req => req.type === 'CONNECTION_REQUEST' && req.status === 'PENDING')
        .map(req => String(req.from.id || req.from));

      const receivedRequestedArtistIds = [...receivedRepRequestArtistIds, ...receivedConnRequestArtistIds];

      // Extract IDs from representingArtists array (source of truth for accepted representations)
      const representedArtistIds = (data.profile?.representingArtists || [])
        .map(artist => String(artist.profileId));

      console.log('[SearchArtistsModal] representingArtists:', data.profile?.representingArtists);
      console.log('[SearchArtistsModal] representedArtistIds:', representedArtistIds);

      // Also check ACCEPTED requests for backward compatibility
      const acceptedRequestedArtistIds = (data.sentRequests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'ACCEPTED')
        .map(req => String(req.to.id || req.to));

      const acceptedReceivedArtistIds = (data.requests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'ACCEPTED')
        .map(req => String(req.from.id || req.from));

      // Combine both sent and received pending requests
      const allPendingRequestIds = [...sentRequestedArtistIds, ...receivedRequestedArtistIds];

      // Combine all accepted: from representingArtists array + ACCEPTED requests
      const allAcceptedRequestIds = [...representedArtistIds, ...acceptedRequestedArtistIds, ...acceptedReceivedArtistIds];

      console.log('[SearchArtistsModal] allAcceptedRequestIds:', allAcceptedRequestIds);

      setSentRequestIds(new Set(allPendingRequestIds));
      setAcceptedRequestIds(new Set(allAcceptedRequestIds));
      setReceivedRequestIds(new Set(receivedRequestedArtistIds)); // Track received requests separately

      // Extract IDs of artists who DECLINED our representation requests
      const declinedArtistIds = (data.sentRequests || [])
        .filter(req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'REJECTED')
        .map(req => String(req.to.id || req.to));
      setDeclinedRequestIds(new Set(declinedArtistIds));

      // Extract IDs of artists we're connected to
      // Use connectedProfileIds from backend (already processed)
      const connectedArtistIds = (data.connectedProfileIds || []).map(id => String(id));

      console.log('[SearchArtistsModal] Connection data:', {
        connectedProfileIdsCount: connectedArtistIds.length,
        connectedIds: connectedArtistIds
      });

      setConnectedIds(new Set(connectedArtistIds));

      // Extract IDs of artists with pending connection requests
      const pendingConnectionArtistIds = (data.sentRequests || [])
        .filter(req => req.type === 'CONNECTION_REQUEST' && req.status === 'PENDING')
        .map(req => String(req.to.id || req.to));
      setPendingConnectionIds(new Set(pendingConnectionArtistIds));

      console.log('[SearchArtistsModal] Final state:', {
        connectedCount: connectedArtistIds.length,
        pendingCount: pendingConnectionArtistIds.length,
        representationRequestsCount: allPendingRequestIds.length,
        acceptedRepresentationCount: allAcceptedRequestIds.length,
        representedArtistIds: representedArtistIds,
        acceptedRequestIds: [...acceptedRequestedArtistIds, ...acceptedReceivedArtistIds],
        allAcceptedIds: allAcceptedRequestIds
      });
    } catch (error) {
      console.error('[SearchArtistsModal] Error fetching sent requests:', error);
    }
  };

  const fetchArtists = async (query = '') => {
    setLoading(true);
    try {
      const params = {
        roles: 'ARTIST' // Only search for artists
      };

      if (query) {
        params.search = query;
      }

      const response = await apiService.searchProfiles(params);
      const profiles = response.profiles || response || [];

      // Filter out current agent's profile (just in case)
      const filteredArtists = (profiles || []).filter(profile => {
        const profileId = profile.id;
        return profileId !== currentAgentId;
      });

      setArtists(filteredArtists);
      setHasSearched(true);
    } catch (error) {
      console.error('Error fetching artists:', error);
      setArtists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchArtists(searchQuery);
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear results when input is cleared
    if (value.length === 0) {
      setArtists([]);
      setHasSearched(false);
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };

  const handleCardClick = (artist) => {
    console.log('[SearchArtistsModal] Card clicked, opening profile:', artist.id);
    setViewingProfile(artist);  // Pass full artist object
  };

  const handleConnectClick = (artist) => {
    // Show connection modal when user clicks "Connect"
    setSelectedArtist(artist);
    setConnectionMessage(''); // Reset message
    setShowConnectionModal(true);
  };

  const handleRequestClick = (artist) => {
    // Show message modal when user clicks "Send Request"
    setSelectedArtist(artist);
    setMessageText(''); // Reset message
    setShowMessageModal(true);
  };

  const handleSendRequest = async () => {
    if (!selectedArtist) return;

    setSending(true);
    try {
      const artistId = selectedArtist.id;

      // Call the parent's onSelectArtist function with the artist and message
      await onSelectArtist(selectedArtist, messageText);

      // Update local state to show "Requested" immediately
      setSentRequestIds(prev => new Set([...prev, artistId]));

      // Close the message modal
      setShowMessageModal(false);
      setSelectedArtist(null);
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
    if (!selectedArtist) return;

    setSending(true);
    try {
      const artistId = selectedArtist.id;

      // Send connection request (from currentAgentId to artistId)
      await apiService.sendConnectionRequest(currentAgentId, artistId, connectionMessage);

      // Update local state to show "Requested" immediately
      setPendingConnectionIds(prev => new Set([...prev, artistId]));

      // Close the connection modal
      setShowConnectionModal(false);
      setSelectedArtist(null);
      setConnectionMessage('');

      // Refetch data to update UI
      await fetchSentRequests();

    } catch (error) {
      console.error('Error sending connection request:', error);
      alert('Failed to send connection request');
    } finally {
      setSending(false);
    }
  };

  const handleCancelConnection = () => {
    setShowConnectionModal(false);
    setSelectedArtist(null);
    setConnectionMessage('');
  };

  const handleCancelMessage = () => {
    setShowMessageModal(false);
    setSelectedArtist(null);
    setMessageText('');
  };

  const handleReviewClick = async (artist) => {
    try {
      const artistId = String(artist.id);
      // Fetch the full profile data to get the request details
      const data = await apiService.getProfileData(currentAgentId);

      // Find the request from this artist (either representation or connection)
      const request = (data.requests || []).find(req => {
        const fromId = String(req.from.id || req.from);
        return fromId === artistId &&
               (req.type === 'REPRESENTATION_REQUEST' || req.type === 'CONNECTION_REQUEST') &&
               req.status === 'PENDING';
      });

      if (request) {
        setReviewingRequest(request);
        setSelectedArtist(artist);
        setShowReviewModal(true);
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
    }
  };

  const handleAcceptRepresentation = async () => {
    if (!reviewingRequest || !selectedArtist) return;

    setSending(true);
    try {
      const requestId = reviewingRequest.id;
      const artistId = String(selectedArtist.id);

      // Accept the request (either representation or connection)
      await apiService.acceptRequest(requestId);

      // Update local state based on request type
      if (reviewingRequest.type === 'CONNECTION_REQUEST') {
        // For connection requests, update connected state
        setConnectedIds(prev => new Set([...prev, artistId]));
      } else {
        // For representation requests, update accepted state
        setAcceptedRequestIds(prev => new Set([...prev, artistId]));
      }

      // Remove from received and sent request lists
      setReceivedRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(artistId);
        return newSet;
      });
      setSentRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(artistId);
        return newSet;
      });

      // Close modal
      setShowReviewModal(false);
      setReviewingRequest(null);
      setSelectedArtist(null);

      // Refetch data to update UI
      await fetchSentRequests();

    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request');
    } finally {
      setSending(false);
    }
  };

  const handleDeclineRepresentation = async () => {
    if (!reviewingRequest || !selectedArtist) return;

    setSending(true);
    try {
      const requestId = reviewingRequest.id;

      // Decline the representation request
      await apiService.declineRequest(requestId);

      // Update local state
      const artistId = String(selectedArtist.id);
      setDeclinedRequestIds(prev => new Set([...prev, artistId]));
      setReceivedRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(artistId);
        return newSet;
      });
      setSentRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(artistId);
        return newSet;
      });

      // Close modal
      setShowReviewModal(false);
      setReviewingRequest(null);
      setSelectedArtist(null);

      // Refetch data to update UI
      await fetchSentRequests();

    } catch (error) {
      console.error('Error declining representation request:', error);
      alert('Failed to decline representation request');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Main Search Modal */}
      <div className="screen active search-artists-screen">
        <div className="search-agents-header">
          <button className="back-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>FIND ARTIST</h1>
          <div style={{ width: '24px' }}></div>
        </div>

        <div className="search-agents-content">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              className="search-input"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>

          {/* Loading State */}
          {loading && (
            <LoadingGlobe label="Searching artists..." />
          )}

          {/* Prompt to search */}
          {!loading && !hasSearched && (
            <div className="empty-state">
              <p>Search for an artist by name</p>
            </div>
          )}

          {/* Results */}
          {!loading && hasSearched && (
            <div className="artists-list">
              {artists.length === 0 ? (
                <div className="empty-state">
                  <p>No artists found</p>
                  {searchQuery && (
                    <p className="empty-state-hint">Try a different search term</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Info banner about connection requirement */}
                  <div className="info-banner" style={{
                    padding: '12px 16px',
                    marginBottom: '16px',
                    backgroundColor: 'rgba(255, 51, 102, 0.1)',
                    border: '1px solid rgba(255, 51, 102, 0.3)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#ccc'
                  }}>
                    To send a representation request, you must be connected with the artist first.
                  </div>

                  <div className="results-header">
                    <p>{artists.length} artist{artists.length !== 1 ? 's' : ''} found</p>
                  </div>
                  {artists.map((artist) => {
                    const artistId = String(artist.id);
                    const hasRequested = sentRequestIds.has(artistId);
                    const hasAccepted = acceptedRequestIds.has(artistId);
                    const wasDeclined = declinedRequestIds.has(artistId);
                    const isConnected = connectedIds.has(artistId);

                    console.log('[SearchArtistsModal] Checking artist:', artist.name, artistId, 'hasAccepted:', hasAccepted, 'acceptedRequestIds:', [...acceptedRequestIds]);

                    // Simplified button logic: always show Send Request (greyed out if not connected)
                    let buttonText = 'Send Request';
                    let buttonClass = 'btn-primary';
                    let buttonDisabled = false;
                    let buttonAction = () => handleRequestClick(artist);

                    if (hasAccepted) {
                      buttonText = 'Represented';
                      buttonClass = 'btn-success';
                      buttonDisabled = true;
                      buttonAction = null;
                    } else if (wasDeclined) {
                      buttonText = 'Declined';
                      buttonClass = 'btn-secondary';
                      buttonDisabled = true;
                      buttonAction = null;
                    } else if (hasRequested) {
                      // Already sent representation request
                      buttonText = 'Pending';
                      buttonClass = 'btn-secondary';
                      buttonDisabled = true;
                      buttonAction = null;
                    } else if (!isConnected) {
                      // Not connected - grey out the button
                      buttonText = 'Send Request';
                      buttonClass = 'btn-disabled';
                      buttonDisabled = true;
                      buttonAction = null;
                    }

                    return (
                      <div key={artistId} className="artist-item">
                        <div
                          className="artist-info clickable"
                          onClick={() => handleCardClick(artist)}
                        >
                          <div className="artist-avatar">
                            {artist.avatar ? (
                              <img src={artist.avatar} alt={artist.name} />
                            ) : (
                              getInitial(artist.name)
                            )}
                          </div>
                          <div className="artist-details">
                            <h4>{artist.name}</h4>
                            <p className="artist-location">{artist.location}</p>
                          </div>
                        </div>
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
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile View Modal - rendered on top */}
      {viewingProfile && (
        <>
          {console.log('[SearchArtistsModal] Rendering ViewProfileScreen for:', viewingProfile.id)}
          <ViewProfileScreen
            profile={viewingProfile}
            onClose={() => setViewingProfile(null)}
          />
        </>
      )}

      {/* Connection Modal - rendered on top of everything */}
      {showConnectionModal && selectedArtist && (
        <div className="modal-overlay" onClick={handleCancelConnection}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Connect with {selectedArtist.name}</h2>
              <button className="close-btn" onClick={handleCancelConnection}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Send a connection request to <strong>{selectedArtist.name}</strong>
              </p>

              <div className="form-group">
                <label>Message (optional)</label>
                <textarea
                  value={connectionMessage}
                  onChange={(e) => setConnectionMessage(e.target.value)}
                  placeholder="Say hi and introduce yourself... (optional)"
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
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSendConnection}
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal - rendered on top of everything */}
      {showMessageModal && selectedArtist && (
        <div className="modal-overlay" onClick={handleCancelMessage}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Send Representation Request</h2>
              <button className="close-btn" onClick={handleCancelMessage}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Sending representation request to:<br /><strong>{selectedArtist.name}</strong>
              </p>

              <div className="form-group">
                <label>Message (optional)</label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Add a personal message to introduce yourself... (optional)"
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
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSendRequest}
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Representation Request Modal */}
      {showReviewModal && selectedArtist && reviewingRequest && (
        <div className="modal-overlay" onClick={() => {
          setShowReviewModal(false);
          setSelectedArtist(null);
          setReviewingRequest(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {reviewingRequest.type === 'CONNECTION_REQUEST' ? 'Connection Request' : 'Representation Request'} from {selectedArtist.name}
              </h2>
              <button className="close-btn" onClick={() => {
                setShowReviewModal(false);
                setSelectedArtist(null);
                setReviewingRequest(null);
              }}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <div className="review-modal-profile">
                <div className="artist-avatar">
                  {selectedArtist.avatar ? (
                    <img src={selectedArtist.avatar} alt={selectedArtist.name} />
                  ) : (
                    getInitial(selectedArtist.name)
                  )}
                </div>
                <div className="review-modal-info">
                  <h3>{selectedArtist.name}</h3>
                  <p className="artist-location">{selectedArtist.location}</p>
                  <span className={`role-badge ${selectedArtist.role.toLowerCase()}`}>
                    {selectedArtist.role}
                  </span>
                </div>
              </div>

              {reviewingRequest.message && reviewingRequest.message.trim() ? (
                <div className="review-modal-message">
                  <label>Message:</label>
                  <div className="message-content">{reviewingRequest.message}</div>
                </div>
              ) : (
                <div className="review-modal-message">
                  <p className="system-message-text">
                    {reviewingRequest.type === 'CONNECTION_REQUEST'
                      ? `${selectedArtist.name} wants to connect`
                      : `${selectedArtist.name} wants you to represent them`}
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
                {sending ? 'Processing...' : 'Decline'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAcceptRepresentation}
                disabled={sending}
              >
                {sending ? 'Processing...' : 'Accept'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SearchArtistsModal;
