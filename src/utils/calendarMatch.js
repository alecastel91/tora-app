/**
 * Calendar matching — pure, no React, no imports (synced verbatim to mobile).
 *
 * The Tour tab only ever pairs counterpart roles: an artist (or an agent on
 * behalf of a roster artist) with promoters and venues; a venue with artists
 * and promoters; a promoter with artists and venues. Same-role pairs never
 * match. A shared open date counts only when the artist is in the
 * counterpart's country that day: either based there, or there on a travel
 * schedule entry covering the date. Promoter↔venue pairs must share a country.
 */
export const COUNTERPARTS = {
  ARTIST: ['PROMOTER', 'VENUE'],
  AGENT: ['PROMOTER', 'VENUE'],
  VENUE: ['ARTIST', 'PROMOTER'],
  PROMOTER: ['ARTIST', 'VENUE'],
};

const up = (role) => String(role || '').toUpperCase();
const arr = (v) => (Array.isArray(v) ? v : []);
const isArtistLike = (p) => up(p?.role) === 'ARTIST' || up(p?.role) === 'AGENT';

export const counterpartRoles = (role) => COUNTERPARTS[up(role)] || [];

/** ARTIST↔VENUE, ARTIST↔PROMOTER, PROMOTER↔VENUE; AGENT counts as ARTIST. Never same role. */
// An agent on either side stands in for an artist, so AGENT normalises to ARTIST before the lookup.
export const isValidRoleMatch = (roleA, roleB) => counterpartRoles(roleA).includes(up(roleB) === 'AGENT' ? 'ARTIST' : up(roleB));

/** 'YYYY-M-D' → 'YYYY-MM-DD' (dates are compared as strings, never as Date objects). */
export const normalizeDate = (s) => {
  const parts = String(s || '').split('-');
  if (parts.length !== 3) return String(s || '');
  return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
};

/** Is the artist in `country` on `date`: based there, or travelling there that day. */
export function artistInCountryOn(artist, country, date) {
  if (!artist || !country) return false;
  if (artist.country === country) return true;
  const d = normalizeDate(date);
  return arr(artist.travelSchedule).some((e) => (
    e && e.country === country && e.startDate && e.endDate
    && normalizeDate(e.startDate) <= d && d <= normalizeDate(e.endDate)
  ));
}

/**
 * Open dates both profiles share AND on which the pair can actually meet.
 * `source` is the profile whose availability drives the search (the viewer,
 * or a roster artist for an agent); `candidate` is a search result.
 * Returns normalized ISO dates, or [].
 */
export function matchDatesFor(source, candidate) {
  if (!source || !candidate || !isValidRoleMatch(source.role, candidate.role)) return [];
  if (!source.country || !candidate.country) return [];
  const sg = arr(source.genres); const cg = arr(candidate.genres);
  if (sg.length === 0 || cg.length === 0 || !sg.some((g) => cg.includes(g))) return [];
  const cand = new Set(arr(candidate.availableDates).map(normalizeDate));
  const shared = arr(source.availableDates).map(normalizeDate).filter((d) => cand.has(d));
  if (shared.length === 0) return [];
  const artist = isArtistLike(source) ? source : isArtistLike(candidate) ? candidate : null;
  if (!artist) return source.country === candidate.country ? shared : []; // PROMOTER↔VENUE: nobody travels
  const other = artist === source ? candidate : source;
  return shared.filter((d) => artistInCountryOn(artist, other.country, d));
}
