/**
 * Minimal badge glyphs — thin-stroke icons in the app's icon language
 * (feather-style, 24x24 box). One design per badge; the STROKE COLOR moves
 * through the tier ladder (bronze → silver → gold → platinum → diamond →
 * infrared holo) as the member levels up. No fills, no glow, no chrome —
 * card surfaces come from the host component.
 *
 * drawBadgeGlyph(key, opts) returns an SVG string; render via
 * dangerouslySetInnerHTML (no user input reaches the markup).
 */

// Tier color ladder (stroke tints, quiet-premium)
export const TIER_COLORS = {
  bronze:   '#C98A52',
  silver:   '#C7CCD6',
  gold:     '#EFBD4A',
  platinum: '#EDF4F8',
  diamond:  '#9FDCFF',
  holo:     null, // rendered as an infrared→violet gradient
};
const LADDER5 = ['bronze', 'silver', 'gold', 'platinum', 'holo'];
const LADDER6 = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'holo'];

export function tierColorName(level, max) {
  if (!max || level <= 0) return null;
  return (max === 6 ? LADDER6 : LADDER5)[Math.min(level, max) - 1];
}

export const BADGE_TIER_COUNT = {
  gigs: 6, events: 6, closer: 5, globetrotter: 5,
  connector: 5, resident: 5, ambassador: 5, crowd: 5,
};

// Identity accents for single-state badges and name labels
export const BADGE_ACCENTS = {
  founding: '#FF3366',
  yearly: '#FFD700',
  gigs: '#667EEA',
  events: '#F5576C',
  closer: '#43E97B',
  globetrotter: '#4DA6FF',
  connector: '#43E97B',
  resident: '#FFC107',
  ambassador: '#FF6B9E',
  crowd: '#FF8A00',
};

// Stroke glyphs, 24x24 box. Pure line work — matches utils/icons.js.
const GLYPHS = {
  founding: `
    <path d="M4 15.5 L4 7.5 L8.5 11 L12 5 L15.5 11 L20 7.5 L20 15.5 Z"/>
    <path d="M4 18.5 H20"/>`,
  yearly: `
    <path d="M12 3.5 L18.5 9 L12 20.5 L5.5 9 Z"/>
    <path d="M5.5 9 H18.5"/>
    <path d="M9.5 3.9 L12 9 L14.5 3.9"/>`,
  gigs: `
    <circle cx="12" cy="12" r="8.5"/>
    <circle cx="12" cy="12" r="2"/>
    <path d="M4.6 8.5 A8.5 8.5 0 0 1 8.6 4.7" opacity=".5"/>
    <path d="M19.4 15.5 A8.5 8.5 0 0 1 15.4 19.3" opacity=".5"/>`,
  events: `
    <path d="M12 2.5 V5.5"/>
    <circle cx="12" cy="13" r="7.5"/>
    <path d="M4.8 11 H19.2 M4.8 15 H19.2" opacity=".6"/>
    <path d="M9.4 6.4 c-1.6 4.2 -1.6 9 0 13.2 M14.6 6.4 c1.6 4.2 1.6 9 0 13.2" opacity=".6"/>`,
  closer: `
    <path d="M6.5 3.5 H15 L18.5 7 V20.5 H6.5 Z"/>
    <path d="M15 3.5 V7 H18.5"/>
    <path d="M9.5 10.5 H15.5 M9.5 13.5 H13"/>
    <circle cx="15" cy="17.5" r="2.6"/>`,
  globetrotter: `
    <circle cx="12" cy="12" r="8.5"/>
    <path d="M3.5 12 H20.5"/>
    <path d="M12 3.5 c3 2.7 3 14.3 0 17 M12 3.5 c-3 2.7 -3 14.3 0 17"/>`,
  connector: `
    <circle cx="6.5" cy="6.5" r="2.4"/>
    <circle cx="17.5" cy="8.5" r="2.4"/>
    <circle cx="11.5" cy="18" r="2.4"/>
    <path d="M8.8 7 L15.1 8.1 M7.4 8.6 L10.6 15.9 M16.4 10.6 L12.6 16"/>`,
  resident: `
    <path d="M4 11 L12 4.5 L20 11"/>
    <path d="M6 9.5 V19.5 H18 V9.5"/>
    <path d="M10.2 19.5 V14 H13.8 V19.5"/>`,
  ambassador: `
    <path d="M4.5 8 H19.5 A2.6 2.6 0 0 1 19.5 16 H4.5 A2.6 2.6 0 0 1 4.5 8 Z"/>
    <path d="M9 8.5 V15.5" stroke-dasharray="1.6 2"/>
    <path d="M13.5 12 H17 M15.25 10.25 V13.75"/>`,
  crowd: `
    <path d="M12 20 c-5.6 -3.6 -8.4 -6.8 -8.4 -10 c0 -2.6 2 -4.4 4.3 -4.4 c1.7 0 3.1 1 4.1 2.6 c1 -1.6 2.4 -2.6 4.1 -2.6 c2.3 0 4.3 1.8 4.3 4.4 c0 3.2 -2.8 6.4 -8.4 10 Z"/>`,
};

let uid = 0;

/**
 * opts: { level, max, locked }
 * Single-state badges (max 0): identity accent when earned.
 * Tiered: stroke color = tier metal; top tier = infrared→violet gradient.
 */
export function drawBadgeGlyph(key, opts = {}) {
  const glyph = GLYPHS[key];
  if (!glyph) return '';
  const { level = 0, max = 0, locked = false } = opts;
  const id = 'bg' + (uid++);
  let stroke;
  let defs = '';
  if (locked) {
    stroke = 'rgba(255,255,255,.28)';
  } else if (!max) {
    stroke = BADGE_ACCENTS[key] || '#FFFFFF';
  } else {
    const name = tierColorName(level, max);
    if (name === 'holo') {
      defs = `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FF3366"/><stop offset="1" stop-color="#667EEA"/>
      </linearGradient>`;
      stroke = `url(#${id})`;
    } else {
      stroke = TIER_COLORS[name] || 'rgba(255,255,255,.28)';
    }
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"
    style="display:block;width:100%;height:100%">${defs ? `<defs>${defs}</defs>` : ''}${glyph}</svg>`;
}

/** Tier pips row as a tiny standalone SVG (lit in the tier color). */
export function drawBadgePips(key, { level = 0, max = 0, locked = false } = {}) {
  if (!max) return '';
  const name = tierColorName(level, max);
  const lit = locked ? 'rgba(255,255,255,.25)'
    : name === 'holo' ? '#FF3366'
    : (TIER_COLORS[name] || 'rgba(255,255,255,.25)');
  const w = max * 10;
  const dots = Array.from({ length: max }, (_, i) =>
    `<circle cx="${5 + i * 10}" cy="4" r="2" fill="${i < level ? lit : 'rgba(255,255,255,.14)'}"/>`
  ).join('');
  return `<svg viewBox="0 0 ${w} 8" xmlns="http://www.w3.org/2000/svg"
    style="display:block;width:${w}px;height:8px">${dots}</svg>`;
}
