import React, { useEffect, useState } from 'react';
import OverlayPortal from './OverlayPortal';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import useBusyAction from '../../hooks/useBusyAction';
import { TemplateKindBadge } from './TemplatesSection';

/**
 * Draft a contract for an accepted booking from one of the member's
 * templates. Clause templates (basic / PDF letterhead): every clause is
 * editable in place. Word templates: the blanks TORA fills are editable, and
 * so is every paragraph of the document. Either way, ask for a change in
 * words and the altered parts come back highlighted; preview the PDF; then
 * "Continue to sign" builds it and hands it to the existing sign-and-send
 * step via onReady({ id, title, url }) — the same shape AddContractModal
 * produces.
 */
const DraftContractModal = ({ isOpen, deal, currentUser, onClose, onReady }) => {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [kind, setKind] = useState(null);
  const [draft, setDraft] = useState(null);
  const [edits, setEdits] = useState({});          // Word: ref → new paragraph text
  const [changed, setChanged] = useState([]);      // section indexes or paragraph refs the AI touched
  const [summary, setSummary] = useState('');
  const [instruction, setInstruction] = useState('');
  const [saveToTemplate, setSaveToTemplate] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showText, setShowText] = useState(false);
  const [busy, run] = useBusyAction();

  const reset = () => { setDraft(null); setKind(null); setEdits({}); setChanged([]); setSummary(''); setInstruction(''); setSaveToTemplate(false); setShowText(false); dropPreview(); };
  const dropPreview = () => setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });

  useEffect(() => {
    if (!isOpen || !deal?.id || !currentUser?.id) return;
    let cancelled = false;
    reset(); setNeedsSetup(false); setTemplates([]); setTemplateId(null);
    apiService.contractTemplates.list(currentUser.id)
      .then((r) => { if (cancelled) return; setTemplates(r.templates || []); if (!r.templates?.length) setNeedsSetup(true); else setTemplateId(r.defaultId || r.templates[0].id); })
      .catch(() => { if (!cancelled) setNeedsSetup(true); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen || !deal?.id || !currentUser?.id || !templateId) return;
    let cancelled = false;
    reset();
    apiService.draftContract(currentUser.id, deal.id, templateId)
      .then((r) => { if (!cancelled) { setKind(r.kind); setDraft(r.draft); } })
      .catch((e) => { if (cancelled) return; if (e.code === 'CONTRACT_TEMPLATE_MISSING') setNeedsSetup(true); else appAlert(e.message || t('common.error')); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!isOpen) dropPreview(); }, [isOpen]);

  if (!isOpen || !deal) return null;
  const isWord = kind === 'docx';

  // ---- clause drafts
  const setSection = (i, patch) => { setDraft((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })); setChanged((c) => c.filter((n) => n !== i)); dropPreview(); };
  // ---- Word drafts
  const setField = (key, value) => { setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, value } : f)) })); dropPreview(); };
  const paragraphText = (p) => (edits[p.ref] !== undefined ? edits[p.ref] : p.text);
  const setParagraph = (ref, text) => { setEdits((e) => ({ ...e, [ref]: text })); setChanged((c) => c.filter((r) => r !== ref)); dropPreview(); };

  const payload = () => (isWord
    ? { title: draft.title, fields: Object.fromEntries(draft.fields.map((f) => [f.key, f.value])), paragraphs: Object.entries(edits).map(([ref, text]) => ({ ref, text })) }
    : { sections: draft.sections, title: draft.title, signatureBlock: draft.signatureBlock, saveToTemplate });

  const applyInstruction = () => {
    if (!instruction.trim() || !draft) return;
    run(async () => {
      let r;
      if (isWord) {
        const paragraphs = draft.paragraphs.map((p) => ({ ref: p.ref, text: paragraphText(p) }));
        r = await apiService.editContractDraft(currentUser.id, deal.id, { paragraphs, instruction: instruction.trim() }, templateId);
        setEdits((e) => ({ ...e, ...Object.fromEntries((r.edits || []).map((x) => [x.ref, x.text])) }));
        setChanged((r.edits || []).map((x) => x.ref)); setShowText(true);
      } else {
        r = await apiService.editContractDraft(currentUser.id, deal.id, { sections: draft.sections, instruction: instruction.trim() }, templateId);
        setDraft((d) => ({ ...d, sections: r.sections }));
        setChanged(r.changed || []);
      }
      setSummary(r.summary || ''); setInstruction(''); dropPreview();
    });
  };

  const doPreview = () => draft && run(async () => {
    dropPreview();
    const url = await apiService.renderContractDraft(currentUser.id, deal.id, { ...payload(), preview: true }, templateId);
    setPreviewUrl(url);
  });

  const continueToSign = () => draft && run(async () => {
    const r = await apiService.renderContractDraft(currentUser.id, deal.id, payload(), templateId);
    onReady({ id: r.documentId, title: r.documentTitle, url: r.documentUrl, type: 'generated' });
    onClose();
  });

  const selected = templates.find((x) => x.id === templateId);

  return (
    <OverlayPortal>
      <div className="delete-modal-overlay" onClick={onClose}>
        <div className="delete-modal contract-draft-modal" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-content">
            <h2 className="modal-title">{t('contracts.draftTitle')}</h2>
            <p className="form-hint" style={{ marginTop: 0 }}>{deal.eventName || deal.venueName}</p>

            {needsSetup ? (
              <div className="agency-card">
                <p className="m-0 text-sm text-white">{t('contracts.setupFirst')}</p>
                <p className="form-hint">{t('contracts.setupWhere')}</p>
              </div>
            ) : (
              <>
                {templates.length > 1 && (
                  <>
                    <label className="form-label">{t('templates.choose')}</label>
                    <div className="invoice-kind-row">
                      {templates.map((x) => (
                        <button key={x.id} type="button" className={`btn btn-sm ${templateId === x.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTemplateId(x.id)}>{x.name}</button>
                      ))}
                    </div>
                  </>
                )}
                {selected && <p className="form-hint template-line"><TemplateKindBadge kind={selected.kind} /> {t(`contracts.kindExplain.${selected.kind}`)}</p>}

                {!draft ? (
                  <p className="form-hint">{t('common.loading')}</p>
                ) : isWord ? (
                  <>
                    <h4 className="calendar-sync-sub">{t('contracts.fieldsTitle')}</h4>
                    {draft.fields.length ? (
                      <div className="contract-fields">
                        {draft.fields.map((f) => (
                          <div key={f.key} className="invoice-field">
                            <label className="form-label">{t(`contracts.ph.${f.key}`)} <span className="form-hint m-0">· {f.original}</span></label>
                            <input type="text" className="form-input" value={f.value} onChange={(e) => setField(f.key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    ) : <p className="form-hint">{t('contracts.blanksNone')}</p>}
                    <button type="button" className="btn btn-outline btn-sm self-start" onClick={() => setShowText((v) => !v)}>{showText ? t('contracts.hideText') : t('contracts.showText')}</button>
                    {showText && (
                      <div className="contract-draft-clauses">
                        {draft.paragraphs.map((p) => (
                          <div key={p.ref} className={`contract-clause${changed.includes(p.ref) ? ' is-changed' : ''}`}>
                            {changed.includes(p.ref) && <span className="contract-changed-chip">{t('contracts.changed')}</span>}
                            <textarea className="form-input" rows={Math.min(6, Math.max(2, Math.ceil(paragraphText(p).length / 90)))} value={paragraphText(p)} onChange={(e) => setParagraph(p.ref, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="invoice-field">
                      <label className="form-label">{t('contracts.title')}</label>
                      <input type="text" className="form-input" value={draft.title} onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); dropPreview(); }} />
                    </div>
                    <div className="contract-draft-clauses">
                      {draft.sections.map((s, i) => (
                        <div key={i} className={`contract-clause${changed.includes(i) ? ' is-changed' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className="contract-clause-no">{i + 1}.</span>
                            <input type="text" className="form-input flex-1" value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} />
                            {changed.includes(i) && <span className="contract-changed-chip">{t('contracts.changed')}</span>}
                          </div>
                          <textarea className="form-input" rows={4} value={s.body} onChange={(e) => setSection(i, { body: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {draft && (
                  <>
                    {summary && <p className="form-hint">{summary}</p>}
                    <div className="invoice-field">
                      <label className="form-label">{t('contracts.askForChange')}</label>
                      <div className="flex gap-2">
                        <input type="text" className="form-input flex-1" placeholder={t('contracts.askPlaceholder')} value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyInstruction(); }} />
                        <button type="button" className="btn btn-outline" disabled={busy || !instruction.trim()} onClick={applyInstruction}>{busy ? '…' : t('contracts.apply')}</button>
                      </div>
                    </div>
                    {!isWord && (
                      <label className="settings-toggle mt-2">
                        <input type="checkbox" checked={saveToTemplate} onChange={(e) => setSaveToTemplate(e.target.checked)} />
                        <span>{t('contracts.saveToTemplate')}</span>
                      </label>
                    )}
                    {isWord && <p className="form-hint">{t('contracts.docxEditHint')}</p>}
                    {previewUrl && (
                      <div className="invoice-preview">
                        <iframe title="contract preview" src={previewUrl} />
                      </div>
                    )}
                    <p className="form-hint">{t('contracts.notLegalAdvice')}</p>
                  </>
                )}
              </>
            )}
          </div>
          <div className="delete-modal-actions">
            <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
            {draft && !needsSetup && !previewUrl && <button className="btn btn-outline" disabled={busy} onClick={doPreview}>{busy ? '…' : t('contracts.preview')}</button>}
            {draft && !needsSetup && <button className="btn btn-primary" disabled={busy} onClick={continueToSign}>{busy ? '…' : t('contracts.continueToSign')}</button>}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default DraftContractModal;
