/* Desktop layouts behind a flag. v3 is the desktop TORA now ships; v1 is kept
 * reachable as the rollback and for anyone who opted into it.
 *
 *   v1 — the previous desktop (responsive.css). No class on <html>.
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

const KEY = 'tora-desktop-layout'; // 'v1' | 'v2' | 'v3'; absent = DEFAULT_LEVEL
const LEVELS = ['v1', 'v2', 'v3'];
const DESKTOP_MQ = '(min-width: 1024px)';

/* The desktop someone gets when they have expressed no preference. Moved to
   'v3' on 2026-10-22: the desktop-native layout is now what TORA ships.
   'v1' remains a stored value in its own right because it is the rollback —
   an opt-out that merely cleared the key would be silently undone here on the
   very next load, exactly when it is needed. `?desktop=off` sets it, and a
   stored choice always beats this default, so nobody who opted out is moved. */
const DEFAULT_LEVEL = 'v3';

export const isDesktopV2 = () => document.documentElement.classList.contains('desktop-v2');
export const isDesktopV3 = () => document.documentElement.classList.contains('desktop-v3');

function apply(level) {
  const cl = document.documentElement.classList;
  cl.toggle('desktop-v2', level === 'v2' || level === 'v3');
  cl.toggle('desktop-v3', level === 'v3');
}

function store(level) {
  if (LEVELS.includes(level)) localStorage.setItem(KEY, level);
  else localStorage.removeItem(KEY); // 'reset' — follow DEFAULT_LEVEL again
}

// ?desktop=v1|v2|v3 records a deliberate choice that survives later loads;
// =off is a synonym for v1, the rollback switch. =reset forgets the choice.
const param = new URLSearchParams(window.location.search).get('desktop');
if (LEVELS.includes(param)) store(param);
else if (param === 'off') store('v1');
else if (param === 'reset') store(null);

apply(localStorage.getItem(KEY) || DEFAULT_LEVEL);

// Console flip: toraDesktop('v3'), toraDesktop('v1'). The level is read from
// the <html> class at render time, which React cannot observe, so flipping it
// in place would leave v3 screens mounted with v2 CSS (or the reverse). The
// level is persisted, so a reload lands on it cleanly.
window.toraDesktop = (level) => {
  const next = LEVELS.includes(level) ? level : DEFAULT_LEVEL;
  store(next);
  apply(next);
  window.location.reload();
  return next;
};

/** Reactive matchMedia: true while the query matches (subscribed only when `enabled`). */
export function useMediaQuery(query, enabled = true) {
  const [on, setOn] = useState(() => enabled && window.matchMedia(query).matches);
  useEffect(() => {
    if (!enabled) { setOn(false); return undefined; }
    const mq = window.matchMedia(query);
    setOn(mq.matches); // `enabled` may have just flipped — re-sync before listening
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
