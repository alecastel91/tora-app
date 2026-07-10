import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * ContractViewer Component
 * Displays PDF contracts in an iframe with viewing time tracking
 */
const ContractViewer = ({ isOpen, onClose, contractUrl, dealId, onTrackView }) => {
  const { t } = useLanguage();
  const [viewingStartTime, setViewingStartTime] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setViewingStartTime(Date.now());
      setIsLoading(true);
    }

    // Track viewing time when modal closes
    return () => {
      if (viewingStartTime && onTrackView) {
        const viewDuration = Math.floor((Date.now() - viewingStartTime) / 1000);
        if (viewDuration > 0) {
          onTrackView(viewDuration);
        }
      }
    };
  }, [isOpen]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '900px',
          width: '90vw',
          maxHeight: '90vh',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Contract Preview
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* PDF Viewer */}
        <div style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#1a1a1a',
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden'
        }}>
          {/* Loading Indicator */}
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255, 255, 255, 0.1)',
                borderTop: '3px solid #FF3366',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px'
              }}></div>
              <p style={{ color: '#999', fontSize: '14px' }}>{t('contract.loadingContract')}</p>
            </div>
          )}

          {/* PDF Iframe */}
          <iframe
            src={contractUrl}
            title="Contract Document"
            onLoad={handleIframeLoad}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: isLoading ? 'none' : 'block'
            }}
          />

          {/* Fallback Link */}
          {!isLoading && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10
            }}>
              <a
                href={contractUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{
                  textDecoration: 'none',
                  fontSize: '12px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Open in New Tab
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Loading Animation CSS */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ContractViewer;
