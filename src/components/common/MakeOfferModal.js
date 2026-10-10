import { clampDateRange } from '../../utils/dates';
import React, { useState, useEffect } from 'react';
import { CURRENCY_OPTIONS } from './CurrencyOptions';
import ReactDOM from 'react-dom';
import { appAlert } from '../../utils/dialogs';
import { isVerificationGate } from '../../utils/errors';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import CitySearch from './CitySearch';
import VenueSearch from './VenueSearch';
import { useLanguage } from '../../contexts/LanguageContext';

// The final payment can never be due before the deposit.
const DEADLINE_KEYS = { start: 'depositDeadline', end: 'finalPaymentDeadline' };

const MakeOfferModal = ({ isOpen, onClose, recipientProfile, onSuccess, dockAsDrawer = false, preferCountry = null }) => {
  const { t } = useLanguage();

  const { user: currentUser } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [representedArtists, setRepresentedArtists] = useState([]);
  // Bumped whenever geography is prefilled externally (modal open, venue pick)
  // so the CitySearch input — which reads city/country only on mount —
  // remounts and reflects the new value.
  const [geoPrefillKey, setGeoPrefillKey] = useState(0);

  // Form state - simplified for Venue/Promoter initial offer
  const [formData, setFormData] = useState({
    eventName: '',
    venueName: '',
    eventVenueId: '',
    zone: '',
    country: '',
    city: '',
    date: '',
    eventStartTime: '',
    eventEndTime: '',
    timeTbc: false,
    fee: '',
    currency: 'USD',
    performanceType: 'DJ Set',
    setStartTime: '',
    setEndTime: '',
    depositDeadline: '',
    finalPaymentDeadline: '',
    notes: '',
    selectedArtistId: '',
    selectedArtistName: '',
    // Event logistics (venue-facing details)
    eventCapacity: '',
    eventRoomsCount: '',
    eventStage: '',
    lineup: [''],
    entranceFee: '',
    entranceFeeCurrency: '',
    entranceFeeNote: '',
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

  // A venue making an offer IS the venue — prefill their name (promoters
  // book many rooms, so they keep typing it) plus their own capacity/rooms.
  // Also prefill the geography from the initiator's own profile location, and
  // seed lineup row 0 with the booked artist. Must run above the early
  // return: hooks can never sit after a conditional return.
  useEffect(() => {
    if (!isOpen) return;
    setFormData((prev) => {
      const next = { ...prev };
      if (currentUser.role === 'VENUE') {
        if (!next.venueName) next.venueName = currentUser.name;
        if (next.eventCapacity === '' && currentUser.venueCapacity != null) next.eventCapacity = String(currentUser.venueCapacity);
        if (next.eventRoomsCount === '' && currentUser.venueRooms != null) next.eventRoomsCount = String(currentUser.venueRooms);
      }
      // Geography prefill from the initiator's own profile location.
      if (!next.city && !next.country && currentUser.city && currentUser.country) {
        next.city = currentUser.city;
        next.country = currentUser.country;
        next.zone = currentUser.zone || '';
      }
      // Lineup row 0 = the booked artist (direct recipient, or the agent's
      // chosen artist once picked).
      const bookedName = recipientProfile.role === 'ARTIST' ? recipientProfile.name : '';
      if (bookedName && (!next.lineup?.[0] || next.lineup[0] === '')) {
        next.lineup = [bookedName, ...(next.lineup || []).slice(1)];
      }
      return next;
    });
    setGeoPrefillKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Keep lineup row 0 in sync with the agent's selected artist.
  useEffect(() => {
    if (!isOpen || recipientProfile.role !== 'AGENT') return;
    setFormData((prev) => {
      const lineup = [...(prev.lineup || [''])];
      lineup[0] = formData.selectedArtistName || '';
      return { ...prev, lineup };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.selectedArtistName]);

  if (!isOpen) return null;

  // Event logistics (capacity / rooms / stage) are mandatory whenever the
  // offer INITIATOR is a promoter or a venue — they own the event and must
  // declare these details regardless of whether a TORA venue is tagged.
  const logisticsRequired =
    currentUser.role === 'PROMOTER' || currentUser.role === 'VENUE';

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Lineup: free-text artist name rows (row 0 is the booked artist).
  const handleLineupChange = (index, value) => {
    setFormData((prev) => {
      const lineup = [...(prev.lineup || [''])];
      lineup[index] = value;
      return { ...prev, lineup };
    });
  };
  const addLineupRow = () => {
    setFormData((prev) => ({ ...prev, lineup: [...(prev.lineup || ['']), ''] }));
  };
  const removeLineupRow = (index) => {
    setFormData((prev) => {
      const lineup = (prev.lineup || ['']).filter((_, i) => i !== index);
      return { ...prev, lineup: lineup.length ? lineup : [''] };
    });
  };

  // A promoter picking a TORA venue prefills capacity/rooms/location from it.
  const handleVenuePick = (name, id, venue) => {
    setFormData((prev) => {
      const next = { ...prev, venueName: name, eventVenueId: id || '' };
      if (venue) {
        if (venue.venueCapacity != null) next.eventCapacity = String(venue.venueCapacity);
        if (venue.venueRooms != null) next.eventRoomsCount = String(venue.venueRooms);
        if (venue.city && venue.country) {
          next.city = venue.city;
          next.country = venue.country;
          if (venue.zone) next.zone = venue.zone;
          setGeoPrefillKey((k) => k + 1);
        }
      }
      return next;
    });
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
    if (!formData.city || !formData.country || !formData.zone) {
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

    // Event capacity + rooms + stage are required whenever the initiator is a
    // promoter or a venue. Each error names the specific missing field.
    if (logisticsRequired) {
      const cap = parseInt(formData.eventCapacity, 10);
      if (!formData.eventCapacity || Number.isNaN(cap) || cap <= 0) {
        setError(t('offer.capacityRequired'));
        return;
      }
      const rooms = parseInt(formData.eventRoomsCount, 10);
      if (!formData.eventRoomsCount || Number.isNaN(rooms) || rooms <= 0) {
        setError(t('offer.roomsRequired'));
        return;
      }
      if (!formData.eventStage.trim()) {
        setError(t('offer.stageRequired'));
        return;
      }
    }

    // Validate that set time is within event time
    if (!formData.timeTbc && formData.setStartTime && formData.setEndTime && formData.eventStartTime && formData.eventEndTime) {
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
        // 'TBC' is stored as the time itself: every reader shows it as-is.
        startTime: formData.timeTbc ? 'TBC' : formData.eventStartTime,
        endTime: formData.timeTbc ? 'TBC' : formData.eventEndTime,
        setStartTime: formData.setStartTime,
        setEndTime: formData.setEndTime,
        fee: feeValue,
        currency: formData.currency,
        performanceType: formData.performanceType,
        setDuration: setDuration,
        extras: Object.keys(extras).length > 0 ? extras : undefined,
        depositDeadline: formData.depositDeadline || undefined,
        finalPaymentDeadline: formData.finalPaymentDeadline || undefined,
        notes: formData.notes,
        artistId: formData.selectedArtistId || undefined,
        artistName: formData.selectedArtistName || undefined,
        eventVenueId: formData.eventVenueId || undefined,
        // Event logistics
        eventCapacity: formData.eventCapacity ? parseInt(formData.eventCapacity, 10) : undefined,
        eventRoomsCount: formData.eventRoomsCount ? parseInt(formData.eventRoomsCount, 10) : undefined,
        eventStage: formData.eventStage.trim() || undefined,
        lineup: (formData.lineup || [])
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
        entranceFee: formData.entranceFee !== '' ? parseInt(formData.entranceFee, 10) : undefined,
        entranceFeeCurrency: formData.entranceFee !== '' ? (formData.entranceFeeCurrency || formData.currency) : undefined,
        entranceFeeNote: formData.entranceFeeNote.trim() || undefined
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
        eventVenueId: '',
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
        depositDeadline: '',
        finalPaymentDeadline: '',
            notes: '',
        selectedArtistId: '',
        selectedArtistName: '',
        eventCapacity: '',
        eventRoomsCount: '',
        eventStage: '',
        lineup: [''],
        entranceFee: '',
        entranceFeeCurrency: '',
        entranceFeeNote: '',
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
      if (code !== 'OFFER_LIMIT' && !isVerificationGate(err)) {
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
    <div className={`make-offer-modal-overlay${dockAsDrawer ? ' md-drawer' : ''}`} onClick={onClose}>
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
              {currentUser.role === 'PROMOTER' ? (
                // Promoters run events in other people's rooms — autocomplete
                // against TORA venues (links eventVenueId); free text stays
                // valid for off-platform venues.
                <VenueSearch
                  venueName={formData.venueName}
                  venueId={formData.eventVenueId || null}
                  onSelect={handleVenuePick}
                />
              ) : (
                <input
                  type="text"
                  value={formData.venueName}
                  onChange={(e) => handleChange('venueName', e.target.value)}
                  placeholder={isArtistOrAgent ? recipientProfile.name : t('offer.yourVenueName')}
                  className="form-input"
                  required
                />
              )}
              {!!formData.eventVenueId && (
                <p className="m-0 mt-2 text-xs leading-relaxed text-infrared/90">
                  {t('offer.venueConfirmDisclaimer')}
                </p>
              )}
            </div>

            <div className="form-group">
              <label>{t('editProfile.city')} *</label>
              <CitySearch
                key={`city-${geoPrefillKey}`}
                city={formData.city}
                country={formData.country}
                zone={formData.zone}
                preferCountry={preferCountry}
                onSelect={(city, country, zone) => setFormData((prev) => ({ ...prev, city, country, zone }))}
              />
            </div>

            <div className="form-group">
              <label>{t('tour.date')} *</label>
              <input className="form-input"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="form-input"
                required
              />
            </div>

            <label className="offer-tbc-toggle">
              <input type="checkbox" checked={formData.timeTbc} onChange={(e) => handleChange('timeTbc', e.target.checked)} />
              <span>{t('offer.timeTbc')}</span>
              <small>{t('offer.timeTbcHint')}</small>
            </label>
            {!formData.timeTbc && (
            <div className="form-row">
              <div className="form-group">
                <label>{t('offer.eventStartTime')}</label>
                <input
                  type="time"
                  step="300"
                  value={formData.eventStartTime}
                  onChange={(e) => handleChange('eventStartTime', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>{t('offer.eventEndTime')}</label>
                <input
                  type="time"
                  step="300"
                  value={formData.eventEndTime}
                  onChange={(e) => handleChange('eventEndTime', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
            )}
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

            {!formData.timeTbc && (
            <div className="form-row">
              <div className="form-group">
                <label>{t('offer.setStartTime')}</label>
                <input
                  type="time"
                  step="300"
                  value={formData.setStartTime}
                  onChange={(e) => handleChange('setStartTime', e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>{t('offer.setEndTime')}</label>
                <input
                  type="time"
                  step="300"
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
            )}
          </div>

          <div className="form-section">
            <h4>{t('offer.eventLogistics')}</h4>

            {/* Capacity, rooms and stage belong to the booker; an artist or agent countering only sees the lineup. */}
            {logisticsRequired && (<>
            <div className="form-row">
              <div className="form-group">
                <label>{t('offer.eventCapacity')} *</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.eventCapacity}
                  onChange={(e) => handleChange('eventCapacity', e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  placeholder={t('offer.eventCapacityPlaceholder')}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('offer.eventRooms')} *</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.eventRoomsCount}
                  onChange={(e) => handleChange('eventRoomsCount', e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  placeholder={t('offer.eventRoomsPlaceholder')}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t('offer.eventStage')} *</label>
              <input
                type="text"
                value={formData.eventStage}
                onChange={(e) => handleChange('eventStage', e.target.value)}
                placeholder={t('offer.eventStagePlaceholder')}
                className="form-input"
                required
              />
            </div>
            </>)}

            <div className="form-group">
              <label>{t('offer.lineup')}</label>
              {(formData.lineup || ['']).map((name, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleLineupChange(i, e.target.value)}
                    placeholder={i === 0 ? t('offer.lineupHeadlinerPlaceholder') : t('offer.lineupPlaceholder')}
                    className="form-input flex-1"
                  />
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => removeLineupRow(i)}
                      aria-label={t('offer.removeArtist')}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[#0c0c11] border border-white/10 text-white/50 hover:text-infrared hover:border-infrared/40 cursor-pointer transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addLineupRow}
                className="mt-1 bg-transparent border-none p-0 text-xs text-infrared/90 hover:text-infrared cursor-pointer font-tech transition-colors"
              >
                + {t('offer.addArtist')}
              </button>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>{t('offer.tickets')}</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.entranceFee}
                  onChange={(e) => handleChange('entranceFee', e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  placeholder={t('offer.entranceFeePlaceholder')}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label>{t('chat.currency')}</label>
                <select
                  value={formData.entranceFeeCurrency || formData.currency}
                  onChange={(e) => handleChange('entranceFeeCurrency', e.target.value)}
                  className="form-input"
                >
{CURRENCY_OPTIONS}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>{t('offer.entranceFeeNote')}</label>
              <input
                type="text"
                value={formData.entranceFeeNote}
                onChange={(e) => handleChange('entranceFeeNote', e.target.value)}
                placeholder={t('offer.entranceFeeNotePlaceholder')}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-section">
            <h4>{t('offer.paymentDeadlines')}</h4>
            <p className="m-0 mb-2.5 text-xs leading-relaxed text-white/45">
              {t('offer.paymentDeadlinesHint')}
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>{t('offer.depositDeadline')}</label>
                <input
                  className="form-input"
                  type="date"
                  value={formData.depositDeadline}
                  onChange={(e) => setFormData((prev) => clampDateRange(prev, 'depositDeadline', e.target.value, DEADLINE_KEYS))}
                />
              </div>
              <div className="form-group">
                <label>{t('offer.finalPaymentDeadline')}</label>
                <input
                  className="form-input"
                  type="date"
                  min={formData.depositDeadline || undefined}
                  value={formData.finalPaymentDeadline}
                  onChange={(e) => setFormData((prev) => clampDateRange(prev, 'finalPaymentDeadline', e.target.value, DEADLINE_KEYS))}
                />
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
