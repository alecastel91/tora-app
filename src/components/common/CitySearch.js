import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { countriesByZone } from '../../data/profiles';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Flat country list + reverse country -> zone map for the manual fallback.
const COUNTRY_ZONES = Object.entries(countriesByZone).flatMap(([zone, countries]) =>
  countries.map((name) => ({ name, zone }))
).sort((a, b) => a.name.localeCompare(b.name));

/**
 * City-first location picker (same UX as the torahub.io application form):
 * type a city, pick a suggestion, and country + zone resolve automatically
 * via GET /api/cities. A manual fallback covers unlisted cities.
 *
 * onSelect(city, country, zone) — empty strings while the pick is incomplete,
 * so callers can gate their Next button on all three being set.
 */
const CitySearch = ({ city, country, zone, onSelect }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState(city && country ? `${city}, ${country}` : city || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualCity, setManualCity] = useState('');
  const [manualCountry, setManualCountry] = useState('');
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const runSearch = (v) => {
    setQuery(v);
    onSelect('', '', ''); // typing invalidates any prior pick
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const term = v.trim();
    if (term.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    // Create the replacement controller NOW: the aborted request's finally
    // block checks abortRef.current, and during the debounce window it would
    // otherwise still see itself and clear the loading state early.
    const controller = new AbortController();
    abortRef.current = controller;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/cities?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setResults([]);
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    }, 220);
  };

  const pick = (s) => {
    onSelect(s.city, s.country, s.zone);
    setQuery(`${s.city}, ${s.country}`);
    setResults([]);
    setOpen(false);
  };

  const updateManual = (nextCity, nextCountry) => {
    setManualCity(nextCity);
    setManualCountry(nextCountry);
    const entry = COUNTRY_ZONES.find((c) => c.name === nextCountry);
    if (nextCity.trim() && entry) onSelect(nextCity.trim(), entry.name, entry.zone);
    else onSelect('', '', '');
  };

  if (manual) {
    return (
      <div className="w-full flex flex-col gap-3">
        <input
          type="text"
          className="form-input"
          value={manualCity}
          onChange={(e) => updateManual(e.target.value, manualCountry)}
          placeholder={t('editProfile.enterCityPlaceholder')}
          maxLength={60}
          autoComplete="off"
        />
        <select
          className="form-input"
          value={manualCountry}
          onChange={(e) => updateManual(manualCity, e.target.value)}
        >
          <option value="" disabled>{t('editProfile.selectCountry')}</option>
          {COUNTRY_ZONES.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setManual(false); updateManual('', ''); }}
          className="self-start bg-transparent border-none p-0 text-xs text-white/40 hover:text-infrared cursor-pointer font-tech transition-colors"
        >
          ← {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="w-full relative">
      <input
        type="text"
        className="form-input"
        value={query}
        onChange={(e) => runSearch(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true); }}
        placeholder={t('editProfile.searchCityPlaceholder')}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-[#0f0f11] max-h-64 overflow-y-auto text-left shadow-xl">
          {loading && <div className="px-4 py-3 text-sm text-white/40">…</div>}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-white/40">{t('editProfile.cityNotFound')}</div>
          )}
          {!loading && results.map((s, i) => (
            <button
              key={`${s.city}-${s.country}-${i}`}
              type="button"
              onClick={() => pick(s)}
              className="block w-full text-left px-4 py-3 text-sm bg-transparent border-none cursor-pointer hover:bg-white/5 transition-colors"
            >
              <span className="text-white">{s.city}</span>
              <span className="text-white/40">, {s.country}</span>
            </button>
          ))}
        </div>
      )}
      {city && country && zone && (
        <p className="m-0 mt-2 text-[10px] uppercase tracking-[0.15em] text-infrared/80 font-tech">
          ✓ {country} · {zone}
        </p>
      )}
      <button
        type="button"
        onClick={() => { setManual(true); setOpen(false); onSelect('', '', ''); }}
        className="mt-3 bg-transparent border-none p-0 text-xs text-white/40 hover:text-infrared cursor-pointer font-tech transition-colors"
      >
        {t('editProfile.cityNotFound')}
      </button>
    </div>
  );
};

export default CitySearch;
