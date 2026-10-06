// Helpers for constructing backend URLs that need auth query params.
// Used by <a href> + <img src> targets where we can't send custom
// Authorization headers — the auth middleware accepts `?token=` and
// `?profileId=` as a fallback for those navigation cases.

function backendBaseUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
  return apiUrl.replace(/\/api$/, '');
}

/**
 * Convert a backend URL into a fully-qualified, authed URL. Handles:
 *   - relative `/api/...` paths → prepend current backend base + add auth
 *   - absolute backend URLs (any host: localhost / alessandro.local / railway)
 *     whose path includes `/api/` → rewrite onto current backend base + add auth
 *   - external absolute URLs (e.g. Supabase signed URLs) → leave unchanged
 *   - URLs already carrying `?token=` → leave unchanged
 *
 * Rewriting the origin makes legacy values portable: a documentUrl stored
 * with `http://localhost:5002` opens correctly when the env now points at
 * `http://alessandro.local:5002` (or production).
 */
export function getAuthedBackendUrl(url, profileId, dealId) {
  if (!url) return '';
  const base = backendBaseUrl();
  const token = localStorage.getItem('token');

  if (/[?&]token=/.test(url)) return url;

  // dealId lets /api/contracts/files check one deal instead of scanning every
  // deal's JSONB (F4-03). Purely an optimization hint — the backend re-verifies
  // the caller is a party, so a wrong dealId can't widen access.
  const dealParam = dealId ? `&dealId=${dealId}` : '';

  const isAbsolute = url.startsWith('http://') || url.startsWith('https://');
  if (isAbsolute) {
    let parsed;
    try { parsed = new URL(url); } catch { return url; }
    if (!parsed.pathname.startsWith('/api/')) return url; // external
    const pathAndQuery = parsed.pathname + parsed.search;
    const separator = pathAndQuery.includes('?') ? '&' : '?';
    return `${base}${pathAndQuery}${separator}profileId=${profileId}&token=${token}${dealParam}`;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${base}${url}${separator}profileId=${profileId}&token=${token}${dealParam}`;
}

// Backend-proxied files (uploads, contract files) need to open in the
// in-app PdfViewer with auth on the URL. External links (Drive, Dropbox)
// can open in a new tab as-is.
export function isBackendFileUrl(doc) {
  if (!doc?.url) return false;
  return doc.type === 'upload' || doc.url.startsWith('/api/') || doc.url.includes('/api/contracts/files/');
}

/** Proofs and attachments: PDF by declared type or extension, otherwise treated as an image. */
export const isPdfFile = (meta) => meta?.contentType === 'application/pdf'
  || /\.pdf$/i.test(meta?.originalName || meta?.title || '');

/**
 * Compose `/api/deals/:dealId/payment-proof` with type + optional history index.
 */
export function buildPaymentProofUrl(dealId, profileId, type, index = null) {
  const idx = index !== null && index !== undefined ? `&index=${index}` : '';
  return `${backendBaseUrl()}/api/deals/${dealId}/payment-proof?type=${type}&profileId=${profileId}&token=${localStorage.getItem('token')}${idx}`;
}

/**
 * Resolve a stored Resident Advisor value (full URL or artist name) to the
 * public RA profile URL. Name form: "DNG (1)" -> https://ra.co/dj/dng-1.
 */
export function raProfileUrl(residentAdvisor) {
  if (!residentAdvisor) return null;
  if (residentAdvisor.startsWith('http')) return residentAdvisor;
  const slug = residentAdvisor
    .toLowerCase()
    .replace(/\s+\(([^)]+)\)/g, '-$1')
    .replace(/\s+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://ra.co/dj/${slug}`;
}
