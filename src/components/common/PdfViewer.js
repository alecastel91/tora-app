import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PdfViewer = ({ url, onLoaded }) => {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(800);
  const loadedFiredRef = useRef(false);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setPageWidth(Math.min(containerRef.current.clientWidth - 16, 1100));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        overflow: 'auto',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex',
          gap: '8px',
          padding: '6px 10px',
          backgroundColor: 'rgba(20,20,20,0.85)',
          borderRadius: '20px',
          marginBottom: '8px',
          backdropFilter: 'blur(6px)',
        }}
      >
        <button
          type="button"
          onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
          style={{ background: 'transparent', color: 'white', border: '1px solid #444', borderRadius: '14px', width: '32px', height: '28px', cursor: 'pointer' }}
          aria-label="Zoom out"
        >
          −
        </button>
        <span style={{ color: 'white', fontSize: '12px', alignSelf: 'center', minWidth: '38px', textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale(s => Math.min(3, s + 0.25))}
          style={{ background: 'transparent', color: 'white', border: '1px solid #444', borderRadius: '14px', width: '32px', height: '28px', cursor: 'pointer' }}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {error ? (
        <div style={{ color: '#ff6b6b', padding: '24px', textAlign: 'center' }}>
          Failed to load PDF.
        </div>
      ) : (
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            if (!loadedFiredRef.current) {
              loadedFiredRef.current = true;
              if (onLoaded) onLoaded();
            }
          }}
          onLoadError={(e) => setError(e)}
          loading={<div style={{ color: '#aaa', padding: '24px' }}>Loading…</div>}
        >
          {Array.from({ length: numPages || 0 }, (_, i) => (
            <div key={i + 1} style={{ marginBottom: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
              <Page
                pageNumber={i + 1}
                width={pageWidth}
                scale={scale}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            </div>
          ))}
        </Document>
      )}
    </div>
  );
};

export default PdfViewer;
