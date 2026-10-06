import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { GEAR_CATEGORIES, gearItemsFor, gearLabel } from '../../utils/venueRooms';

const MAX_ROOMS = 12;

/** Picks one piece of gear: category, model (from the catalog, or free text), quantity. */
const GearAdder = ({ onAdd }) => {
  const { t } = useLanguage();
  const [category, setCategory] = useState('players');
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState('1');
  const listId = `gear-${category}`;

  const add = () => {
    const q = query.trim();
    if (!q) return;
    const items = gearItemsFor(category);
    const hit = items.find((i) => i.label.toLowerCase() === q.toLowerCase())
      || items.find((i) => (i.model || '').toLowerCase() === q.toLowerCase());
    onAdd({ category, catalogId: hit ? hit.id : null, label: hit ? hit.label : q, quantity: Math.max(1, Math.min(99, parseInt(qty, 10) || 1)) });
    setQuery(''); setQty('1');
  };

  return (
    <div className="gear-adder">
      <select value={category} onChange={(e) => { setCategory(e.target.value); setQuery(''); }} aria-label={t('gear.category')}>
        {GEAR_CATEGORIES.map((key) => <option key={key} value={key}>{t(`gear.${key}`)}</option>)}
      </select>
      <input
        list={listId}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        placeholder={t('editProfile.gearSearch')}
        aria-label={t('editProfile.gearSearch')}
      />
      <datalist id={listId}>
        {gearItemsFor(category).map((i) => <option key={i.id} value={i.label} />)}
      </datalist>
      <input className="gear-qty" inputMode="numeric" pattern="[0-9]*" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} aria-label={t('editProfile.quantity')} />
      <button type="button" className="btn btn-outline btn-sm" onClick={add} disabled={!query.trim()}>{t('editProfile.addGear')}</button>
    </div>
  );
};

/**
 * Rooms and their equipment for a venue profile. Controlled: `rooms` is the
 * venueRoomsSpec array, `onChange` receives the next array.
 */
const RoomGearEditor = ({ rooms, onChange }) => {
  const { t } = useLanguage();
  const list = Array.isArray(rooms) ? rooms : [];
  const update = (i, patch) => onChange(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

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
                    <span className="room-gear-cat">{t(`gear.${e.category}`)}</span>
                    <span>{e.quantity > 1 ? `${e.quantity}× ` : ''}{gearLabel(e)}</span>
                    <button type="button" onClick={() => update(i, { equipment: room.equipment.filter((_, idx) => idx !== ei) })} aria-label={t('editProfile.removeGear')}>×</button>
                  </li>
                ))}
              </ul>
            )}
          <GearAdder onAdd={(item) => update(i, { equipment: [...(room.equipment || []), item] })} />
        </div>
      ))}
      {list.length < MAX_ROOMS && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([...list, { name: `${t('editProfile.roomDefaultName')} ${list.length + 1}`, capacity: null, equipment: [] }])}>
          {t('editProfile.addRoom')}
        </button>
      )}
    </div>
  );
};

export default RoomGearEditor;
