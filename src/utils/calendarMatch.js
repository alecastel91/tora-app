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

export const counterpartRoles = (role) => COUNTERPARTS[String(role || '').toUpperCase()] || [];

const asArtist = (role) => (role === 'AGENT' ? 'ARTIST' : role);

/** ARTIST↔VENUE, ARTIST↔PROMOTER, PROMOTER↔VENUE; AGENT counts as ARTIST. Never same role. */
export function isValidRoleMatch(roleA, roleB) {
  const a = asArtist(String(roleA || '').toUpperCase());
  const b = asArtist(String(roleB || '').toUpperCase());
  if (!a || !b || a === b) return false;
  return (COUNTERPARTS[a] || []).includes(b);
}

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
  return (Array.isArray(artist.travelSchedule) ? artist.travelSchedule : []).some((e) => (
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
  const sg = Array.isArray(source.genres) ? source.genres : [];
  const cg = Array.isArray(candidate.genres) ? candidate.genres : [];
  if (sg.length === 0 || cg.length === 0 || !sg.some((g) => cg.includes(g))) return [];
  const cand = new Set((Array.isArray(candidate.availableDates) ? candidate.availableDates : []).map(normalizeDate));
  const shared = (Array.isArray(source.availableDates) ? source.availableDates : []).map(normalizeDate).filter((d) => cand.has(d));
  if (shared.length === 0) return [];
  const sRole = asArtist(String(source.role).toUpperCase());
  const cRole = asArtist(String(candidate.role).toUpperCase());
  if (sRole !== 'ARTIST' && cRole !== 'ARTIST') {
    // PROMOTER↔VENUE: no travelling party — same country, every shared date.
    return source.country === candidate.country ? shared : [];
  }
  const artist = sRole === 'ARTIST' ? source : candidate;
  const other = sRole === 'ARTIST' ? candidate : source;
  return shared.filter((d) => artistInCountryOn(artist, other.country, d));
}
