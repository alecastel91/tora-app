import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { LinkIcon, HeartIcon, CloseIcon, HandshakeIcon, SlashCircleIcon } from '../../utils/icons';
import RAEventsModal from '../common/RAEventsModal';
import ConnectionChoiceModal from '../common/ConnectionChoiceModal';

const ViewProfileScreen = ({ profile, onClose, onOpenChat, onNavigateToMessages, onOpenPremium }) => {
  const { likedProfiles, toggleLike, sentRequests, receivedRequests, sendConnectionRequest, connectedUsers, removeConnection } = useAppContext();
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [message, setMessage] = useState('');
  const [showRAEvents, setShowRAEvents] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showConnectionChoice, setShowConnectionChoice] = useState(false);
  const [showLikeLimitModal, setShowLikeLimitModal] = useState(false);
  const [likeLimitData, setLikeLimitData] = useState(null);
  const [showConnectionLimitModal, setShowConnectionLimitModal] = useState(false);
  const [connectionLimitData, setConnectionLimitData] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  if (!profile) {
    return null;
  }

  const profileId = profile.id;

  const isLiked = likedProfiles.has(profileId);
  const isRequested = sentRequests.has(profileId);
  const hasReceivedRequest = receivedRequests.has(profileId);
  const isConnected = connectedUsers.has(profileId);
  const hasPendingRequest = isRequested || hasReceivedRequest;

  const handleConnect = () => {
    console.log('handleConnect called!');
    console.log('hasPendingRequest:', hasPendingRequest);

    if (!hasPendingRequest) {
      console.log('profile.representedBy:', profile.representedBy);

      // Check if profile has a valid representedBy agent (now an array)
      const representedByArray = Array.isArray(profile.representedBy)
        ? profile.representedBy
        : (profile.representedBy ? [profile.representedBy] : []);

      const hasValidAgent = representedByArray.some(a =>
        (a.name || a.agentName) && (a.agentId || a.profileId || a.id)
      );

      console.log('hasValidAgent:', hasValidAgent);

      // If profile has a valid representedBy agent, show choice modal
      // Otherwise show the old message modal
      if (hasValidAgent) {
        console.log('Opening connection choice modal');
        setShowConnectionChoice(true);
      } else {
        console.log('Opening message modal');
        setShowMessageModal(true);
      }
    }
  };

  const handleConnectionChoice = async (targetProfileId, type, artistContext = null, userMessage = '') => {
    if (actionBusy) return;
    console.log('handleConnectionChoice called:', { targetProfileId, type, artistContext, userMessage });

    setActionBusy(true);
    try {
      // Use the user's custom message
      console.log('Sending connection request...', { targetProfileId, message: userMessage });
      await sendConnectionRequest(targetProfileId, userMessage);
      console.log('Connection request sent successfully!');

      // Show success feedback
      let targetName = profile.name;
      if (type === 'AGENT' && artistContext) {
        const repArray = Array.isArray(artistContext.representedBy)
          ? artistContext.representedBy
          : (artistContext.representedBy ? [artistContext.representedBy] : []);
        targetName = repArray[0]?.name || repArray[0]?.agentName || 'Agent';
      }
      alert(`Connection request sent to ${targetName}!`);
    } catch (error) {
      console.error('Error sending connection request:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      // Check if this is a connection limit error (403)
      if (error.response?.status === 403 && error.response?.data?.error === 'CONNECTION_LIMIT_EXCEEDED') {
        const { limit, tier } = error.response.data;

        console.log('Connection limit reached! Opening modal with:', { limit, tier });

        // Show connection limit modal
        setConnectionLimitData({ limit, tier });
        setShowConnectionLimitModal(true);
        return;
      }

      // Only show alert for non-limit errors
      console.error('Connection request failed:', error);
      alert('Failed to send connection request. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMessage = () => {
    // Open chat and navigate to messages tab
    if (onOpenChat) {
      onOpenChat(profile);
    }
    if (onNavigateToMessages) {
      onNavigateToMessages();
    }
  };

  const handleLike = async () => {
    try {
      await toggleLike(profileId);
    } catch (error) {
      console.error('Error toggling like:', error);

      // Check if error is due to like limit
      if (error.response?.status === 403 && error.response?.data?.error === 'Daily like limit reached') {
        const { limit, tier } = error.response.data;

        // Show like limit modal
        setLikeLimitData({ limit, tier });
        setShowLikeLimitModal(true);
      } else {
        alert('Failed to like profile. Please try again.');
      }
    }
  };

  const handleSendMessage = async () => {
    if (actionBusy) return;
    if (!message.trim()) {
      alert('Please write a message to introduce yourself');
      return;
    }
    setActionBusy(true);
    try {
      await sendConnectionRequest(profileId, message.trim());
      setShowMessageModal(false);
      setMessage('');
    } catch (error) {
      console.error('Error sending connection request:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      // Check if this is a connection limit error (403)
      if (error.response?.status === 403 && error.response?.data?.error === 'CONNECTION_LIMIT_EXCEEDED') {
        const { limit, tier } = error.response.data;

        console.log('Connection limit reached! Opening modal with:', { limit, tier });

        // Close message modal first
        setShowMessageModal(false);
        setMessage('');

        // Show connection limit modal
        setConnectionLimitData({ limit, tier });
        setShowConnectionLimitModal(true);
        return;
      }

      // Only show alert for non-limit errors
      alert('Failed to send connection request. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRemoveConnection = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await removeConnection(profileId);
      setShowRemoveModal(false);

      // Close the profile screen
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error removing connection:', error);
      alert('Failed to remove connection');
    } finally {
      setActionBusy(false);
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };
  
  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      'ARTIST': 'role-badge',
      'VENUE': 'role-badge venue',
      'PROMOTER': 'role-badge promoter',
      'AGENT': 'role-badge agent'
    };
    return roleClasses[role] || 'role-badge';
  };
  
  return (
    <div className="screen active view-profile-screen">
      <div className="view-profile-header">
        <button className="back-btn" onClick={onClose}>
          <CloseIcon />
        </button>
        <div style={{ width: '24px' }}></div>
      </div>
      
      <div className="view-profile-content">
        <div className="profile-header">
          <div className="profile-avatar-container">
            <div className="profile-avatar">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} />
              ) : (
                getInitial(profile.name)
              )}
            </div>
          </div>
          
          <div className="profile-name-role-container">
            <h2 className="profile-name">{profile.name}</h2>
          </div>
          <p className="profile-location">{profile.location}</p>
          <div className="profile-role-centered">
            <div className={getRoleBadgeClass(profile.role)}>
              {profile.role}
            </div>
          </div>
          {profile.role === 'AGENT' && profile.agencyName && (
            <p className="profile-agency-name" style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', marginTop: '4px' }}>
              {profile.agencyName}
            </p>
          )}
          {profile.genres && profile.genres.length > 0 && (
            <div className="profile-genres-container">
              <div className="profile-genres">
                {profile.genres.map(genre => (
                  <span key={genre} className="genre-tag">{genre}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Stats */}
        {(profile.followers || profile.connections) && (
          <div className="profile-stats">
            {profile.followers && (
              <div className="stat-item">
                <span className="stat-value">{profile.followers.toLocaleString()}</span>
                <span className="stat-label">Likes</span>
              </div>
            )}
            {profile.connections && (
              <div className="stat-item">
                <span className="stat-value">{profile.connections}</span>
                <span className="stat-label">Connections</span>
              </div>
            )}
            {profile.venueCapacity && (
              <div className="stat-item">
                <span className="stat-value">{profile.venueCapacity.toLocaleString()}</span>
                <span className="stat-label">Capacity</span>
              </div>
            )}
          </div>
        )}
        
        {/* Bio */}
        {profile.bio && (
          <div className="profile-bio">
            <p>{profile.bio}</p>
          </div>
        )}
        
        {/* Embedded Media Section */}
        <div className="profile-embeds">
          {profile.mixtape && (
            <div className="embed-card">
              <h4>Latest Mix</h4>
              <iframe
                src={(() => {
                  // Convert mobile SoundCloud URL to regular URL for embed
                  let soundcloudUrl = profile.mixtape;
                  if (soundcloudUrl.includes('m.soundcloud.com')) {
                    soundcloudUrl = soundcloudUrl.replace('m.soundcloud.com', 'soundcloud.com');
                  }
                  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(soundcloudUrl)}&color=%23ff3366&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
                })()}
                frameBorder="0"
                className="embed-iframe soundcloud-embed"
                title="SoundCloud Mix"
                allow="autoplay"
              />
            </div>
          )}
          
          {profile.spotify && (
            <div className="embed-card">
              <h4>Spotify Artist</h4>
              <iframe
                src={(() => {
                  // Extract artist ID from URL and convert to embed URL
                  const spotifyUrl = profile.spotify;
                  if (spotifyUrl.includes('/artist/')) {
                    const artistId = spotifyUrl.split('/artist/')[1]?.split('?')[0];
                    return `https://open.spotify.com/embed/artist/${artistId}`;
                  }
                  // If not a proper Spotify artist URL, return as-is
                  return spotifyUrl;
                })()}
                frameBorder="0"
                allowTransparency="true"
                allow="encrypted-media"
                className="embed-iframe spotify-embed"
                title="Spotify Artist Profile"
              />
            </div>
          )}
          
          {profile.residentAdvisor && (
            <div className="embed-card ra-card">
              <h4>Events</h4>
              <button 
                className="ra-events-button"
                onClick={() => setShowRAEvents(true)}
              >
                <span className="ra-icon">📅</span>
                <span>View Upcoming Events</span>
              </button>
              <a
                href={profile.residentAdvisor.startsWith('http')
                  ? profile.residentAdvisor
                  : `https://ra.co/dj/${profile.residentAdvisor.toLowerCase().replace(/\s+\(([^)]+)\)/g, '-$1').replace(/\s+/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="ra-profile-link"
              >
                View Full RA Profile →
              </a>
            </div>
          )}
        </div>

        {/* Social CTAs */}
        <div className="profile-social-ctas">
          {profile.instagram && (
            <a 
              href={`https://instagram.com/${profile.instagram.replace('@', '')}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-outline btn-social"
            >
              <span>Instagram</span>
            </a>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-social"
            >
              <span>Website</span>
            </a>
          )}
          {profile.linkedin && (
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-social"
            >
              <span>LinkedIn</span>
            </a>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="profile-actions-bottom">
          <button
            className={`btn ${isLiked ? 'btn-primary' : 'btn-outline'} btn-full-width`}
            onClick={handleLike}
          >
            <HeartIcon filled={isLiked} /> {isLiked ? 'Liked' : 'Like'}
          </button>
          {isConnected ? (
            <button
              className="btn btn-message btn-full-width"
              onClick={handleMessage}
            >
              Message
            </button>
          ) : (
            <button
              className={`btn ${hasPendingRequest ? 'btn-disabled' : 'btn-primary'} btn-full-width`}
              onClick={handleConnect}
              disabled={hasPendingRequest || actionBusy}
            >
              {hasPendingRequest ? 'Pending' : (actionBusy ? '...' : 'Connect')}
            </button>
          )}
        </div>

        {/* Represented By Badge */}
        {(() => {
          const repArray = Array.isArray(profile.representedBy)
            ? profile.representedBy
            : (profile.representedBy ? [profile.representedBy] : []);
          const agentNames = repArray
            .map(a => a.name || a.agentName)
            .filter(Boolean);
          if (agentNames.length === 0) return null;
          return (
            <div className="represented-by-container">
              <div className="represented-by-badge">
                <span className="represented-icon"><HandshakeIcon /></span>
                Represented by {agentNames.join(', ')}
              </div>
            </div>
          );
        })()}

        {/* Remove Connection Button (only shown if connected) */}
        {isConnected && (
          <div className="profile-remove-connection">
            <button
              className="btn btn-outline btn-remove-connection"
              onClick={() => setShowRemoveModal(true)}
            >
              Remove Connection
            </button>
          </div>
        )}
      </div>
        
      {/* Message Modal */}
        {showMessageModal && (
          <div className="message-modal-overlay" onClick={() => setShowMessageModal(false)}>
            <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
              <h2 className="message-modal-title">Send Message to {profile.name}</h2>
              <textarea
                placeholder="Write your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows="5"
                className="message-textarea-bottom"
              />
              <div className="message-modal-actions">
                <button 
                  className="btn btn-outline btn-modal-cancel"
                  onClick={() => setShowMessageModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-modal-send"
                  onClick={handleSendMessage}
                  disabled={actionBusy}
                >
                  {actionBusy ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}
        
      {/* RA Events Modal */}
      {showRAEvents && (
        <RAEventsModal
          isOpen={showRAEvents}
          onClose={() => setShowRAEvents(false)}
          artistName={profile.name}
        />
      )}

      {/* Remove Connection Confirmation Modal */}
      {showRemoveModal && (
        <div className="message-modal-overlay" onClick={() => setShowRemoveModal(false)}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">Remove Connection?</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '20px' }}>
              Are you sure you want to remove your connection with {profile.name}? You can always reconnect later.
            </p>
            <div className="message-modal-actions">
              <button
                className="btn btn-outline btn-modal-cancel"
                onClick={() => setShowRemoveModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-outline btn-remove-confirm"
                onClick={handleRemoveConnection}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Choice Modal */}
      {showConnectionChoice && (
        <ConnectionChoiceModal
          artist={profile}
          onClose={() => setShowConnectionChoice(false)}
          onConnect={handleConnectionChoice}
        />
      )}

      {/* Like Limit Modal */}
      {showLikeLimitModal && likeLimitData && (
        <div className="modal-overlay" onClick={() => setShowLikeLimitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Daily Like Limit Reached</h3>
              <button className="modal-close" onClick={() => setShowLikeLimitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">You've reached your daily limit. Upgrade to Premium for unlimited likes!</p>
              </div>

              <div className="tier-info-box">
                <p className="tier-details">Current plan: <strong>{likeLimitData.tier}</strong> • {likeLimitData.limit} likes per day</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowLikeLimitModal(false)}
              >
                Close
              </button>
              <button
                className="btn btn-upgrade"
                onClick={() => {
                  setShowLikeLimitModal(false);
                  if (onOpenPremium) {
                    onOpenPremium();
                  }
                }}
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Limit Modal */}
      {showConnectionLimitModal && connectionLimitData && (
        <div className="modal-overlay" onClick={() => setShowConnectionLimitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Monthly Connection Limit Reached</h3>
              <button className="modal-close" onClick={() => setShowConnectionLimitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">You've reached your monthly limit. Upgrade to Premium for unlimited connections!</p>
              </div>

              <div className="tier-info-box">
                <p className="tier-details">Current plan: <strong>{connectionLimitData.tier}</strong> • {connectionLimitData.limit} connections per month</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowConnectionLimitModal(false)}
              >
                Close
              </button>
              <button
                className="btn btn-upgrade"
                onClick={() => {
                  setShowConnectionLimitModal(false);
                  if (onOpenPremium) {
                    onOpenPremium();
                  }
                }}
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewProfileScreen;