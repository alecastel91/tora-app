// Helpers for constructing backend URLs that need auth query params.
// Used by <a href> + <img src> targets where we can't send custom
// Authorization headers — the auth middleware accepts `?token=` and
// `?profileId=` as a fallback for those navigation cases.

function backendBaseUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
  return apiUrl.replace(/\/api$/, '');
}

/**
 * Convert a relative `/api/...` path to a fully-qualified backend URL with
 * auth query params appended. Returns absolute URLs unchanged.
 */
export function getAuthedBackendUrl(url, profileId) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const token = localStorage.getItem('token');
  const separator = url.includes('?') ? '&' : '?';
  return `${backendBaseUrl()}${url}${separator}profileId=${profileId}&token=${token}`;
}

/**
 * Compose `/api/deals/:dealId/payment-proof` with type + optional history index.
 */
export function buildPaymentProofUrl(dealId, profileId, type, index = null) {
  const idx = index !== null && index !== undefined ? `&index=${index}` : '';
  return `${backendBaseUrl()}/api/deals/${dealId}/payment-proof?type=${type}&profileId=${profileId}&token=${localStorage.getItem('token')}${idx}`;
}
