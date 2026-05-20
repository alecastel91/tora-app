import React from 'react';
import { createPortal } from 'react-dom';
import PdfViewer from './PdfViewer';

// Shared PDF viewer modal — portals to document.body so it escapes any
// overflow:hidden ancestor (iOS Safari fix), full-screen on mobile via
// 100dvh, and exposes a header with Download + Open-in-new-tab + Close.
// Used by BookingsScreen, ChatScreen, ManageProfileScreen, ManageArtistScreen.
const PdfViewerModal = ({ url, onClose, title, onLoaded }) => {
  if (!url) return null;

  const filename = (() => {
    if (title) return title;
    try {
      const pathPart = decodeURIComponent(url.split('/api/contracts/files/')[1]?.split('?')[0] || '');
      const raw = pathPart.split('/').pop() || 'document.pdf';
      return raw.replace(/^\d+-[a-z0-9]+-/, '');
    } catch {
      return 'document.pdf';
    }
  })();

  const iconBtnStyle = {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderRadius: '8px',
    padding: 0,
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ padding: 0, zIndex: 10001 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          color: '#fff',
        }}>
          <h3 title={filename} style={{
            margin: 0,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '14px',
            fontWeight: 600,
          }}>{filename}</h3>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              title="Download"
              aria-label="Download"
              style={iconBtnStyle}
              onClick={async () => {
                try {
                  const response = await fetch(url);
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  const blob = await response.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = blobUrl;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(blobUrl);
                } catch {
                  alert('Download failed. Try "Open in new tab" and save from there.');
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              aria-label="Open in new tab"
              style={{ ...iconBtnStyle, textDecoration: 'none' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              style={iconBtnStyle}
              onClick={onClose}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <PdfViewer url={url} onLoaded={onLoaded} />
      </div>
    </div>,
    document.body,
  );
};

export default PdfViewerModal;
