/**
 * Minimal badge glyphs — thin-stroke icons in the app's icon language
 * (feather-style, 24x24 box). One design per badge; the stroke moves through
 * the tier ladder (bronze → silver → gold → platinum → diamond → infrared
 * holo) as the member levels up. Sophistication comes from metallic gradient
 * strokes, a two-weight line hierarchy (main outline + fine detail lines)
 * and a faint containing ring — no fills, no glow.
 *
 * drawBadgeGlyph(key, opts) returns an SVG string; render via
 * dangerouslySetInnerHTML (no user input reaches the markup).
 */

// Tier ladder: [light, dark] gradient stops per metal
export const TIER_COLORS = {
  bronze:   ['#E8B07C', '#9E6234'],
  silver:   ['#F2F5FA', '#9AA3B2'],
  gold:     ['#FFE08A', '#D89B2D'],
  platinum: ['#FFFFFF', '#BFD4DE'],
  diamond:  ['#D9F3FF', '#5FB1E8'],
  holo:     ['#FF3366', '#667EEA'], // infrared → indigo, drawn diagonally
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

// Display order: tiered achievements first, membership badges close the list
export const BADGE_DISPLAY_ORDER = [
  'gigs', 'events', 'closer', 'globetrotter',
  'connector', 'resident', 'ambassador', 'crowd',
  'yearly', 'founding',
];

export function sortBadges(list) {
  const rank = (k) => {
    const i = BADGE_DISPLAY_ORDER.indexOf(k);
    return i === -1 ? BADGE_DISPLAY_ORDER.length : i;
  };
  return [...(list || [])].sort((a, b) => rank(a.key) - rank(b.key));
}

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

// Gradient stops for single-state badges (same metallic treatment)
const ACCENT_GRADIENTS = {
  founding: ['#FF7A9B', '#D91F52'],
  yearly: ['#FFE08A', '#D89B2D'],
};

// Stroke glyphs, 24x24 box. Main outlines inherit the 1.6 stroke; fine
// detail lines carry their own opacity/stroke-width for hierarchy.
const D = 'opacity=".45" stroke-width="1.1"';
const GLYPHS = {
  founding: `
    <path d="M4 15.5 L4 7.5 L8.5 11 L12 5 L15.5 11 L20 7.5 L20 15.5 Z"/>
    <path d="M4 18.5 H20"/>
    <path d="M9.2 15.5 L12 13.6 L14.8 15.5" ${D}/>`,
  yearly: `
    <rect x="4" y="5.5" width="16" height="14" rx="2.4"/>
    <path d="M8.5 3.2 V7 M15.5 3.2 V7" ${D}/>
    <path d="M4 9.6 H20" ${D}/>
    <path d="M12 11.6 L13 13.7 L15.3 14 L13.6 15.6 L14 17.9 L12 16.8 L10 17.9 L10.4 15.6 L8.7 14 L11 13.7 Z"/>`,
  gigs: `
    <circle cx="12" cy="12" r="8.5"/>
    <circle cx="12" cy="12" r="2"/>
    <path d="M4.6 8.5 A8.5 8.5 0 0 1 8.6 4.7" ${D}/>
    <path d="M19.4 15.5 A8.5 8.5 0 0 1 15.4 19.3" ${D}/>
    <circle cx="12" cy="12" r="5.4" ${D}/>`,
  events: `
    <path d="M12 2.5 V5.5"/>
    <circle cx="12" cy="13" r="7.5"/>
    <path d="M4.8 11 H19.2 M4.8 15 H19.2" ${D}/>
    <path d="M9.4 6.4 c-1.6 4.2 -1.6 9 0 13.2 M14.6 6.4 c1.6 4.2 1.6 9 0 13.2" ${D}/>`,
  closer: `
    <path d="M6.5 3.5 H15 L18.5 7 V20.5 H6.5 Z"/>
    <path d="M15 3.5 V7 H18.5"/>
    <path d="M9.5 10.5 H15.5 M9.5 13.5 H13" ${D}/>
    <circle cx="15" cy="17.5" r="2.6"/>
    <circle cx="15" cy="17.5" r="1" ${D}/>`,
  globetrotter: `
    <circle cx="12" cy="12" r="8.5"/>
    <path d="M3.5 12 H20.5" ${D}/>
    <path d="M4.7 7.8 H19.3 M4.7 16.2 H19.3" ${D}/>
    <path d="M12 3.5 c3 2.7 3 14.3 0 17 M12 3.5 c-3 2.7 -3 14.3 0 17"/>`,
  connector: `
    <circle cx="6.5" cy="6.5" r="2.4"/>
    <circle cx="17.5" cy="8.5" r="2.4"/>
    <circle cx="11.5" cy="18" r="2.4"/>
    <path d="M8.8 7 L15.1 8.1 M7.4 8.6 L10.6 15.9 M16.4 10.6 L12.6 16" ${D}/>`,
  resident: `
    <path d="M4 11 L12 4.5 L20 11"/>
    <path d="M6 9.5 V19.5 H18 V9.5"/>
    <path d="M10.2 19.5 V14 H13.8 V19.5" ${D}/>
    <path d="M12 4.5 V2.8 M16.6 8.2 V5 H18.2 V9.5" ${D}/>`,
  ambassador: `
    <circle cx="10" cy="8" r="3.4"/>
    <path d="M4.3 19.5 c0 -3.7 2.6 -5.9 5.7 -5.9 s5.7 2.2 5.7 5.9"/>
    <path d="M17.2 8.3 H21.4 M19.3 6.2 V10.4"/>`,
  crowd: `
    <path d="M12 20 c-5.6 -3.6 -8.4 -6.8 -8.4 -10 c0 -2.6 2 -4.4 4.3 -4.4 c1.7 0 3.1 1 4.1 2.6 c1 -1.6 2.4 -2.6 4.1 -2.6 c2.3 0 4.3 1.8 4.3 4.4 c0 3.2 -2.8 6.4 -8.4 10 Z"/>
    <path d="M6.2 8.6 c0.2 -1.2 1.1 -2 2.2 -2.2" ${D}/>`,
};

let uid = 0;

/**
 * opts: { level, max, locked }
 * Single-state badges (max 0): identity accent gradient when earned.
 * Tiered: metallic gradient of the current tier; top tier = infrared holo.
 * A faint ring frames every glyph; locked = flat low-contrast stroke.
 */
export function drawBadgeGlyph(key, opts = {}) {
  const glyph = GLYPHS[key];
  if (!glyph) return '';
  const { level = 0, max = 0, locked = false } = opts;
  let stroke;
  let ring;
  let defs = '';
  if (locked) {
    stroke = 'rgba(255,255,255,.28)';
    ring = 'rgba(255,255,255,.07)';
  } else {
    const name = max ? tierColorName(level, max) : null;
    const stops = max
      ? TIER_COLORS[name] || ['#FFFFFF', '#FFFFFF']
      : ACCENT_GRADIENTS[key] || [BADGE_ACCENTS[key] || '#FFFFFF', BADGE_ACCENTS[key] || '#FFFFFF'];
    const id = 'bg' + (uid++);
    const diag = name === 'holo';
    defs = `<linearGradient id="${id}" x1="0" y1="0" x2="${diag ? 1 : 0}" y2="1">
      <stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/>
    </linearGradient>`;
    stroke = `url(#${id})`;
    ring = `url(#${id})`;
  }
  return `<svg viewBox="-3 -3 30 30" fill="none" stroke="${stroke}" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"
    style="display:block;width:100%;height:100%">${defs ? `<defs>${defs}</defs>` : ''}
    <circle cx="12" cy="12" r="14" stroke="${ring}" stroke-width="0.8" opacity="${locked ? 1 : 0.28}"/>
    ${glyph}</svg>`;
}

/** Tier pips row as a tiny standalone SVG (lit in the tier's light stop). */
export function drawBadgePips(_key, { level = 0, max = 0, locked = false } = {}) {
  if (!max) return '';
  const name = tierColorName(level, max);
  const lit = locked ? 'rgba(255,255,255,.25)'
    : (TIER_COLORS[name] || [null, null])[0] || 'rgba(255,255,255,.25)';
  const w = max * 10;
  const dots = Array.from({ length: max }, (_, i) =>
    `<circle cx="${5 + i * 10}" cy="4" r="2" fill="${i < level ? lit : 'rgba(255,255,255,.14)'}"/>`
  ).join('');
  return `<svg viewBox="0 0 ${w} 8" xmlns="http://www.w3.org/2000/svg"
    style="display:block;width:${w}px;height:8px">${dots}</svg>`;
}
