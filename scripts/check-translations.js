#!/usr/bin/env node
/**
 * Translation lint. See TRANSLATION.md for the standard this enforces.
 *
 *   node scripts/check-translations.js
 *
 * Catches the four ways translations have actually broken here:
 *   1. key drift between locales (a missing key silently shows English)
 *   2. {{var}} drift (a user sees a literal "{{n}}")
 *   3. banned terminology (ベニュー, 予約 for a booking, palavra-passe, tu-forms in pt-BR…)
 *   4. brand terms that got translated (Tour Kickstart, TORA)
 *
 * Exits non-zero when anything fails, so it can gate a commit or CI.
 */
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const LOCALES = ['en', 'it', 'fr', 'es', 'pt', 'zh', 'ja', 'ko'];
const DIR = path.join(HERE, '..', 'src', 'translations');

// Terms that must never appear, per locale, with what to use instead.
const BANNED = {
  ja: [
    [/ベニュー/, 'ヴェニュー (the reviewed term for the VENUE role, Nov 2026)'],
    [/予約(?!されて)/, 'ブッキング (予約 reads as a consumer reservation)'],
  ],
  pt: [
    [/\bpalavra-passe\b/i, 'senha'],
    [/\butilizador(es)?\b/i, 'usuário(s)'],
    [/\bgerir\b/i, 'gerenciar'],
    [/\bficheiro(s)?\b/i, 'arquivo(s)'],
    [/\bpartilhar\b/i, 'compartilhar'],
    [/\beliminar\b/i, 'excluir'],
    [/\bcontacto(s)?\b/i, 'contato(s)'],
    [/\bteu(s)?\b|\btua(s)?\b/i, 'seu/sua — pt-BR uses você'],
    [/\bpodes\b|\bqueres\b|\btens\b/i, 'pode/quer/tem — pt-BR uses você'],
    [/(^|[^A-Za-zÀ-ÿ])és([^A-Za-zÀ-ÿ]|$)/i, 'é — pt-BR uses você'],
  ],
};

// Must survive untranslated in every locale that mentions them.
const BRAND = ['TORA', 'Tour Kickstart'];

/**
 * Every string leaf, keyed by path — one walker for objects AND arrays, so the
 * guide's `chapters[0].entries[1].a` is reached the same way as `search.title`.
 * (This used to be two passes: one that treated arrays as leaves and a second
 * that re-walked them, which is how the guide escaped the pt-BR conversion.)
 */
const walk = (node, prefix = '') => {
  if (typeof node === 'string') return [[prefix, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => walk(v, `${prefix}[${i}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => walk(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
};

/** Structural keys only — what parity is compared on. */
const keyPaths = (node) => walk(node).map(([k]) => k);

const vars = (s) => (s.match(/\{\{\w+\}\}/g) || []).sort().join(',');

(async () => {
  const loaded = {};
  for (const l of LOCALES) {
    const mod = await import(pathToFileURL(path.join(DIR, `${l}.js`)).href);
    loaded[l] = mod.default || Object.values(mod)[0];
  }

  const problems = [];
  const baseKeys = new Set(keyPaths(loaded.en));
  const baseStrings = new Map(walk(loaded.en));

  for (const l of LOCALES) {
    const pairs = walk(loaded[l]);
    const keys = new Set(pairs.map(([k]) => k));

    for (const k of baseKeys) if (!keys.has(k)) problems.push(`${l}: MISSING key ${k}`);
    for (const k of keys) if (!baseKeys.has(k)) problems.push(`${l}: EXTRA key ${k}`);

    for (const [k, v] of pairs) {
      const en = baseStrings.get(k);
      if (en && vars(en) !== vars(v)) {
        problems.push(`${l}: {{var}} mismatch at ${k} — en[${vars(en)}] vs ${l}[${vars(v)}]`);
      }
      for (const [re, fix] of BANNED[l] || []) {
        if (re.test(v)) problems.push(`${l}: banned term at ${k} → use ${fix}\n      "${v.slice(0, 90)}"`);
      }
      for (const b of BRAND) {
        // if English used the brand term here, the translation must keep it
        if (en && en.includes(b) && !v.includes(b)) {
          problems.push(`${l}: brand term "${b}" lost at ${k}`);
        }
      }
    }
  }

  const total = keyPaths(loaded.en).length;
  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s) across ${LOCALES.length} locales (${total} keys):\n`);
    problems.slice(0, 40).forEach((p) => console.error('  •', p));
    if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
    console.error('\nSee TRANSLATION.md for the standard.\n');
    process.exit(1);
  }
  console.log(`✓ ${LOCALES.length} locales, ${total} keys — parity, {{vars}}, terminology and brand terms all clean.`);
})().catch((e) => { console.error('check-translations failed:', e.message); process.exit(1); });
