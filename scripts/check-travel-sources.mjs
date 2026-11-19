// Upkeep check for the booking page's Travel panel data (visitor entry +
// performer permits): every official link still answers, every nationality
// is one the passport picker offers, and the checked dates are not stale.
// Run before each quarterly re-verification and whenever a rule makes news:
//   npm run check:travel
// It cannot tell whether a rule changed: that still needs a person reading
// the official pages. It tells you which pages to read first.
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../src/data/${p}`, import.meta.url), 'utf8'));
const entry = read('visitorEntry.json');
const permits = read('performerPermits.json');
const STALE_DAYS = 120;

const profiles = readFileSync(new URL('../src/data/profiles.js', import.meta.url), 'utf8');
const zoneBlock = profiles.slice(profiles.indexOf('countriesByZone = {'), profiles.indexOf('};', profiles.indexOf('countriesByZone = {')));
const ZONES = new Set(['Americas', 'Europe', 'Middle East', 'Africa', 'Asia', 'Oceania']);
const passports = new Set([...zoneBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((n) => !ZONES.has(n)));

const problems = [];
const urls = new Map(); // url -> where it is used

for (const [file, data, dateKey] of [['visitorEntry', entry, '_checkedAt'], ['performerPermits', permits, '_verifiedAt']]) {
  const age = (Date.now() - new Date(data[dateKey]).getTime()) / 86400000;
  if (!(age <= STALE_DAYS)) problems.push(`${file}: ${dateKey} ${data[dateKey]} is older than ${STALE_DAYS} days, re-verify`);
  for (const [country, rule] of Object.entries(data)) {
    if (country.startsWith('_')) continue;
    const lists = [rule.exemptNationalities, ...(rule.tiers || []).flatMap((t) => [t.nationalities, t.except]),
      ...(rule.authorisations || []).flatMap((a) => [a.appliesTo, a.except])];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const n of list) if (!passports.has(n)) problems.push(`${file} ${country}: "${n}" is not in the passport list`);
    }
    for (const t of rule.tiers || []) if (t.until && new Date(t.until) <= new Date()) problems.push(`${file} ${country}: a ${t.kind} tier ended ${t.until}, check for an extension and update`);
    // reviewBy: a date the rule is known to change (a policy ending, an exemption expiring).
    if (rule.reviewBy && new Date(rule.reviewBy) <= new Date()) problems.push(`${file} ${country}: review date ${rule.reviewBy} has passed (${rule.reviewNote || 'rule due to change'})`);
    for (const a of rule.authorisations || []) {
      if (a.exceptUntil && new Date(a.exceptUntil) <= new Date()) problems.push(`${file} ${country}: ${a.name} exemption ended ${a.exceptUntil}, check for an extension and update`);
      if (a.status === 'upcoming' && a.startsOn && new Date(a.startsOn) <= new Date()) problems.push(`${file} ${country}: ${a.name} was due to start ${a.startsOn}, check whether it is live`);
    }
    const links = [...(rule.sources || []).map((s) => s.url), ...(rule.authorisations || []).map((a) => a.url), rule.arrivalCard?.url].filter(Boolean);
    for (const u of links) urls.set(u, [...(urls.get(u) || []), `${file} ${country}`]);
  }
}

const check = async (u) => {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(u, { method, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (TORA travel data check)' }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return null;
      if (method === 'GET') return `HTTP ${res.status}`;
    } catch (e) {
      if (method === 'GET') return e.name === 'TimeoutError' ? 'timeout' : e.message;
    }
  }
  return null;
};
// A few at a time: a hundred parallel requests read as an attack to some government sites.
const queue = [...urls.keys()];
const results = [];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let u = queue.shift(); u; u = queue.shift()) results.push([u, await check(u)]);
}));
for (const [u, err] of results) if (err) problems.push(`link ${err}: ${u} (${urls.get(u).join(', ')})`);

console.log(`${urls.size} links, ${passports.size} passports checked.`);
if (problems.length) {
  console.log(problems.map((p) => `- ${p}`).join('\n'));
  // Government sites often block scripts; a failing link is a page to open by hand, not proof it moved.
  process.exitCode = 1;
} else {
  console.log('All clean.');
}
