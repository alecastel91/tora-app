import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { GEAR_CATEGORIES, OTHER, brandsFor, modelsFor, catalogIdFor, gearLine } from '../../utils/venueRooms';

const MAX_ROOMS = 12;
const blank = (category = 'players') => ({ category, brand: '', brandOther: '', model: '', modelOther: '', quantity: 1, note: '' });

/** Fill the sheet from a saved row (brand/model that are not in the catalog land in the free-text fields). */
const fromItem = (e) => {
  const brands = brandsFor(e.category);
  const brandListed = e.brand && brands.includes(e.brand);
  const models = modelsFor(e.category, brandListed ? e.brand : OTHER);
  const modelListed = e.model && models.includes(e.model);
  return {
    category: e.category,
    brand: brandListed ? e.brand : (e.brand ? OTHER : ''),
    brandOther: brandListed ? '' : (e.brand || ''),
    model: modelListed ? e.model : (e.model ? OTHER : ''),
    modelOther: modelListed ? '' : (e.model || ''),
    quantity: e.quantity || 1,
    note: e.note || '',
  };
};

/**
 * Slim sheet for one piece of equipment: category, brand (catalog or Other),
 * model/type (catalog or not listed), quantity, note. Bottom sheet on phones,
 * narrow card on desktop.
 */
const GearSheet = ({ initial, onSave, onClose }) => {
  const { t } = useLanguage();
  const [f, setF] = useState(initial);
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));
  const brands = brandsFor(f.category);
  const models = modelsFor(f.category, f.brand);
  const brand = f.brand === OTHER ? f.brandOther.trim() : f.brand;
  const model = f.model === OTHER ? f.modelOther.trim() : f.model;
  const canSave = !!(brand || model);
  const isTyped = brands.length === 0; // lighting: a type, no brand list

  const save = () => {
    if (!canSave) return;
    onSave({
      category: f.category,
      catalogId: catalogIdFor(f.category, brand, model),
      brand, model,
      quantity: Math.max(1, Math.min(99, Number(f.quantity) || 1)),
      ...(f.note.trim() ? { note: f.note.trim().slice(0, 120) } : {}),
    });
  };

  return createPortal(
    <div className="modal-overlay gear-sheet-overlay" onClick={onClose}>
      <div className="gear-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="gear-sheet-handle" />
        <div className="gear-sheet-head">
          <h3>{initial.editing ? t('editProfile.editEquipment') : t('editProfile.addEquipment')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('editProfile.gearCancel')}>×</button>
        </div>

        <div className="gear-chips" role="radiogroup" aria-label={t('gear.category')}>
          {GEAR_CATEGORIES.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={f.category === key}
              className={`gear-chip${f.category === key ? ' active' : ''}`}
              onClick={() => set({ ...blank(key), quantity: f.quantity, note: f.note })}>
              {t(`gear.${key}`)}
            </button>
          ))}
        </div>

        {!isTyped && (
          <div className="form-group">
            <label>{t('editProfile.brand')}</label>
            <select value={f.brand} onChange={(e) => set({ brand: e.target.value, model: '', modelOther: '' })}>
              <option value="">{t('editProfile.choose')}</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value={OTHER}>{t('editProfile.brandOther')}</option>
            </select>
            {f.brand === OTHER && (
              <input value={f.brandOther} onChange={(e) => set({ brandOther: e.target.value })} placeholder={t('editProfile.brandName')} maxLength={40} autoFocus />
            )}
          </div>
        )}

        <div className="form-group">
          <label>{isTyped ? t('editProfile.modelType') : t('editProfile.model')}</label>
          {models.length > 0 ? (
            <select value={f.model} onChange={(e) => set({ model: e.target.value })}>
              <option value="">{t('editProfile.choose')}</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
              <option value={OTHER}>{t('editProfile.modelOther')}</option>
            </select>
          ) : null}
          {(f.model === OTHER || models.length === 0) && (
            <input value={f.modelOther} onChange={(e) => set({ modelOther: e.target.value, ...(models.length === 0 ? { model: OTHER } : {}) })}
              placeholder={isTyped ? t('editProfile.modelType') : t('editProfile.modelName')} maxLength={60} />
          )}
        </div>

        <div className="gear-sheet-row">
          <div className="form-group">
            <label>{t('editProfile.quantity')}</label>
            <div className="gear-stepper">
              <button type="button" onClick={() => set({ quantity: Math.max(1, Number(f.quantity) - 1) })} aria-label="−">−</button>
              <span>{f.quantity}</span>
              <button type="button" onClick={() => set({ quantity: Math.min(99, Number(f.quantity) + 1) })} aria-label="+">+</button>
            </div>
          </div>
          <div className="form-group gear-note">
            <label>{t('editProfile.note')}</label>
            <input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder={t('editProfile.notePlaceholder')} maxLength={120} />
          </div>
        </div>

        <div className="gear-sheet-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('editProfile.gearCancel')}</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!canSave}>{t('editProfile.gearSave')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/**
 * Rooms and their equipment for a venue profile. Controlled: `rooms` is the
 * venueRoomsSpec array, `onChange` receives the next array. Tap a row to edit it.
 */
