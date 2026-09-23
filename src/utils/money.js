// Billing currencies and display — frontend mirror of
// tora-backend/src/config/pricing.js. Prices are fixed list prices per
// currency (never FX conversions); the account's currency comes from
// /billing/status (fixed once a Stripe customer exists).

export const CURRENCIES = ['EUR', 'JPY', 'USD'];
export const DEFAULT_CURRENCY = 'USD';
const SYMBOL = { EUR: '€', JPY: '¥', USD: '$' };

/** Yearly plans are billed as 10 months (2 free): the per-month equivalent of a yearly total. */
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

// Agent per-seat bands, monthly rate per artist, major units (yearly = ×10).
export const AGENT_BANDS = [
  { upTo: 3,        monthly: { EUR: 19.90, JPY: 3480, USD: 22.90 } },
  { upTo: 10,       monthly: { EUR: 14.90, JPY: 2580, USD: 16.90 } },
  { upTo: 25,       monthly: { EUR: 11.90, JPY: 2080, USD: 13.90 } },
  { upTo: 50,       monthly: { EUR: 8.90,  JPY: 1580, USD: 9.90 } },
  { upTo: Infinity, monthly: { EUR: 6.90,  JPY: 1180, USD: 7.90 } },
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

/** Total monthly cost for a roster of `n` artists, billed graduated. */
export function agentMonthlyTotal(n, currency) {
  const cur = normalizeCurrency(currency);
  let total = 0;
  let prev = 0;
  for (const band of AGENT_BANDS) {
    if (n <= prev) break;
    total += (Math.min(n, band.upTo) - prev) * band.monthly[cur];
    prev = band.upTo;
  }
  return total;
}
