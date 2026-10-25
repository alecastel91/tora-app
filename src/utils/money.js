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

// Agent plan, major units: one flat price per agent, unlimited artists
// (2026-10-26). Mirrors tora-backend/src/config/pricing.js AGENT.
export const AGENT_PRICES = {
  EUR: { monthly: 49, yearly: 490 },
  JPY: { monthly: 8580, yearly: 85800 },
  USD: { monthly: 56.90, yearly: 569 },
};

// One-off extras, major units.
export const EXTRA_PRICES = {
  likes_5:       { EUR: 2, JPY: 350, USD: 2.49 },
  likes_week:    { EUR: 5, JPY: 880, USD: 5.90 },
  connections_1: { EUR: 5, JPY: 880, USD: 5.90 },
  connections_3: { EUR: 12, JPY: 2080, USD: 13.90 },
  offers_1:      { EUR: 5, JPY: 880, USD: 5.90 },
  offers_3:      { EUR: 12, JPY: 2080, USD: 13.90 },
};
