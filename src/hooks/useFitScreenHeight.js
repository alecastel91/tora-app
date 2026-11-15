import { useEffect } from 'react';

/* Phones: pins a fixed-height screen to the space the app scroller really
   gives it, written to the CSS variable `cssVar` on the element. The CSS
   100vh calc over-shoots on iPhones (100vh includes the collapsed-URL-bar
   area), which let the whole page scroll and slid the screen's own header
   under the app header. Desktop lets the page scroll and ignores the var.
   `deps` re-measure when the root element remounts. */
export default function useFitScreenHeight(ref, cssVar, deps = []) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) return;
      const scroller = el.closest('.app-content');
      if (!scroller || scroller.clientHeight < 100) return; // hidden keep-mounted panel
      // NaN-only fallback: a real padding-bottom of 0 must stay 0.
      const pb = parseFloat(getComputedStyle(scroller).paddingBottom);
      const padBottom = Number.isNaN(pb) ? 70 : pb;
      el.style.setProperty(cssVar, `${Math.max(320, Math.round(scroller.clientHeight - padBottom))}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure); // fires when a hidden tab becomes visible
    ro.observe(el);
    return () => { window.removeEventListener('resize', measure); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
