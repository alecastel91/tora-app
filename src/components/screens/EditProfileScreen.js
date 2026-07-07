import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { genresList, zones, countriesByZone, citiesByCountry, getZoneFromCountry } from '../../data/profiles';
import { CloseIcon } from '../../utils/icons';
import apiService from '../../services/api';

const EditProfileScreen = ({ onClose }) => {
  const { user, updateUser } = useAppContext();
  const { t } = useLanguage();

  // Parse existing location
  const parseLocation = (location) => {
    if (!location) return { city: '', country: '', zone: '' };
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const city = parts[0];
      const country = parts[1];
      const zone = getZoneFromCountry(country) || '';
      return { city, country, zone };
    }
    return { city: '', country: '', zone: '' };
  };

  const initialLocation = parseLocation(user?.location);

  const [editedUser, setEditedUser] = useState({
    ...user,
    genres: user?.genres || [],
    city: initialLocation.city,
    country: initialLocation.country,
    zone: initialLocation.zone
  });
  const [selectedGenres, setSelectedGenres] = useState(new Set(user?.genres || []));
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showGenresDropdown, setShowGenresDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [customCity, setCustomCity] = useState('');
  const [showCustomCityInput, setShowCustomCityInput] = useState(false);

  // Cascading dropdown handlers
  const handleZoneChange = (zone) => {
    setEditedUser({
      ...editedUser,
      zone,
      country: '', // Reset country when zone changes
      city: ''     // Reset city when zone changes
    });
    setShowCustomCityInput(false);
    setCustomCity('');
  };

  const handleCountryChange = (country) => {
    setEditedUser({
      ...editedUser,
      country,
      city: '' // Reset city when country changes
    });
    setShowCustomCityInput(false);
    setCustomCity('');
  };

  const handleCityChange = (city) => {
    if (city === 'Other') {
      setShowCustomCityInput(true);
      setEditedUser({ ...editedUser, city: customCity });
    } else {
      setShowCustomCityInput(false);
      setCustomCity('');
      setEditedUser({ ...editedUser, city });
    }
  };

  const handleCustomCityChange = (value) => {
    setCustomCity(value);
    setEditedUser({ ...editedUser, city: value });
  };

  // Get available countries based on selected zone
  const availableCountries = editedUser.zone ? countriesByZone[editedUser.zone] || [] : [];

  // Get available cities based on selected country
  const availableCities = editedUser.country ? citiesByCountry[editedUser.country] || [] : [];

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Combine city and country into location string
      const location = editedUser.city && editedUser.country
        ? `${editedUser.city}, ${editedUser.country}`
        : editedUser.location || '';

      const updatedProfile = {
        ...editedUser,
        location, // Use combined location string
        genres: Array.from(selectedGenres)
      };

      // Remove zone, city, country from the payload as we only store location
      delete updatedProfile.zone;
      delete updatedProfile.city;
      delete updatedProfile.country;

      const profileId = user.id;

      if (!profileId) {
        setError('Profile ID is missing. Please log out and log back in.');
        setSaving(false);
        return;
      }

      // Save to backend
      const response = await apiService.updateProfile(profileId, updatedProfile);

      // Update local state with response from backend
      // SQL backend returns { message, profile }, so extract profile
      const updatedProfileData = response.profile || response;
      updateUser(updatedProfileData);

      onClose();
    } catch (err) {
      console.error('Failed to save profile:', err);
      console.error('Error details:', { message: err.message, stack: err.stack });
      setError(err.message || 'Failed to save profile. Please try again.');
      setSaving(false);
    }
  };

  const handleGenreToggle = (genre) => {
    const newGenres = new Set(selectedGenres);
    if (newGenres.has(genre)) {
      newGenres.delete(genre);
    } else {
      newGenres.add(genre);
    }
    setSelectedGenres(newGenres);
  };

  const displayedGenres = showAllGenres ? genresList : genresList.slice(0, 12);

  return (
    <div className="screen active edit-profile-screen">
      <div className="edit-profile-header">
        <button className="back-btn" onClick={onClose}>
          <CloseIcon />
        </button>
        <h1>{t('profile.editProfile')}</h1>
        <div style={{ width: '24px' }}></div>
      </div>

      <div className="edit-profile-content relative isolate">
        {/* faint engineering grid fading from the top (quiet-premium backdrop) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-5 -top-5 h-40 -z-10 bg-grid
                     [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
        />
        {/* Basic Info Section */}
        <div className="edit-section">
          <h3>Basic Information</h3>
          
          <div className="form-group">
            <label>{t('editProfile.name')}</label>
            <input
              type="text"
              value={editedUser.name || ''}
              onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
              placeholder="Your name"
            />
          </div>

          <div className="form-group">
            <label>{t('editProfile.role')}</label>
            <select
              value={editedUser.role || ''}
              onChange={(e) => setEditedUser({ ...editedUser, role: e.target.value })}
            >
              <option value="ARTIST">Artist</option>
              <option value="VENUE">Venue</option>
              <option value="PROMOTER">Promoter</option>
              <option value="AGENT">Agent</option>
            </select>
          </div>

          {/* Cascading Location Dropdowns */}
          <div className="form-group">
            <label>Zone</label>
            <select
              value={editedUser.zone || ''}
              onChange={(e) => handleZoneChange(e.target.value)}
            >
              <option value="">Select Zone</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>

          {editedUser.zone && (
            <div className="form-group">
              <label>Country</label>
              <select
                value={editedUser.country || ''}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="">Select Country</option>
                {availableCountries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}

          {editedUser.country && (
            <div className="form-group">
              <label>City</label>
              <select
                value={editedUser.city || ''}
                onChange={(e) => handleCityChange(e.target.value)}
              >
                <option value="">Select City</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}

          {showCustomCityInput && (
            <div className="form-group">
              <label>Enter City Name</label>
              <input
                type="text"
                value={customCity}
                onChange={(e) => handleCustomCityChange(e.target.value)}
                placeholder="Enter city name"
              />
            </div>
          )}

          {editedUser.role === 'VENUE' && (
            <div className="form-group">
              <label>Venue Capacity</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editedUser.venueCapacity || ''}
                onChange={(e) => setEditedUser({ ...editedUser, venueCapacity: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="Maximum capacity"
              />
            </div>
          )}

          {editedUser.role === 'AGENT' && (
            <div className="form-group">
              <label>Agency Name</label>
              <input
                type="text"
                value={editedUser.agencyName || ''}
                onChange={(e) => setEditedUser({ ...editedUser, agencyName: e.target.value })}
                placeholder="Your agency name"
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>{t('profile.bio')}</label>
            <textarea
              value={editedUser.bio || ''}
              onChange={(e) => setEditedUser({ ...editedUser, bio: e.target.value })}
              placeholder="Tell us about yourself..."
              rows="4"
            />
          </div>
        </div>

        {/* Genres Section */}
        <div className="edit-section" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label>Genres</label>
            <div 
              className="genres-dropdown-trigger"
              onClick={() => setShowGenresDropdown(!showGenresDropdown)}
            >
              <span className="genres-selected-text">
                {selectedGenres.size > 0 
                  ? `${selectedGenres.size} genre${selectedGenres.size > 1 ? 's' : ''} selected`
                  : 'Select genres'}
              </span>
              <span className="dropdown-arrow">{showGenresDropdown ? '▲' : '▼'}</span>
            </div>
            
            {showGenresDropdown && (
              <div className="genres-dropdown-content">
                <div className="genres-grid">
                  {displayedGenres.map(genre => (
                    <label key={genre} className="genre-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedGenres.has(genre)}
                        onChange={() => handleGenreToggle(genre)}
                      />
                      <span className={selectedGenres.has(genre) ? 'selected' : ''}>
                        {genre}
                      </span>
                    </label>
                  ))}
                </div>
                {genresList.length > 12 && (
                  <button
                    className="show-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllGenres(!showAllGenres);
                    }}
                  >
                    {showAllGenres ? 'Show less' : `Show all ${genresList.length} genres`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Social Links Section */}
        <div className="edit-section">
          <h3>Social Links</h3>
          
          <div className="form-group">
            <label>SoundCloud/Mixtape</label>
            <input
              type="url"
              value={editedUser.mixtape || ''}
              onChange={(e) => setEditedUser({ ...editedUser, mixtape: e.target.value })}
              placeholder="https://soundcloud.com/..."
            />
            <p style={{
              fontSize: '11px',
              color: '#888',
              marginTop: '4px',
              lineHeight: '1.4'
            }}>
              💡 If using a share link: Open it in your web browser, then copy the full URL from the address bar
            </p>
          </div>

          {editedUser.role === 'ARTIST' && (
            <div className="form-group">
              <label>Spotify Artist</label>
              <input
                type="url"
                value={editedUser.spotify || ''}
                onChange={(e) => setEditedUser({ ...editedUser, spotify: e.target.value })}
                placeholder="https://open.spotify.com/artist/..."
              />
              <p style={{
                fontSize: '11px',
                color: '#888',
                marginTop: '4px',
                lineHeight: '1.4'
              }}>
                💡 If using a share link: Open it in your web browser, then copy the full URL from the address bar
              </p>
            </div>
          )}

          {editedUser.role === 'ARTIST' && (
            <div className="form-group">
              <label>Resident Advisor</label>
              <input
                type="text"
                value={editedUser.residentAdvisor || ''}
                onChange={(e) => setEditedUser({ ...editedUser, residentAdvisor: e.target.value })}
                placeholder="RA artist name"
              />
            </div>
          )}

          <div className="form-group">
            <label>Instagram</label>
            <input
              type="text"
              value={editedUser.instagram || ''}
              onChange={(e) => setEditedUser({ ...editedUser, instagram: e.target.value })}
              placeholder="@username"
            />
          </div>

          <div className="form-group">
            <label>Website</label>
            <input
              type="url"
              value={editedUser.website || ''}
              onChange={(e) => setEditedUser({ ...editedUser, website: e.target.value })}
              placeholder="https://..."
            />
          </div>

          {editedUser.role === 'AGENT' && (
            <div className="form-group">
              <label>LinkedIn</label>
              <input
                type="url"
                value={editedUser.linkedin || ''}
                onChange={(e) => setEditedUser({ ...editedUser, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message" style={{
            color: '#ff3366',
            padding: '12px',
            background: 'rgba(255, 51, 102, 0.1)',
            borderRadius: '8px',
            marginTop: '16px'
          }}>
            {error}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '20px',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            border: '1px solid rgba(220, 53, 69, 0.3)',
            borderRadius: '8px',
            color: '#dc3545'
          }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="edit-actions">
          <button className="btn btn-secondary btn-full" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileScreen;