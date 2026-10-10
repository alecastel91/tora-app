import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const TOUCH = typeof window !== 'undefined' && 'ontouchstart' in window;

/**
 * Scrollable option list with a type-to-filter box once it gets long. Owns
 * the query, so it resets whenever the list is (re)mounted — i.e. every time
 * a dropdown opens. No autofocus on touch devices: the keyboard would cover
 * the list it is meant to narrow.
 */
const FilterList = ({ items, labelOf = (x) => x, children, minForSearch = 12, className = 'filter-dropdown-content scrollable' }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((it) => String(labelOf(it)).toLowerCase().includes(q)) : items;
  return (
    <div className={className}>
      {items.length > minForSearch && (
        <input type="text" className="filter-list-search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.typeToFilter')} aria-label={t('search.typeToFilter')} autoFocus={!TOUCH} />
      )}
      {shown.map(children)}
    </div>
  );
};

export default FilterList;
