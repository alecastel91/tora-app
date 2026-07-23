// One-off extras catalog — the single frontend copy. Prices mirror
// tora-backend/src/config/pricing.js EXTRAS (cents) — keep in sync.
// `kind` groups items for the limit-reached upsells; `roles` restricts
// role-specific items (offers only exist for bookers).
export const EXTRA_ITEMS = [
  { key: 'likes_5',       labelKey: 'extraLikes5',    price: '€2',  kind: 'likes' },
  { key: 'likes_week',    labelKey: 'extraLikesWeek', price: '€5',  kind: 'likes' },
  { key: 'connections_1', labelKey: 'extraConn1',     price: '€5',  kind: 'connections' },
  { key: 'connections_3', labelKey: 'extraConn3',     price: '€12', kind: 'connections' },
  { key: 'offers_1',      labelKey: 'extraOffer1',    price: '€5',  kind: 'offers', roles: ['VENUE', 'PROMOTER'] },
  { key: 'offers_3',      labelKey: 'extraOffer3',    price: '€12', kind: 'offers', roles: ['VENUE', 'PROMOTER'] },
];

export function extrasForRole(role) {
  return EXTRA_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}

export function extrasForKind(kind) {
  return EXTRA_ITEMS.filter((i) => i.kind === kind);
}
