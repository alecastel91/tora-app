import React from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';

/** Full-screen image viewer (payment proofs, photos). PDFs go through PdfViewerModal. */
const ImageLightbox = ({ url, title, onClose }) => {
  const { t } = useLanguage();
  if (!url) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ padding: 0, zIndex: 10001 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        // 100dvh accounts for mobile browser chrome — 100vh on iOS pushes the
        // close button off-screen when the URL bar shows.
        style={{ width: '100%', maxWidth: '100vw', height: '100dvh', maxHeight: '100dvh', padding: 0, display: 'flex', flexDirection: 'column', borderRadius: 0 }}
      >
        <div className="modal-header" style={{ padding: '12px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#0c0c11', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#08080b', padding: '16px' }}>
          <img
            src={url}
            alt={title}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextSibling;
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <div style={{ display: 'none', color: '#F5576C', textAlign: 'center', maxWidth: '420px' }}>
            <p style={{ marginBottom: '8px' }}>{t('bookings.imageLoadFailed')}</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#FF3366' }}>{t('bookings.viewProof')}</a>
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ImageLightbox;
