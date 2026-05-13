import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { uploadDocument } from '../../services/contractService';

/**
 * AddContractModal — four ways to attach a contract to a deal:
 *   1. Upload a PDF (drag-drop or browse, lands in Supabase Storage)
 *   2. Generate from a template (auto-fills deal data — Phase C, coming soon)
 *   3. Paste an external link (DocuSign / HelloSign / Dropbox / Gdocs / ...)
 *   4. Pick from the user's previously uploaded library
 *
 * The Skip Contract option lives OUTSIDE this modal (in BookingsScreen + chat).
 */

const TABS = [
  { id: 'upload', label: 'Upload PDF' },
  { id: 'template', label: 'Template' },
  { id: 'link', label: 'External Link' },
  { id: 'library', label: 'Library' },
];

const AddContractModal = ({
  isOpen,
  onClose,
  onSave,
  category = 'contract',
  categoryLabel = 'Contract',
  initialTitle = '',
  initialUrl = '',
  initialType = null,
  existingFileName = '',
  existingContracts = [],
}) => {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState('upload');
  const [title, setTitle] = useState(initialTitle);
  const [selectedFile, setSelectedFile] = useState(null);
  const [externalUrl, setExternalUrl] = useState(initialUrl);
  const [selectedExistingContract, setSelectedExistingContract] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keepExistingFile, setKeepExistingFile] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialTitle);
    setExternalUrl(initialUrl);
    // Default tab order: respect caller-provided initialType, otherwise pick
    // Library when there's something to pick, else Upload as the path of
    // least resistance.
    const fallback = existingContracts.length > 0 ? 'library' : 'upload';
    const wanted = initialType === 'existing' ? 'library' : initialType;
    setActiveTab(wanted && TABS.some((t) => t.id === wanted) ? wanted : fallback);
    setSelectedFile(null);
    setSelectedExistingContract(null);
    setKeepExistingFile(!!existingFileName);
    setError('');
  }, [isOpen, initialTitle, initialUrl, initialType, existingFileName, existingContracts.length]);

  const handleFileSelect = (file) => {
    setError('');
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB');
      return;
    }
    setSelectedFile(file);
    setKeepExistingFile(false);
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

    if (activeTab === 'template') {
      setError('Template generation is coming soon — use Upload, Library, or External Link for now.');
      return;
    }

    if (activeTab === 'library') {
      if (!selectedExistingContract) { setError('Please select a contract from your library'); return; }
    } else if (activeTab === 'upload') {
      if (!selectedFile) { setError('Please select a PDF to upload'); return; }
      if (!title.trim()) { setError(`Please enter a ${categoryLabel.toLowerCase()} title`); return; }
    } else if (activeTab === 'link') {
      if (!title.trim()) { setError(`Please enter a ${categoryLabel.toLowerCase()} title`); return; }
      if (!externalUrl.trim()) { setError(`Please enter a ${categoryLabel.toLowerCase()} URL`); return; }
      try { new URL(externalUrl); } catch { setError('Please enter a valid URL'); return; }
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'upload') {
        const token = localStorage.getItem('token');
        const uploadResult = await uploadDocument(selectedFile, user.id, token);
        // uploadResult.fileUrl is the /api/contracts/files/{path} reference.
        // Hand off as a normal link entry so the rest of the flow doesn't need
        // to care that it came from a fresh upload.
        await onSave({
          type: 'upload',
          title: title.trim(),
          url: uploadResult.fileUrl,
          storagePath: uploadResult.storagePath,
          fileSize: uploadResult.fileSize,
          existingContract: null,
        });
      } else if (activeTab === 'library') {
        await onSave({
          type: 'existing',
          title: selectedExistingContract.title,
          url: selectedExistingContract.url,
          existingContract: selectedExistingContract,
        });
      } else {
        await onSave({
          type: 'link',
          title: title.trim(),
          url: externalUrl.trim(),
          existingContract: null,
        });
      }

      setTitle('');
      setSelectedFile(null);
      setExternalUrl('');
      setSelectedExistingContract(null);
      onClose();
    } catch (err) {
      setError(err.message || `Failed to add ${categoryLabel.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const tabBtn = (tab) => {
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => setActiveTab(tab.id)}
        style={{
          flex: 1,
          padding: '8px 4px',
          backgroundColor: isActive ? '#FF3366' : 'transparent',
          border: 'none',
          borderRadius: '6px',
          color: '#fff',
          fontSize: '11px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {tab.label}
      </button>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Add {categoryLabel}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <div style={{
            display: 'flex', gap: '4px', marginBottom: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '8px'
          }}>
            {TABS.map(tabBtn)}
          </div>

          <form onSubmit={handleSubmit}>
            {activeTab === 'library' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '500' }}>
                  Select from your library
                </label>
                {existingContracts.length > 0 ? (
                  <div style={{
                    maxHeight: '300px', overflowY: 'auto',
                    border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)'
                  }}>
                    {existingContracts.map((contract, index) => {
                      const isSelected = selectedExistingContract?.id === contract.id;
                      return (
                        <div
                          key={contract.id || index}
                          onClick={() => setSelectedExistingContract(contract)}
                          style={{
                            padding: '14px 16px',
                            borderBottom: index < existingContracts.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(255, 51, 102, 0.1)' : 'transparent',
                            transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '12px'
                          }}
                        >
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '4px',
                            border: `2px solid ${isSelected ? '#FF3366' : 'rgba(255, 255, 255, 0.3)'}`,
                            backgroundColor: isSelected ? '#FF3366' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {contract.title}
                            </div>
                            {contract.url && (
                              <div style={{ fontSize: '11px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {contract.url}
                              </div>
                            )}
                          </div>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#666', fontSize: '13px', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                    No contracts in your library yet.<br />Upload one in the Upload tab and it will appear here next time.
                  </div>
                )}
              </div>
            )}

            {(activeTab === 'upload' || activeTab === 'link') && (
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="title" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  {categoryLabel} Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g., Booking Agreement 2026`}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
                  disabled={isSubmitting}
                  required
                />
              </div>
            )}

            {activeTab === 'upload' && (
              <>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  style={{
                    border: `2px dashed ${isDragging ? '#FF3366' : 'rgba(255, 255, 255, 0.2)'}`,
                    borderRadius: '8px', padding: '30px', textAlign: 'center',
                    backgroundColor: isDragging ? 'rgba(255, 51, 102, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    transition: 'all 0.2s', marginBottom: '16px'
                  }}
                >
                  {selectedFile ? (
                    <div>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF3366" strokeWidth="2" style={{ margin: '0 auto 12px' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                      <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{selectedFile.name}</p>
                      <p style={{ fontSize: '12px', color: '#999' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button type="button" onClick={() => setSelectedFile(null)} style={{ marginTop: '12px', padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 12px', opacity: 0.3 }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <p style={{ fontSize: '14px', marginBottom: '8px' }}>Drag and drop your PDF here, or</p>
                      <label style={{ display: 'inline-block', padding: '8px 16px', backgroundColor: '#FF3366', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                        Browse Files
                        <input type="file" accept="application/pdf" onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])} style={{ display: 'none' }} disabled={isSubmitting} />
                      </label>
                      <p style={{ fontSize: '11px', color: '#666', marginTop: '12px' }}>PDF only, max 10MB</p>
                    </>
                  )}
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', fontSize: '11px', color: '#888', lineHeight: '1.5' }}>
                  Uploaded PDFs are stored privately and also added to your library for reuse on future bookings.
                </div>
              </>
            )}

            {activeTab === 'template' && (
              <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.15)', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '6px' }}>Generate from template — coming soon</p>
                <p style={{ fontSize: '12px', color: '#999', lineHeight: '1.5' }}>
                  We'll auto-fill a standard booking agreement with the deal's parties, date, fee, and extras. You'll be able to download to edit or send as-is.
                </p>
              </div>
            )}

            {activeTab === 'link' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="externalUrl" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    {categoryLabel} URL *
                  </label>
                  <input
                    id="externalUrl"
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://www.docusign.com/..."
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', fontSize: '11px', color: '#888', lineHeight: '1.5' }}>
                  Paste a signing URL from DocuSign, HelloSign / Dropbox Sign, Adobe Sign, PandaDoc, or a Gdocs / Notion / Dropbox link. After both parties sign on the external platform, come back here and mark as signed.
                </div>
              </>
            )}

            {error && (
              <div style={{ marginTop: '16px', padding: '10px 12px', backgroundColor: 'rgba(255, 51, 51, 0.1)', border: '1px solid rgba(255, 51, 51, 0.3)', borderRadius: '6px', color: '#ff3333', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting || activeTab === 'template'}>
                {isSubmitting ? 'Sending...' : 'Send Contract'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddContractModal;
