import { travelData } from './travelData';

/**
 * Visitor entry for a booking: how the artist's passport gets into the event
 * country as a short-stay visitor (visa-free, visa on arrival, eVisa or a
 * visa), what to file before flying (ESTA, eTA, ETA...) and the arrival card.
 * Guidance only, from official sources (utils/travelData: the server's copy,
 * else data/visitorEntry.json). A passport the data doesn't list as visa-free
 * falls back to "visa needed", the safe reading. Mirrored on the server in
 * tora-backend utils/travelRules.js: keep the two in step.
 */

const RANK = { visa_free: 3, visa_on_arrival: 2, evisa: 1 };
// Every nationality the tiers name, per version of the data.
const namedIn = new WeakMap();
function nationalities(data) {
  if (!namedIn.has(data)) namedIn.set(data, [...new Set(Object.values(data).flatMap((rule) => (rule?.tiers || []).flatMap((tier) => (Array.isArray(tier.nationalities) ? tier.nationalities : []))))]);
  return namedIn.get(data);
}

// A tier note covers every passport in the tier ("Taiwan passports must show
// an ID number..."): keep the sentences about this passport or about none.
function noteFor(note, passport, named) {
  if (!note) return null;
  const names = (sentence, n) => new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u').test(sentence);
  const kept = note.split(/(?<=\.)\s+/).filter((sentence) => names(sentence, passport)
    || !named.some((n) => names(sentence, n)));
  return kept.join(' ') || null;
}
const inList = (list, passport) => list === '*' || (Array.isArray(list) && list.includes(passport));

// A dated rule (a trial, a policy ending, a temporary exemption) counts only
// when it still runs on the show date.
const runsOn = (until, on) => !until || new Date(`${until}T23:59:59`) >= on;
// An upcoming form counts from its start date, when it has one.
const liveOn = (a, on) => a.status !== 'upcoming' || (!!a.startsOn && new Date(`${a.startsOn}T00:00:00`) <= on);

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
  }).map((a) => ({ ...a, status: liveOn(a, on) ? 'live' : 'upcoming' }));
}

/**
 * { kind, country, passport?, days?, note?, authorisations, arrivalCard, otherwise?, rule? }
 * kind: 'no-data' | 'visa_free' | 'visa_on_arrival' | 'evisa' | 'visa'.
 * Call it only for a foreign passport (home and free-movement pairs are
 * settled by permitStatusFor). With two passports the easiest entry wins.
 * `date` is the show date: dated rules are read as they stand on that day.
 */
export function entryStatusFor(country, passports, date) {
  const data = travelData().entry;
  const rule = data[country];
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
    note: noteFor(tier?.note, passport, nationalities(data)),
    otherwise: tier ? null : rule.otherwise,
    authorisations: auths,
    arrivalCard: rule.arrivalCard || null,
    rule,
  };
}
