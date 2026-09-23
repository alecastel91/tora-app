import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { genresList, getZoneFromCountry } from '../../data/profiles';
import { CloseIcon } from '../../utils/icons';
import apiService from '../../services/api';
import CitySearch from '../common/CitySearch';
import { downscaleImageToDataUrl } from '../../utils/image';
import { appAlert } from '../../utils/dialogs';
import { RA_URL_RE } from '../common/HighlightsList';

const MAX_PROFILE_PHOTOS = 8;
// Plausible highlight years — upper bound derived from today. The three core
// fields (venue / city-or-artist / year) are MANDATORY for rows added or
// edited in this session; only the RA link stays optional (but must be a
// valid RA host when present). Rows loaded from the profile and left
// untouched are GRANDFATHERED — legacy lenient-era entries never lock the
// Save button. Blank rows the user never filled are dropped, not blocking.
const HIGHLIGHT_YEAR_MIN = 1980;
const HIGHLIGHT_YEAR_MAX = new Date().getFullYear();
const highlightMidField = (role) => (role === 'ARTIST' ? 'city' : 'artist');
const highlightRowBlank = (h) =>
  !String(h?.venue || '').trim() && !String(h?.city || '').trim()
  && !String(h?.artist || '').trim() && !String(h?.year || '').trim()
  && !String(h?.raUrl || '').trim();
