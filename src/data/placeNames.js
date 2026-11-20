// Place names in the app's language, for display only: profiles keep the
// English city/country they were picked with, and search matches every
// language on the server (tora-backend utils/placeSearch.js).
//
// cityNames.json: normalized English city → { ja, zh, ko, es, fr, it, pt },
// only where the name differs from English. Built from Wikidata labels for
// every city on the globe; mirrored in tora-backend src/data/cityNames.json.
// Countries come from the browser's own CLDR names (Intl.DisplayNames).
import CITY_NAMES from './cityNames.json';
import COUNTRY_ISO from './countryIso.json';
import { normalizeCity, ATLAS_COUNTRY_NAMES } from './cityCoords';

// The globe's atlas names ("Czechia", "Dem. Rep. Congo") back to the app's.
const FROM_ATLAS = Object.fromEntries(Object.entries(ATLAS_COUNTRY_NAMES).map(([app, atlas]) => [atlas, app]));
const COUNTRY_ALIASES = { 'United States of America': 'US', UAE: 'AE', Czechia: 'CZ' };

const regionNames = {};
const regionNamesFor = (lang) => {
  if (!(lang in regionNames)) {
    try { regionNames[lang] = new Intl.DisplayNames([lang], { type: 'region' }); } catch { regionNames[lang] = null; }
  }
  return regionNames[lang];
};

export const cityLabel = (city, lang) =>
  (lang && lang !== 'en' && CITY_NAMES[normalizeCity(city)]?.[lang]) || city;

export const countryLabel = (country, lang) => {
  if (!country || !lang || lang === 'en') return country;
  const appName = FROM_ATLAS[country] || country;
  const iso = COUNTRY_ISO[appName] || COUNTRY_ALIASES[appName];
  return (iso && regionNamesFor(lang)?.of(iso)) || country;
};
