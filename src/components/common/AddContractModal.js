import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { uploadDocument } from '../../services/contractService';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * AddContractModal — single-screen picker. Two ways to attach a contract PDF:
 *   - Pick from the user's library (any previously uploaded PDF on their profile)
 *   - Upload a new PDF (drag-drop or browse, lands in Supabase Storage)
 *
 * On submit, the chosen PDF is handed to the parent's onSave, which then
 * routes through the Sign & Send flow (sender pre-signs, recipient signs in
 * app, certificate of completion + emails on FULLY_SIGNED).
 *
 * No external link option: external links bypass TORA's audit trail (PDF
 * hash, signature capture, certificate, email pipeline) and create a two-tier
 * trust model. Real DocuSign / HelloSign integrations are a future feature.
 */

const AddContractModal = ({
  isOpen,
  onClose,
  onSave,
  categoryLabel = 'Contract',
  initialTitle = '',
  existingContracts = [],
  submitLabel = null, // override to "Add" when used from manage-library screens
  submittingLabel = null,
}) => {
  const { t } = useLanguage();
  const displayLabel = {
    'Contract': t('chat.contract'),
    'Press Kit': t('chat.pressKit'),
    'Technical Rider': t('chat.technicalRider'),
    'Hospitality Rider': t('chat.hospitalityRider'),
    'Invoice': t('chat.invoice'),
  }[categoryLabel] || categoryLabel;
  const { user } = useAppContext();
  const [title, setTitle] = useState(initialTitle);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedExistingContract, setSelectedExistingContract] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialTitle);
    setSelectedFile(null);
    setSelectedExistingContract(null);
    setError('');
  }, [isOpen, initialTitle]);

  const handleFileSelect = (file) => {
    setError('');
    if (file.type !== 'application/pdf') { setError(t('docs.onlyPdf')); return; }
    if (file.size > 10 * 1024 * 1024) { setError(t('docs.under10mb')); return; }
    setSelectedFile(file);
    setSelectedExistingContract(null);
    if (!title) setTitle(file.name.replace(/\.pdf$/i, ''));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!selectedExistingContract && !selectedFile) {
      setError(t('docs.pickOrUpload'));
      return;
    }
    if (selectedFile && !title.trim()) {
      setError(t('docs.enterTitleError', { label: displayLabel.toLowerCase() }));
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedExistingContract) {
        await onSave({
          type: 'existing',
          title: selectedExistingContract.title,
          url: selectedExistingContract.url,
          existingContract: selectedExistingContract,
        });
      } else {
        const token = localStorage.getItem('token');
        const uploadResult = await uploadDocument(selectedFile, user.id, token);
        await onSave({
          type: 'upload',
          title: title.trim(),
          url: uploadResult.fileUrl,
          storagePath: uploadResult.storagePath,
          fileSize: uploadResult.fileSize,
          existingContract: null,
        });
      }

      setTitle('');
      setSelectedFile(null);
      setSelectedExistingContract(null);
      onClose();
    } catch (err) {
      setError(err.message || t('docs.addFailed', { label: displayLabel.toLowerCase() }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{t('docs.addCategory', { label: displayLabel })}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <form onSubmit={handleSubmit}>
            {existingContracts.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: '600', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('docs.fromYourLibrary')}
                </label>
                <div style={{
                  maxHeight: '220px', overflowY: 'auto',
                  border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                }}>
                  {existingContracts.map((contract, index) => {
                    const isSelected = selectedExistingContract?.id === contract.id;
                    return (
                      <div
                        key={contract.id || index}
                        onClick={() => { setSelectedExistingContract(contract); setSelectedFile(null); }}
                        style={{
                          padding: '12px 14px',
                          borderBottom: index < existingContracts.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(255, 51, 102, 0.1)' : 'transparent',
                          display: 'flex', alignItems: 'center', gap: '12px',
                        }}
                      >
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px',
                          border: `2px solid ${isSelected ? '#FF3366' : 'rgba(255, 255, 255, 0.3)'}`,
                          backgroundColor: isSelected ? '#FF3366' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {isSelected && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: 500 }}>
                          {contract.title}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.45 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: '600', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {existingContracts.length > 0 ? t('docs.orUploadNew') : t('docs.uploadAPdf')}
              </label>

              {selectedFile && (
                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="title" style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>
                    {t('docs.categoryTitleRequired', { label: displayLabel })}
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('docs.titlePlaceholder')}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              )}

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                style={{
                  border: `2px dashed ${isDragging ? '#FF3366' : 'rgba(255, 255, 255, 0.2)'}`,
                  borderRadius: '8px', padding: '24px', textAlign: 'center',
                  backgroundColor: isDragging ? 'rgba(255, 51, 102, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.2s',
                }}
              >
                {selectedFile ? (
                  <div>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF3366" strokeWidth="2" style={{ margin: '0 auto 10px' }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{selectedFile.name}</p>
                    <p style={{ fontSize: '11px', color: '#999' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button
                      type="button"
                      onClick={() => { setSelectedFile(null); setTitle(''); }}
                      style={{ marginTop: '10px', padding: '5px 12px', backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}
                    >
                      {t('viewProfile.remove')}
                    </button>
                  </div>
                ) : (
                  <>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 10px', opacity: 0.3 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <p style={{ fontSize: '13px', marginBottom: '8px' }}>{t('docs.dragDrop')}</p>
                    <label style={{ display: 'inline-block', padding: '7px 14px', backgroundColor: 'var(--primary-pink)', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                      {t('docs.browseFiles')}
                      <input type="file" accept="application/pdf" onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])} style={{ display: 'none' }} disabled={isSubmitting} />
                    </label>
                    <p style={{ fontSize: '11px', color: '#666', marginTop: '10px' }}>{t('docs.pdfOnlyMax')}</p>
                  </>
                )}
              </div>
            </div>

            <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', fontSize: '11px', color: '#888', lineHeight: '1.5' }}>
              {t('docs.uploadPrivacyNote')}
            </div>

            {error && (
              <div style={{ marginTop: '14px', padding: '10px 12px', backgroundColor: 'rgba(255, 51, 51, 0.1)', border: '1px solid rgba(255, 51, 51, 0.3)', borderRadius: '6px', color: '#ff3333', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }} disabled={isSubmitting}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                {isSubmitting ? (submittingLabel || t('docs.preparing')) : (submitLabel || t('docs.continueToSign'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddContractModal;
