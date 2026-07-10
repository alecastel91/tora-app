import React, { useState } from 'react';
import { genresList } from '../../data/profiles';
import { useLanguage } from '../../contexts/LanguageContext';
import { roleLabel } from '../../utils/roles';
import CitySearch from '../common/CitySearch';

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
  const [genres, setGenres] = useState([]);
  const [instagram, setInstagram] = useState('');
  const [residentAdvisor, setResidentAdvisor] = useState('');
  const [soundcloud, setSoundcloud] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [venueCapacity, setVenueCapacity] = useState('');

  // --- Validation per step ---
  const canAdvance = () => {
    switch (step) {
      case 1: return !!role;
      case 2: return profileName.trim().length > 0;
      case 3: return !!zone && !!country && !!city;
      case 4: return true; // genres are optional
      case 5: {
        // Instagram is the verification channel — mandatory for every role,
        // matching the torahub.io application form.
        if (!instagram.trim()) return false;
        if (role === 'AGENT' && !agencyName.trim()) return false;
        if (role === 'VENUE' && !venueCapacity.trim()) return false;
        return true;
      }
      default: return false;
    }
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
        instagram: instagram.trim(),
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
          <div className="flex flex-col items-center text-center px-5 py-10">
            {/* Animated check icon */}
            <div className="w-24 h-24 rounded-full bg-infrared/10 ring-1 ring-infrared/30 flex items-center justify-center mb-7">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <path d="M10 24L18 32L38 12" stroke="var(--primary-pink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h2 className="m-0 mb-3 text-[19px] font-semibold text-white font-space-grotesk uppercase tracking-[0.08em]">
              {t('addProfile.applicationSubmitted')}
            </h2>

            <p className="m-0 mb-6 max-w-[320px] text-sm leading-relaxed text-white/60">
              {t('addProfile.submittedBefore')} <strong className="text-infrared">{roleLabel(role, t)}</strong> {t('addProfile.submittedAfter')}
            </p>

            {/* What happens next */}
            <div className="w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left mb-8">
              <p className="m-0 mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 font-tech">
                {t('addProfile.whatHappensNext')}
              </p>
              <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-white/50">
                <p className="m-0"><span className="text-infrared font-semibold">1. {t('addProfile.stepReview')}</span> — {t('addProfile.stepReviewDesc')}</p>
                <p className="m-0"><span className="text-infrared font-semibold">2. {t('addProfile.stepApproval')}</span> — {t('addProfile.stepApprovalDesc')}</p>
              </div>
            </div>

            <button className="btn btn-primary w-full max-w-[280px]" onClick={onClose}>
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
            <label className={labelClass}>{t('addProfile.selectRole')}</label>
            <div className="grid grid-cols-2 gap-2.5">
              {['ARTIST', 'PROMOTER', 'VENUE', 'AGENT'].map(r => {
                const dot = {
                  ARTIST: 'bg-role-artist', PROMOTER: 'bg-role-promoter',
                  VENUE: 'bg-role-venue', AGENT: 'bg-role-agent',
                }[r];
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-4 min-h-[58px]
                                text-[11px] font-semibold uppercase tracking-[0.12em] font-tech transition-colors
                                ${active
                                  ? 'border-infrared/60 bg-infrared/10 text-white shadow-[0_0_14px_rgba(255,51,102,0.15)]'
                                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                    {roleLabel(r, t)}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="form-group">
            <label className={labelClass}>
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
          <div className="form-group">
            <label className={labelClass}>{t('editProfile.city')}</label>
            <CitySearch
              city={city}
              country={country}
              zone={zone}
              onSelect={(nextCity, nextCountry, nextZone) => {
                setCity(nextCity);
                setCountry(nextCountry);
                setZone(nextZone);
              }}
            />
          </div>
        );

      case 4:
        return (
          <div className="form-group">
            <label className={labelClass}>{t('addProfile.selectGenresOptional')}</label>
            <div className="grid grid-cols-2 gap-2">
              {genresList.map(genre => {
                const isSelected = genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`rounded-full border px-3 py-2.5 text-[12px] font-medium text-center transition-colors
                                ${isSelected
                                  ? 'border-infrared/60 bg-infrared/10 text-infrared'
                                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25'}`}
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
              <label className={labelClass}>{t('editProfile.instagram')} *</label>
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
                  placeholder={t('addProfile.usernamePlaceholder')}
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
            </div>

            {/* Artist-specific */}
            {role === 'ARTIST' && (
              <>
                <div className="form-group">
                  <label className={labelClass}>{t('addProfile.raOptional')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('editProfile.raArtistName')}
                    value={residentAdvisor}
                    onChange={(e) => setResidentAdvisor(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className={labelClass}>{t('addProfile.soundcloudOptional')}</label>
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
                  <label className={labelClass}>{t('editProfile.agencyName')} *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('addProfile.agencyPlaceholder')}
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className={labelClass}>{t('addProfile.linkedinOptional')}</label>
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
                  <label className={labelClass}>{t('editProfile.venueCapacity')} *</label>
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
                <label className={labelClass}>{t('addProfile.websiteOptional')}</label>
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
                <label className={labelClass}>{t('addProfile.websiteOptional')}</label>
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
        {/* Step header */}
        <div className="mb-4">
          <p className="m-0 text-[10px] uppercase tracking-[0.2em] text-white/40 font-tech">
            {t('addProfile.stepOf', { n: step, m: TOTAL_STEPS })}
          </p>
          <h2 className="m-0 mt-1 text-[20px] font-semibold text-white font-space-grotesk tracking-[-0.01em]">
            {stepTitles[step]}
          </h2>
        </div>

        {/* Progress line */}
        <div className="w-full h-[3px] rounded-full bg-white/10 overflow-hidden mb-6">
          <div
            className="h-full rounded-full bg-infrared transition-[width] duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
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

// Shared label class (Obsidian Neon micro-label)
const labelClass = 'block text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40 font-tech mb-2';

export default AddProfileScreen;
