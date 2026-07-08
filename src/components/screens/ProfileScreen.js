import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import Modal from '../common/Modal';
import RAEventsModal from '../common/RAEventsModal';
import { UploadIcon, SwitchIcon, AddIcon, TrashIcon, HandshakeIcon, EditIcon, ListIcon, SearchIcon, LocationIcon, GlobeIcon, LinkIcon } from '../../utils/icons';
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
import { downscaleImageToDataUrl } from '../../utils/image';

// --- Obsidian Neon redesign helpers (glassmorphism + crimson neon) ---
const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const InstagramGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" />
    <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
  </svg>
);

// Glassmorphic action tile (Edit Profile / Manage / Find Agent / Add Profile).
const ActionCard = ({ icon, label, onClick, dot }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03]
               px-3.5 py-3 min-h-[58px] text-left transition-colors hover:border-infrared/40 hover:bg-white/[0.05]"
  >
    <span className="shrink-0 text-infrared [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white font-tech leading-tight">{label}</span>
    {dot && (
      <span
        aria-label="Actions required"
        className="absolute top-3 right-3 w-2 h-2 rounded-full bg-infrared shadow-[0_0_6px_rgba(255,51,102,0.7)]"
      />
    )}
  </button>
);

// 1234 -> "1.2K" for the stats row.
const fmtStat = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : `${n ?? 0}`);

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
  // Action-required dots next to Manage CTAs. `ownHasActions` is true when
  // the active profile has at least one action item; `artistActionsMap`
  // is keyed by artist profile id for the agent's represented-artist cards.
  const [ownHasActions, setOwnHasActions] = useState(false);
  const [artistActionsMap, setArtistActionsMap] = useState({});
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

  // Action-required dots: fetch own + each represented artist in one
  // round-trip burst. Sequential awaiting would block on the rate limiter
  // for agents with many artists.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadActionFlags = async () => {
      const artists = user.role === 'AGENT' && Array.isArray(user.representingArtists)
        ? user.representingArtists.filter((a) => a.profileId || a.id)
        : [];
      const tasks = [
        apiService.getActionSummary(user.id).then((d) => ({ kind: 'own', d })).catch(() => ({ kind: 'own', d: null })),
        ...artists.map((a) => {
          const artistId = a.profileId || a.id;
          return apiService.getActionSummary(user.id, { artistProfileId: artistId })
            .then((d) => ({ kind: 'artist', artistId, d }))
            .catch(() => ({ kind: 'artist', artistId, d: null }));
        }),
      ];
      const results = await Promise.all(tasks);
      if (cancelled) return;
      const map = {};
      let own = false;
      for (const r of results) {
        const has = Array.isArray(r.d?.items) && r.d.items.length > 0;
        if (r.kind === 'own') own = has;
        else map[r.artistId] = has;
      }
      setOwnHasActions(own);
      setArtistActionsMap(map);
    };
    loadActionFlags();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.representingArtists?.length]);

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
    if (!file || !user?.id) return;
    try {
      // Downscale on-device before upload (backend re-normalizes to 512px
      // webp and stores it in object storage — the profile keeps a URL).
      const avatarData = await downscaleImageToDataUrl(file);
      const updatedProfile = await apiService.updateProfile(user.id, { avatar: avatarData });
      updateUser(updatedProfile);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert(error.message || 'Failed to upload image. Please try again.');
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };

  // Role accent classes drawn from the shared design tokens (--color-role-*).
  // Outline-pill style per the reference (ARTIST = ethereal violet).
  const roleBadgeClasses = {
    ARTIST: 'text-role-artist border-role-artist/60',
    VENUE: 'text-role-venue border-role-venue/60',
    PROMOTER: 'text-role-promoter border-role-promoter/60',
    AGENT: 'text-role-agent border-role-agent/60',
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

  // Bloom behind the avatar takes the profile's canonical role color.
  const roleBloomColor = {
    ARTIST: 'rgba(107, 95, 255, 0.18)',   // #6B5FFF
    VENUE: 'rgba(255, 87, 87, 0.16)',     // #FF5757
    PROMOTER: 'rgba(255, 184, 0, 0.13)',  // #FFB800
    AGENT: 'rgba(0, 200, 117, 0.13)',     // #00C875
  }[user?.role] || 'rgba(255, 255, 255, 0.08)';

  return (
    <div className="screen active px-5 pt-6 pb-5">
      {/* isolate wraps ONLY in-flow content so the -z-10 backdrop stays visible;
          modals live OUTSIDE it so they aren't trapped under the app header. */}
      <div className="relative isolate">
      {/* deep-space backdrop: role-colored bloom + faint engineering grid, fading out */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-5 -top-6 h-64 -z-10"
        style={{ background: `radial-gradient(60% 100% at 50% 0%, ${roleBloomColor}, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-5 -top-6 h-56 -z-10 bg-grid
                   [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
      />

      {/* ===== Header ===== */}
      <div className="text-center mb-6">
        <div className="relative w-28 h-28 mx-auto mb-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group block w-full h-full rounded-full overflow-hidden bg-near-black ring-1 ring-white/15
                       flex items-center justify-center
                       text-4xl font-bold text-white font-space-grotesk"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user?.name} className="w-full h-full object-cover" />
            ) : (
              getInitial(user?.name)
            )}
            <span className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transition-opacity duration-300
                             text-white [&>svg]:w-7 [&>svg]:h-7">
              <UploadIcon />
            </span>
          </button>
          <span className="pointer-events-none absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full
                           bg-[#232325] border border-white/15 flex items-center justify-center text-white/80
                           [&>svg]:w-3.5 [&>svg]:h-3.5">
            <UploadIcon />
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
        </div>

        <h2 className="text-3xl font-bold text-white font-space-grotesk tracking-[-0.02em] leading-none mb-2">
          {user?.name || t('profile.yourName')}
        </h2>
        <p className="flex items-center justify-center gap-1.5 text-[13px] text-white/60 mb-3 font-tech [&>svg]:w-3.5 [&>svg]:h-3.5">
          <LocationIcon />{user?.location || t('profile.addLocation')}
        </p>
        <div className={`inline-flex items-center px-3.5 py-1 rounded-full border text-[10px] font-semibold uppercase
                         tracking-[0.2em] font-tech ${roleBadgeClasses[user?.role] || 'text-white/70 border-white/20'}`}>
          {user?.role || 'ARTIST'}
        </div>

        {user?.genres && user.genres.length > 0 && (
          <div className="flex flex-col items-center mt-3">
            <div
              className={`flex flex-wrap gap-2 justify-center w-full overflow-hidden transition-[max-height] duration-300
                          ${showAllGenres ? 'max-h-[1000px]' : 'max-h-[64px]'}`}
            >
              {user.genres.map(genre => (
                <span
                  key={genre}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-white/60
                             text-[8px] font-medium uppercase tracking-[0.15em] font-tech"
                >
                  {genre}
                </span>
              ))}
            </div>
            {user.genres.length > 6 && (
              <button
                className="mt-2 px-2 py-1 text-infrared text-xs hover:opacity-80 hover:underline transition-opacity"
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
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 mb-6 text-left">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl shrink-0">⚠️</span>
                <div>
                  <strong className="block text-sm font-semibold text-amber-300">Your trial has expired</strong>
                  <p className="text-xs text-white/50 mt-0.5">Upgrade to Premium to keep access to all features</p>
                </div>
              </div>
              <button
                onClick={() => onOpenPremium && onOpenPremium()}
                className="shrink-0 px-4 py-2 rounded-lg bg-infrared text-white text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-infrared-dim transition-colors"
              >
                Upgrade Now
              </button>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 mb-6 text-left">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-2xl shrink-0">🎉</span>
              <div>
                <strong className="block text-sm font-semibold text-emerald-300">Premium Trial Active</strong>
                <p className="text-xs text-white/50 mt-0.5">
                  {trialInfo.days
                    ? `${trialInfo.days} ${trialInfo.days === 1 ? 'day' : 'days'} remaining`
                    : `${trialInfo.hours} ${trialInfo.hours === 1 ? 'hour' : 'hours'} remaining`}
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenPremium && onOpenPremium()}
              className="shrink-0 px-4 py-2 rounded-lg border border-white/15 text-white text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:border-infrared/50 hover:text-infrared transition-colors"
            >
              Upgrade
            </button>
          </div>
        );
      })()}

      <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-2.5 mb-5">
        <button type="button" onClick={() => setShowLikesList(true)} className="flex flex-col items-center gap-0.5 px-1 transition-transform hover:scale-[1.03]">
          <span className="text-lg font-bold text-white font-space-grotesk">{fmtStat(likedProfiles.size)}</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-tech">{t('profile.liked')}</span>
        </button>
        <button type="button" onClick={() => setShowLikersList(true)} className="flex flex-col items-center gap-0.5 px-1 transition-transform hover:scale-[1.03]">
          <span className="text-lg font-bold text-white font-space-grotesk">{fmtStat(likerProfilesList.length)}</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-tech">{t('profile.likes')}</span>
        </button>
        <button type="button" onClick={() => setShowConnectionsList(true)} className="flex flex-col items-center gap-0.5 px-1 transition-transform hover:scale-[1.03]">
          <span className="text-lg font-bold text-white font-space-grotesk">{fmtStat(connectedUsers.size)}</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-tech">{t('profile.connections')}</span>
        </button>
      </div>

      {/* ===== Actions (2x2 glass grid) ===== */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <ActionCard icon={<EditIcon />} label={t('profile.editProfile')} onClick={() => setShowEditProfile(true)} />
        {user?.role === 'AGENT' ? (
          <ActionCard icon={<ListIcon />} label="Represented Artists" onClick={() => setShowRepresentedArtists(true)} />
        ) : (
          <ActionCard icon={<GridIcon />} label="Manage" onClick={() => setShowManageProfile(true)} dot={ownHasActions} />
        )}
        {user?.role === 'ARTIST' && (
          <ActionCard icon={<SearchIcon />} label="Find Agent" onClick={() => setShowFindAgent(true)} />
        )}
        <ActionCard
          icon={userProfiles.length > 1 ? <SwitchIcon /> : <AddIcon />}
          label={userProfiles.length > 1 ? 'Switch Profile' : 'Add Profile'}
          onClick={() => setShowProfileSwitcher(true)}
        />
      </div>

      {/* Bio Section */}
      {user?.bio && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5 text-left">
          <p className="text-sm leading-relaxed text-white/70">{user.bio}</p>
        </div>
      )}

      {/* Agent Artists Representing Section */}
      {user?.role === 'AGENT' && (
        <div className="mb-8 text-left">
          <h3 className="text-lg font-bold text-white font-space-grotesk mb-4">Artists Representing</h3>
          <div className="flex flex-col gap-3">
            {user?.representingArtists && user.representingArtists.length > 0 ? user.representingArtists.map(artist => (
              <div
                key={artist.id}
                onClick={() => setViewingArtistProfile(artist.id)}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 cursor-pointer
                           hover:border-infrared/40 transition-colors"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-near-black ring-1 ring-white/10 shrink-0
                                flex items-center justify-center text-lg font-bold text-white font-space-grotesk">
                  {artist.avatar ? (
                    <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{artist.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">{artist.name}</h4>
                  <p className="text-xs text-white/50 truncate">{artist.location}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setManagingArtist(artist); }}
                  className="relative shrink-0 px-3 py-1.5 rounded-lg bg-infrared text-white text-xs font-semibold uppercase tracking-wider hover:bg-infrared-dim transition-colors"
                >
                  Manage
                  {artistActionsMap[artist.profileId || artist.id] && (
                    <span aria-label="Actions required" className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
                  )}
                </button>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <p className="text-sm text-white/50 mb-3">No artists added yet</p>
                <button onClick={() => setShowRepresentedArtists(true)} className="px-4 py-2 rounded-lg border border-white/15 text-white text-xs font-semibold uppercase tracking-wider hover:border-infrared/50 hover:text-infrared transition-colors">Add Artists</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Embedded Media Section */}
      <div className="flex flex-col gap-3 mb-6 text-left">
        {user?.mixtape && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h4 className="text-xs uppercase tracking-[0.15em] text-white/50 font-tech mb-3">Latest Mix</h4>
            {resolvedSoundCloudUrl ? (
              <iframe
                src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(resolvedSoundCloudUrl)}&color=%23ff3366&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`}
                frameBorder="0"
                className="w-full h-[320px] rounded-lg"
                title="SoundCloud Mix"
              />
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-center">
                <p className="text-sm text-white/70 mb-1">⚠️ Please use the full SoundCloud URL</p>
                <p className="text-xs text-white/40 mb-3">Example: https://soundcloud.com/artist/track-name</p>
                <button onClick={() => setShowEditProfile(true)} className="px-4 py-2 rounded-lg border border-white/15 text-white text-xs font-semibold uppercase tracking-wider hover:border-infrared/50 hover:text-infrared transition-colors">Update Link</button>
              </div>
            )}
          </div>
        )}

        {user?.spotify && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h4 className="text-xs uppercase tracking-[0.15em] text-white/50 font-tech mb-3">Spotify Artist</h4>
            {resolvedSpotifyId ? (
              <iframe
                src={`https://open.spotify.com/embed/artist/${resolvedSpotifyId}`}
                frameBorder="0"
                allowTransparency="true"
                allow="encrypted-media"
                className="w-full h-[380px] rounded-lg"
                title="Spotify Artist Profile"
              />
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-center">
                <p className="text-sm text-white/70 mb-1">⚠️ Please use the full Spotify URL</p>
                <p className="text-xs text-white/40 mb-3">Example: https://open.spotify.com/artist/XXXXX</p>
                <button onClick={() => setShowEditProfile(true)} className="px-4 py-2 rounded-lg border border-white/15 text-white text-xs font-semibold uppercase tracking-wider hover:border-infrared/50 hover:text-infrared transition-colors">Update Link</button>
              </div>
            )}
          </div>
        )}

        {user?.residentAdvisor && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h4 className="text-xs uppercase tracking-[0.15em] text-white/50 font-tech mb-3">Events</h4>
            <button
              onClick={() => setShowRAEvents(true)}
              className="w-full px-4 py-3 rounded-lg bg-infrared/10 border border-infrared/30 text-infrared text-sm font-semibold uppercase tracking-wider hover:bg-infrared/15 transition-colors mb-3"
            >
              View Upcoming Events
            </button>
            <a
              href={user.residentAdvisor.startsWith('http')
                ? user.residentAdvisor
                : `https://ra.co/dj/${user.residentAdvisor.toLowerCase().replace(/\s+\(([^)]+)\)/g, '-$1').replace(/\s+/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '')}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-white/50 hover:text-infrared transition-colors"
            >
              View Full RA Profile →
            </a>
          </div>
        )}
      </div>

      {/* ===== Links ===== */}
      <div className="mb-6 text-left">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-tech mb-2.5 px-1">Links</p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => user?.website && window.open(user.website, '_blank')}
            disabled={!user?.website}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left
                       transition-colors enabled:hover:border-infrared/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="w-9 h-9 rounded-full bg-infrared flex items-center justify-center shrink-0 text-white [&>svg]:w-4 [&>svg]:h-4">
              <GlobeIcon />
            </span>
            <span className="flex-1 text-sm font-medium text-white">Official Website</span>
            <span className="text-white/30 [&>svg]:w-4 [&>svg]:h-4"><ExternalLinkIcon /></span>
          </button>

          {user?.instagram && (
            <a
              href={`https://instagram.com/${user.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-infrared/40 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-infrared flex items-center justify-center shrink-0 text-white [&>svg]:w-4 [&>svg]:h-4">
                <InstagramGlyph />
              </span>
              <span className="flex-1 text-sm font-medium text-white">Instagram</span>
              <span className="text-white/30 [&>svg]:w-4 [&>svg]:h-4"><ExternalLinkIcon /></span>
            </a>
          )}

          {user?.linkedin && (
            <a
              href={user.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-infrared/40 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-infrared flex items-center justify-center shrink-0 text-white [&>svg]:w-4 [&>svg]:h-4">
                <LinkIcon />
              </span>
              <span className="flex-1 text-sm font-medium text-white">LinkedIn</span>
              <span className="text-white/30 [&>svg]:w-4 [&>svg]:h-4"><ExternalLinkIcon /></span>
            </a>
          )}
        </div>
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
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 text-xs text-role-agent/90 font-tech">
              <span className="inline-flex [&>svg]:w-4 [&>svg]:h-4"><HandshakeIcon /></span>
              Represented by {agentNames.join(', ')}
            </div>
          </div>
        );
      })()}
      </div>

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
        <div className="text-left">
          {userProfiles.length > 1 && (
            <p className="text-sm text-white/50 mb-4">
              Select which profile you want to manage:
            </p>
          )}
          <div className="flex flex-col gap-2.5">
            {userProfiles.map(profile => {
              const profileId = profile.id;
              const isActive = profileId === user?.id;
              const avatarClass = {
                ARTIST: 'avatar-artist', VENUE: 'avatar-venue',
                PROMOTER: 'avatar-promoter', AGENT: 'avatar-agent'
              }[profile.role] || 'avatar-artist';

              return (
                <div
                  key={profileId}
                  className={`rounded-2xl border p-3.5 cursor-pointer flex items-center gap-3 transition-colors
                              ${isActive
                                ? 'border-white/25 bg-black/40'
                                : 'border-white/10 bg-black/30 hover:bg-black/20'}`}
                  onClick={() => {
                    switchProfile(profileId);
                    setShowProfileSwitcher(false);
                  }}
                >
                  <div className={`message-avatar shrink-0 ${avatarClass}`}>
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} />
                    ) : (
                      profile.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
                    <h4 className="text-[15px] font-medium text-white truncate leading-none m-0">{profile.name}</h4>
                    <span className={`role-badge ${profile.role.toLowerCase()}`}>
                      {profile.role}
                    </span>
                    <p className="text-xs text-white/50 truncate leading-none m-0">{profile.location}</p>
                  </div>
                  {isActive && (
                    <svg className="shrink-0 text-infrared" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {!isActive && userProfiles.length > 1 && (
                    <button
                      className="shrink-0 p-2 rounded-lg text-white/35 hover:text-red-400 hover:bg-white/[0.06] transition-colors cursor-pointer bg-transparent border-none"
                      aria-label={`Delete ${profile.name}`}
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
              className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-3.5 cursor-pointer flex items-center gap-3
                         transition-colors hover:bg-black/30 hover:border-white/30"
              onClick={() => {
                setShowProfileSwitcher(false);
                setShowAddProfile(true);
              }}
            >
              <div className="w-[54px] h-[54px] shrink-0 rounded-full border border-dashed border-white/25 flex items-center justify-center text-white/60">
                <AddIcon />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[15px] font-medium text-white">Add New Profile</h4>
                <p className="text-xs text-white/50 mt-1">Create another professional profile</p>
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
          <div className="text-left">
            <p className="text-sm leading-relaxed text-white/70 m-0">
              Are you sure you want to delete the profile{' '}
              <span className="font-semibold text-white">{profileToDelete.name}</span>?
            </p>
            <p className="text-xs text-red-400/80 mt-2 mb-5">This action cannot be undone.</p>
            <div className="flex gap-2.5">
              <button
                className="btn btn-outline flex-1"
                onClick={() => setProfileToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger flex-1"
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