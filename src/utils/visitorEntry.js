import ENTRY from '../data/visitorEntry.json';

/**
 * Visitor entry for a booking: how the artist's passport gets into the event
 * country as a short-stay visitor (visa-free, visa on arrival, eVisa or a
 * visa), what to file before flying (ESTA, eTA, ETA...) and the arrival card.
 * Guidance only, from official sources (data/visitorEntry.json, checked date
 * in the file). A passport the data doesn't list as visa-free falls back to
 * "visa needed", the safe reading.
 */
export const ENTRY_CHECKED_AT = ENTRY._checkedAt;

const RANK = { visa_free: 3, visa_on_arrival: 2, evisa: 1 };
const NATIONALITIES = new Set(Object.values(ENTRY).flatMap((rule) => (rule.tiers || []).flatMap((tier) => (Array.isArray(tier.nationalities) ? tier.nationalities : []))));

// A tier note covers every passport in the tier ("Taiwan passports must show
// an ID number..."): keep the sentences about this passport or about none.
function noteFor(note, passport) {
  if (!note) return null;
  const names = (sentence, n) => new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u').test(sentence);
  const kept = note.split(/(?<=\.)\s+/).filter((sentence) => names(sentence, passport)
    || ![...NATIONALITIES].some((n) => names(sentence, n)));
  return kept.join(' ') || null;
}
const inList = (list, passport) => list === '*' || (Array.isArray(list) && list.includes(passport));

// A dated rule (a trial, a policy ending, a temporary exemption) counts only
// when it still runs on the show date.
const runsOn = (until, on) => !until || new Date(`${until}T23:59:59`) >= on;

function bestTier(rule, passport, on) {
  return (rule.tiers || [])
    .filter((tier) => inList(tier.nationalities, passport) && !(tier.except || []).includes(passport) && runsOn(tier.until, on))
    .sort((a, b) => RANK[b.kind] - RANK[a.kind] || (b.days || 0) - (a.days || 0))[0] || null;
}

function authorisationsFor(rule, tier, passport, on) {
  return (rule.authorisations || []).filter((a) => {
    if ((a.except || []).includes(passport) && runsOn(a.exceptUntil, on)) return false;
    if (a.appliesTo === 'all') return true;
    if (a.appliesTo === 'visa_free') return tier?.kind === 'visa_free';
    return inList(a.appliesTo, passport);
  });
}

/**
 * { kind, country, passport?, days?, note?, authorisations, arrivalCard, otherwise?, rule? }
 * kind: 'no-data' | 'visa_free' | 'visa_on_arrival' | 'evisa' | 'visa'.
 * Call it only for a foreign passport (home and free-movement pairs are
 * settled by permitStatusFor). With two passports the easiest entry wins.
 * `date` is the show date: dated rules are read as they stand on that day.
 */
export function entryStatusFor(country, passports, date) {
  const rule = ENTRY[country];
  if (!rule) return { kind: 'no-data', country, authorisations: [] };
  const parsed = date ? new Date(date) : new Date();
  const on = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  const options = passports.map((passport) => {
    const tier = bestTier(rule, passport, on);
    return { passport, tier, auths: authorisationsFor(rule, tier, passport, on) };
  });
  options.sort((a, b) => (RANK[b.tier?.kind] || 0) - (RANK[a.tier?.kind] || 0)
    || (b.tier?.days || 0) - (a.tier?.days || 0)
    || a.auths.length - b.auths.length);
  const { passport, tier, auths } = options[0];
  return {
    kind: tier ? tier.kind : 'visa',
    country,
    passport,
    days: tier?.days || null,
    note: noteFor(tier?.note, passport),
    otherwise: tier ? null : rule.otherwise,
    authorisations: auths,
    arrivalCard: rule.arrivalCard || null,
    rule,
  };
}

/** True when the entry data is older than `days`: the panel says so. */
export function entryDataStale(days = 120) {
  const t = new Date(ENTRY_CHECKED_AT).getTime();
  return !Number.isFinite(t) || Date.now() - t > days * 86400000;
}
