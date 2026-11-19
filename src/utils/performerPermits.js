import { travelData } from './travelData';

/**
 * Visa / work-permit guidance for a booking: the event country's rules for
 * foreign performers, matched against the artist's passport(s). Guidance
 * only, from official sources (utils/travelData: the server's copy, else
 * data/performerPermits.json): the panel always sends people to those sources.
 */

// Free movement: these citizens work in each other's countries without a permit.
const EU_EEA_CH = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Iceland', 'Liechtenstein', 'Norway', 'Switzerland'];
const TRANS_TASMAN = ['Australia', 'New Zealand'];
const sameBloc = (a, b) => [EU_EEA_CH, TRANS_TASMAN].some((bloc) => bloc.includes(a) && bloc.includes(b));

/**
 * { kind, country, rule?, passport? } where kind is:
 *  'no-country'   the booking has no event country yet
 *  'no-passport'  the artist hasn't added a nationality
 *  'home'         a passport of the event country
 *  'free'         free movement (EU/EEA/Swiss, trans-Tasman)
 *  'exempt'       the country's rules exempt this passport, or need no permit
 *  'required'     a permit or visa is needed
 *  'depends'      the rules turn on details (length, venue, who pays)
 *  'no-data'      a country TORA has no rules for yet
 * With two passports the easiest outcome wins.
 */
export function permitStatusFor(eventCountry, nationalities) {
  const country = (eventCountry || '').trim();
  if (!country) return { kind: 'no-country' };
  const passports = (nationalities || []).filter(Boolean);
  const PERMITS = travelData().permits;
  if (!passports.length) return { kind: 'no-passport', country, rule: PERMITS[country] || null };
  const home = passports.find((p) => p === country);
  if (home) return { kind: 'home', country, passport: home };
  const bloc = passports.find((p) => sameBloc(p, country));
  if (bloc) return { kind: 'free', country, passport: bloc };
  const rule = PERMITS[country];
  if (!rule) return { kind: 'no-data', country };
  const exempt = passports.find((p) => (rule.exemptNationalities || []).includes(p));
  if (exempt || rule.permit === 'not_required') return { kind: 'exempt', country, rule, passport: exempt || passports[0] };
  return { kind: rule.permit === 'depends' ? 'depends' : 'required', country, rule, passport: passports[0] };
}

/** Weeks left before the show, or null. */
export function weeksUntil(date) {
  const t = date ? new Date(date).getTime() : NaN;
  return Number.isFinite(t) ? Math.floor((t - Date.now()) / (7 * 86400000)) : null;
}
