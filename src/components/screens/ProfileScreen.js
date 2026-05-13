import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import RAEventsModal from '../common/RAEventsModal';
import { CalendarIcon, UploadIcon, SwitchIcon, AddIcon, TrashIcon, HandshakeIcon } from '../../utils/icons';
import CalendarScreen from './CalendarScreen';
import EditProfileScreen from './EditProfileScreen';
import RepresentedArtistsScreen from './RepresentedArtistsScreen';
import AddProfileScreen from './AddProfileScreen';
import ManageArtistScreen from './ManageArtistScreen';
import ManageProfileScreen from './ManageProfileScreen';
import ViewProfileScreen from './ViewProfileScreen';
import SearchAgentsModal from '../common/SearchAgentsModal';
import ChatScreen from './ChatScreen';
import apiService from '../../services/api';

const ProfileScreen = ({ onOpenPremium, accountUser, onSwitchTab }) => {
  const { user, updateUser, userProfiles, switchProfile, addProfile, deleteProfile, likedProfiles, likedProfilesData, connectedUsers, connectedUsersData, likerProfilesData } = useAppContext();
  const { t } = useLanguage();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showManageProfile, setShowManageProfile] = useState(false);
  const [showRepresentedArtists, setShowRepresentedArtists] = useState(false);
  const [showFindAgent, setShowFindAgent] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [showLikesList, setShowLikesList] = useState(false);
  const [showLikersList, setShowLikersList] = useState(false);
  const [showConnectionsList, setShowConnectionsList] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showRAEvents, setShowRAEvents] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null); // For artists: their agent
  const [viewingArtistProfile, setViewingArtistProfile] = useState(null);
  const [managingArtist, setManagingArtist] = useState(null);
  const fileInputRef = useRef(null);
  const [resolvedSoundCloudUrl, setResolvedSoundCloudUrl] = useState(null);
  const [resolvedSpotifyId, setResolvedSpotifyId] = useState(null);

  // Helper function to calculate trial days/hours remaining
  const getTrialTimeRemaining = () => {
    if (!user || user.subscriptionTier !== 'TRIAL' || !user.trialEndDate) {
      return null;
    }

    const now = new Date();
    const endDate = new Date(user.trialEndDate);
    const diffTime = endDate - now;

    if (diffTime <= 0) return { expired: true };

    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Show hours if less than 24h remaining, otherwise show days
    if (diffHours < 24) {
      return { hours: diffHours, days: null };
    } else {
      return { hours: null, days: diffDays };
    }
  };

  // Handle SoundCloud URLs
  React.useEffect(() => {
    if (user?.mixtape) {
      // Accept soundcloud.com or m.soundcloud.com URLs (not on.soundcloud.com short links)
      const isValidSoundCloud = (user.mixtape.includes('soundcloud.com/') || user.mixtape.includes('m.soundcloud.com/'))
        && !user.mixtape.includes('on.soundcloud.com');

      if (isValidSoundCloud) {
        // Convert m.soundcloud.com to soundcloud.com for embed
        const embedUrl = user.mixtape.replace('m.soundcloud.com', 'soundcloud.com');
        setResolvedSoundCloudUrl(embedUrl);
      } else {
        setResolvedSoundCloudUrl(null);
      }
    }
  }, [user?.mixtape]);

  // Handle Spotify URLs
  React.useEffect(() => {
    if (user?.spotify) {
      // Only accept full spotify.com URLs with /artist/
      if (user.spotify.includes('open.spotify.com') && user.spotify.includes('/artist/')) {
        const artistId = user.spotify.split('/artist/')[1]?.split('?')[0]?.split('/')[0];
        setResolvedSpotifyId(artistId);
      } else {
        setResolvedSpotifyId(null);
      }
    }
  }, [user?.spotify]);
  
  const [editForm] = useState({
    name: user?.name || 'Your Name',
    role: user?.role || 'ARTIST',
    bio: user?.bio || '',
    location: user?.location || 'Tokyo, Japan',
    city: user?.city || 'Tokyo',
    country: user?.country || 'Japan',
    genres: user?.genres || [],
    residentAdvisor: user?.residentAdvisor || '',
    mixtape: user?.mixtape || '',
    spotify: user?.spotify || '',
    instagram: user?.instagram || '',
    website: user?.website || '',
    spotifyTracks: user?.spotifyTracks || [],
    calendarVisible: user?.calendarVisible !== undefined ? user.calendarVisible : true
  });

  const [selectedGenres, setSelectedGenres] = useState(editForm.genres || []);

  // DEBUG: Log profile count
  useEffect(() => {
    console.log('🔍 [ProfileScreen] userProfiles count:', userProfiles?.length || 0);
    console.log('🔍 [ProfileScreen] userProfiles:', userProfiles);
  }, [userProfiles]);

  // Fetch representation status for artists
  useEffect(() => {
    const fetchRepresentationStatus = async () => {
      if (user?.role === 'ARTIST' && user?.id) {
        try {
          const data = await apiService.getProfileData(user.id);

          // Check if there's an accepted representation request where the artist received it
          const acceptedRepresentation = (data.requests || []).find(
            req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'ACCEPTED'
          );

          // Or check if there's an accepted sent request (artist requested agent)
          const acceptedSentRequest = (data.sentRequests || []).find(
            req => req.type === 'REPRESENTATION_REQUEST' && req.status === 'ACCEPTED'
          );

          if (acceptedRepresentation) {
            setAgentProfile(acceptedRepresentation.from);
          } else if (acceptedSentRequest) {
            setAgentProfile(acceptedSentRequest.to);
          } else {
            setAgentProfile(null);
          }
        } catch (error) {
          console.error('Error fetching representation status:', error);
          setAgentProfile(null);
        }
      }
    };

    fetchRepresentationStatus();
  }, [user]);

  // OPTIMIZED: Use cached profile data from AppContext instead of fetching
  const likedProfilesList = likedProfilesData || [];
  const likerProfilesList = likerProfilesData || [];
  const connectionsList = connectedUsersData || [];

  // No need to fetch - data is already loaded in AppContext
  useEffect(() => {
    // This effect is now just for debugging/logging if needed
    if (user?.id) {
      console.log('ProfileScreen: Using cached profile data');
      console.log('Liked profiles:', likedProfilesList.length);
      console.log('Likers:', likerProfilesList.length);
      console.log('Connections:', connectionsList.length);
    }
  }, [user?.id, likedProfilesList.length, likerProfilesList.length, connectionsList.length]);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const avatarData = reader.result;
          const profileId = user.id;

          if (!profileId) {
            console.error('Profile ID is missing');
            return;
          }

          // Save to backend immediately
          const updatedProfile = await apiService.updateProfile(profileId, {
            ...user,
            avatar: avatarData
          });

          // Update local state with response from backend
          updateUser(updatedProfile);
        } catch (error) {
          console.error('Failed to upload avatar:', error);
          alert('Failed to upload image. Please try again.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };

  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      'ARTIST': 'role-badge artist',
      'VENUE': 'role-badge venue',
      'PROMOTER': 'role-badge promoter',
      'AGENT': 'role-badge agent'
    };
    return roleClasses[role] || 'role-badge';
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;

    try {
      await deleteProfile(profileToDelete.id);
      setProfileToDelete(null);
      setShowProfileSwitcher(false);
    } catch (error) {
      console.error('Failed to delete profile:', error);
      alert(error.message || 'Failed to delete profile. Please try again.');
    }
  };

  const handleSelectAgent = async (agent, message = '') => {
    try {
      const artistProfileId = user.id;
      const agentProfileId = agent.id;

      await apiService.sendRepresentationRequest(
        artistProfileId,
        agentProfileId,
        message
      );

      // Request sent successfully
      // The button will update automatically via state management in SearchAgentsModal
    } catch (error) {
      console.error('Error sending representation request:', error);
      throw error; // Re-throw so SearchAgentsModal can handle it
    }
  };

  // Show manage artist screen if selected
  if (managingArtist) {
    return (
      <ManageArtistScreen
        artist={managingArtist}
        onClose={() => setManagingArtist(null)}
        onSwitchTab={onSwitchTab}
      />
    );
  }

  // Show viewing artist profile if selected
  if (viewingArtistProfile) {
    return (
      <ViewProfileScreen
        profileId={viewingArtistProfile}
        onClose={() => setViewingArtistProfile(null)}
      />
    );
  }

  // Show full-screen calendar if requested
  if (showCalendar) {
    return <CalendarScreen onClose={() => setShowCalendar(false)} />;
  }

  // Show full-screen manage profile if requested
  if (showManageProfile) {
    return <ManageProfileScreen onClose={() => setShowManageProfile(false)} onSwitchTab={onSwitchTab} />;
  }

  // Show full-screen represented artists if requested
  if (showRepresentedArtists) {
    return (
      <RepresentedArtistsScreen
        onClose={() => setShowRepresentedArtists(false)}
        onSwitchTab={onSwitchTab}
      />
    );
  }

  // Show full-screen edit profile if requested
  if (showEditProfile) {
    return <EditProfileScreen onClose={() => setShowEditProfile(false)} />;
  }

  // Show add profile screen if requested
  if (showAddProfile) {
    return (
      <AddProfileScreen
        onClose={() => setShowAddProfile(false)}
        onSuccess={(newProfile) => {
          // Switch to the new profile
          switchProfile(newProfile.id);
        }}
      />
    );
  }

  return (
    <div className="screen active profile-screen">
      <div className="profile-header">
        <div className="profile-avatar-container">
          <div 
            className="profile-avatar clickable"
            onClick={() => fileInputRef.current?.click()}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user?.name} />
            ) : (
              getInitial(user?.name)
            )}
            <div className="avatar-upload-overlay">
              <UploadIcon />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
        </div>
        
        <h2 className="profile-name">{user?.name || t('profile.yourName')}</h2>
        <p className="profile-location">{user?.location || t('profile.addLocation')}</p>
        <div className={getRoleBadgeClass(user?.role)}>
          {user?.role || 'ARTIST'}
        </div>
        {user?.genres && user.genres.length > 0 && (
          <div className="profile-genres-container">
            <div className={`profile-genres ${showAllGenres ? 'expanded' : 'collapsed'}`}>
              {user.genres.map(genre => (
                <span key={genre} className="genre-tag">{genre}</span>
              ))}
            </div>
            {user.genres.length > 6 && (
              <button
                className="see-more-btn"
                onClick={() => setShowAllGenres(!showAllGenres)}
              >
                {showAllGenres ? t('profile.seeLess') : t('profile.seeMore')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Trial Banner */}
      {(() => {
        const trialInfo = getTrialTimeRemaining();
        if (!trialInfo) return null;

        if (trialInfo.expired) {
          return (
            <div className="trial-banner trial-expired">
              <div className="trial-banner-content">
                <span className="trial-icon">⚠️</span>
                <div className="trial-text">
                  <strong>Your trial has expired</strong>
                  <p>Upgrade to Premium to keep access to all features</p>
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onOpenPremium && onOpenPremium()}
              >
                Upgrade Now
              </button>
            </div>
          );
        }

        return (
          <div className="trial-banner trial-active">
            <div className="trial-banner-content">
              <span className="trial-icon">🎉</span>
              <div className="trial-text">
                <strong>Premium Trial Active</strong>
                <p>
                  {trialInfo.days
                    ? `${trialInfo.days} ${trialInfo.days === 1 ? 'day' : 'days'} remaining`
                    : `${trialInfo.hours} ${trialInfo.hours === 1 ? 'hour' : 'hours'} remaining`
                  }
                </p>
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => onOpenPremium && onOpenPremium()}
            >
              Upgrade
            </button>
          </div>
        );
      })()}

      <div className="profile-stats">
        <div className="stat-item" onClick={() => setShowLikesList(true)}>
          <span className="stat-value">{likedProfiles.size}</span>
          <span className="stat-label">{t('profile.liked')}</span>
        </div>
        <div className="stat-item" onClick={() => setShowLikersList(true)}>
          <span className="stat-value">{likerProfilesList.length}</span>
          <span className="stat-label">{t('profile.likes')}</span>
        </div>
        <div className="stat-item" onClick={() => setShowConnectionsList(true)}>
          <span className="stat-value">{connectedUsers.size}</span>
          <span className="stat-label">{t('profile.connections')}</span>
        </div>
      </div>


      <div className="profile-actions">
        <button 
          className="btn btn-primary btn-full-width"
          onClick={() => setShowEditProfile(true)}
        >
          {t('profile.editProfile')}
        </button>
        {user?.role === 'AGENT' ? (
          <button
            className="btn btn-outline btn-full-width"
            onClick={() => setShowRepresentedArtists(true)}
          >
            <AddIcon /> Represented Artists
          </button>
        ) : (
          <>
            <button
              className="btn btn-outline btn-full-width"
              onClick={() => setShowManageProfile(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Manage
            </button>
            {user?.role === 'ARTIST' && (
              <button
                className="btn btn-outline btn-full-width"
                onClick={() => setShowFindAgent(true)}
              >
                <AddIcon /> Find Agent
              </button>
            )}
          </>
        )}
        <button
          className="btn btn-secondary btn-full-width"
          onClick={() => setShowProfileSwitcher(true)}
        >
          {userProfiles.length > 1 ? (
            <><SwitchIcon /> Switch Profile</>
          ) : (
            <><AddIcon /> Add Profile</>
          )}
        </button>
      </div>

      {/* Bio Section */}
      {user?.bio && (
        <div className="profile-bio">
          <p>{user.bio}</p>
        </div>
      )}

      {/* Agent Artists Representing Section */}
      {user?.role === 'AGENT' && (
        <div className="agent-artists-section">
          <h3>Artists Representing</h3>
          <div className="agent-artists-grid">
            {user?.representingArtists && user.representingArtists.length > 0 ? user.representingArtists.map(artist => (
              <div
                key={artist.id}
                className="agent-artist-card"
                onClick={() => setViewingArtistProfile(artist.id)}
              >
                <div className="agent-artist-avatar">
                  {artist.avatar ? (
                    <img src={artist.avatar} alt={artist.name} />
                  ) : (
                    <span>{artist.name.charAt(0)}</span>
                  )}
                </div>
                <div className="agent-artist-info">
                  <h4>{artist.name}</h4>
                  <p>{artist.location}</p>
                </div>
                <div className="agent-artist-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setManagingArtist(artist);
                    }}
                  >
                    Manage
                  </button>
                </div>
              </div>
            )) : (
              <div className="no-artists-message">
                <p>No artists added yet</p>
                <button className="btn btn-outline" onClick={() => setShowRepresentedArtists(true)}>Add Artists</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Embedded Media Section */}
      <div className="profile-embeds">
        {user?.mixtape && (
          <div className="embed-card">
            <h4>Latest Mix</h4>
            {resolvedSoundCloudUrl ? (
              <iframe
                src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(resolvedSoundCloudUrl)}&color=%23ff3366&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`}
                frameBorder="0"
                className="embed-iframe soundcloud-embed"
                title="SoundCloud Mix"
              />
            ) : (
              <div className="embed-placeholder">
                <p style={{ marginBottom: '8px' }}>⚠️ Please use the full SoundCloud URL</p>
                <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '12px' }}>
                  Example: https://soundcloud.com/artist/track-name
                </p>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowEditProfile(true)}
                >
                  Update Link
                </button>
              </div>
            )}
          </div>
        )}

        {user?.spotify && (
          <div className="embed-card">
            <h4>Spotify Artist</h4>
            {resolvedSpotifyId ? (
              <iframe
                src={`https://open.spotify.com/embed/artist/${resolvedSpotifyId}`}
                frameBorder="0"
                allowTransparency="true"
                allow="encrypted-media"
                className="embed-iframe spotify-embed"
                title="Spotify Artist Profile"
              />
            ) : (
              <div className="embed-placeholder">
                <p style={{ marginBottom: '8px' }}>⚠️ Please use the full Spotify URL</p>
                <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '12px' }}>
                  Example: https://open.spotify.com/artist/XXXXX
                </p>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowEditProfile(true)}
                >
                  Update Link
                </button>
              </div>
            )}
          </div>
        )}
        
        {user?.residentAdvisor && (
          <div className="embed-card ra-card">
            <h4>Events</h4>
            <button
              className="ra-events-button"
              onClick={() => setShowRAEvents(true)}
            >
              <span>View Upcoming Events</span>
            </button>
            <a
              href={user.residentAdvisor.startsWith('http')
                ? user.residentAdvisor
                : `https://ra.co/dj/${user.residentAdvisor.toLowerCase().replace(/\s+\(([^)]+)\)/g, '-$1').replace(/\s+/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '')}`
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
        {user?.instagram && (
          <a
            href={`https://instagram.com/${user.instagram.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-social"
          >
            <span>Instagram</span>
          </a>
        )}
        <button
          className={`btn btn-outline btn-social ${!user?.website ? 'disabled' : ''}`}
          onClick={() => user?.website && window.open(user.website, '_blank')}
          disabled={!user?.website}
        >
          <span>Website</span>
        </button>
        {user?.linkedin && (
          <a
            href={user.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-social"
          >
            <span>LinkedIn</span>
          </a>
        )}
      </div>

      {/* Represented By Badge */}
      {(() => {
        const repArray = Array.isArray(user?.representedBy)
          ? user.representedBy
          : (user?.representedBy ? [user.representedBy] : []);
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

      {/* Likes List Modal */}
      <Modal
        isOpen={showLikesList}
        onClose={() => setShowLikesList(false)}
        title="Profiles You Liked"
      >
        <div className="profiles-list">
          {likedProfilesList.length > 0 ? (
            likedProfilesList.map(profile => (
              <div key={profile.id} className="profile-list-item">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} />
                ) : (
                  <div className="profile-avatar-placeholder">{profile.name.charAt(0)}</div>
                )}
                <div className="profile-info">
                  <h4>{profile.name}</h4>
                  <span className="profile-role">{profile.role}</span>
                  <span className="profile-location">{profile.location}</span>
                </div>
              </div>
            ))
          ) : (
            <p>No liked profiles yet</p>
          )}
        </div>
      </Modal>

      {/* Likers List Modal */}
      <Modal
        isOpen={showLikersList}
        onClose={() => setShowLikersList(false)}
        title="Profiles That Liked You"
      >
        <div className="profiles-list">
          {likerProfilesList.length > 0 ? (
            likerProfilesList.map(profile => (
              <div key={profile.id} className="profile-list-item">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} />
                ) : (
                  <div className="profile-avatar-placeholder">{profile.name.charAt(0)}</div>
                )}
                <div className="profile-info">
                  <h4>{profile.name}</h4>
                  <span className="profile-role">{profile.role}</span>
                  <span className="profile-location">{profile.location}</span>
                </div>
              </div>
            ))
          ) : (
            <p>No one has liked you yet</p>
          )}
        </div>
      </Modal>

      {/* Connections List Modal */}
      <Modal
        isOpen={showConnectionsList}
        onClose={() => setShowConnectionsList(false)}
        title={t('profile.connections')}
      >
        <div className="profiles-list">
          {connectionsList.length > 0 ? (
            connectionsList.map(profile => (
              <div key={profile.id} className="profile-list-item">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} />
                ) : (
                  <div className="profile-avatar-placeholder">{profile.name.charAt(0)}</div>
                )}
                <div className="profile-info">
                  <h4>{profile.name}</h4>
                  <span className="profile-role">{profile.role}</span>
                  <span className="profile-location">{profile.location}</span>
                </div>
              </div>
            ))
          ) : (
            <p>No connections yet</p>
          )}
        </div>
      </Modal>

      {/* Profile Switcher Modal */}
      <Modal
        isOpen={showProfileSwitcher}
        onClose={() => setShowProfileSwitcher(false)}
        title={userProfiles.length > 1 ? "Switch Profile" : "Add Profile"}
      >
        <div className="profile-switcher-content">
          {userProfiles.length > 1 && (
            <p className="profile-switcher-description">
              Select which profile you want to manage:
            </p>
          )}
          <div className="profile-switcher-list">
            {userProfiles.map(profile => {
              const profileId = profile.id;
              const currentUserId = user?.id;
              const isActive = profileId === currentUserId;

              return (
                <div
                  key={profileId}
                  className={`profile-switcher-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    switchProfile(profileId);
                    setShowProfileSwitcher(false);
                  }}
                >
                  <div className="switcher-avatar">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} />
                    ) : (
                      profile.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="switcher-info">
                    <h4>{profile.name}</h4>
                    <span className={`role-badge ${profile.role.toLowerCase()}`}>
                      {profile.role}
                    </span>
                    <p className="switcher-location">{profile.location}</p>
                  </div>
                  {isActive && (
                    <div className="active-indicator">✓</div>
                  )}
                  {!isActive && userProfiles.length > 1 && (
                    <button
                      className="delete-profile-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProfileToDelete(profile);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add Profile Button */}
            <div
              className="profile-switcher-item add-profile-item"
              onClick={() => {
                setShowProfileSwitcher(false);
                setShowAddProfile(true);
              }}
            >
              <div className="switcher-avatar add-avatar">
                <AddIcon />
              </div>
              <div className="switcher-info">
                <h4>Add New Profile</h4>
                <p className="add-profile-description">Create another professional profile</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* RA Events Modal */}
      <RAEventsModal
        isOpen={showRAEvents}
        onClose={() => setShowRAEvents(false)}
        artistName={user?.name}
        raUrl={user?.residentAdvisor}
      />

      {/* Delete Profile Confirmation Modal */}
      {profileToDelete && (
        <Modal
          isOpen={!!profileToDelete}
          onClose={() => setProfileToDelete(null)}
          title="Delete Profile"
        >
          <div className="delete-profile-confirmation">
            <p>Are you sure you want to delete the profile <strong>{profileToDelete.name}</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="confirmation-buttons">
              <button
                className="cancel-btn"
                onClick={() => setProfileToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="delete-btn"
                onClick={handleDeleteProfile}
              >
                Delete Profile
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Find Agent Modal for Artists */}
      {showFindAgent && (
        <SearchAgentsModal
          onClose={() => setShowFindAgent(false)}
          onSelectAgent={handleSelectAgent}
          currentArtistId={user?.id}
          onOpenChat={(agent) => {
            setShowFindAgent(false);
            setAgentProfile(agent);
            setShowAgentChat(true);
          }}
        />
      )}

      {/* Agent Chat Modal for Artists */}
      {showAgentChat && agentProfile && (
        <ChatScreen
          user={agentProfile}
          onClose={() => setShowAgentChat(false)}
        />
      )}
    </div>
  );
};

export default ProfileScreen;