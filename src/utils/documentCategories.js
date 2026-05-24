// Single source of truth for sharable per-deal document categories.
// Backend mirror lives in tora-backend-sql/src/utils/documentCategories.js
// (separate process, can't share runtime).

// `uploadOnly: true` categories don't show the artist's pre-existing library
// — the user picks a fresh file per booking (e.g. invoices change every time).
// Mechanically the upload still lands in the same Supabase storage bucket
// and the deal's sharedDocuments JSONB entry has the same shape as a library
// share, so backend handlers stay identical.
//
// `broadcast: true` categories are the artist-side docs that the chat
// paperclip auto-writes into every active deal between sender and recipient
// (and that deal-accept seeds from chat history). Invoice opts out because
// it's per-deal-fresh by definition.
export const DOC_CATEGORIES = [
  { key: 'pressKit', label: 'Press Kit', broadcast: true },
  { key: 'technicalRider', label: 'Technical Rider', broadcast: true },
  { key: 'hospitalityRider', label: 'Hospitality Rider', broadcast: true },
  { key: 'invoice', label: 'Invoice', uploadOnly: true },
];

export const DOC_CATEGORY_KEYS = DOC_CATEGORIES.map((c) => c.key);
export const BROADCAST_DOC_CATEGORY_KEYS = DOC_CATEGORIES.filter((c) => c.broadcast).map((c) => c.key);

export function labelForCategory(key) {
  const hit = DOC_CATEGORIES.find((c) => c.key === key);
  return hit ? hit.label : key;
}

export function isValidCategory(key) {
  return DOC_CATEGORY_KEYS.includes(key);
}

// Status of a shared-document entry on a deal.
export function categoryStatus(sharedDocuments, key) {
  const entry = sharedDocuments?.[key];
  if (entry?.documentId) return 'shared';
  if (entry?.skipped) return 'skipped';
  return 'pending';
}
