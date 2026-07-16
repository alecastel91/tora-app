// Parity guard: every city offered in the signup picker (profiles.js
// citiesByCountry) must have coordinates in cityCoords.js, or its members get
// no pin on the Search globe (only an "off-map" count).
//
//   node scripts/check-city-coords.mjs      (exit 1 when cities are missing)
//
// Run it whenever citiesByCountry changes.
import { citiesByCountry } from '../src/data/profiles.js';
import { CITY_COORDS, normalizeCity } from '../src/data/cityCoords.js';

const missing = [];
for (const [country, cities] of Object.entries(citiesByCountry)) {
  for (const city of cities) {
    if (city === 'Other') continue;
    if (!CITY_COORDS[normalizeCity(city)]) missing.push(`${country} | ${city}`);
  }
}

const total = Object.values(citiesByCountry).flat().filter((c) => c !== 'Other').length;
if (missing.length) {
  console.error(`✗ ${missing.length}/${total} picker cities have no coordinates in src/data/cityCoords.js:`);
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

let badRange = 0;
for (const [key, [lon, lat]] of Object.entries(CITY_COORDS)) {
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    console.error(`✗ out-of-range coords for '${key}': [${lon}, ${lat}] (order must be [lon, lat])`);
    badRange += 1;
  }
}
if (badRange) process.exit(1);

console.log(`✓ all ${total} picker cities have globe coordinates (${Object.keys(CITY_COORDS).length} entries total)`);
