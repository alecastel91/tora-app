// The identity gate answers with 403 { code: 'VERIFICATION_REQUIRED' }, and
// api.js turns that into a global `tora:verification-required` event which
// opens the verification screen. A call site that ALSO shows its own generic
// "failed" alert therefore says the wrong thing twice: the user sees "Failed
// to like profile. Please try again." — which is untrue, retrying will never
// work — on top of the screen that explains the real reason.
export function isVerificationGate(error) {
  return error?.response?.data?.code === 'VERIFICATION_REQUIRED';
}

// A free member out of monthly connections: the details LimitReachedModal shows, else null.
export function connectionLimitOf(error) {
  const data = error?.response?.data;
  return error?.response?.status === 403 && data?.error === 'CONNECTION_LIMIT_EXCEEDED'
    ? { limit: data.limit, tier: data.tier }
    : null;
}
