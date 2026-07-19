/**
 * Badge medallion renderer — ported from the Badge Lab (v3 look: each badge
 * is its own object; tier expressed by ribbon metal + pips; art itself is a
 * fixed signature illustration per badge — per-tier evolving art stays in
 * the lab until adopted).
 *
 * drawBadgeSVG(key, opts) returns an SVG string; render via
 * dangerouslySetInnerHTML (no user input flows into the markup — tier names
 * come from the server-side catalog).
 */

const METALS = {
  steel:    { hi: '#5a5a66', mid: '#38383f', lo: '#1c1c22', edge: '#0c0c10' },
  bronze:   { hi: '#e8a465', mid: '#b06a30', lo: '#6e3d17', edge: '#402108' },
  silver:   { hi: '#f2f5fa', mid: '#aab2c0', lo: '#68707e', edge: '#3c424e' },
  gold:     { hi: '#ffe58a', mid: '#f0b429', lo: '#a06d0a', edge: '#5e3f04' },
  platinum: { hi: '#ffffff', mid: '#d7e6ee', lo: '#8ba4b3', edge: '#5a7280' },
  diamond:  { hi: '#ffffff', mid: '#9fdcff', lo: '#3f7ea6', edge: '#1c4258' },
  holo:     { hi: '#ff9ab8', mid: '#FF3366', lo: '#667EEA', edge: '#2a1140' },
};

const LADDER5 = ['bronze','silver','gold','platinum','holo'];
const LADDER6 = ['bronze','silver','gold','platinum','diamond','holo'];

function metalFor(level, max) {
  if (!max) return null;
  if (level <= 0) return METALS.steel;
  return METALS[(max === 6 ? LADDER6 : LADDER5)[Math.min(level, max) - 1]];
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.min(255,((n>>16)&255)+amt)},${Math.min(255,((n>>8)&255)+amt)},${Math.min(255,(n&255)+amt)})`;
}
function darken(hex, amt) { return lighten(hex, -amt); }
const sparkle = (x, y, s, o = 1) =>
  `<path d="M${x} ${y - s} l${s*.32} ${s*.68} ${s*.68} ${s*.32} -${s*.68} ${s*.32} -${s*.32} ${s*.68} -${s*.32} -${s*.68} -${s*.68} -${s*.32} ${s*.68} -${s*.32} Z" fill="#fff" opacity="${o}"/>`;


const C = {
  crown: (y = -52, s = 1, col = '#FFD700') => `
    <g transform="translate(0,${y}) scale(${s})">
      <path d="M-16 8 L-16 -4 L-8 2 L0 -10 L8 2 L16 -4 L16 8 Z" fill="${col}" stroke="${darken(col,80)}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="0" cy="-10" r="2.6" fill="#fff"/>
    </g>`,
  flames: (y = -46) => `
    <g transform="translate(0,${y})">
      <path d="M-16 8 c-4 -10 2 -16 7 -16 c-2 6 2 8 3 13 Z" fill="#FF8A00"/>
      <path d="M-2 4 c-2 -12 6 -18 11 -15 c-4 6 1 9 1 15 Z" fill="#FFD700"/>
      <path d="M12 8 c-1 -8 5 -12 9 -10 c-2 5 1 7 0 10 Z" fill="#FF8A00"/>
    </g>`,
  wings: (y = 0, sp = 52) => `
    <g transform="translate(0,${y})">
      <path d="M-${sp} -6 q-16 -8 -18 -22 q14 2 20 12 q-2 -14 8 -20 q4 12 -2 26 Z" fill="#f2f5fa" stroke="#68707e" stroke-width="2" stroke-linejoin="round"/>
      <path d="M${sp} -6 q16 -8 18 -22 q-14 2 -20 12 q2 -14 -8 -20 q-4 12 2 26 Z" fill="#f2f5fa" stroke="#68707e" stroke-width="2" stroke-linejoin="round"/>
    </g>`,
  star: (x = 0, y = -52, s = 9, c = '#FFD700') => `
    <path d="M${x} ${y-s} l${s*.31} ${s*.66} ${s*.72} ${s*.1} -${s*.52} ${s*.5} ${s*.12} ${s*.72} -${s*.63} -${s*.34} -${s*.63} ${s*.34} ${s*.12} -${s*.72} -${s*.52} -${s*.5} ${s*.72} -${s*.1} Z"
      fill="${c}" stroke="${darken(c,80)}" stroke-width="1.6" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px ${c})"/>`,
  laurels: (y = 34, c = '#FFD700') => `
    <g transform="translate(0,${y})" fill="${c}" stroke="${darken(c,80)}" stroke-width="1.4">
      ${[0,1,2,3].map(i => `
        <ellipse cx="${-30 - i*7}" cy="${-i*10}" rx="5" ry="9" transform="rotate(${-28 - i*14} ${-30 - i*7} ${-i*10})"/>
        <ellipse cx="${30 + i*7}" cy="${-i*10}" rx="5" ry="9" transform="rotate(${28 + i*14} ${30 + i*7} ${-i*10})"/>`).join('')}
    </g>`,
  pedestal: (y = 40) => `
    <g transform="translate(0,${y})">
      <rect x="-26" y="0" width="52" height="9" rx="3" fill="#FFD700" stroke="#5e3f04" stroke-width="2"/>
      <rect x="-32" y="9" width="64" height="9" rx="3" fill="#f0b429" stroke="#5e3f04" stroke-width="2"/>
    </g>`,
  columns: () => `
    <g>
      <rect x="-52" y="-26" width="9" height="58" rx="2" fill="#d7e6ee" stroke="#5a7280" stroke-width="2"/>
      <rect x="43" y="-26" width="9" height="58" rx="2" fill="#d7e6ee" stroke="#5a7280" stroke-width="2"/>
      <rect x="-58" y="-34" width="116" height="9" rx="2" fill="#d7e6ee" stroke="#5a7280" stroke-width="2"/>
    </g>`,
  fedora: (y = -52) => `
    <g transform="translate(0,${y})">
      <ellipse cx="0" cy="6" rx="24" ry="6" fill="#1d1d24" stroke="#000" stroke-width="2"/>
      <path d="M-13 5 C-13 -6 13 -6 13 5 Z" fill="#2c2c36" stroke="#000" stroke-width="2"/>
      <rect x="-13" y="0" width="26" height="4" fill="#FF3366"/>
    </g>`,
};


function vinylBase(a) {
  return `
    <circle cx="0" cy="0" r="42" fill="#15151b" stroke="#000" stroke-width="3"/>
    ${[35,29,23].map(r => `<circle cx="0" cy="0" r="${r}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="1.4"/>`).join('')}
    <path d="M-30 -27 A41 41 0 0 1 28 -29" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="4" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="15" fill="${a}" stroke="${darken(a,75)}" stroke-width="2.4"/>
    <path d="M-15 0 A15 15 0 0 1 0 -15" fill="none" stroke="${lighten(a,80)}" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="3.2" fill="#0a0a0e" stroke="${darken(a,75)}" stroke-width="1.4"/>`;
}


const CARTOON = {
  founding(a) { return `<g transform="translate(0,6)">${C.crown(0, 2.6, a)}</g>
    <circle cx="-22" cy="36" r="5" fill="#3ddc97" stroke="${darken(a,85)}" stroke-width="1.6"/>
    <circle cx="0" cy="38" r="6" fill="#4DA6FF" stroke="${darken(a,85)}" stroke-width="1.6"/>
    <circle cx="22" cy="36" r="5" fill="#FFD700" stroke="${darken(a,85)}" stroke-width="1.6"/>
    ${sparkle(-36,-30,5,.95)} ${sparkle(38,-34,4,.8)}`; },
  yearly(a) { return `
    <path d="M-28 -20 L28 -20 L42 -3 L0 40 L-42 -3 Z" fill="${a}" stroke="${darken(a,95)}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M-28 -20 L-9 -3 L-42 -3 Z" fill="${lighten(a,70)}"/>
    <path d="M28 -20 L42 -3 L9 -3 Z" fill="${darken(a,45)}"/>
    <path d="M-28 -20 L28 -20 L9 -3 L-9 -3 Z" fill="${lighten(a,100)}"/>
    <path d="M-9 -3 L9 -3 L0 40 Z" fill="${lighten(a,45)}"/>
    <path d="M-42 -3 L-9 -3 L0 40 Z" fill="${darken(a,15)}"/>
    <path d="M42 -3 L0 40 L9 -3 Z" fill="${darken(a,70)}"/>
    ${sparkle(-36,-26,6)} ${sparkle(34,14,5,.9)}`; },
  gigs(a, lvl) {
    let x = vinylBase(a);
    if (lvl >= 2) x += `<path d="M44 -18 L29 2 L38 2 L25 22 L44 0 L35 0 Z" fill="#FFD700" stroke="#5e3f04" stroke-width="2" stroke-linejoin="round" transform="translate(4,-2)"/>`;
    if (lvl >= 3) x += C.star(0, -54, 10);
    if (lvl >= 4) x = C.flames(-40) + x;
    if (lvl >= 5) x += C.crown(-58, 1);
    if (lvl >= 6) x = C.laurels(38) + x + C.pedestal(42);
    return `<g transform="translate(0,${lvl >= 6 ? -6 : 0})">${x}</g>`;
  },
  events(a, lvl) {
    let x = `
      <path d="M0 -50 V-42" stroke="rgba(255,255,255,.6)" stroke-width="3"/>
      <defs><clipPath id="db4"><circle cx="0" cy="0" r="36"/></clipPath>
      <radialGradient id="dbg4" cx=".33" cy=".28" r="1.05">
        <stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#c3cddd"/><stop offset="1" stop-color="#525c6c"/>
      </radialGradient></defs>
      <circle cx="0" cy="0" r="36" fill="url(#dbg4)" stroke="#39404c" stroke-width="2.6"/>
      <g clip-path="url(#db4)" stroke="rgba(18,22,32,.55)" stroke-width="2">
        ${[-24,-12,0,12,24].map(y => `<path d="M-40 ${y} H40"/>`).join('')}
        ${[-26,-14,-2,10,22].map(xx => `<path d="M${xx} -36 V40"/>`).join('')}
      </g>
      <g clip-path="url(#db4)"><rect x="-26" y="-24" width="11" height="11" fill="rgba(255,255,255,.9)"/>
      <rect x="6" y="-12" width="11" height="11" fill="rgba(255,255,255,.5)"/><rect x="-14" y="10" width="11" height="11" fill="${a}" opacity=".7"/></g>`;
    if (lvl >= 2) x += `<path d="M-46 -22 l10 7 M46 -22 l-10 7 M-52 12 l12 -2 M52 12 l-12 -2" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`;
    if (lvl >= 3) x = C.columns() + x;
    if (lvl >= 4) x = C.flames(-46) + x;
    if (lvl >= 5) x += C.star(0, -56, 10);
    if (lvl >= 6) x += C.pedestal(40);
    return `<g transform="translate(0,2)">${x}</g>`;
  },
  closer(a, lvl) {
    let x = `
      <g transform="rotate(-7)">
        <rect x="-30" y="-36" width="60" height="72" rx="6" fill="#f2ecdd" stroke="#b9ae94" stroke-width="2.6"/>
        <path d="M30 -36 l0 14 -14 0 Z" fill="#d8cfb8"/>
        <path d="M-19 -18 H19 M-19 -7 H19 M-19 4 H9" stroke="#a89f8a" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M-16 26 c5 -7 9 3 14 -3" stroke="#3b3b46" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      </g>
      <path d="M-42 36 L-12 6" stroke="#1d1d24" stroke-width="6" stroke-linecap="round"/>
      <path d="M-42 36 L-37 31" stroke="#FFD700" stroke-width="6" stroke-linecap="round"/>`;
    if (lvl >= 2) x += `
      <circle cx="22" cy="27" r="15" fill="${a}" stroke="${darken(a,85)}" stroke-width="2.6"/>
      <circle cx="22" cy="27" r="9.5" fill="none" stroke="${lighten(a,75)}" stroke-width="1.8"/>
      <path d="M22 20 l2.2 4.5 5 .8 -3.6 3.6 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.6 5 -.8 Z" fill="${lighten(a,100)}"/>`;
    if (lvl >= 3) x += C.star(30, -40, 9);
    if (lvl >= 4) x = C.wings(-4, 46) + x;
    if (lvl >= 5) x += C.crown(-56, 1);
    return x;
  },
  globetrotter(a, lvl) {
    let x = `
      <defs><radialGradient id="gg4" cx=".33" cy=".28" r="1">
        <stop offset="0" stop-color="${lighten(a,80)}"/><stop offset=".55" stop-color="${a}"/><stop offset="1" stop-color="${darken(a,65)}"/>
      </radialGradient><clipPath id="gc4"><circle cx="0" cy="0" r="34"/></clipPath></defs>
      <circle cx="0" cy="0" r="34" fill="url(#gg4)" stroke="${darken(a,85)}" stroke-width="2.8"/>
      <g clip-path="url(#gc4)" fill="${lighten(a,100)}" opacity=".9">
        <path d="M-31 -13 c8 -7 18 -5 22 2 c-5 7 -16 9 -22 4 Z"/>
        <path d="M5 -28 c11 0 19 8 21 16 c-8 3 -19 -2 -23 -8 Z"/>
        <path d="M-9 13 c8 2 15 8 15 16 c-8 3 -17 -3 -18 -10 Z"/>
      </g>
      <g clip-path="url(#gc4)" stroke="rgba(255,255,255,.4)" stroke-width="1.8" fill="none">
        <path d="M-34 0 H34"/><ellipse cx="0" cy="0" rx="15" ry="34"/>
      </g>
      <path d="M-23 -20 A34 34 0 0 1 7 -31" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" stroke-linecap="round"/>`;
    if (lvl >= 2) x += `
      <ellipse cx="0" cy="4" rx="50" ry="17" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.4" transform="rotate(-16)" stroke-dasharray="7 8"/>
      <g transform="rotate(-16) translate(43,-8) rotate(58)"><path d="M0 -8 L5.5 6.5 L0 3.3 L-5.5 6.5 Z" fill="#fff" stroke="#5a7280" stroke-width="1.2" stroke-linejoin="round"/></g>`;
    if (lvl >= 3) x += C.star(-42, -34, 7) + C.star(44, -20, 5.6);
    if (lvl >= 4) x = C.wings(-2, 46) + x;
    if (lvl >= 5) x += C.crown(-56, 1);
    return x;
  },
  connector(a, lvl) {
    const nodes = [[-24,-18,11],[22,-9,13],[-3,24,11],[31,26,7],[-37,13,7]];
    const n = lvl >= 3 ? 5 : (lvl >= 2 ? 3 : 2);
    const use = nodes.slice(0, n);
    const links = [];
    for (let i = 0; i < use.length; i++) for (let j = i + 1; j < use.length; j++)
      if (i + j < 5) links.push(`M${use[i][0]} ${use[i][1]} L${use[j][0]} ${use[j][1]}`);
    let x = `<path d="${links.join(' ')}" stroke="${darken(a,40)}" stroke-width="4.6" stroke-linecap="round"/>
      ${use.map(([X,Y,r]) => `
        <circle cx="${X}" cy="${Y}" r="${r}" fill="${a}" stroke="${darken(a,85)}" stroke-width="2.2"/>
        <circle cx="${X-r*.3}" cy="${Y-r*.34}" r="${r*.3}" fill="rgba(255,255,255,.9)"/>`).join('')}`;
    if (lvl >= 4) x = `<circle cx="0" cy="4" r="46" fill="none" stroke="${a}" stroke-width="2.4" stroke-dasharray="4 7" opacity=".8"/>` + x;
    if (lvl >= 5) x += `<circle cx="0" cy="4" r="12" fill="#fff" opacity=".22"/>` + C.crown(-58, 1);
    return `<g transform="translate(0,-2)">${x}</g>`;
  },
  resident(a, lvl) {
    let x = `
      <path d="M-36 -4 L0 -34 L36 -4 Z" fill="${a}" stroke="${darken(a,85)}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-36 -4 L0 -34 L0 -26 L-26 -4 Z" fill="rgba(255,255,255,.35)"/>
      <rect x="-28" y="-4" width="56" height="38" rx="4" fill="#1a1a22" stroke="${darken(a,85)}" stroke-width="3"/>
      <rect x="-8" y="9" width="16" height="25" rx="3" fill="${a}" stroke="${darken(a,85)}" stroke-width="2"/>
      <circle cx="-18" cy="8" r="5.4" fill="#ffdf8a" stroke="${darken(a,85)}" stroke-width="1.6"/>
      <circle cx="18" cy="8" r="5.4" fill="#ffdf8a" opacity=".55" stroke="${darken(a,85)}" stroke-width="1.6"/>`;
    if (lvl >= 3) x += `
      <g transform="translate(26,-24)"><path d="M0 10 V-7 L10 -9.6 V7.6" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <circle cx="-3.2" cy="10" r="4.4" fill="#fff"/><circle cx="6.8" cy="8" r="4.4" fill="#fff"/></g>`;
    if (lvl >= 4) x += `
      <path d="M0 -46 C-2 -50 -8 -50 -8 -45 C-8 -41 -4 -38 0 -35 C4 -38 8 -41 8 -45 C8 -50 2 -50 0 -46 Z"
        fill="#FF3366" stroke="${darken('#FF3366',80)}" stroke-width="1.8"/>`;
    if (lvl >= 5) x = C.columns() + x;
    return `<g transform="translate(0,4)">${x}</g>`;
  },
  ambassador(a, lvl) {
    let x = `
    <g transform="rotate(-9)">
      <rect x="-42" y="-23" width="84" height="46" rx="8" fill="${a}" stroke="${darken(a,85)}" stroke-width="3"/>
      <rect x="-42" y="-23" width="84" height="14" rx="8" fill="rgba(255,255,255,.32)"/>
      <circle cx="-42" cy="0" r="7" fill="#101014" stroke="${darken(a,85)}" stroke-width="2.2"/>
      <circle cx="42" cy="0" r="7" fill="#101014" stroke="${darken(a,85)}" stroke-width="2.2"/>
      <path d="M-18 -18 V18" stroke="${darken(a,60)}" stroke-width="2.4" stroke-dasharray="4.5 4.5"/>
      <text x="11" y="10" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="25" fill="#141419">+1</text>
    </g>`;
    if (lvl >= 2) x += C.star(-40, -34, 7) + C.star(42, -28, 5.6);
    if (lvl >= 3) x = `<circle cx="0" cy="0" r="52" fill="none" stroke="${a}" stroke-width="2.6" stroke-dasharray="5 8" opacity=".8"/>` + x;
    if (lvl >= 4) x += `<path d="M-6 34 l3.4 7 7.6 1.1 -5.5 5.4 1.3 7.6 -6.8 -3.6 -6.8 3.6 1.3 -7.6 -5.5 -5.4 7.6 -1.1 Z" fill="#4DA6FF" stroke="#1c4258" stroke-width="1.8" transform="translate(4,2)"/>`;
    if (lvl >= 5) x += C.fedora(-54);
    return x;
  },
  crowd(a, lvl) {
    let x = `
      <path d="M0 40 C-20 27 -34 14 -34 -4 C-34 -18 -22 -24 -12 -18 C-7 -15 -3 -10 0 -5 C3 -10 7 -15 12 -18 C22 -24 34 -18 34 -4 C34 14 20 27 0 40 Z"
        fill="${a}" stroke="${darken(a,85)}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M0 -5 C3 -10 7 -15 12 -18 C22 -24 34 -18 34 -4 C34 14 20 27 0 40 Z" fill="rgba(0,0,0,.2)"/>
      <path d="M-24 -10 c3 -5 10 -7 14 -2" fill="none" stroke="${lighten(a,95)}" stroke-width="4.4" stroke-linecap="round"/>`;
    if (lvl >= 2) x += sparkle(-38, 18, 6, .95) + sparkle(38, 10, 5, .85) + sparkle(-30, -28, 4.4, .8);
    if (lvl >= 3) x += `<path d="M-44 -34 l12 10 M44 -34 l-12 10 M0 -46 v12" stroke="#FFD700" stroke-width="4" stroke-linecap="round"/>`;
    if (lvl >= 4) x = C.flames(-38) + x;
    if (lvl >= 5) x += C.crown(-58, 1);
    return `<g transform="translate(0,2)">${x}</g>`;
  },
};



