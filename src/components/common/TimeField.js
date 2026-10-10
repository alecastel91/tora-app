import React from 'react';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

/**
 * "HH:MM" in 5-minute steps. Two selects instead of <input type="time">:
 * the native control ignores `step` in its picker on phones and in Chrome,
 * so by-the-minute wheels kept coming back. Value is '' when unset.
 */
const TimeField = ({ value = '', onChange, disabled = false }) => {
  const [h = '', m = ''] = value ? value.split(':') : [];
  const set = (hh, mm) => onChange(hh ? `${hh}:${mm}` : '');
  return (
    <div className="time-field">
      <select className="form-input" value={h} disabled={disabled} onChange={(e) => set(e.target.value, m || '00')}>
        <option value="">--</option>
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="time-field-sep">:</span>
      <select className="form-input" value={m} disabled={disabled || !h} onChange={(e) => set(h, e.target.value)}>
        {MINUTES.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  );
};

export default TimeField;
