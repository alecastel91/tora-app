import React, { useState } from 'react';
import { genresList, zones, countriesByZone, citiesByCountry } from '../../data/profiles';
import { useLanguage } from '../../contexts/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const TOTAL_STEPS = 5;

const AddProfileScreen = ({ onClose, onSuccess }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [role, setRole] = useState('');
  const [profileName, setProfileName] = useState('');
  const [zone, setZone] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [showCustomCityInput, setShowCustomCityInput] = useState(false);
  const [genres, setGenres] = useState([]);
  const [instagram, setInstagram] = useState('');
  const [residentAdvisor, setResidentAdvisor] = useState('');
  const [soundcloud, setSoundcloud] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [venueCapacity, setVenueCapacity] = useState('');

  // Derived data
  const availableCountries = zone ? countriesByZone[zone] || [] : [];
  const availableCities = country ? citiesByCountry[country] || [] : [];

  // --- Validation per step ---
  const canAdvance = () => {
    switch (step) {
      case 1: return !!role;
      case 2: return profileName.trim().length > 0;
      case 3: return !!zone && !!country && (!!city || (showCustomCityInput && customCity.trim().length > 0));
      case 4: return true; // genres are optional
      case 5: {
        if (role === 'AGENT' && !agencyName.trim()) return false;
        if (role === 'VENUE' && !venueCapacity.trim()) return false;
        return true;
      }
      default: return false;
    }
  };

  // --- Location handlers ---
  const handleZoneChange = (val) => {
    setZone(val);
    setCountry('');
    setCity('');
    setCustomCity('');
    setShowCustomCityInput(false);
  };

  const handleCountryChange = (val) => {
    setCountry(val);
    setCity('');
    setCustomCity('');
    setShowCustomCityInput(false);
  };

  const handleCityChange = (val) => {
    if (val === 'Other') {
      setShowCustomCityInput(true);
      setCity(customCity);
    } else {
      setShowCustomCityInput(false);
      setCustomCity('');
      setCity(val);
    }
  };

  const handleCustomCityChange = (val) => {
    setCustomCity(val);
    setCity(val);
  };

  // --- Genre toggle ---
  const toggleGenre = (genre) => {
    setGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  // --- Navigation ---
  const goNext = () => {
    if (canAdvance() && step < TOTAL_STEPS) {
      setError('');
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setError('');
      setStep(step - 1);
    }
  };

  // --- Submit ---
  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const body = {
        role,
        profileName,
        zone,
        country,
        city,
        genres,
        instagram: instagram || undefined,
        residentAdvisor: residentAdvisor || undefined,
        soundcloud: soundcloud || undefined,
        website: website || undefined,
        linkedin: linkedin || undefined,
        agencyName: agencyName || undefined,
        venueCapacity: venueCapacity || undefined,
      };

      const response = await fetch(`${API_URL}/invitations/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || t('addProfile.submitFailed'));
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message || t('auth.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  // --- Success screen ---
  if (submitted) {
    return (
      <div className="screen active edit-profile-screen">
        <div className="edit-profile-header">
          <button className="back-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>{t('addProfile.title')}</h1>
          <div style={{ width: '24px' }}></div>
        </div>
        <div className="edit-profile-content">
          <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            {/* Animated check icon — matching landing page */}
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: 'rgba(255, 51, 102, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '28px',
            }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path
                  d="M10 24L18 32L38 12"
                  stroke="#FF3366"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Title */}
            <h2 style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '24px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '16px',
              color: '#fff',
            }}>
              {t('addProfile.applicationSubmitted')}
            </h2>

            {/* Message */}
            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              lineHeight: '1.7',
              marginBottom: '24px',
              maxWidth: '320px',
            }}>
              {t('addProfile.submittedBefore')} <strong style={{ color: '#FF3366' }}>{role}</strong> {t('addProfile.submittedAfter')}
            </p>

            {/* What happens next */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '20px',
              marginBottom: '32px',
              width: '100%',
              maxWidth: '320px',
            }}>
              <p style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '12px',
              }}>
                {t('addProfile.whatHappensNext')}
              </p>
              <div style={{ textAlign: 'left', fontSize: '13px', lineHeight: '1.8', color: 'rgba(255,255,255,0.5)' }}>
                <p><span style={{ color: '#FF3366', fontWeight: 600 }}>1. {t('addProfile.stepReview')}</span> — {t('addProfile.stepReviewDesc')}</p>
                <p><span style={{ color: '#FF3366', fontWeight: 600 }}>2. {t('addProfile.stepApproval')}</span> — {t('addProfile.stepApprovalDesc')}</p>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={onClose}
              style={{ width: '100%', maxWidth: '280px' }}
            >
              {t('common.done')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step content renderers ---
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="form-group">
            <label style={labelStyle}>{t('addProfile.selectRole')}</label>
            <div className="role-selector">
              {['ARTIST', 'PROMOTER', 'VENUE', 'AGENT'].map(r => (
                <button
                  key={r}
                  type="button"
                  className={`role-option ${role === r ? 'active' : ''}`}
                  onClick={() => setRole(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="form-group">
            <label style={labelStyle}>
              {role === 'VENUE' ? t('addProfile.venueName') :
               role === 'PROMOTER' ? t('addProfile.promoterName') :
               role === 'AGENT' ? t('addProfile.agentName') :
               t('addProfile.artistName')}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={
                role === 'VENUE' ? 'e.g. Berghain' :
                role === 'PROMOTER' ? 'e.g. Awakenings' :
                role === 'AGENT' ? 'e.g. John Smith' :
                'e.g. DJ Shadow'
              }
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              autoFocus
            />
          </div>
        );

      case 3:
        return (
          <>
            <div className="form-group">
              <label style={labelStyle}>{t('editProfile.zone')}</label>
              <select
                className="form-input"
                value={zone}
                onChange={(e) => handleZoneChange(e.target.value)}
              >
                <option value="">{t('editProfile.selectZone')}</option>
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            {zone && (
              <div className="form-group">
                <label style={labelStyle}>{t('editProfile.country')}</label>
                <select
                  className="form-input"
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                >
                  <option value="">{t('editProfile.selectCountry')}</option>
                  {availableCountries.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            {country && (
              <div className="form-group">
                <label style={labelStyle}>{t('editProfile.city')}</label>
                <select
                  className="form-input"
                  value={showCustomCityInput ? 'Other' : city}
                  onChange={(e) => handleCityChange(e.target.value)}
                >
                  <option value="">{t('editProfile.selectCity')}</option>
                  {availableCities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            {showCustomCityInput && (
              <div className="form-group">
                <label style={labelStyle}>{t('editProfile.enterCityName')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={customCity}
                  onChange={(e) => handleCustomCityChange(e.target.value)}
                  placeholder={t('editProfile.enterCityPlaceholder')}
                />
              </div>
            )}
          </>
        );

      case 4:
        return (
          <div className="form-group">
            <label style={labelStyle}>{t('addProfile.selectGenresOptional')}</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}>
              {genresList.map(genre => {
                const isSelected = genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #FF3366' : '1px solid rgba(255,255,255,0.15)',
                      background: isSelected ? 'rgba(255,51,102,0.15)' : 'rgba(255,255,255,0.05)',
                      color: isSelected ? '#FF3366' : 'rgba(255,255,255,0.7)',
                      fontSize: '13px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 5:
        return (
          <>
            <div className="form-group">
              <label style={labelStyle}>{t('editProfile.instagram')}</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#fff',
                  fontSize: '14px',
                  zIndex: 1,
                }}>@</span>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '28px' }}
                  placeholder="username"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
            </div>

            {/* Artist-specific */}
            {role === 'ARTIST' && (
              <>
                <div className="form-group">
                  <label style={labelStyle}>{t('addProfile.raOptional')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('editProfile.raArtistName')}
                    value={residentAdvisor}
                    onChange={(e) => setResidentAdvisor(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label style={labelStyle}>{t('addProfile.soundcloudOptional')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('addProfile.soundcloudPlaceholder')}
                    value={soundcloud}
                    onChange={(e) => setSoundcloud(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Agent-specific */}
            {role === 'AGENT' && (
              <>
                <div className="form-group">
                  <label style={labelStyle}>{t('editProfile.agencyName')} *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Coda Agency"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label style={labelStyle}>{t('addProfile.linkedinOptional')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('addProfile.linkedinPlaceholder')}
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Venue-specific */}
            {role === 'VENUE' && (
              <>
                <div className="form-group">
                  <label style={labelStyle}>{t('editProfile.venueCapacity')} *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="form-input"
                    placeholder="e.g. 500"
                    value={venueCapacity}
                    onChange={(e) => setVenueCapacity(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
              </>
            )}

            {/* Promoter-specific */}
            {role === 'PROMOTER' && (
              <div className="form-group">
                <label style={labelStyle}>{t('addProfile.websiteOptional')}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            )}

            {/* Website for non-promoter roles that don't already show it */}
            {role !== 'PROMOTER' && (
              <div className="form-group">
                <label style={labelStyle}>{t('addProfile.websiteOptional')}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  // Step titles
  const stepTitles = {
    1: t('editProfile.role'),
    2: t('addProfile.profileName'),
    3: t('addProfile.location'),
    4: t('editProfile.genres'),
    5: t('addProfile.linksDetails'),
  };

  return (
    <div className="screen active edit-profile-screen">
      <div className="edit-profile-header">
        <button className="back-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>{t('addProfile.title')}</h1>
        <div style={{ width: '24px' }}></div>
      </div>
      <div className="edit-profile-content">
        {/* Sub-header */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '13px',
          }}>
            Step {step} of {TOTAL_STEPS} — {stepTitles[step]}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '2px',
          marginBottom: '24px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(step / TOTAL_STEPS) * 100}%`,
            height: '100%',
            background: '#FF3366',
            borderRadius: '2px',
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Error */}
        {error && (
          <div className="error-message" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Step content */}
        <div style={{ minHeight: '200px' }}>
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="form-actions" style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '24px',
        }}>
          {step === 1 ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              {t('editProfile.cancel')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={goBack}
            >
              {t('addProfile.back')}
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={goNext}
              disabled={!canAdvance()}
            >
              {t('signup.next')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading || !canAdvance()}
            >
              {loading ? t('addProfile.submitting') : t('addProfile.submitApplication')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Shared label style
const labelStyle = {
  fontFamily: 'Inter, sans-serif',
  fontSize: '13px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'rgba(255,255,255,0.6)',
  marginBottom: '8px',
  display: 'block',
};

export default AddProfileScreen;
