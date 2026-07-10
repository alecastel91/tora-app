import React, { useState, useEffect, useRef } from 'react';
import { appAlert, appConfirm } from '../../utils/dialogs';
import apiService from '../../services/api';
import { uploadDocument } from '../../services/contractService';
import { DOC_CATEGORIES, categoryStatus } from '../../utils/documentCategories';
import { useLanguage } from '../../contexts/LanguageContext';

const ShareDocumentsModal = ({ isOpen, deal, currentUser, onClose, onDealUpdated }) => {
  const { t } = useLanguage();
  const [artistProfile, setArtistProfile] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [localDeal, setLocalDeal] = useState(deal);

  // Sync from prop only when the underlying deal changes (different deal
  // selected, or initial open). Otherwise trust local optimistic updates —
  // the parent's onDealUpdated triggers a new prop reference with stale
  // sharedDocuments before fetchDeals resolves, which would clobber the
  // optimistic UI we just applied after share/unshare/skip/unskip.
  useEffect(() => { setLocalDeal(deal); }, [deal?.id]);

  useEffect(() => {
    if (!isOpen || !deal?.artistId || deal.artistId === currentUser?.id) {
      setArtistProfile(null);
      return undefined;
    }
    let cancelled = false;
    apiService.getProfile(deal.artistId)
      .then((profile) => { if (!cancelled) setArtistProfile(profile); })
      .catch((err) => {
        console.error('Failed to fetch artist profile:', err);
        if (!cancelled) setArtistProfile(null);
      });
    return () => { cancelled = true; };
  }, [isOpen, deal?.artistId, currentUser?.id]);

  if (!isOpen || !localDeal) return null;

  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div className="delete-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="delete-modal-header">
          <h3>{t('chat.shareDocuments')}</h3>
        </div>
        <div className="delete-modal-content">
          <p style={{ marginBottom: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            {t('docs.sharePickIntro')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '60vh', overflowY: 'auto' }}>
            {DOC_CATEGORIES.map((cat) => {
              const status = categoryStatus(localDeal.sharedDocuments, cat.key);
              const docsSource = artistProfile?.documents?.[cat.key] || currentUser.documents?.[cat.key] || [];
              const sharedEntry = localDeal.sharedDocuments?.[cat.key];

              return (
                <div key={cat.key} style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '14px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: status === 'shared' ? '6px' : '10px', gap: '8px', minWidth: 0 }}>
                    <strong style={{ fontSize: '14px', flexShrink: 0 }}>{cat.label}</strong>
                    {status !== 'pending' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
                        {status === 'skipped' && (
                          <span style={{
                            fontSize: '10px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#888',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 600,
                          }}>
                            Skipped
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={async () => {
                            if (actionBusy) return;
                                                        if (!(await appConfirm(t(status === 'shared' ? 'docs.deleteDocConfirm' : 'docs.unskipDocConfirm', { label: cat.label }), { danger: status === 'shared' }))) return;
                            setActionBusy(true);
                            try {
                              await apiService.resetDocument(localDeal.id, currentUser.id, cat.key);
                              setLocalDeal((prev) => {
                                if (!prev) return prev;
                                const next = { ...(prev.sharedDocuments || {}) };
                                delete next[cat.key];
                                return { ...prev, sharedDocuments: next };
                              });
                              if (onDealUpdated) onDealUpdated({
                                ...localDeal,
                                sharedDocuments: (() => {
                                  const next = { ...(localDeal.sharedDocuments || {}) };
                                  delete next[cat.key];
                                  return next;
                                })(),
                              });
                            } catch (err) {
                              appAlert(err.message || t('docs.resetFailed'));
                            } finally {
                              setActionBusy(false);
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '2px 4px',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: status === 'shared' ? '16px' : '11px',
                            lineHeight: 1,
                            cursor: actionBusy ? 'default' : 'pointer',
                            flexShrink: 0,
                          }}
                          title={status === 'shared' ? t('docs.removeShared') : t('docs.unskipHint')}
                          aria-label={status === 'shared' ? `Delete ${cat.label}` : `Unskip ${cat.label}`}
                        >
                          {status === 'shared' ? '✕' : t('docs.unskip')}
                        </button>
                      </div>
                    )}
                  </div>

                  {status === 'shared' && (
                    <div
                      title={sharedEntry?.documentTitle || ''}
                      style={{
                        fontSize: '12px',
                        color: 'rgba(80,200,120,1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sharedEntry?.documentTitle || ''}
                    </div>
                  )}

                  {status === 'pending' && cat.uploadOnly && (
                    <UploadOnlyPicker
                      category={cat}
                      actionBusy={actionBusy}
                      profileId={currentUser.id}
                      onUploaded={async (uploadResult) => {
                        if (actionBusy) return;
                        setActionBusy(true);
                        try {
                          const docPayload = {
                            id: uploadResult.id || uploadResult.storagePath || `${cat.key}-${Date.now()}`,
                            title: uploadResult.title,
                            url: uploadResult.fileUrl,
                          };
                          await apiService.shareDocument(localDeal.id, currentUser.id, cat.key, docPayload);
                          const nextDeal = {
                            ...localDeal,
                            sharedDocuments: {
                              ...(localDeal.sharedDocuments || {}),
                              [cat.key]: { documentId: docPayload.id, documentUrl: docPayload.url, documentTitle: docPayload.title },
                            },
                          };
                          setLocalDeal(nextDeal);
                          if (onDealUpdated) onDealUpdated(nextDeal);
                        } catch (err) {
                          appAlert(err.message || `Failed to share ${cat.label.toLowerCase()}`);
                        } finally {
                          setActionBusy(false);
                        }
                      }}
                    />
                  )}

                  {status === 'pending' && !cat.uploadOnly && docsSource.length > 0 && docsSource.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        cursor: actionBusy ? 'default' : 'pointer',
                        opacity: actionBusy ? 0.6 : 1,
                        transition: 'all 0.15s',
                      }}
                      onClick={async () => {
                        if (actionBusy) return;
                        setActionBusy(true);
                        try {
                          await apiService.shareDocument(localDeal.id, currentUser.id, cat.key, doc);
                          const nextDeal = {
                            ...localDeal,
                            sharedDocuments: {
                              ...(localDeal.sharedDocuments || {}),
                              [cat.key]: { documentId: doc.id, documentUrl: doc.url, documentTitle: doc.title },
                            },
                          };
                          setLocalDeal(nextDeal);
                          if (onDealUpdated) onDealUpdated(nextDeal);
                        } catch (err) {
                          appAlert(err.message || t('docs.shareFailed'));
                        } finally {
                          setActionBusy(false);
                        }
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,51,102,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,51,102,0.5)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      title={doc.title}
                    >
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>{doc.title}</div>
                    </div>
                  ))}

                  {status === 'pending' && !cat.uploadOnly && docsSource.length === 0 && (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.5 }}>
                      {t('docs.noneInLibraryBefore', { label: cat.label.toLowerCase() })} <strong>{t('chat.manageDocsPath')}</strong>{t('docs.noneInLibraryAfter')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="delete-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>{t('common.done')}</button>
        </div>
      </div>
    </div>
  );
};

// Inline file picker for upload-only categories (e.g. invoice). Uploads via
// the same /api/contracts/upload-document endpoint used by the contract
// modal, then bubbles the resulting metadata up to share it on the deal.
const UploadOnlyPicker = ({ category, actionBusy, profileId, onUploaded }) => {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError(t('docs.uploadPdf'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('docs.max10mb'));
      return;
    }
    setError('');
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const result = await uploadDocument(file, profileId, token);
      await onUploaded({
        id: result.documentId || result.storagePath || `${category.key}-${Date.now()}`,
        title: file.name.replace(/\.pdf$/i, ''),
        fileUrl: result.fileUrl || result.url,
        storagePath: result.storagePath,
      });
    } catch (err) {
      setError(err.message || t('docs.uploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const disabled = uploading || actionBusy;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px dashed rgba(255,51,102,0.5)',
          borderRadius: '6px',
          background: 'rgba(255,51,102,0.05)',
          color: '#FF3366',
          fontSize: '13px',
          fontWeight: 500,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'center',
        }}
      >
        {uploading ? 'Uploading…' : `Upload ${category.label} PDF`}
      </button>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', margin: '6px 0 0 0' }}>
        Fresh upload per booking — PDF only, max 10 MB.
      </p>
      {error && <p style={{ fontSize: '11px', color: '#ff6b6b', margin: '6px 0 0 0' }}>{error}</p>}
    </div>
  );
};

export default ShareDocumentsModal;
