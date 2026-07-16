import React, { useState, useEffect } from 'react';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { useAppContext } from '../../contexts/AppContext';
import { CloseIcon, AddIcon, TrashIcon } from '../../utils/icons';
import ViewProfileScreen from './ViewProfileScreen';
import ManageArtistScreen from './ManageArtistScreen';
import SearchArtistsModal from '../common/SearchArtistsModal';
import AgentUpgradeModal from '../common/AgentUpgradeModal';
import { dummyProfiles } from '../../data/profiles';
import apiService from '../../services/api';
import { rosterUsage } from '../../utils/agentTiers';
import LoadingGlobe from '../common/LoadingGlobe';
import { useLanguage } from '../../contexts/LanguageContext';

const RepresentedArtistsScreen = ({ onClose, onSwitchTab }) => {
  const { t } = useLanguage();
  const { user, reloadProfileData } = useAppContext();
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [fullProfileData, setFullProfileData] = useState(null);
  const [managingArtist, setManagingArtist] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const representedArtists = user?.representingArtists || [];
  const [removingArtistId, setRemovingArtistId] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const usage = rosterUsage(user);
  // Pink dot on Manage CTA when the represented artist has pending action
  // items (same pattern as ProfileScreen — fetch per-artist in one burst).
  const [artistActionsMap, setArtistActionsMap] = useState({});

  useEffect(() => {
    if (!user?.id || user.role !== 'AGENT' || representedArtists.length === 0) return undefined;
    let cancelled = false;
    Promise.all(
      representedArtists.map((a) => {
        const artistId = a.profileId || a.id;
        return apiService.getActionSummary(user.id, { artistProfileId: artistId })
          .then((d) => ({ artistId, d }))
          .catch(() => ({ artistId, d: null }));
      })
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      for (const r of results) {
        map[r.artistId] = Array.isArray(r.d?.items) && r.d.items.length > 0;
      }
      setArtistActionsMap(map);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, representedArtists.length, refreshKey]);

  const handleRemoveArtist = async (artist) => {
    const artistId = artist.profileId || artist.id;
    const displayName = artist.name || 'this artist';
    if (!(await appConfirm(t('roster.removeConfirm', { name: displayName }), { danger: true }))) return;

    setRemovingArtistId(artistId);
    try {
      await apiService.cancelRepresentation({ artistId, currentProfileId: user?.id });
      await reloadProfileData();
    } catch (error) {
      console.error('Error removing artist:', error);
      appAlert(t('roster.failedToRemove'));
    } finally {
      setRemovingArtistId(null);
    }
  };

  const handleSelectArtist = async (artist, message = '') => {
    try {
      const agentProfileId = user.id;
      const artistProfileId = artist.id;

      await apiService.sendRepresentationRequest(
        agentProfileId,
        artistProfileId,
        message // Use the provided message (can be empty)
      );

      // Don't close the modal - let the user send multiple requests
      // The button will turn grey automatically via SearchArtistsModal's state update
    } catch (error) {
      console.error('Error sending representation request:', error);
      throw error; // Re-throw so SearchArtistsModal can handle it
    }
  };


  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'A';
  };

  const handleViewProfile = async (artist) => {
    // Fetch the full profile data from the API
    // Note: artist object from representingArtists has profileId field
    const artistId = artist.profileId || artist.id;
    if (artistId) {
      setLoading(true);
      try {
        const response = await apiService.getProfile(artistId);
        setFullProfileData(response);
        setViewingProfile(artistId);
      } catch (error) {
        console.error('Error fetching artist profile:', error);
        appAlert(t('roster.failedToLoadProfile'));
      } finally {
        setLoading(false);
      }
    }
  };

  // Reset full profile data when closing the profile view
  useEffect(() => {
    if (!viewingProfile) {
      setFullProfileData(null);
    }
  }, [viewingProfile]);

  const handleManageArtist = (artist) => {
    setManagingArtist(artist);
  };

  const handleCloseManage = async () => {
    setManagingArtist(null);
    // Reload profile data to get updated representingArtists array
    console.log('[RepresentedArtistsScreen] Reloading profile data after closing ManageArtistScreen');
    await reloadProfileData();
    setRefreshKey(prev => prev + 1); // Force re-render
  };

  // Show manage artist screen if selected
  if (managingArtist) {
    return (
      <ManageArtistScreen
        artist={managingArtist}
        onClose={handleCloseManage}
        onSwitchTab={onSwitchTab}
      />
    );
  }

  // Show viewing profile if selected and data is loaded
  if (viewingProfile && fullProfileData) {
    return (
      <ViewProfileScreen
        profile={fullProfileData}
        onClose={() => setViewingProfile(null)}
      />
    );
  }

  // Show loading state while fetching profile
  if (loading) {
    return (
      <div className="screen active represented-artists-screen">
        <div className="represented-artists-header">
          <button className="back-btn" onClick={onClose}>
            <CloseIcon />
          </button>
          <h1>{t('roster.title')}</h1>
        </div>
        <LoadingGlobe label={t('roster.loadingProfile')} className="h-[60vh]" />
      </div>
    );
  }

  return (
    <div className="screen active represented-artists-screen">
      <div className="represented-artists-header">
        <button className="back-btn" onClick={onClose}>
          <CloseIcon />
        </button>
        <h1>{t('roster.title')}</h1>
        <button
          className="add-artist-btn"
          onClick={() => usage.atLimit ? setShowUpgradeModal(true) : setShowSearchModal(true)}
          title={usage.atLimit ? t('roster.limitReachedTitle') : t('roster.addArtist')}
          style={usage.atLimit ? { opacity: 0.5 } : undefined}
        >
          <AddIcon />
        </button>
      </div>

      {usage.cap !== Infinity && (
        <div className={`flex items-center justify-between gap-3 mx-4 mt-4 mb-3 px-4 py-3 rounded-2xl border
                        ${usage.atLimit ? 'border-infrared/30 bg-infrared/[0.06]' : 'border-white/10 bg-[#0a0a0e]'}`}>
          <div className="min-w-0 flex items-baseline gap-2">
            <span className={`text-[9px] font-semibold uppercase tracking-[0.2em] font-tech
                             ${usage.atLimit ? 'text-infrared/70' : 'text-white/30'}`}>{t('roster.roster')}</span>
            <span className={`text-sm font-medium ${usage.atLimit ? 'text-infrared' : 'text-white'}`}>
              {usage.current}/{usage.cap}
              <span className={`font-normal ${usage.atLimit ? 'text-infrared/80' : 'text-white/50'}`}>
                {usage.atLimit && (usage.cap === 0
                  ? ' — ' + t('roster.pickPlanSuffix')
                  : ' — ' + t('roster.upgradeSuffix'))}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="btn btn-outline btn-sm shrink-0"
          >
            {usage.cap === 0 ? t('roster.choosePlan') : t('roster.upgrade')}
          </button>
        </div>
      )}

      <div className="represented-artists-content">
        {representedArtists.length > 0 ? (
          <div className="artists-list">
            {representedArtists.map((artist) => (
              <div key={artist.profileId || artist.id} className="artist-card-row">
                <div className="artist-avatar-small">
                  {artist.avatar ? (
                    <img src={artist.avatar} alt={artist.name} />
                  ) : (
                    getInitial(artist.name)
                  )}
                </div>
                <div className="artist-card-content">
                  <div className="artist-row-info">
                    <div className="artist-name-inline">{artist.name}</div>
                    <div className="artist-location-inline">{artist.location}</div>
                  </div>
                </div>
                <div className="artist-row-actions">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleViewProfile(artist)}
                  >
                    {t('roster.view')}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleManageArtist(artist)}
                    style={{ position: 'relative' }}
                  >
                    {t('roster.manage')}
                    {artistActionsMap[artist.profileId || artist.id] && (
                      <span
                        aria-label={t('manage.actionsRequired')}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '6px',
                          width: '7px',
                          height: '7px',
                          background: '#FF3366',
                          borderRadius: '50%',
                          boxShadow: '0 0 5px rgba(255, 51, 102, 0.7)',
                        }}
                      />
                    )}
                  </button>
                  <button
                    className="shrink-0 p-2 rounded-lg text-white/35 hover:text-red-400 hover:bg-[#15151b] transition-colors cursor-pointer bg-transparent border-none disabled:opacity-40"
                    aria-label={`Remove ${artist.name}`}
                    onClick={() => handleRemoveArtist(artist)}
                    disabled={removingArtistId === (artist.profileId || artist.id)}
                  >
                    {removingArtistId === (artist.profileId || artist.id) ? '...' : <TrashIcon />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="flex justify-center mb-4 text-white/25">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h2>{usage.cap === 0 ? t('roster.pickPlanToStart') : t('roster.noArtistsYet')}</h2>
            <p>
              {usage.cap === 0
                ? t('roster.agentPlansIntro')
                : t('roster.startBuilding')}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => usage.cap === 0 ? setShowUpgradeModal(true) : setShowSearchModal(true)}
            >
              {usage.cap === 0 ? t('roster.seePlans') : <><AddIcon /> {t('roster.addFirstArtist')}</>}
            </button>
          </div>
        )}

        {showSearchModal && (
          <SearchArtistsModal
            onClose={() => setShowSearchModal(false)}
            onSelectArtist={handleSelectArtist}
            currentAgentId={user?.id}
          />
        )}

      </div>

      <AgentUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={user?.agentTier || null}
      />
    </div>
  );
};

export default RepresentedArtistsScreen;