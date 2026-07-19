import React, { useState, useEffect } from 'react';
import { CURRENCY_OPTIONS } from './CurrencyOptions';
import ReactDOM from 'react-dom';
import { appAlert } from '../../utils/dialogs';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { zones, countriesByZone, citiesByCountry } from '../../data/profiles';
import { useLanguage } from '../../contexts/LanguageContext';

const MakeOfferModal = ({ isOpen, onClose, recipientProfile, onSuccess }) => {
  const { t } = useLanguage();

  const { user: currentUser } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [representedArtists, setRepresentedArtists] = useState([]);

  // Form state - simplified for Venue/Promoter initial offer
  const [formData, setFormData] = useState({
    eventName: '',
    venueName: '',
    zone: '',
    country: '',
    city: '',
    date: '',
    eventStartTime: '',
    eventEndTime: '',
    fee: '',
    currency: 'USD',
    performanceType: 'DJ Set',
    setStartTime: '',
    setEndTime: '',
    notes: '',
    selectedArtistId: '',
    selectedArtistName: '',
    // Extras
    includeTravelIn: false,
    travelInNote: '',
    includeTravelOut: false,
    travelOutNote: '',
    includeTransportation: false,
    transportationNote: '',
    includeAccommodation: false,
    accommodationNote: '',
    includeMeals: false,
    mealsNote: ''
  });

  // Fetch represented artists when modal opens and recipient is an agent
  useEffect(() => {
    const fetchRepresentedArtists = async () => {
      if (isOpen && recipientProfile && recipientProfile.role === 'AGENT') {
        try {
          // Fetch the full profile data to get representingArtists array
          const profileData = await apiService.getProfile(recipientProfile.id);
          setRepresentedArtists(profileData.representingArtists || []);
        } catch (error) {
          console.error('Error fetching represented artists:', error);
          setRepresentedArtists([]);
        }
      } else {
        setRepresentedArtists([]);
      }
    };

    fetchRepresentedArtists();
  }, [isOpen, recipientProfile]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArtistChange = (e) => {
    const selectedId = e.target.value;
    const selectedArtist = representedArtists.find(artist => artist.profileId === selectedId);
    setFormData(prev => ({
      ...prev,
      selectedArtistId: selectedId,
      selectedArtistName: selectedArtist ? selectedArtist.name : ''
    }));
  };

  // Cascading dropdown handlers for location
  const handleZoneChange = (zone) => {
    setFormData({
      ...formData,
      zone,
      country: '', // Reset country when zone changes
      city: ''     // Reset city when zone changes
    });
  };

  const handleCountryChange = (country) => {
    setFormData({
      ...formData,
      country,
      city: '' // Reset city when country changes
    });
  };

  const handleCityChange = (city) => {
    setFormData({ ...formData, city });
  };

  // Get available countries based on selected zone
  const availableCountries = formData.zone ? countriesByZone[formData.zone] || [] : [];

  // Get available cities based on selected country
  const availableCities = formData.country ? citiesByCountry[formData.country] || [] : [];

  // Calculate set duration in minutes based on start and end time
  const calculateSetDuration = () => {
    if (!formData.setStartTime || !formData.setEndTime) return 0;

    const [startHour, startMin] = formData.setStartTime.split(':').map(Number);
    const [endHour, endMin] = formData.setEndTime.split(':').map(Number);

    const startTotalMin = startHour * 60 + startMin;
    let endTotalMin = endHour * 60 + endMin;

    // Handle case where end time is past midnight
    if (endTotalMin < startTotalMin) {
      endTotalMin += 24 * 60;
    }

    return endTotalMin - startTotalMin;
  };

  const setDuration = calculateSetDuration();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (recipientProfile.role === 'AGENT' && !formData.selectedArtistId) {
      setError(t('offer.selectArtistError'));
      return;
    }
    if (!formData.venueName.trim()) {
      setError(t('offer.venueRequired'));
      return;
    }
    if (!formData.zone) {
      setError(t('offer.zoneRequired'));
      return;
    }
    if (!formData.country) {
      setError(t('offer.countryRequired'));
      return;
    }
    if (!formData.city) {
      setError(t('offer.cityRequired'));
      return;
    }
    if (!formData.date) {
      setError(t('offer.dateRequired'));
      return;
    }

    // Validate that date is not in the past
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      appAlert(t('offer.dateInPast'));
      return;
    }

    if (!formData.fee || parseFloat(formData.fee) <= 0) {
      setError(t('chat.enterValidFee'));
      return;
    }

    // Validate that set time is within event time
    if (formData.setStartTime && formData.setEndTime && formData.eventStartTime && formData.eventEndTime) {
      const [eventStartHour, eventStartMin] = formData.eventStartTime.split(':').map(Number);
      const [eventEndHour, eventEndMin] = formData.eventEndTime.split(':').map(Number);
      const [setStartHour, setStartMin] = formData.setStartTime.split(':').map(Number);
      const [setEndHour, setEndMin] = formData.setEndTime.split(':').map(Number);

      const eventStartTotalMin = eventStartHour * 60 + eventStartMin;
      let eventEndTotalMin = eventEndHour * 60 + eventEndMin;
      const setStartTotalMin = setStartHour * 60 + setStartMin;
      let setEndTotalMin = setEndHour * 60 + setEndMin;

      // Handle case where end time is past midnight
      if (eventEndTotalMin < eventStartTotalMin) {
        eventEndTotalMin += 24 * 60;
      }
      if (setEndTotalMin < setStartTotalMin) {
        setEndTotalMin += 24 * 60;
      }

      // Check if set time is within event time
      if (setStartTotalMin < eventStartTotalMin || setEndTotalMin > eventEndTotalMin) {
        appAlert(t('offer.setTimeRange'));
        return;
      }
    }

    setLoading(true);

    try {
      // Build extras object
      const extras = {};
      if (formData.includeTravelIn) extras.travelIn = formData.travelInNote || 'Included';
      if (formData.includeTravelOut) extras.travelOut = formData.travelOutNote || 'Included';
      if (formData.includeTransportation) extras.transportation = formData.transportationNote || 'Included';
      if (formData.includeAccommodation) extras.accommodation = formData.accommodationNote || 'Included';
      if (formData.includeMeals) extras.meals = formData.mealsNote || 'Included';

      // Call backend API to create deal
      // Round fee to 2 decimal places to avoid floating point precision errors
      const feeValue = Math.round(parseFloat(formData.fee) * 100) / 100;

      const dealData = {
        initiatorProfileId: currentUser.id,
        recipientProfileId: recipientProfile.id,
        eventName: formData.eventName,
        venueName: formData.venueName || recipientProfile.name,
        zone: formData.zone,
        country: formData.country,
        city: formData.city,
        date: formData.date,
        startTime: formData.eventStartTime,
        endTime: formData.eventEndTime,
        setStartTime: formData.setStartTime,
        setEndTime: formData.setEndTime,
        fee: feeValue,
        currency: formData.currency,
        performanceType: formData.performanceType,
        setDuration: setDuration,
        extras: Object.keys(extras).length > 0 ? extras : undefined,
        notes: formData.notes,
        artistId: formData.selectedArtistId || undefined,
        artistName: formData.selectedArtistName || undefined
      };

      const response = await apiService.createDeal(dealData);

      // Close modal on success
      setLoading(false);
      onClose();

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(response);
      }

      // Reset form
      setFormData({
        eventName: '',
        venueName: '',
        zone: '',
        country: '',
        city: '',
        date: '',
        eventStartTime: '',
        eventEndTime: '',
        fee: '',
        currency: 'USD',
        performanceType: 'DJ Set',
        setStartTime: '',
        setEndTime: '',
        notes: '',
        selectedArtistId: '',
        selectedArtistName: '',
        includeTravelIn: false,
        travelInNote: '',
        includeTravelOut: false,
        travelOutNote: '',
        includeTransportation: false,
        transportationNote: '',
        includeAccommodation: false,
        accommodationNote: '',
        includeMeals: false,
        mealsNote: ''
      });
    } catch (err) {
      const code = err.response?.data?.code;
      // OFFER_LIMIT / VERIFICATION_REQUIRED are handled by the global
      // dialogs (api.js events) — no second error inside the modal.
      if (code !== 'OFFER_LIMIT' && code !== 'VERIFICATION_REQUIRED') {
        setError(err.message || t('offer.createFailed'));
      }
      setLoading(false);
    }
  };

  const isArtistOrAgent = currentUser.role === 'ARTIST' || currentUser.role === 'AGENT';

  // Portal to body: the desktop drawer system docks the tour screen via
  // body:has(> .md-drawer), which only matches direct body children — and
  // the overlay must escape parent stacking contexts like the chat screen.
  return ReactDOM.createPortal(
    <div className="make-offer-modal-overlay md-drawer" onClick={onClose}>
      <div className="make-offer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="make-offer-header">
          <button className="back-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h2>{t('tour.makeAnOffer')}</h2>
          <div style={{ width: '24px' }}></div>
        </div>

        <div className="make-offer-recipient">
          <div className="recipient-avatar">
            {recipientProfile.avatar ? (
              <img src={recipientProfile.avatar} alt={recipientProfile.name} />
            ) : (
              recipientProfile.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="recipient-info">
            <h3>{recipientProfile.name}</h3>
            <p>{recipientProfile.role} • {recipientProfile.location}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="make-offer-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {recipientProfile.role === 'AGENT' && (
            <div className="form-section">
              <h4>{t('offer.artistSelection')}</h4>

              <div className="form-group">
                <label>{t('offer.selectArtistToBook')} *</label>
                <select
                  value={formData.selectedArtistId}
                  onChange={handleArtistChange}
                  className="form-input"
                  required
                >
                  <option value="">{t('offer.selectAnArtist')}</option>
                  {representedArtists.map(artist => (
                    <option key={artist.profileId} value={artist.profileId}>
                      {artist.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-section">
            <h4>{t('offer.eventDetails')}</h4>

            <div className="form-group">
              <label>{t('offer.eventName')}</label>
              <input
                type="text"
                value={formData.eventName}
                onChange={(e) => handleChange('eventName', e.target.value)}
                placeholder={t('offer.eventNamePlaceholder')}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>{t('offer.venueName')} *</label>
              <input
                type="text"
                value={formData.venueName}
                onChange={(e) => handleChange('venueName', e.target.value)}
                placeholder={isArtistOrAgent ? recipientProfile.name : t('offer.yourVenueName')}
                className="form-input"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('editProfile.zone')} *</label>
                <select
                  value={formData.zone}
                  onChange={(e) => handleZoneChange(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">{t('editProfile.selectZone')}</option>
                  {zones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('editProfile.country')} *</label>
                <select
                  value={formData.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="form-input"
                  disabled={!formData.zone}
                  required
                >
                  <option value="">{t('editProfile.selectCountry')}</option>
                  {availableCountries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>{t('editProfile.city')} *</label>
              <select
                value={formData.city}
                onChange={(e) => handleCityChange(e.target.value)}
                className="form-input"
                disabled={!formData.country}
                required
              >
                <option value="">{t('editProfile.selectCity')}</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t('tour.date')} *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('offer.eventStartTime')}</label>
                <input
                  type="time"
                  value={formData.eventStartTime}
                  onChange={(e) => handleChange('eventStartTime', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>{t('offer.eventEndTime')}</label>
                <input
                  type="time"
                  value={formData.eventEndTime}
                  onChange={(e) => handleChange('eventEndTime', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>{t('offer.financialTerms')}</h4>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>{t('tour.fee')} *</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.fee}
                  onChange={(e) => handleChange('fee', e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  placeholder="0"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label>{t('chat.currency')}</label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="form-input"
                >
{CURRENCY_OPTIONS}
                </select>
              </div>
            </div>

          </div>

          <div className="form-section">
            <h4>{t('chat.extras')}</h4>

            <div className="extras-grid">
              <div className="extra-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.includeTravelIn}
                    onChange={(e) => handleChange('includeTravelIn', e.target.checked)}
                  />
                  <span>{t('chat.travelIn')}</span>
                </label>
                {formData.includeTravelIn && (
                  <input
                    type="text"
                    value={formData.travelInNote}
                    onChange={(e) => handleChange('travelInNote', e.target.value)}
                    placeholder={t('offer.travelInPlaceholder')}
                    className="form-input extra-note"
                  />
                )}
              </div>

              <div className="extra-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.includeTravelOut}
                    onChange={(e) => handleChange('includeTravelOut', e.target.checked)}
                  />
                  <span>{t('chat.travelOut')}</span>
                </label>
                {formData.includeTravelOut && (
                  <input
                    type="text"
                    value={formData.travelOutNote}
                    onChange={(e) => handleChange('travelOutNote', e.target.value)}
                    placeholder={t('offer.travelOutPlaceholder')}
                    className="form-input extra-note"
                  />
                )}
              </div>

              <div className="extra-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.includeTransportation}
                    onChange={(e) => handleChange('includeTransportation', e.target.checked)}
                  />
                  <span>{t('offer.groundTransportation')}</span>
                </label>
                {formData.includeTransportation && (
                  <input
                    type="text"
                    value={formData.transportationNote}
                    onChange={(e) => handleChange('transportationNote', e.target.value)}
                    placeholder={t('offer.transportationPlaceholder')}
                    className="form-input extra-note"
                  />
                )}
              </div>

              <div className="extra-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.includeAccommodation}
                    onChange={(e) => handleChange('includeAccommodation', e.target.checked)}
                  />
                  <span>{t('chat.accommodation')}</span>
                </label>
                {formData.includeAccommodation && (
                  <input
                    type="text"
                    value={formData.accommodationNote}
                    onChange={(e) => handleChange('accommodationNote', e.target.value)}
                    placeholder={t('offer.accommodationPlaceholder')}
                    className="form-input extra-note"
                  />
                )}
              </div>

              <div className="extra-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.includeMeals}
                    onChange={(e) => handleChange('includeMeals', e.target.checked)}
                  />
                  <span>{t('chat.meals')}</span>
                </label>
                {formData.includeMeals && (
                  <input
                    type="text"
                    value={formData.mealsNote}
                    onChange={(e) => handleChange('mealsNote', e.target.value)}
                    placeholder={t('offer.mealsPlaceholder')}
                    className="form-input extra-note"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>{t('offer.performanceDetails')}</h4>

            <div className="form-row">
              <div className="form-group">
                <label>{t('offer.performanceType')}</label>
                <select
                  value={formData.performanceType}
                  onChange={(e) => handleChange('performanceType', e.target.value)}
                  className="form-input"
                >
                  <option value="DJ Set">DJ Set</option>
                  <option value="Live Performance">Live Performance</option>
                  <option value="B2B">B2B</option>
                  <option value="Live Band">Live Band</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('offer.setStartTime')}</label>
                <input
                  type="time"
                  value={formData.setStartTime}
                  onChange={(e) => handleChange('setStartTime', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>{t('offer.setEndTime')}</label>
                <input
                  type="time"
                  value={formData.setEndTime}
                  onChange={(e) => handleChange('setEndTime', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>{t('offer.setDuration')}</label>
                <div className="form-input" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  color: setDuration > 0 ? 'var(--text-white)' : 'rgba(255, 255, 255, 0.3)',
                  cursor: 'not-allowed'
                }}>
                  {setDuration > 0 ? t('offer.durationMinutes', { n: setDuration }) : '--'}
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>{t('offer.additionalInfo')}</h4>

            <div className="form-group">
              <label>{t('offer.notesOptional')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder={t('offer.notesPlaceholder')}
                className="form-textarea"
                rows="2"
              />
            </div>
          </div>

          <div className="make-offer-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? t('offer.sendingOffer') : t('offer.sendOffer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  , document.body);
};

export default MakeOfferModal;
