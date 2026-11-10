import React, { useRef } from 'react';
import { downscaleImageToDataUrl } from '../../utils/image';
import { appAlert } from '../../utils/dialogs';
import { useLanguage } from '../../contexts/LanguageContext';

// The booking page's header photo, picked on the offer form. The image is
// downscaled here and re-normalized by the server, like a News post image.
const EventPhotoPicker = ({ value, onChange, disabled = false }) => {
  const { t } = useLanguage();
  const inputRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      onChange(await downscaleImageToDataUrl(file, { maxDimension: 1280, quality: 0.82 }));
    } catch (err) {
      appAlert(err?.message || t('bookings.eventPhotoFailed'));
    }
  };

  return (
    <div className="event-photo-picker">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
      {value ? (
        <div className="event-photo-preview">
          <img src={value} alt="" />
          <div className="event-photo-preview-actions">
            <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
              {t('bookings.changeEventPhoto')}
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={() => onChange(null)}>
              {t('bookings.removeEventPhoto')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="event-photo-empty" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m21 17-5-5-8 7" />
          </svg>
          <span>{t('bookings.addEventPhoto')}</span>
          <small>{t('bookings.eventPhotoHint')}</small>
        </button>
      )}
    </div>
  );
};

export default EventPhotoPicker;
