import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { CloseIcon, AddIcon } from '../../utils/icons';
import ViewProfileScreen from './ViewProfileScreen';
import ManageArtistScreen from './ManageArtistScreen';
import SearchArtistsModal from '../common/SearchArtistsModal';
import { dummyProfiles } from '../../data/profiles';
import apiService from '../../services/api';

const RepresentedArtistsScreen = ({ onClose }) => {
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

  const handleRemoveArtist = async (artist) => {
    const artistId = artist.profileId || artist.id;
    const displayName = artist.name || 'this artist';
    if (!window.confirm(`Remove ${displayName} from your represented artists?`)) return;

    setRemovingArtistId(artistId);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/connections/cancel-representation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ artistId, currentProfileId: user?.id })
      });
      await reloadProfileData();
    } catch (error) {
      console.error('Error removing artist:', error);
      alert('Failed to remove artist. Please try again.');
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
        alert('Failed to load artist profile');
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
          <h1>Represented Artists</h1>
        </div>
        <div className="loading-state" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen active represented-artists-screen">
      <div className="represented-artists-header">
        <button className="back-btn" onClick={onClose}>
          <CloseIcon />
        </button>
        <h1>Represented Artists</h1>
        <button
          className="add-artist-btn"
          onClick={() => setShowSearchModal(true)}
        >
          <AddIcon />
        </button>
      </div>

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
                    View
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleManageArtist(artist)}
                  >
                    Manage
                  </button>
                  <button
                    className="btn btn-outline btn-sm btn-remove-artist"
                    onClick={() => handleRemoveArtist(artist)}
                    disabled={removingArtistId === (artist.profileId || artist.id)}
                  >
                    {removingArtistId === (artist.profileId || artist.id) ? '...' : '✕'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🎵</div>
            <h2>No Artists Yet</h2>
            <p>Start building your roster by adding artists you represent.</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowSearchModal(true)}
            >
              <AddIcon /> Add First Artist
            </button>
          </div>
        )}

        {showSearchModal && (
          <SearchArtistsModal
            key={Date.now()} // Force remount on each open to fetch fresh data
            onClose={() => setShowSearchModal(false)}
            onSelectArtist={handleSelectArtist}
            currentAgentId={user?.id}
          />
        )}

      </div>
    </div>
  );
};

export default RepresentedArtistsScreen;