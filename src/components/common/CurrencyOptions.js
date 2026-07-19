import { CURRENCIES } from '../../utils/currencies';

// Prebuilt <option> lists shared by every currency <select>. Module-level so
// the identical element references short-circuit React's diff on form
// re-renders, and so the rendering of currency choices lives in one place.
export const CURRENCY_OPTIONS = CURRENCIES.map((c) => (
  <option key={c.code} value={c.code}>{c.code}</option>
));

export const CURRENCY_OPTIONS_WITH_SYMBOL = CURRENCIES.map((c) => (
  <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
));
