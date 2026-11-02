import React, { Suspense, lazy, useEffect, useState } from 'react';
import OverlayPortal from './OverlayPortal';
import PdfViewerModal from './PdfViewerModal';
import { useLanguage } from '../../contexts/LanguageContext';

// Lazy for the same reason as PdfViewerModal: react-pdf and its worker stay
// out of the entry bundle until a document is actually shown.
const PdfViewer = lazy(() => import('./PdfViewer'));

/** True when the side-by-side preview pane is on screen (desktop widths). */
const PANE_QUERY = '(min-width: 1024px)';
export const previewPaneVisible = () => typeof window !== 'undefined' && window.matchMedia(PANE_QUERY).matches;
// Same answer as state, so the inline viewer only mounts where it is shown.
const usePaneVisible = () => {
  const [on, setOn] = useState(previewPaneVisible);
  useEffect(() => {
    const mq = window.matchMedia(PANE_QUERY);
    const sync = () => setOn(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return on;
};

/**
 * The PDF next to the form. Desktop: an inline viewer with "Open full
 * screen"; when the form changed since the last build the old PDF stays,
 * dimmed, under an "Update preview" pill. Mobile: the pane is hidden and a
 * single button opens the same PDF full-screen.
 *
 * props: url (blob URL or null), title, building, stale, onRefresh,
 * viewing / setViewing (full-screen state owned by the caller), emptyText.
 */
export const DocPreviewPane = ({ url, title, building, stale, onRefresh, viewing, setViewing, refreshLabel, emptyText }) => {
  const { t } = useLanguage();
  const refresh = refreshLabel || t('invoices.updatePreview');
  const paneOn = usePaneVisible();
  return (
    <>
      {paneOn && <div className="doc-preview">
        <div className="doc-preview-bar">
          <span className="truncate">{building ? t('templates.building') : title ? <strong>{title}</strong> : null}</span>
          {url && !building && <button type="button" className="template-act" onClick={() => setViewing(true)}>{t('templates.openFull')}</button>}
        </div>
        <div className={`doc-preview-body${stale && url ? ' is-stale' : ''}`}>
          {url ? (
            <div className="doc-preview-pdf">
              <Suspense fallback={<p className="doc-preview-empty">{t('common.loading')}</p>}>
                <PdfViewer key={url} url={url} />
              </Suspense>
            </div>
          ) : (
            <p className="doc-preview-empty">{building ? t('templates.building') : emptyText || t('templates.previewHint')}</p>
          )}
          {url && stale && !building && (
            <div className="doc-preview-stale">
              <span>{t('templates.staleHint')}</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={onRefresh}>{refresh}</button>
            </div>
          )}
          {url && building && <div className="doc-preview-stale"><span>{t('templates.building')}</span></div>}
        </div>
      </div>}
      <div className="doc-preview-mobile">
        {building && <span className="form-hint m-0">{t('templates.building')}</span>}
        {url && !building && <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewing(true)}>{t('templates.openPreview')}</button>}
        {url && !building && stale && <button type="button" className="btn btn-outline btn-sm" onClick={onRefresh}>{refresh}</button>}
        {title && !building && <span className="form-hint m-0">{title}</span>}
      </div>
      {viewing && url && <PdfViewerModal url={url} title={title} onClose={() => setViewing(false)} />}
    </>
  );
};

/**
 * Shell for the two document modals (issue an invoice, draft a contract):
 * head, a body that is one column on mobile and form | preview on desktop,
 * and the action row. `preview` takes DocPreviewPane props.
 */
const DocModal = ({ title, subtitle, onClose, preview, actions, children, className = '' }) => (
  <OverlayPortal>
    <div className="delete-modal-overlay" onClick={onClose}>
      <div className={`delete-modal doc-modal ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="doc-modal-head">
          <h2 className="modal-title">{title}</h2>
          {subtitle && <p className="form-hint m-0">{subtitle}</p>}
        </div>
        <div className="doc-modal-body">
          <div className="doc-form">{children}</div>
          {preview && <DocPreviewPane {...preview} />}
        </div>
        <div className="delete-modal-actions">{actions}</div>
      </div>
    </div>
  </OverlayPortal>
);

export default DocModal;
