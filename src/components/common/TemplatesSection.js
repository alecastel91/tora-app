import React, { useRef, useState } from 'react';
import OverlayPortal from './OverlayPortal';
import PdfViewerModal from './PdfViewerModal';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { isYearlyViewer, openPremium } from '../../utils/subscription';

const KINDS = ['docx', 'pdf', 'basic'];

/** "Word · identical" / "PDF · your layout" / "Basic layout" */
export const TemplateKindBadge = ({ kind }) => {
  const { t } = useLanguage();
  return <span className={`template-kind is-${kind}`}>{t(`templates.kind.${kind}`)}</span>;
};

/**
 * Which template a booking document is made from: chips when there is a
 * choice, the name alone when there is one, the kind pill either way.
 */
export const TemplatePicker = ({ templates, templateId, onPick }) => {
  const { t } = useLanguage();
  const selected = templates.find((x) => x.id === templateId);
  return (
    <>
      <label className="form-label">{t('templates.choose')}</label>
      {templates.length > 1 && (
        <div className="invoice-kind-row">
          {templates.map((x) => (
            <button key={x.id} type="button" className={`btn btn-sm ${templateId === x.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => { if (x.id !== templateId) onPick(x.id); }}>{x.name}</button>
          ))}
        </div>
      )}
      {selected && (
        <p className={`template-line mb-3${templates.length > 1 ? ' -mt-1' : ''}`}>
          {templates.length === 1 && <strong className="text-white text-sm">{selected.name}</strong>}
          <TemplateKindBadge kind={selected.kind} />
        </p>
      )}
    </>
  );
};

/** The "i" sheet: what a template is, the three kinds, where it is used, privacy, limit. */
const TemplatesGuide = ({ ns, wordOff, onClose }) => {
  const { t } = useLanguage();
  return (
    <OverlayPortal>
      <div className="message-modal-overlay" onClick={onClose}>
        <div className="message-modal-bottom template-guide" onClick={(e) => e.stopPropagation()}>
          <h2 className="message-modal-title">{t('templates.guideTitle')}</h2>
          <p className="form-hint">{t(`${ns}.setupIntro`)}</p>
          <ul className="template-kinds">
            {KINDS.map((k) => (
              <li key={k} className={k === 'docx' && wordOff ? 'is-off' : ''}>
                <TemplateKindBadge kind={k} />
                <span>{k === 'docx' && wordOff ? t('templates.wordUnavailable') : t(`${ns}.kindExplain.${k}`)}</span>
              </li>
            ))}
          </ul>
          <p className="form-hint">{t(`${ns}.statusInUse`)}</p>
          <p className="form-hint">{t('templates.limit')}</p>
          <p className="form-hint">{t(`${ns}.privacy`)}</p>
          <button className="btn btn-primary w-full mt-2" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </OverlayPortal>
  );
};

/** Save / Hide details row at the end of every template editor. */
export const TemplateEditorActions = ({ dirty, busy, onSave, onClose }) => {
  const { t } = useLanguage();
  return (
    <div className="template-editor-actions">
      <button type="button" className="template-act" onClick={onClose}>{t('templates.hideDetails')}</button>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={onSave}>{busy ? '…' : t('templates.save')}</button>
    </div>
  );
};

/**
 * One list of document templates (invoices or contracts) under
 * Profile → Manage → Documents: a row per template (name, kind, file,
 * default) with quiet actions — sample, details (an editor the caller
 * renders, opened under the row), make default, delete — and the two ways
 * to add one. The explanations live behind the "i" button.
 *
 * props: ns ('invoices' | 'contracts') for the copy, store = useDocumentTemplates(),
 * profile, renderDetails(template, { save, busy, close }) → the editor.
 */
const TemplatesSection = ({ ns, icon, store, profile, renderDetails }) => {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(null);      // template id with details open
  const [guide, setGuide] = useState(false);
  const [sample, setSample] = useState(null);  // { url, name }
  const yearly = isYearlyViewer(profile);
  const { templates, defaultId, converter, loading, error, busy } = store;
  const MAX = 8;
  const full = templates.length >= MAX;
  const wordOff = converter?.docx === false;
  const canUpload = () => (yearly ? fileRef.current?.click() : openPremium());

  const onFiles = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name) || file.size > 10 * 1024 * 1024) return appAlert(t(`${ns}.fileOnly`));
    if (wordOff && /\.docx$/i.test(file.name)) return appAlert(t('templates.wordUnavailable'));
    const added = await store.add([file], 'file');
    if (added) setOpen(added.id);
  };
  const closeSample = () => setSample((s) => { if (s) URL.revokeObjectURL(s.url); return null; });
  const showSample = async (tpl) => {
    closeSample();
    const url = await store.sample(tpl.id);
    if (url) setSample({ url, name: tpl.name });
  };
  const remove = async (tpl) => {
    if (await appConfirm(t('templates.deleteConfirm', { name: tpl.name }), { confirmLabel: t('templates.delete'), danger: true })) {
      if (open === tpl.id) setOpen(null);
      store.remove(tpl.id);
    }
  };

  return (
    <div className={`dashboard-section templates-section templates-${ns}`}>
      <div className="section-header">
        <h3>{icon} {t(`${ns}.setupTitle`)}</h3>
        <button type="button" className="template-info-btn" aria-label={t('templates.guideTitle')} title={t('templates.guideTitle')} onClick={() => setGuide(true)}>i</button>
      </div>
      {!yearly && <p className="form-hint mt-0">{t('aiFeatures.yearlyOnly')}</p>}
      {wordOff && <p className="form-hint mt-0">{t('templates.wordUnavailable')}</p>}

      {error && <p className="form-hint mt-0">{t('common.error')} <button type="button" className="btn btn-outline btn-sm" onClick={store.reload}>{t('common.retry')}</button></p>}
      {!loading && !error && templates.length === 0 && <p className="form-hint mt-0">{t(`${ns}.statusNone`)}</p>}
      {templates.length > 0 && (
        <div className="template-list">
          {templates.map((tpl) => {
            const isDefault = tpl.id === defaultId;
            const isOpen = open === tpl.id;
            return (
              <div key={tpl.id} className={`template-row${isDefault ? ' is-default' : ''}${isOpen ? ' is-open' : ''}`}>
                <div className="template-row-main">
                  <div className="template-card-title">
                    <strong>{tpl.name}</strong>
                    {isDefault && <span className="template-default-chip">{t('templates.default')}</span>}
                  </div>
                  <div className="template-row-sub">
                    <TemplateKindBadge kind={tpl.kind} />
                    {tpl.file?.originalName && <span className="template-file" title={tpl.file.originalName}>{tpl.file.originalName}</span>}
                  </div>
                </div>
                <div className="template-row-actions">
                  <button type="button" className="template-act" disabled={!!busy} onClick={() => showSample(tpl)}>{busy === tpl.id ? '…' : t('templates.preview')}</button>
                  <button type="button" className={`template-act${isOpen ? ' is-on' : ''}`} onClick={() => setOpen(isOpen ? null : tpl.id)}>{isOpen ? t('templates.hideDetails') : t('templates.details')}</button>
                  {!isDefault && <button type="button" className="template-act" disabled={!!busy} onClick={() => store.makeDefault(tpl.id)}>{t('templates.makeDefault')}</button>}
                  <button type="button" className="template-act is-danger" disabled={!!busy} onClick={() => remove(tpl)}>{t('templates.delete')}</button>
                </div>
                {isOpen && (
                  <div className="template-details">
                    {(tpl.notes || tpl.template?.notes) && <p className="form-hint template-notes mt-0"><b>{t('templates.notes')}:</b> {tpl.notes || tpl.template.notes}</p>}
                    {renderDetails(tpl, { save: (body) => store.update(tpl.id, body), busy: busy === tpl.id, close: () => setOpen(null) })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input ref={fileRef} type="file" accept={wordOff ? '.pdf,application/pdf' : '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'} style={{ display: 'none' }} onChange={onFiles} />
      <div className="template-add-row">
        <button className="btn btn-primary btn-sm" disabled={!!busy || full} onClick={canUpload} title={full ? t('templates.limit') : yearly ? undefined : t('aiFeatures.yearlyOnly')}>
          {busy === 'reading' ? t(`${ns}.reading`) : t(`${ns}.uploadButton`)}
        </button>
        <button type="button" className="template-act" disabled={!!busy || full} onClick={() => store.add([], 'blank')} title={full ? t('templates.limit') : undefined}>{t(`${ns}.blankButton`)}</button>
      </div>
      {full && <p className="form-hint">{t('templates.limit')}</p>}

      {guide && <TemplatesGuide ns={ns} wordOff={wordOff} onClose={() => setGuide(false)} />}
      {sample && <PdfViewerModal url={sample.url} title={`${sample.name} · ${t('templates.sampleTitle')}`} onClose={closeSample} />}
    </div>
  );
};

/** A name field, shared by both editors. */
export const TemplateNameField = ({ value, onChange }) => {
  const { t } = useLanguage();
  return (
    <div className="invoice-field">
      <label className="form-label">{t('templates.name')}</label>
      <input type="text" className="form-input" value={value} maxLength={80} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
};

export default TemplatesSection;
