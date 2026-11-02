import React, { useEffect, useRef, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import { isYearlyViewer, openPremium } from '../../utils/subscription';
import useBusyAction from '../../hooks/useBusyAction';
import { TemplateKindBadge } from './TemplatesSection';
import DocModal, { previewPaneVisible } from './DocModal';

/**
 * Draft a contract for an accepted booking from one of the member's
 * templates. Clause templates (basic / PDF letterhead): every clause is
 * editable in place. Word templates: the blanks TORA fills are editable, and
 * so is every paragraph of the document. Either way, ask for a change in
 * words and the altered parts come back highlighted. The PDF sits next to
 * the form on desktop (built as soon as the draft loads, dimmed with an
 * "Update preview" pill once the form changes) and behind a button on
 * mobile; "Continue to sign" builds the final file and hands it to the
 * existing sign-and-send step via onReady({ id, title, url }) — the same
 * shape AddContractModal produces.
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
  const [error, setError] = useState('');             // why the draft could not be built
  const [previewUrl, setPreviewUrl] = useState(null);
  const [stale, setStale] = useState(false);       // the form changed since the PDF was built
  const [building, setBuilding] = useState(false);
  const [viewing, setViewing] = useState(false);   // the preview PDF open full-screen
  const [showText, setShowText] = useState(false);
  const [busy, run] = useBusyAction();
  // Every edit bumps this; a build that started before the last edit comes
  // back already stale instead of showing a PDF for the previous text.
  const editSeq = useRef(0);
  const latest = useRef({});                       // what the form holds now, for builds started earlier
  latest.current = { draft, edits, saveToTemplate, kind, templateId };

  const dropPreview = () => { setViewing(false); setStale(false); setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return null; }); };
  const markStale = () => { editSeq.current += 1; setStale(true); };
  const reset = () => { setDraft(null); setKind(null); setEdits({}); setChanged([]); setSummary(''); setInstruction(''); setSaveToTemplate(false); setShowText(false); dropPreview(); };

  useEffect(() => {
    if (!isOpen || !deal?.id || !currentUser?.id) return;
    let cancelled = false;
    reset(); setNeedsSetup(false); setError(''); setTemplates([]); setTemplateId(null);
    apiService.contractTemplates.list(currentUser.id)
      .then((r) => { if (cancelled) return; setTemplates(r.templates || []); if (!r.templates?.length) setNeedsSetup(true); else setTemplateId(r.defaultId || r.templates[0].id); })
      .catch((e) => { if (!cancelled) setError(e.message || t('common.error')); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen || !deal?.id || !currentUser?.id || !templateId) return;
    let cancelled = false;
    reset(); setError('');
    apiService.draftContract(currentUser.id, deal.id, templateId)
      .then((r) => { if (cancelled) return; setKind(r.kind); setDraft(r.draft); editSeq.current += 1; })
      .catch((e) => { if (cancelled) return; if (e.code === 'CONTRACT_TEMPLATE_MISSING') setNeedsSetup(true); else if (e.code === 'TEMPLATE_NOT_FOUND') dropGone(); else setError(e.message || t('common.error')); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop: the PDF pane is on screen, so build it as soon as a draft is in
  // (once per template; later edits go through "Update preview").
  const loadedFor = draft ? templateId : null;
  useEffect(() => {
    if (!loadedFor || !isOpen || !previewPaneVisible()) return;
    buildPreview();
  }, [loadedFor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!isOpen) dropPreview(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // The chosen template was deleted elsewhere: fall back to the next one.
  const dropGone = () => { const left = templates.filter((x) => x.id !== templateId); setTemplates(left); setTemplateId(left[0]?.id || null); if (!left.length) setNeedsSetup(true); return true; };
  const orPremium = (e) => { if (e.code === 'TEMPLATE_NOT_FOUND') return dropGone(); if (e.code !== 'YEARLY_REQUIRED') return false; openPremium(); return true; };

  const payloadFor = ({ draft: d, edits: ed, saveToTemplate: save, kind: k }) => (k === 'docx'
    ? { title: d.title, fields: Object.fromEntries(d.fields.map((f) => [f.key, f.value])), paragraphs: Object.entries(ed).map(([ref, text]) => ({ ref, text })) }
    : { sections: d.sections, title: d.title, signatureBlock: d.signatureBlock, saveToTemplate: save });

  // Builds the PDF from whatever the form holds now; the form stays usable
  // meanwhile, and an edit made during the build leaves the result stale.
  const buildPreview = async () => {
    const cur = latest.current;
    if (!cur.draft) return;
    const at = editSeq.current;
    setBuilding(true);
    try {
      const url = await apiService.renderContractDraft(currentUser.id, deal.id, { ...payloadFor(cur), preview: true }, cur.templateId);
      if (latest.current.templateId !== cur.templateId || !latest.current.draft) { URL.revokeObjectURL(url); return; }
      setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return url; });
      setStale(editSeq.current !== at);
    } catch (e) {
      if (!orPremium(e)) appAlert(e.message || t('common.error'));
    } finally { setBuilding(false); }
  };

  if (!isOpen || !deal) return null;
  const isWord = kind === 'docx';
  const yearly = isYearlyViewer(currentUser);

  // ---- clause drafts
  const setSection = (i, patch) => { setDraft((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })); setChanged((c) => c.filter((n) => n !== i)); markStale(); };
  // ---- Word drafts
  const setField = (key, value) => { setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, value } : f)) })); markStale(); };
  const paragraphText = (p) => (edits[p.ref] !== undefined ? edits[p.ref] : p.text);
  const setParagraph = (ref, text) => { setEdits((e) => ({ ...e, [ref]: text })); setChanged((c) => c.filter((r) => r !== ref)); markStale(); };

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
      setSummary(r.summary || ''); setInstruction(''); markStale();
    }, { onError: orPremium });
  };

  // Mobile: build and open full-screen in one tap.
  const doPreview = async () => { await buildPreview(); if (!previewPaneVisible()) setViewing(true); };

  const continueToSign = () => draft && run(async () => {
    const r = await apiService.renderContractDraft(currentUser.id, deal.id, payloadFor(latest.current), templateId);
    onReady({ id: r.documentId, title: r.documentTitle, url: r.documentUrl, type: 'generated' });
    onClose();
  }, { onError: orPremium });

  const selected = templates.find((x) => x.id === templateId);

  return (
    <DocModal
      className="contract-draft-modal"
      title={t('contracts.draftTitle')}
      subtitle={deal.eventName || deal.venueName}
      onClose={onClose}
      preview={draft && !needsSetup ? { url: previewUrl, title: draft.title || '', building, stale, onRefresh: buildPreview, viewing, setViewing, refreshLabel: t('contracts.preview') } : null}
      actions={(
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
          {draft && !needsSetup && (!previewUrl || stale) && <button className="btn btn-outline" disabled={busy || building} onClick={doPreview}>{busy || building ? '…' : t('contracts.preview')}</button>}
          {draft && !needsSetup && <button className="btn btn-primary" disabled={busy || building} onClick={continueToSign}>{busy ? '…' : t('contracts.continueToSign')}</button>}
        </>
      )}
    >
      {needsSetup ? (
        <div className="agency-card">
          <p className="m-0 text-sm text-white">{t('contracts.setupFirst')}</p>
          <p className="form-hint">{t('contracts.setupWhere')}</p>
        </div>
      ) : (
        <>
          <label className="form-label">{t('templates.choose')}</label>
          {templates.length > 1 ? (
            <div className="invoice-kind-row">
              {templates.map((x) => (
                <button key={x.id} type="button" className={`btn btn-sm ${templateId === x.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTemplateId(x.id)}>{x.name}</button>
              ))}
            </div>
          ) : selected && <p className="template-line mb-3"><strong className="text-white text-sm">{selected.name}</strong><TemplateKindBadge kind={selected.kind} /></p>}
          {templates.length > 1 && selected && <p className="template-line mb-3 -mt-1"><TemplateKindBadge kind={selected.kind} /></p>}

          {!draft ? (
            <p className="form-hint">{error || t('common.loading')}</p>
          ) : isWord ? (
            <>
              <h4 className="calendar-sync-sub mt-1">{t('contracts.fieldsTitle')}</h4>
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
              <button type="button" className="template-act self-start mt-2" onClick={() => setShowText((v) => !v)}>{showText ? t('contracts.hideText') : t('contracts.showText')}</button>
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
                <input type="text" className="form-input" value={draft.title} onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); markStale(); }} />
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
              {yearly && <div className="invoice-field mt-2">
                <label className="form-label">{t('contracts.askForChange')}</label>
                <div className="flex gap-2">
                  <input type="text" className="form-input flex-1" placeholder={t('contracts.askPlaceholder')} value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyInstruction(); }} />
                  <button type="button" className="btn btn-outline" disabled={busy || !instruction.trim()} onClick={applyInstruction}>{busy ? '…' : t('contracts.apply')}</button>
                </div>
              </div>}
              {!isWord && (
                <label className="settings-toggle mt-2">
                  <input type="checkbox" checked={saveToTemplate} onChange={(e) => setSaveToTemplate(e.target.checked)} />
                  <span>{t('contracts.saveToTemplate')}</span>
                </label>
              )}
              {isWord && <p className="form-hint">{t('contracts.docxEditHint')}</p>}
              <p className="form-hint">{t('contracts.notLegalAdvice')}</p>
            </>
          )}
        </>
      )}
    </DocModal>
  );
};

export default DraftContractModal;
