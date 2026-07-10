import React, { useState, useEffect } from 'react';
import { appAlert } from '../../utils/dialogs';
import { useAppContext } from '../../contexts/AppContext';
import { LinkIcon, HeartIcon, CloseIcon, HandshakeIcon, SlashCircleIcon, LocationIcon } from '../../utils/icons';
import ConnectionChoiceModal from '../common/ConnectionChoiceModal';
import apiService from '../../services/api';
import VerifiedBadge from '../common/VerifiedBadge';
import { useLanguage } from '../../contexts/LanguageContext';
import { roleLabel } from '../../utils/roles';
import { raProfileUrl } from '../../utils/urls';
import MakeOfferModal from '../common/MakeOfferModal';

const ViewProfileScreen = ({ profile: passedProfile, onClose, onOpenChat, onNavigateToMessages, onOpenPremium }) => {
  const { t } = useLanguage();
  const { user: currentUser, likedProfiles, toggleLike, sentRequests, receivedRequests, sendConnectionRequest, connectedUsers, removeConnection } = useAppContext();
  // Callers pass whatever row object they have (search result, conversation
  // partner, roster entry) — those are list projections and may lack detail
  // fields like bio. Enrich with the full profile; the passed object renders
  // immediately as the fallback.
  const [fullProfile, setFullProfile] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setFullProfile(null);
    if (!passedProfile?.id) return undefined;
    apiService.getProfile(passedProfile.id, currentUser?.id)
      .then((data) => { if (!cancelled) setFullProfile(data.profile || data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [passedProfile?.id, currentUser?.id]);
  const profile = fullProfile ? { ...passedProfile, ...fullProfile } : passedProfile;

  // Active tours for artist profiles (Tour Kickstart entry point, roadmap 6a)
  const [artistTours, setArtistTours] = useState([]);
  const [showTourOffer, setShowTourOffer] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setArtistTours([]);
    if (!passedProfile?.id) return undefined;
    if ((passedProfile.role || fullProfile?.role) !== 'ARTIST') return undefined;
    apiService.getTours({ artistId: passedProfile.id })
      .then((data) => { if (!cancelled) setArtistTours(data.tours || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [passedProfile?.id, passedProfile?.role, fullProfile?.role]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [message, setMessage] = useState('');
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
      appAlert(t('search.connectionRequestSent', { name: targetName }));
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
      appAlert(t('search.failedToSendRequest'));
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
        appAlert(t('search.failedToLike'));
      }
    }
  };

  const handleSendMessage = async () => {
    if (actionBusy) return;
    if (!message.trim()) {
      appAlert(t('search.pleaseWriteMessage'));
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
      appAlert(t('search.failedToSendRequest'));
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
      appAlert(t('viewProfile.failedToRemove'));
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
      
      <div className="view-profile-content relative isolate">
        {/* role-colored bloom + faint grid behind the avatar (quiet-premium backdrop) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-5 -top-5 h-64 -z-10"
          style={{
            background: `radial-gradient(60% 100% at 50% 0%, ${
              {
                ARTIST: 'rgba(107, 95, 255, 0.18)',
                VENUE: 'rgba(255, 87, 87, 0.16)',
                PROMOTER: 'rgba(255, 184, 0, 0.13)',
                AGENT: 'rgba(0, 200, 117, 0.13)',
              }[profile.role] || 'rgba(255, 255, 255, 0.08)'
            }, transparent 70%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-5 -top-5 h-56 -z-10 bg-grid
                     [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
        />
        <div className="profile-header">
          <div className="profile-avatar-container">
            <div className={`profile-avatar avatar-${(profile.role || 'artist').toLowerCase()}`}>
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} />
              ) : (
                getInitial(profile.name)
              )}
            </div>
          </div>
          
          <div className="profile-name-role-container">
            <h2 className="profile-name">
              {profile.name}
              {profile.verifyStatus === 'VERIFIED' && <VerifiedBadge size={18} className="ml-2" />}
            </h2>
          </div>
          <p className="profile-location"><LocationIcon />{profile.location}</p>
          <div className="profile-role-centered">
            <div className={getRoleBadgeClass(profile.role)}>
              {roleLabel(profile.role, t)}
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
        {(profile.followers || profile.connections || profile.venueCapacity
          || profile.gigsCompleted > 0 || profile.rosterSize > 0) && (
          <div className="profile-stats">
            {profile.followers && (
              <div className="stat-item">
                <span className="stat-value">{profile.followers.toLocaleString()}</span>
                <span className="stat-label">{t('profile.likes')}</span>
              </div>
            )}
            {profile.connections && (
              <div className="stat-item">
                <span className="stat-value">{profile.connections}</span>
                <span className="stat-label">{t('profile.connections')}</span>
              </div>
            )}
            {profile.role === 'ARTIST' && profile.gigsCompleted > 0 && (
              <div className="stat-item">
                <span className="stat-value">{profile.gigsCompleted}</span>
                <span className="stat-label">{t('viewProfile.gigs')}</span>
              </div>
            )}
            {profile.role === 'AGENT' && profile.rosterSize > 0 && (
              <div className="stat-item">
                <span className="stat-value">{profile.rosterSize}</span>
                <span className="stat-label">{t('roster.roster')}</span>
              </div>
            )}
            {profile.venueCapacity && (
              <div className="stat-item">
                <span className="stat-value">{profile.venueCapacity.toLocaleString()}</span>
                <span className="stat-label">{t('profile.capacity')}</span>
              </div>
            )}
          </div>
        )}

        {/* Member-since + mutual connections meta line */}
        {(profile.memberSince || profile.mutualConnections > 0) && (
          <p className="m-0 mt-2 mb-1 text-center text-[10px] uppercase tracking-[0.15em] text-white/35 font-tech">
            {profile.memberSince && t('viewProfile.memberSince', {
              date: new Date(profile.memberSince).toLocaleDateString(t('dateFormat.locale'), { month: 'short', year: 'numeric' }),
            })}
            {profile.memberSince && profile.mutualConnections > 0 && ' · '}
            {profile.mutualConnections > 0 && t('viewProfile.mutualConnections', { n: profile.mutualConnections })}
          </p>
        )}
        
        {/* Bio */}
        {profile.bio && (
          <div className="profile-bio">
            <p>{profile.bio}</p>
          </div>
        )}

        {/* Past highlights — artist-curated gigs (roadmap item 10) */}
        {profile.role === 'ARTIST' && Array.isArray(profile.pastHighlights) && profile.pastHighlights.length > 0 && (
          <div className="px-5 mb-5 text-left">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-tech mb-2.5">{t('viewProfile.pastHighlights')}</p>
            <div className="flex flex-col gap-2">
              {profile.pastHighlights.map((h, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-infrared shrink-0" />
                  <span className="flex-1 text-sm text-white truncate">{h.venue}{h.city ? <span className="text-white/40"> · {h.city}</span> : null}</span>
                  {h.year && <span className="text-[11px] text-white/40 font-tech shrink-0">{h.year}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active tours — promoters/venues can respond with an offer */}
        {profile.role === 'ARTIST' && artistTours.length > 0 && (
          <div className="px-5 mb-5 text-left">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-tech mb-2.5">{t('viewProfile.activeTours')}</p>
            <div className="flex flex-col gap-2">
              {artistTours.map((tour) => (
                <div key={tour.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-medium text-white truncate">
                        {t('tour.tourTitle', { location: tour.country || tour.zone })}
                      </p>
                      <p className="m-0 mt-1 text-[10px] uppercase tracking-[0.15em] text-white/40 font-tech">
                        {new Date(tour.startDate).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric' })}
                        {' — '}
                        {new Date(tour.endDate).toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric', year: 'numeric' })}
                        {(tour.feeExpectation || tour.priceOnRequest)
                          ? ` · ${tour.priceOnRequest ? t('tour.priceOnRequest') : tour.feeExpectation}`
                          : ''}
                      </p>
                    </div>
                    {(currentUser?.role === 'PROMOTER' || currentUser?.role === 'VENUE') && (
                      <button
                        type="button"
                        className="btn btn-primary btn-small shrink-0"
                        onClick={() => setShowTourOffer(true)}
                      >
                        {t('tour.makeAnOffer')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Embedded Media Section */}
        <div className="profile-embeds">
          {profile.mixtape && (
            <div className="embed-card">
              <h4>{t('viewProfile.latestMix')}</h4>
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
                title={t('manageArtist.soundcloudMix')}
                allow="autoplay"
              />
            </div>
          )}
          
          {profile.spotify && (
            <div className="embed-card">
              <h4>{t('viewProfile.spotifyArtist')}</h4>
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
                title={t('manageArtist.spotifyArtistProfile')}
              />
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
          {profile.residentAdvisor && (
            <a
              href={raProfileUrl(profile.residentAdvisor)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-social"
            >
              <span>RA</span>
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
        
        {/* Sender-side alert: counterparty hasn't verified yet */}
        {fullProfile && fullProfile.verifyStatus !== 'VERIFIED' && (
          <p className="mx-4 mb-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.03] text-xs leading-relaxed text-white/50 text-center">
            {t('viewProfile.unverifiedNotice')}
          </p>
        )}

        {/* Action Buttons */}
        <div className="profile-actions-bottom">
          <button
            className={`btn ${isLiked ? 'btn-primary' : 'btn-outline'} btn-full-width`}
            onClick={handleLike}
          >
            <HeartIcon filled={isLiked} /> {isLiked ? t('search.liked') : t('search.like')}
          </button>
          {isConnected ? (
            <button
              className="btn btn-message btn-full-width"
              onClick={handleMessage}
            >
              {t('search.message')}
            </button>
          ) : (
            <button
              className={`btn ${hasPendingRequest ? 'btn-disabled' : 'btn-primary'} btn-full-width`}
              onClick={handleConnect}
              disabled={hasPendingRequest || actionBusy}
            >
              {hasPendingRequest ? t('search.pending') : (actionBusy ? '...' : t('search.connect'))}
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
              {t('viewProfile.removeConnection')}
            </button>
          </div>
        )}
      </div>
        
      {/* Message Modal */}
        <MakeOfferModal
        isOpen={showTourOffer}
        onClose={() => setShowTourOffer(false)}
        recipientProfile={profile}
        onSuccess={() => {
          setShowTourOffer(false);
          onNavigateToMessages && onNavigateToMessages();
        }}
      />

      {showMessageModal && (
          <div className="message-modal-overlay" onClick={() => setShowMessageModal(false)}>
            <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
              <h2 className="message-modal-title">{t('search.sendMessageTo')} {profile.name}</h2>
              <textarea
                placeholder={t('messages.writeMessage')}
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
                  {t('editProfile.cancel')}
                </button>
                <button
                  className="btn btn-primary btn-modal-send"
                  onClick={handleSendMessage}
                  disabled={actionBusy}
                >
                  {actionBusy ? '...' : t('messages.send')}
                </button>
              </div>
            </div>
          </div>
        )}
          artistName={profile.name}
        />
      )}

      {/* Remove Connection Confirmation Modal */}
      {showRemoveModal && (
        <div className="message-modal-overlay" onClick={() => setShowRemoveModal(false)}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">{t('viewProfile.removeConnectionTitle')}</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '20px' }}>
              {t('viewProfile.removeConnectionBody', { name: profile.name })}
            </p>
            <div className="message-modal-actions">
              <button
                className="btn btn-outline btn-modal-cancel"
                onClick={() => setShowRemoveModal(false)}
              >
                {t('editProfile.cancel')}
              </button>
              <button
                className="btn btn-outline btn-remove-confirm"
                onClick={handleRemoveConnection}
                disabled={actionBusy}
              >
                {actionBusy ? '...' : t('viewProfile.remove')}
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
              <h3>{t('search.dailyLikeLimitReached')}</h3>
              <button className="modal-close" onClick={() => setShowLikeLimitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">{t('search.dailyLikeLimitMessage')}</p>
              </div>

              <div className="tier-info-box">
                <p className="tier-details">{t('search.currentPlan')} <strong>{likeLimitData.tier}</strong> • {t('search.likesPerDay', { n: likeLimitData.limit })}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowLikeLimitModal(false)}
              >
                {t('common.close')}
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
                {t('search.upgrade')}
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
              <h3>{t('search.monthlyConnectionLimitReached')}</h3>
              <button className="modal-close" onClick={() => setShowConnectionLimitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="limit-message-centered">
                <div className="limit-icon">
                  <SlashCircleIcon />
                </div>
                <p className="limit-main-text">{t('search.monthlyConnectionLimitMessage')}</p>
              </div>

              <div className="tier-info-box">
                <p className="tier-details">{t('search.currentPlan')} <strong>{connectionLimitData.tier}</strong> • {t('search.connectionsPerMonth', { n: connectionLimitData.limit })}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowConnectionLimitModal(false)}
              >
                {t('common.close')}
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
                {t('search.upgrade')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewProfileScreen;