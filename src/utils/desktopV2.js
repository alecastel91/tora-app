/* Desktop layouts kept behind a flag so the shipped desktop stays the default
 * while the alternatives are evaluated.
 *
 *   v1 — the shipped desktop (responsive.css). No class on <html>.
 *   v2 — the refined FRAME: sidebar, top bar, canvases, density. Same screens.
 *        <html class="desktop-v2">, rules in styles/desktop-v2.css.
 *   v3 — the desktop-NATIVE product: the v2 frame plus desktop-only screens
 *        (dashboard home, bookings pipeline, search workspace) mounted in
 *        place of the phone screens. <html class="desktop-v2 desktop-v3">.
 *
 * Every rule in the v2/v3 stylesheets is nested under BOTH its class and
 * @media (min-width: 1024px), and the v3 screens only mount through
 * useNativeDesktop(), which also requires >= 1024px. So: flag off, nothing
 * matches and nothing mounts; below 1024px the phone cannot be affected.
 *
 * Applied on import rather than from a call: `import` statements are hoisted,
 * so a function call sitting above the stylesheet imports would still run after
 * them. Module side effects DO run in import order, so importing this module
 * above ./styles/index.css is what actually lands the class first — same
 * pattern as ./services/install in index.js.
 */
import { useEffect, useState } from 'react';

const KEY = 'tora-desktop-layout'; // 'v2' | 'v3'; absent = v1
const LEVELS = ['v2', 'v3'];
const DESKTOP_MQ = '(min-width: 1024px)';

export const isDesktopV2 = () => document.documentElement.classList.contains('desktop-v2');
export const isDesktopV3 = () => document.documentElement.classList.contains('desktop-v3');

function apply(level) {
  const cl = document.documentElement.classList;
  cl.toggle('desktop-v2', level === 'v2' || level === 'v3');
  cl.toggle('desktop-v3', level === 'v3');
}

function store(level) {
  if (level) localStorage.setItem(KEY, level);
  else localStorage.removeItem(KEY);
}

// ?desktop=v2 / v3 turns a layout on, ?desktop=v1 (or =off) turns it off, and
// any of them updates the stored preference so the next plain load keeps it.
const param = new URLSearchParams(window.location.search).get('desktop');
if (LEVELS.includes(param)) store(param);
else if (param === 'v1' || param === 'off') store(null);

apply(localStorage.getItem(KEY));

// Console flip for same-scroll A/B: toraDesktop('v3'), toraDesktop('v1').
window.toraDesktop = (level) => {
  const next = LEVELS.includes(level) ? level : null;
  store(next);
  apply(next);
  return next || 'v1';
};

/** Reactive matchMedia: true while the query matches (subscribed only when `enabled`). */
export function useMediaQuery(query, enabled = true) {
  const [on, setOn] = useState(() => enabled && window.matchMedia(query).matches);
  useEffect(() => {
    if (!enabled) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setOn(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query, enabled]);
  return on;
}

/**
 * True only when the v3 flag is on AND the window is desktop-sized. This is
 * the single gate for mounting desktop-native screens, so the phone never
 * renders one — not hidden, not mounted (hidden subtrees would still fetch).
 */
export const useNativeDesktop = () => useMediaQuery(DESKTOP_MQ, isDesktopV3());
