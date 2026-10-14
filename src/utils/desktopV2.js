/* Desktop v2 — a parallel, refined desktop layout kept behind a flag so the
 * shipped desktop stays the default while the new one is evaluated.
 *
 * The flag is a single `desktop-v2` class on <html>. Every rule in
 * styles/desktop-v2.css is nested under BOTH that class and
 * @media (min-width: 1024px), which buys two guarantees without relying on
 * discipline: flag off, no selector can match (zero diff); below 1024px,
 * nothing is in range (the phone cannot be affected).
 *
 * Applied on import rather than from a call: `import` statements are hoisted,
 * so a function call sitting above the stylesheet imports would still run after
 * them. Module side effects DO run in import order, so importing this module
 * above ./styles/index.css is what actually lands the class first — same
 * pattern as ./services/install in index.js.
 */
const KEY = 'tora-desktop-v2';

export const isDesktopV2 = () => document.documentElement.classList.contains('desktop-v2');

function apply(on) {
  document.documentElement.classList.toggle('desktop-v2', !!on);
}

// ?desktop=v2 turns it on, ?desktop=v1 (or =off) turns it off, and either one
// updates the stored preference so the next plain load keeps it.
const param = new URLSearchParams(window.location.search).get('desktop');
if (param === 'v2') localStorage.setItem(KEY, '1');
else if (param === 'v1' || param === 'off') localStorage.removeItem(KEY);

apply(localStorage.getItem(KEY) === '1');

// Console flip for same-scroll A/B: toraDesktopV2() toggles, or pass a bool.
window.toraDesktopV2 = (next) => {
  const value = next === undefined ? !isDesktopV2() : !!next;
  if (value) localStorage.setItem(KEY, '1');
  else localStorage.removeItem(KEY);
  apply(value);
  return value;
};