const RoomGearEditor = ({ rooms, onChange }) => {
  const { t } = useLanguage();
  const list = Array.isArray(rooms) ? rooms : [];
  const [sheet, setSheet] = useState(null); // { room, index|null, initial }
  const update = (i, patch) => onChange(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const saveItem = (item) => {
    const room = list[sheet.room];
    const equipment = [...(room.equipment || [])];
    if (sheet.index === null) equipment.push(item); else equipment[sheet.index] = item;
    update(sheet.room, { equipment });
    setSheet(null);
  };

  return (
    <div className="form-group">
      <label>{t('editProfile.rooms')}</label>
      <p className="form-hint">{t('editProfile.roomsHint')}</p>
      {list.map((room, i) => (
        <div key={i} className="room-editor">
          <div className="room-editor-head">
            <input value={room.name || ''} onChange={(e) => update(i, { name: e.target.value })} placeholder={t('editProfile.roomName')} aria-label={t('editProfile.roomName')} />
            <input className="room-capacity" inputMode="numeric" pattern="[0-9]*" value={room.capacity ?? ''} onChange={(e) => update(i, { capacity: e.target.value.replace(/[^0-9]/g, '') })} placeholder={t('editProfile.roomCapacity')} aria-label={t('editProfile.roomCapacity')} />
            <button type="button" className="room-remove" onClick={() => onChange(list.filter((_, idx) => idx !== i))} aria-label={t('editProfile.removeRoom')}>×</button>
          </div>
          {(room.equipment || []).length === 0
            ? <p className="room-gear-empty">{t('editProfile.noGearYet')}</p>
            : (
              <ul className="room-gear-list">
                {room.equipment.map((e, ei) => (
                  <li key={ei}>
                    <button type="button" className="room-gear-row" onClick={() => setSheet({ room: i, index: ei, initial: { ...fromItem(e), editing: true } })}>
                      <span className="room-gear-cat">{t(`gear.${e.category}`)}</span>
                      <span>{gearLine(e)}{e.note ? <em> · {e.note}</em> : null}</span>
                    </button>
                    <button type="button" onClick={() => update(i, { equipment: room.equipment.filter((_, idx) => idx !== ei) })} aria-label={t('editProfile.removeGear')}>×</button>
                  </li>
                ))}
              </ul>
            )}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSheet({ room: i, index: null, initial: blank() })}>
            + {t('editProfile.addEquipment')}
          </button>
        </div>
      ))}
      {list.length < MAX_ROOMS && (
        <button type="button" className="btn btn-outline btn-sm room-add" onClick={() => onChange([...list, { name: `${t('editProfile.roomDefaultName')} ${list.length + 1}`, capacity: null, equipment: [] }])}>
          + {t('editProfile.addRoom')}
        </button>
      )}
      {sheet && <GearSheet initial={sheet.initial} onSave={saveItem} onClose={() => setSheet(null)} />}
    </div>
  );
};

export default RoomGearEditor;
