// Billing currencies and display — frontend mirror of
// tora-backend/src/config/pricing.js. Prices are fixed list prices per
// currency (never FX conversions); the account's currency comes from
// /billing/status (fixed once a Stripe customer exists).

export const CURRENCIES = ['EUR', 'JPY', 'USD'];
export const DEFAULT_CURRENCY = 'USD';
const SYMBOL = { EUR: '€', JPY: '¥', USD: '$' };

/** Yearly plans are billed as 10 months (2 free). */
export const YEARLY_MULT = 10;
/** The per-month equivalent of a yearly total. */
export const yearlyPerMonth = (yearlyTotal) => yearlyTotal / 12;

export const normalizeCurrency = (c) => (CURRENCIES.includes(String(c || '').toUpperCase()) ? String(c).toUpperCase() : DEFAULT_CURRENCY);

/** Major-unit amount → ¥3,480 · €19.90 · $22.90 (JPY has no decimals). */
export function formatMoney(amount, currency) {
  const cur = normalizeCurrency(currency);
  const n = Number(amount) || 0;
  return cur === 'JPY' ? `${SYMBOL.JPY}${Math.round(n).toLocaleString('en-US')}` : `${SYMBOL[cur]}${n.toFixed(2)}`;
}

// Member premium, major units.
export const MEMBER_PRICES = {
  EUR: { monthly: 19.90, yearly: 199.90 },
  JPY: { monthly: 3480, yearly: 34800 },
  USD: { monthly: 22.90, yearly: 229.90 },
};

// Agent per-seat bands, FLAT: every artist is billed at the rate the total
// reaches — solo, your own roster; in an agency, the agency's total. Mirrors
// tora-backend/src/config/pricing.js AGENT_BANDS.
export const AGENT_BANDS = [
  { upTo: 3,        monthly: { EUR: 19.90, JPY: 3480, USD: 22.90 } },
  { upTo: 10,       monthly: { EUR: 17.00, JPY: 2960, USD: 19.40 } },
  { upTo: 25,       monthly: { EUR: 14.40, JPY: 2500, USD: 16.50 } },
  { upTo: 50,       monthly: { EUR: 12.00, JPY: 2100, USD: 13.70 } },
  { upTo: Infinity, monthly: { EUR: 9.70,  JPY: 1700, USD: 11.10 } },
];

// One-off extras, major units.
export const EXTRA_PRICES = {
  likes_5:       { EUR: 2, JPY: 350, USD: 2.49 },
  likes_week:    { EUR: 5, JPY: 880, USD: 5.90 },
  connections_1: { EUR: 5, JPY: 880, USD: 5.90 },
  connections_3: { EUR: 12, JPY: 2080, USD: 13.90 },
  offers_1:      { EUR: 5, JPY: 880, USD: 5.90 },
  offers_3:      { EUR: 12, JPY: 2080, USD: 13.90 },
};

/** Band index (0-4) for an artist count — your own roster, or the agency's total. */
export function bandFor(total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  for (let i = 0; i < AGENT_BANDS.length; i++) if (n <= AGENT_BANDS[i].upTo) return i;
  return AGENT_BANDS.length - 1;
}

/** What one artist costs at `band`, major units. Solo and agency alike. */
export function seatPriceAt(currency, band, interval = 'month') {
  const cur = normalizeCurrency(currency);
  const b = AGENT_BANDS[band] || AGENT_BANDS[0];
  return b.monthly[cur] * (interval === 'year' ? YEARLY_MULT : 1);
}

