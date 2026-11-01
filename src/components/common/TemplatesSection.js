import React, { useRef, useState } from 'react';
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
 * One list of document templates (invoices or contracts) under
 * Profile → Manage → Documents: add from a Word / PDF file or start with the
 * basic layout, then per template: sample preview, details (an editor the
 * caller renders), make default, delete.
 *
 * props: ns ('invoices' | 'contracts') for the copy, store = useDocumentTemplates(),
 * profile, renderDetails(template, { save, busy }) → the editor.
 */
const TemplatesSection = ({ ns, icon, store, profile, renderDetails }) => {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(null);      // template id with details open
  const [sampleUrl, setSampleUrl] = useState(null);
  const yearly = isYearlyViewer(profile);
  const { templates, defaultId, converter, loading, busy } = store;
  const canUpload = () => (yearly ? fileRef.current?.click() : openPremium());

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 1);
    e.target.value = '';
    if (!files.length) return;
    const ok = (f) => /\.(pdf|docx)$/i.test(f.name) && f.size <= 10 * 1024 * 1024;
    if (!files.every(ok)) return appAlert(t(`${ns}.fileOnly`));
    const added = await store.add(files, 'file');
    if (added) setOpen(added.id);
  };
  const showSample = async (id) => {
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    setSampleUrl(null);
    const url = await store.sample(id);
    if (url) setSampleUrl(url);
  };
  const remove = async (tpl) => {
    if (await appConfirm(t('templates.deleteConfirm', { name: tpl.name }), { confirmLabel: t('templates.delete'), danger: true })) {
      if (open === tpl.id) setOpen(null);
      store.remove(tpl.id);
    }
  };

  return (
    <div className={`dashboard-section templates-section templates-${ns}`}>
      <div className="section-header"><h3>{icon} {t(`${ns}.setupTitle`)}</h3></div>
      <p className="form-hint" style={{ marginTop: 0 }}>{t(`${ns}.setupIntro`)}</p>

      {!loading && (
        <div className={`learned-status ${templates.length ? 'is-saved' : 'is-unsaved'}`}>
          <span>{templates.length ? t(`${ns}.statusInUse`) : t(`${ns}.statusNone`)}</span>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: 'none' }} onChange={onFiles} />
      <div className="flex flex-wrap gap-2 mb-2">
        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={canUpload} title={yearly ? undefined : t('aiFeatures.yearlyOnly')}>
          {busy === 'reading' ? t(`${ns}.reading`) : t(`${ns}.uploadButton`)}
        </button>
        <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => store.add([], 'blank')}>{t(`${ns}.blankButton`)}</button>
      </div>
      <ul className="template-kinds">
        {KINDS.map((k) => (
          <li key={k} className={k === 'docx' && converter?.docx === false ? 'is-off' : ''}>
            <TemplateKindBadge kind={k} />
            <span>{k === 'docx' && converter?.docx === false ? t('templates.wordUnavailable') : t(`${ns}.kindExplain.${k}`)}</span>
          </li>
        ))}
      </ul>
      <p className="form-hint">{!yearly && <>{t('aiFeatures.yearlyOnly')} </>}{t(`${ns}.privacy`)}</p>

      {templates.length > 0 && (
        <div className="template-list">
          {templates.map((tpl) => {
            const isDefault = tpl.id === defaultId;
            const isOpen = open === tpl.id;
            return (
              <div key={tpl.id} className={`template-card${isDefault ? ' is-default' : ''}`}>
                <div className="template-card-head">
                  <div className="template-card-title">
                    <strong>{tpl.name}</strong>
                    <TemplateKindBadge kind={tpl.kind} />
                    {isDefault && <span className="template-default-chip">{t('templates.default')}</span>}
                  </div>
                  {tpl.file?.originalName && <span className="form-hint m-0">{tpl.file.originalName}</span>}
                </div>
                {tpl.notes && <p className="form-hint template-notes"><b>{t('templates.notes')}:</b> {tpl.notes}</p>}
                <div className="template-card-actions">
                  <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => showSample(tpl.id)}>{busy === tpl.id ? '…' : t('templates.preview')}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setOpen(isOpen ? null : tpl.id)}>{isOpen ? t('templates.hideDetails') : t('templates.details')}</button>
                  {!isDefault && templates.length > 1 && <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => store.makeDefault(tpl.id)}>{t('templates.makeDefault')}</button>}
                  <button className="btn btn-outline btn-sm template-delete" disabled={!!busy} onClick={() => remove(tpl)}>{t('templates.delete')}</button>
                </div>
                {isOpen && (
                  <div className="template-details">
                    {renderDetails(tpl, { save: (body) => store.update(tpl.id, body), busy: busy === tpl.id })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sampleUrl && (
        <div className="invoice-preview template-sample">
          <div className="flex items-center justify-between mb-1">
            <span className="form-hint m-0">{t('templates.sampleTitle')}</span>
            <button className="btn btn-outline btn-sm" onClick={() => { URL.revokeObjectURL(sampleUrl); setSampleUrl(null); }}>{t('common.close')}</button>
          </div>
          <iframe title="template sample" src={sampleUrl} />
        </div>
      )}
      <p className="form-hint">{t('templates.limit')}</p>
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