// v3 signature look: fixed art level per badge (evolving per-tier art is a
// later adoption from the lab)
const ART_LEVEL = {
  gigs: 2, events: 2, closer: 2, globetrotter: 2,
  connector: 3, resident: 3, ambassador: 2, crowd: 2,
};

export const BADGE_TIER_COUNT = { gigs: 6, events: 6, closer: 5, globetrotter: 5, connector: 5, resident: 5, ambassador: 5, crowd: 5 };

const SINGLE_LABEL = { founding: 'FOUNDER', yearly: 'YEARLY' };

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

let uidCounter = 0;

/**
 * opts: { tier, level, max, compact }
 * compact = object + pips only (profile chip size); full adds the ribbon.
 */
export function drawBadgeSVG(key, opts = {}) {
  const accent = BADGE_ACCENTS[key] || '#FFFFFF';
  const mx = opts.max || 0;
  const lvl = opts.level || 0;
  const tierName = mx ? (opts.tier || '') : (SINGLE_LABEL[key] || 'MEMBER');
  const m = metalFor(lvl, mx);
  const uid = 'bm' + (uidCounter++);
  const artFn = CARTOON[key];
  if (!artFn) return '';
  const art = artFn(accent, ART_LEVEL[key] || 0);
  const pips = mx ? Array.from({ length: mx }, (_, i) => {
    const x = 75 + (i - (mx - 1) / 2) * 12;
    return `<circle cx="${x}" cy="126" r="2.6" fill="${i < lvl ? accent : 'rgba(255,255,255,.15)'}"
            ${i < lvl ? `style="filter:drop-shadow(0 0 3px ${accent})"` : ''}/>`;
  }).join('') : '';
  const rib = m
    ? `<linearGradient id="rib_${uid}" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${m.hi}"/><stop offset=".5" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/>
       </linearGradient>`
    : `<linearGradient id="rib_${uid}" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${lighten(accent,25)}"/><stop offset="1" stop-color="${darken(accent,55)}"/>
       </linearGradient>`;
  const edge = m ? m.edge : darken(accent, 80);
  const ribbon = opts.compact ? '' : `
    <g>
      <path d="M34 138 L20 160 L38 156 L45 174 L58 150 Z" fill="${edge}"/>
      <path d="M116 138 L130 160 L112 156 L105 174 L92 150 Z" fill="${edge}"/>
      <path d="M44 140 h62 l7 13 -7 13 h-62 l-7 -13 Z" fill="url(#rib_${uid})" stroke="${edge}" stroke-width="2"/>
      <path d="M44 140 h62 l3.5 6.5 h-69 Z" fill="rgba(255,255,255,.3)"/>
      <text x="75" y="157.5" text-anchor="middle" font-family="Arial" font-weight="800"
            font-size="${(tierName || '').length > 9 ? 8 : 10}"
            letter-spacing="${(tierName || '').length > 9 ? 0.4 : 1.4}"
            ${(tierName || '').length > 11 ? 'textLength="58" lengthAdjust="spacingAndGlyphs"' : ''}
            fill="${m && (m === METALS.silver || m === METALS.platinum || m === METALS.diamond) ? '#1a2129' : '#fff'}">${(tierName || '').toUpperCase()}</text>
    </g>`;
  const vbH = opts.compact ? 138 : 192;
  return `
  <svg viewBox="0 0 150 ${vbH}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%">
    <defs>${rib}
      <radialGradient id="aura_${uid}" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="${accent}" stop-opacity=".33"/>
        <stop offset=".7" stop-color="${accent}" stop-opacity=".08"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="75" cy="66" rx="72" ry="66" fill="url(#aura_${uid})"/>
    <g transform="translate(75,64)">${art}</g>
    ${pips}
    ${ribbon}
  </svg>`;
}
