import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { FilterIcon } from '../../utils/icons';
import FilterList from './FilterList';

/**
 * Shared full-page filter sheet (the Search-screen pattern) + trigger button.
 *
 * Config-driven so Calendar Matches, Tour Kickstart (and eventually Search)
 * render ONE implementation instead of three drifting copies. Selections are
 * held in a local DRAFT and only committed on Apply — ticking five genres is
 * one refetch, not five, and Back discards cleanly.
 *
 * section: {
 *   key,                // field name in the values object
 *   label,              // header label
 *   multi,              // true = checkboxes (array value), false = radios
 *   options(draft),     // [{ value, label }] — function of draft for dependent sections
 *   visible?(draft),    // hide section (e.g. Country until a Zone is chosen)
 *   allLabel?,          // summary label when single-select value is 'all'
 *   emptyLabel?,        // summary label for an empty multi-select (default: search.selectGenres)
 *   resets?,            // keys reset to 'all' when this section changes
 * }
 */
export const FilterButton = ({ count, onClick, label }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md cursor-pointer"
  >
    <span className="[&>svg]:h-4 [&>svg]:w-4"><FilterIcon /></span>
    {count > 0 && (
      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-infrared px-1 text-[9px] font-semibold text-white">
        {count}
      </span>
    )}
  </button>
);

const FilterSheet = ({ sections, values, onApply, onClose, clearedValues }) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(values);
  const [openKey, setOpenKey] = useState(null);

  const setField = (section, value) => {
    setDraft((d) => {
      const next = { ...d, [section.key]: value };
      (section.resets || []).forEach((k) => { next[k] = 'all'; });
      return next;
    });
  };

  const summaryFor = (section) => {
    const v = draft[section.key];
    if (section.multi) {
      return v.length > 0 ? t('search.nSelected', { n: v.length }) : (section.emptyLabel || t('search.selectGenres'));
    }
    if (v === 'all') return section.allLabel;
    const opt = section.options(draft).find((o) => o.value === v);
    return opt ? opt.label : v;
  };

  return (
    <div className="screen active filter-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onClose}>←</button>
        <h2>{t('search.filters')}</h2>
        <div style={{ width: '32px' }}></div>
      </div>
      <div className="filter-screen-content">
        {sections.filter((sec) => !sec.visible || sec.visible(draft)).map((section) => (
          <div className="filter-dropdown-group" key={section.key}>
            <div
              className="filter-dropdown-header"
              onClick={() => setOpenKey(openKey === section.key ? null : section.key)}
            >
              <span>{section.label}</span>
              <span className="dropdown-value">{summaryFor(section)}</span>
              <span className="dropdown-arrow">{openKey === section.key ? '▲' : '▼'}</span>
            </div>
            {openKey === section.key && (
              <FilterList items={section.options(draft)} labelOf={(o) => o.label} className="filter-dropdown-content max-h-56 overflow-y-auto">
                {(opt) => (
                  <label key={opt.value} className="filter-dropdown-item">
                    <input
                      type={section.multi ? 'checkbox' : 'radio'}
                      name={`filter-${section.key}`}
                      checked={section.multi
                        ? draft[section.key].includes(opt.value)
                        : draft[section.key] === opt.value}
                      onChange={() => setField(
                        section,
                        section.multi
                          ? (draft[section.key].includes(opt.value)
                            ? draft[section.key].filter((x) => x !== opt.value)
                            : [...draft[section.key], opt.value])
                          : opt.value,
                      )}
                    />
                    <span>{opt.label}</span>
                  </label>
                )}
              </FilterList>
            )}
          </div>
        ))}
      </div>
      <div className="filter-screen-actions">
        <button className="btn btn-outline" onClick={() => setDraft(clearedValues)}>
          {t('search.clearFilters')}
        </button>
        <button className="btn btn-primary" onClick={() => onApply(draft)}>
          {t('search.applyFilters')}
        </button>
      </div>
    </div>
  );
};

export default FilterSheet;
