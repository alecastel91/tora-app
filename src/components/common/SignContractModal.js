import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useLanguage } from '../../contexts/LanguageContext';

const SignContractModal = ({
  isOpen, onClose, onSign, contractUrl, dealId, senderName, onOpenContract,
  mode = 'sign', // 'sign' (recipient) | 'sign-and-send' (sender)
  signerCapacity, // e.g. "As Agent on behalf of Lara X"
  recipientName, // for sign-and-send mode
  initiallyViewed = false, // true if the user already opened the contract elsewhere
  onContractViewed, // (optional) called once the contract PDF has actually loaded
  viewConfirmedSignal = 0, // increment from parent to confirm the PDF finished loading
}) => {
  const { t } = useLanguage();
  const isSendAndSign = mode === 'sign-and-send';
  // Sender already has the file (they uploaded it); recipient must open it
  // at least once AND have it actually load before signing.
  const [hasViewedContract, setHasViewedContract] = useState(isSendAndSign || initiallyViewed);
  const [openClicked, setOpenClicked] = useState(false);

  // Parent-driven confirmation: when the PdfViewer fires onLoaded, the parent
  // increments viewConfirmedSignal — only then do we count it as "viewed".
  useEffect(() => {
    if (viewConfirmedSignal > 0) {
      setHasViewedContract(true);
      if (onContractViewed) onContractViewed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewConfirmedSignal]);
  const [fullName, setFullName] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [viewingStartTime, setViewingStartTime] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const sigPadRef = useRef(null);
  const drawWrapRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(440);

  useEffect(() => {
    if (isOpen) {
      setViewingStartTime(Date.now());
      setFullName('');
      setConsentGiven(false);
      setError('');
      setHasDrawn(false);
      setHasViewedContract(isSendAndSign || initiallyViewed);
      setOpenClicked(false);
    }
  }, [isOpen, isSendAndSign, initiallyViewed]);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (drawWrapRef.current) {
        setCanvasWidth(drawWrapRef.current.clientWidth);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isOpen]);

  const clearSignature = () => {
    sigPadRef.current?.clear();
    setHasDrawn(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isSendAndSign && !hasViewedContract) {
      setError(t('contract.reviewFirst'));
      return;
    }
    if (!fullName.trim()) {
      setError(t('contract.enterLegalName'));
      return;
    }
    if (!consentGiven) {
      setError(t('contract.mustConsent'));
      return;
    }

    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setError(t('contract.drawSignature'));
      return;
    }
    const signatureImage = sigPadRef.current.getCanvas().toDataURL('image/png');

    const viewingTime = viewingStartTime ? Math.floor((Date.now() - viewingStartTime) / 1000) : 0;

    setIsSubmitting(true);
    try {
      await onSign({
        fullName: fullName.trim(),
        consentGiven: true,
        viewingTime,
        signatureMode: 'draw',
        signatureImage,
        signerCapacity,
      });
      onClose();
    } catch (err) {
      setError(err.message || t('contract.signFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            {isSendAndSign ? t('contract.signAndSend') : t('contract.signContract')}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(138, 43, 226, 0.1)',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid rgba(138, 43, 226, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(138, 43, 226, 1)' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                  {isSendAndSign
                    ? `Contract for ${recipientName || 'the other party'}`
                    : `Contract from ${senderName}`}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#999' }}>
                  {isSendAndSign
                    ? t('contract.signFirstNote')
                    : t('contract.reviewBeforeSigning')}
                </p>
                {signerCapacity && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'rgba(138, 43, 226, 1)', fontWeight: 600 }}>
                    Signing {signerCapacity}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => {
                setOpenClicked(true);
                if (onOpenContract) onOpenContract();
                else window.open(contractUrl, '_blank');
              }}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Open Contract (PDF){!isSendAndSign && hasViewedContract ? ' ✓' : ''}
            </button>
            {!isSendAndSign && !hasViewedContract && (
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#888' }}>
                {openClicked
                  ? t('contract.waitingForLoad')
                  : 'You must open and review the contract before signing.'}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="fullName" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Full Legal Name *
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('contract.enterLegalName')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
                disabled={isSubmitting}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Signature *
              </label>
              <div ref={drawWrapRef}>
                <div style={{
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  overflow: 'hidden',
                }}>
                  <SignatureCanvas
                    ref={sigPadRef}
                    penColor="#111"
                    backgroundColor="#fff"
                    onEnd={() => setHasDrawn(true)}
                    canvasProps={{
                      width: canvasWidth,
                      height: 140,
                      style: { display: 'block', width: '100%', height: '140px', touchAction: 'none' },
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    {t('contract.signHint')}
                  </span>
                  <button
                    type="button"
                    onClick={clearSignature}
                    disabled={isSubmitting}
                    style={{
                      background: 'transparent',
                      color: '#aaa',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '4px',
                      padding: '4px 12px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', lineHeight: '1.5' }}>
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  disabled={isSubmitting}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                  required
                />
                <span>
                  {t('contract.consentText')}
                </span>
              </label>
            </div>

            {error && (
              <div style={{
                marginBottom: '16px',
                padding: '10px 12px',
                backgroundColor: 'rgba(255, 51, 51, 0.1)',
                border: '1px solid rgba(255, 51, 51, 0.3)',
                borderRadius: '6px',
                color: '#ff3333',
                fontSize: '13px'
              }}>
                {error}
              </div>
            )}

            <div style={{
              marginBottom: '20px',
              padding: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#666',
              lineHeight: '1.4'
            }}>
              <strong>{t('contract.securityNoteTitle')}</strong> {t('contract.securityNote')}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? (isSendAndSign ? 'Sending...' : 'Signing...')
                  : (isSendAndSign ? '✓ Sign & Send' : '✓ Sign Contract')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignContractModal;
