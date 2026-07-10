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
      // This screen never edits the avatar — don't echo it back. Avatar
      // uploads go through ProfileScreen, which sends only { avatar }.
      delete updatedProfile.avatar;

      const profileId = user.id;

      if (!profileId) {
        setError(t('editProfile.profileIdMissing'));
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
      setError(err.message || t('editProfile.saveFailed'));
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

  // Collapsed view keeps the first 12 PLUS anything already selected, so a
  // selection never disappears behind the "+ more" fold.
  const displayedGenres = showAllGenres
    ? genresList
    : genresList.filter((g, i) => i < 12 || selectedGenres.has(g));

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
          <h3>{t('editProfile.basicInformation')}</h3>
          
          <div className="form-group">
            <label>{t('editProfile.name')}</label>
            <input
              type="text"
              value={editedUser.name || ''}
              onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
              placeholder={t('editProfile.yourNamePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label>{t('editProfile.role')}</label>
            <select
              value={editedUser.role || ''}
              onChange={(e) => setEditedUser({ ...editedUser, role: e.target.value })}
            >
              <option value="ARTIST">{t('search.roleArtist')}</option>
              <option value="VENUE">{t('search.roleVenue')}</option>
              <option value="PROMOTER">{t('search.rolePromoter')}</option>
              <option value="AGENT">{t('search.roleAgent')}</option>
            </select>
          </div>

          {/* Cascading Location Dropdowns */}
          <div className="form-group">
            <label>{t('editProfile.zone')}</label>
            <select
              value={editedUser.zone || ''}
              onChange={(e) => handleZoneChange(e.target.value)}
            >
              <option value="">{t('editProfile.selectZone')}</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>

          {editedUser.zone && (
            <div className="form-group">
              <label>{t('editProfile.country')}</label>
              <select
                value={editedUser.country || ''}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="">{t('editProfile.selectCountry')}</option>
                {availableCountries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          )}

          {editedUser.country && (
            <div className="form-group">
              <label>{t('editProfile.city')}</label>
              <select
                value={editedUser.city || ''}
                onChange={(e) => handleCityChange(e.target.value)}
              >
                <option value="">{t('editProfile.selectCity')}</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          )}

          {showCustomCityInput && (
            <div className="form-group">
              <label>{t('editProfile.enterCityName')}</label>
              <input
                type="text"
                value={customCity}
                onChange={(e) => handleCustomCityChange(e.target.value)}
                placeholder={t('editProfile.enterCityPlaceholder')}
              />
            </div>
          )}

          {editedUser.role === 'VENUE' && (
            <div className="form-group">
              <label>{t('editProfile.venueCapacity')}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editedUser.venueCapacity || ''}
                onChange={(e) => setEditedUser({ ...editedUser, venueCapacity: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder={t('editProfile.maxCapacity')}
              />
            </div>
          )}

          {editedUser.role === 'AGENT' && (
            <div className="form-group">
              <label>{t('editProfile.agencyName')}</label>
              <input
                type="text"
                value={editedUser.agencyName || ''}
                onChange={(e) => setEditedUser({ ...editedUser, agencyName: e.target.value })}
                placeholder={t('editProfile.agencyNamePlaceholder')}
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '0' }}>
            <label>{t('profile.bio')}</label>
            <textarea
              value={editedUser.bio || ''}
              onChange={(e) => setEditedUser({ ...editedUser, bio: e.target.value })}
              placeholder={t('editProfile.bioPlaceholder')}
              rows="4"
            />
          </div>
        </div>

        {/* Genres Section */}
        <div className="edit-section" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label>{t('editProfile.genres')}</label>
            {/* Chip cloud: every genre is a tappable pill; selected = crimson. */}
            <div className="flex flex-wrap gap-2 mt-1">
              {displayedGenres.map(genre => {
                const on = selectedGenres.has(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => handleGenreToggle(genre)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium uppercase tracking-[0.12em]
                                font-tech cursor-pointer transition-colors ${
                      on
                        ? 'bg-infrared/[0.12] border-infrared/60 text-infrared'
                        : 'bg-white/[0.03] border-white/10 text-white/50 hover:border-white/25 hover:text-white/75'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
              {genresList.length > 12 && (
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-transparent text-[10px] font-medium uppercase
                             tracking-[0.12em] font-tech cursor-pointer text-infrared/80 hover:text-infrared
                             bg-transparent transition-colors"
                  onClick={() => setShowAllGenres(!showAllGenres)}
                >
                  {showAllGenres ? '− Show less' : `+ ${genresList.length - 12} more`}
                </button>
              )}
            </div>
            <p className="mt-2 mb-0 text-[10px] text-white/30">
              {selectedGenres.size > 0
                ? t('search.nSelected', { n: selectedGenres.size })
                : t('editProfile.tapGenres')}
            </p>
          </div>
        </div>

        {/* Social Links Section */}
        <div className="edit-section">
          <h3>{t('editProfile.socialLinks')}</h3>
          
          <div className="form-group">
            <label>{t('editProfile.soundcloudMixtape')}</label>
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
              {t('editProfile.shareLinkHint')}
            </p>
          </div>

          {editedUser.role === 'ARTIST' && (
            <div className="form-group">
              <label>{t('editProfile.spotifyArtist')}</label>
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
                {t('editProfile.shareLinkHint')}
              </p>
            </div>
          )}

          {editedUser.role === 'ARTIST' && (
            <div className="form-group">
              <label>{t('editProfile.residentAdvisorLabel')}</label>
              <input
                type="text"
                value={editedUser.residentAdvisor || ''}
                onChange={(e) => setEditedUser({ ...editedUser, residentAdvisor: e.target.value })}
                placeholder={t('editProfile.raArtistName')}
              />
            </div>
          )}

          <div className="form-group">
            <label>{t('editProfile.instagram')}</label>
            <input
              type="text"
              value={editedUser.instagram || ''}
              onChange={(e) => setEditedUser({ ...editedUser, instagram: e.target.value })}
              placeholder="@username"
            />
          </div>

          <div className="form-group">
            <label>{t('editProfile.website')}</label>
            <input
              type="url"
              value={editedUser.website || ''}
              onChange={(e) => setEditedUser({ ...editedUser, website: e.target.value })}
              placeholder="https://..."
            />
          </div>

          {editedUser.role === 'AGENT' && (
            <div className="form-group">
              <label>{t('editProfile.linkedin')}</label>
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
            {t('editProfile.cancel')}
          </button>
          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
            {saving ? t('editProfile.saving') : t('editProfile.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileScreen;