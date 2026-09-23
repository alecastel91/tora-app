// One-off extras catalog — the single frontend copy. Prices live in
// utils/money.js EXTRA_PRICES (per currency); `extraPriceLabel` formats them.
// `kind` groups items for the limit-reached upsells; `roles` restricts
// role-specific items (offers only exist for bookers).
import { EXTRA_PRICES, formatMoney } from './money';
export const EXTRA_ITEMS = [
  { key: 'likes_5',       labelKey: 'extraLikes5',  kind: 'likes' },
  { key: 'likes_week',    labelKey: 'extraLikesWeek',  kind: 'likes' },
  { key: 'connections_1', labelKey: 'extraConn1',  kind: 'connections' },
  { key: 'connections_3', labelKey: 'extraConn3', kind: 'connections' },
  { key: 'offers_1',      labelKey: 'extraOffer1',  kind: 'offers', roles: ['VENUE', 'PROMOTER'] },
  { key: 'offers_3',      labelKey: 'extraOffer3', kind: 'offers', roles: ['VENUE', 'PROMOTER'] },
];

/** '¥880' / '€5.00' / '$5.90' for an extra in the account currency. */
export const extraPriceLabel = (item, currency) => formatMoney(EXTRA_PRICES[item.key]?.[currency] ?? EXTRA_PRICES[item.key]?.USD, currency);

export function extrasForRole(role) {
  return EXTRA_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}

export function extrasForKind(kind) {
  return EXTRA_ITEMS.filter((i) => i.kind === kind);
}