// Mirrors the server's grandfather signature (raw values, all fields).
const highlightSignature = (h) => JSON.stringify([
  String(h?.venue || ''), String(h?.city || ''), String(h?.artist || ''),
  String(h?.year || ''), String(h?.raUrl || ''),
]);
// null | 'incomplete' | 'year' | 'raUrl' — blank rows never block
const highlightRowIssue = (h, role) => {
  if (!h || highlightRowBlank(h)) return null;
  const mid = String(h[highlightMidField(role)] || '').trim();
  if (!String(h.venue || '').trim() || !mid || !String(h.year || '').trim()) return 'incomplete';
  const n = parseInt(h.year, 10);
  if (!(Number.isInteger(n) && n >= HIGHLIGHT_YEAR_MIN && n <= HIGHLIGHT_YEAR_MAX)) return 'year';
  if (String(h.raUrl || '').trim() && !RA_URL_RE.test(h.raUrl)) return 'raUrl';
  return null;
};

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
    pastHighlights: Array.isArray(user?.pastHighlights) ? user.pastHighlights : [],
    city: initialLocation.city,
    country: initialLocation.country,
    zone: initialLocation.zone
  });
  const [selectedGenres, setSelectedGenres] = useState(new Set(user?.genres || []));
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showGenresDropdown, setShowGenresDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Role-specific gallery (VENUE: venue photos, PROMOTER: past flyers).
  // Existing entries are Storage URLs; new ones are data URLs until save.
  const [photos, setPhotos] = useState(Array.isArray(user?.photos) ? user.photos : []);
  const photoInputRef = useRef(null);
  const hasPhotoGallery = editedUser.role === 'VENUE' || editedUser.role === 'PROMOTER';

  const handleAddPhoto = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await downscaleImageToDataUrl(file, { maxDimension: 1280, quality: 0.8 });
      // exact duplicates skipped — photos double as stable React keys
      setPhotos((prev) => (prev.length >= MAX_PROFILE_PHOTOS || prev.includes(dataUrl) ? prev : [...prev, dataUrl]));
    } catch (err) {
      appAlert(err.message || t('editProfile.saveFailed'));
    }
  };

  // Highlight validation only applies to rows ADDED or EDITED this session —
  // rows matching what the profile loaded with pass untouched (the server
  // grandfathers them too, so legacy entries are never silently deleted).
  const initialHighlightSigs = useRef(
    new Set((Array.isArray(user?.pastHighlights) ? user.pastHighlights : []).map(highlightSignature))
  );
  const highlightIssueFor = (h) =>
    (initialHighlightSigs.current.has(highlightSignature(h)) ? null : highlightRowIssue(h, user?.role));
  const highlightsBlocked = useMemo(
    () => (editedUser.pastHighlights || []).some((h) => highlightIssueFor(h)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editedUser.pastHighlights, user?.role]
  );

  // Pointer-based drag-to-reorder. Mouse drags start immediately; touch
  // requires a ~250ms long-press (a wandering finger cancels it), so normal
  // swipes scroll the page instead of scrambling the order. The drag always
  // ends on a window-level pointerup so releasing outside a tile can't
  // leave it stuck.
  const dragFrom = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const longPressTimer = useRef(null);
  const pendingDrag = useRef(null); // { index, x, y, target, pointerId }
  const photoGridRef = useRef(null);

  const beginDrag = (index, target, pointerId) => {
    dragFrom.current = index;
    setDraggingIdx(index);
    try { target.setPointerCapture(pointerId); } catch { /* already released */ }
  };
  const cancelPendingDrag = () => {
    clearTimeout(longPressTimer.current);
    pendingDrag.current = null;
  };

  const handlePhotoPointerDown = (i) => (e) => {
    if (e.pointerType === 'touch') {
      pendingDrag.current = { index: i, x: e.clientX, y: e.clientY, target: e.currentTarget, pointerId: e.pointerId };
      longPressTimer.current = setTimeout(() => {
        const p = pendingDrag.current;
        pendingDrag.current = null;
        if (p) beginDrag(p.index, p.target, p.pointerId);
      }, 250);
    } else {
      beginDrag(i, e.currentTarget, e.pointerId);
    }
  };
  const handlePhotoPointerMove = (e) => {
    if (pendingDrag.current) {
      // finger moved before the long-press armed — it's a scroll, not a drag
      if (Math.hypot(e.clientX - pendingDrag.current.x, e.clientY - pendingDrag.current.y) > 8) {
        cancelPendingDrag();
      }
      return;
    }
    const from = dragFrom.current;
    if (from === null) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { endPhotoDrag(); return; }
    const tile = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-photo-idx]');
    if (!tile) return;
    const over = Number(tile.dataset.photoIdx);
    if (Number.isNaN(over) || over === from) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(over, 0, moved);
      return next;
    });
    dragFrom.current = over;
    setDraggingIdx(over);
  };
  const endPhotoDrag = () => {
    cancelPendingDrag();
    dragFrom.current = null;
    setDraggingIdx(null);
  };

  // Window-level release so a pointerup anywhere ends the drag, and a
  // non-passive touchmove blocker so the page doesn't scroll mid-drag
  // (React's synthetic touch listeners are passive).
  useEffect(() => {
    const end = () => {
      clearTimeout(longPressTimer.current);
      pendingDrag.current = null;
      dragFrom.current = null;
      setDraggingIdx(null);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);
  useEffect(() => {
    const el = photoGridRef.current;
    if (!el) return undefined;
    const onTouchMove = (e) => { if (dragFrom.current !== null) e.preventDefault(); };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [hasPhotoGallery]);

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

      // city/country/zone are real profile columns (search filters read
      // them). Only send them when the picker state is COMPLETE — CitySearch
      // clears all three while typing, and legacy locations may not parse, so
      // a partial state must never wipe the stored columns (bio-only saves
      // included).
      if (!(editedUser.city && editedUser.country && editedUser.zone)) {
        delete updatedProfile.city;
        delete updatedProfile.country;
        delete updatedProfile.zone;
      }
      // This screen never edits the avatar — don't echo it back. Avatar
      // uploads go through ProfileScreen, which sends only { avatar }.
      delete updatedProfile.avatar;

      // Photo gallery only exists for venues/promoters; other roles must not
      // echo (or wipe) the stored value.
      if (hasPhotoGallery) {
        updatedProfile.photos = photos.slice(0, MAX_PROFILE_PHOTOS);
      } else {
        delete updatedProfile.photos;
      }

      // Highlights: untouched blank rows are dropped, not sent; anything
      // added or edited this session that's still incomplete blocks the save
      // (the button is disabled too — this is the defensive path). Untouched
      // legacy rows pass through and the server grandfathers them.
      if (Array.isArray(updatedProfile.pastHighlights)) {
        updatedProfile.pastHighlights = updatedProfile.pastHighlights.filter((h) => !highlightRowBlank(h));
        if (updatedProfile.pastHighlights.some((h) => highlightIssueFor(h))) {
          setError(t('editProfile.highlightIncomplete'));
          setSaving(false);
          return;
        }
      }

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

          {/* A profile's role is fixed at creation (the backend ignores it on
              update anyway); a different role means a second profile. */}
          <div className="form-group">
            <label>{t('editProfile.role')}</label>
            <input
              type="text"
              value={t(`search.role${(editedUser.role || 'ARTIST').charAt(0)}${(editedUser.role || 'ARTIST').slice(1).toLowerCase()}`)}
              readOnly
              disabled
            />
            <p className="m-0 mt-1.5 text-[11.5px] leading-relaxed text-white/40">{t('editProfile.roleFixed')}</p>
          </div>

          {/* City-first location picker (same UX as the apply form) */}
          <div className="form-group">
            <label>{t('editProfile.city')}</label>
            <CitySearch
              city={editedUser.city || ''}
              country={editedUser.country || ''}
              zone={editedUser.zone || ''}
              onSelect={(nextCity, nextCountry, nextZone) => {
                setEditedUser({ ...editedUser, city: nextCity, country: nextCountry, zone: nextZone });
              }}
            />
          </div>

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

          {editedUser.role === 'VENUE' && (
            <div className="form-group">
              <label>{t('editProfile.venueRooms')}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editedUser.venueRooms || ''}
                onChange={(e) => setEditedUser({ ...editedUser, venueRooms: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder={t('editProfile.venueRoomsPlaceholder')}
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
                        : 'bg-[#0a0a0e] border-white/10 text-white/50 hover:border-white/25 hover:text-white/75'
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
                  {showAllGenres ? t('manageArtist.showLess') : t('manageArtist.showAllGenres', { count: genresList.length })}
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
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              {t('editProfile.soundcloudHint')}
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
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                {t('editProfile.spotifyHint')}
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

        {/* Photo gallery — venues show the space, promoters their flyers */}
        {hasPhotoGallery && (
          <div className="edit-section">
            <div className="flex items-baseline justify-between">
              <h3>{editedUser.role === 'VENUE' ? t('editProfile.venuePhotos') : t('editProfile.pastFlyers')}</h3>
              <span className="text-[10px] font-tech uppercase tracking-[0.15em] text-white/40">
                {photos.length}/{MAX_PROFILE_PHOTOS}
              </span>
            </div>
            <p className="m-0 mb-3 text-xs text-white/40">
              {editedUser.role === 'VENUE' ? t('editProfile.venuePhotosHint') : t('editProfile.pastFlyersHint')}
            </p>
            <div ref={photoGridRef} className="grid grid-cols-3 gap-2">
              {photos.map((src, i) => (
                <div
                  key={src}
                  data-photo-idx={i}
                  onPointerDown={handlePhotoPointerDown(i)}
                  onPointerMove={handlePhotoPointerMove}
                  className={`relative aspect-square rounded-xl border overflow-hidden bg-[#0a0a0e]
                              select-none cursor-grab active:cursor-grabbing
                              ${draggingIdx === i ? 'border-infrared/60 opacity-70' : 'border-white/10'}`}
                >
                  <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    aria-label={t('common.delete')}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 border border-white/20
                               flex items-center justify-center text-white text-sm leading-none cursor-pointer
                               hover:border-role-venue/60 hover:text-role-venue transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photos.length < MAX_PROFILE_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="aspect-square rounded-xl border border-dashed border-white/20 bg-transparent
                             flex flex-col items-center justify-center gap-1 text-white/50 cursor-pointer
                             hover:border-infrared/50 hover:text-infrared transition-colors"
                >
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-[9px] font-tech uppercase tracking-[0.15em]">{t('editProfile.addPhoto')}</span>
                </button>
              )}
            </div>
            {photos.length > 1 && (
              <p className="m-0 mt-2 text-[10px] text-white/30">{t('editProfile.dragToReorder')}</p>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handleAddPhoto}
              style={{ display: 'none' }}
            />
          </div>
        )}

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
            color: '#F5576C'
          }}>
            {error}
          </div>
        )}

        {/* Past highlights — free-text career credits, all main roles.
            Artist: gigs · Promoter: past events · Venue: notable nights */}
        {['ARTIST', 'PROMOTER', 'VENUE'].includes(user?.role) && (
          <div className="edit-section">
            <h3>{t('editProfile.pastHighlights')}</h3>
            <p className="m-0 mb-3 text-xs text-white/40">
              {user.role === 'PROMOTER'
                ? t('editProfile.pastHighlightsHintPromoter')
                : user.role === 'VENUE'
                  ? t('editProfile.pastHighlightsHintVenue')
                  : t('editProfile.pastHighlightsHint')}
            </p>
            <div className="flex flex-col gap-2.5">
              {(editedUser.pastHighlights || []).map((h, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="form-input flex-[2]"
                    placeholder={user?.role === 'VENUE' ? t('offer.eventName') : t('editProfile.venuePlaceholder')}
                    value={h.venue || ''}
                    onChange={(e) => {
                      const next = [...editedUser.pastHighlights];
                      next[i] = { ...next[i], venue: e.target.value };
                      setEditedUser({ ...editedUser, pastHighlights: next });
                    }}
                  />
                  {/* middle field: artists log the city, promoters/venues the artist */}
                  <input
                    type="text"
                    className="form-input flex-[2]"
                    placeholder={user?.role === 'ARTIST' ? t('editProfile.city') : t('search.roleArtist')}
                    value={(user?.role === 'ARTIST' ? h.city : h.artist) || ''}
                    onChange={(e) => {
                      const field = user?.role === 'ARTIST' ? 'city' : 'artist';
                      const next = [...editedUser.pastHighlights];
                      next[i] = { ...next[i], [field]: e.target.value };
                      setEditedUser({ ...editedUser, pastHighlights: next });
                    }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input flex-1 min-w-[64px]"
                    placeholder={t('editProfile.yearPlaceholder')}
                    maxLength={4}
                    value={h.year || ''}
                    onChange={(e) => {
                      const next = [...editedUser.pastHighlights];
                      next[i] = { ...next[i], year: e.target.value.replace(/[^0-9]/g, '') };
                      setEditedUser({ ...editedUser, pastHighlights: next });
                    }}
                  />
                  <button
                    type="button"
                    aria-label={t('common.delete')}
                    className="shrink-0 w-8 h-8 rounded-full border border-white/15 bg-transparent text-white/50 hover:text-role-venue hover:border-role-venue/50 cursor-pointer"
                    onClick={() => {
                      const next = editedUser.pastHighlights.filter((_, j) => j !== i);
                      setEditedUser({ ...editedUser, pastHighlights: next });
                    }}
                  >
                    ×
                  </button>
                </div>
                {/* optional RA event link — only ra.co / residentadvisor.net URLs are stored */}
                <input
                  type="url"
                  className="form-input !text-xs !py-2"
                  placeholder={t('editProfile.raEventLink')}
                  value={h.raUrl || ''}
                  onChange={(e) => {
                    const next = [...editedUser.pastHighlights];
                    next[i] = { ...next[i], raUrl: e.target.value.trim() };
                    setEditedUser({ ...editedUser, pastHighlights: next });
                  }}
                />
                {(() => {
                  const issue = highlightIssueFor(h);
                  if (!issue) return null;
                  return (
                    <p className="m-0 text-[11px] text-role-venue/90">
                      {issue === 'raUrl'
                        ? t('editProfile.raLinkInvalid')
                        : issue === 'year'
                          ? t('editProfile.yearOutOfRange', { min: HIGHLIGHT_YEAR_MIN, max: HIGHLIGHT_YEAR_MAX })
                          : t('editProfile.highlightIncomplete')}
                    </p>
                  );
                })()}
                </div>
              ))}
              {(editedUser.pastHighlights || []).length < 20 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditedUser({
                    ...editedUser,
                    pastHighlights: [...(editedUser.pastHighlights || []), { venue: '', city: '', artist: '', year: '' }],
                  })}
                >
                  + {t('editProfile.addHighlight')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {highlightsBlocked && (
          <p className="m-0 mb-2 text-[11px] text-role-venue/90 text-center">
            {t('editProfile.highlightIncomplete')}
          </p>
        )}
        <div className="edit-actions">
          <button className="btn btn-secondary btn-full" onClick={onClose} disabled={saving}>
            {t('editProfile.cancel')}
          </button>
          <button
            className="btn btn-primary btn-full"
            onClick={handleSave}
            disabled={saving || highlightsBlocked}
          >
            {saving ? t('editProfile.saving') : t('editProfile.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileScreen;