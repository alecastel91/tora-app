/**
 * Block + report — pure, no React, no imports (synced verbatim to mobile).
 *
 * A block is ACCOUNT level: it covers every profile the blocked person holds,
 * and it works in both directions, so neither side sees the other in search,
 * the globe, the travel feed, matches, the feed, notifications or messages.
 * The server is the source of truth and already strips blocked rows; these
 * helpers are for the screens that hold a list in memory (the blocked-members
 * section, an open profile) and for the shared vocabulary of a report.
 */
export const REPORT_REASONS = ['spam', 'harassment', 'impersonation', 'inappropriate', 'other'];
export const REPORT_TARGETS = { PROFILE: 'PROFILE', MESSAGE: 'MESSAGE', POST: 'POST' };

/** What a block actually does — the confirmation copy walks through these keys. */
export const BLOCK_EFFECT_KEYS = ['blockEffectHidden', 'blockEffectMessages', 'blockEffectRequests', 'blockEffectBookings'];

export const isReportReason = (reason) => REPORT_REASONS.includes(String(reason || ''));

/** GET /blocks rows → the set of blocked account ids. */
export const blockedUserIdSet = (blocks) => new Set(
  (Array.isArray(blocks) ? blocks : []).map((b) => b?.userId).filter(Boolean),
);

/** Is this account blocked? Accepts a Set or the raw list. */
export const isBlockedUser = (blocked, userId) => {
  if (!userId) return false;
  const set = blocked instanceof Set ? blocked : blockedUserIdSet(blocked);
  return set.has(userId);
};

/** Drop anything owned by a blocked account from a list the client already holds. */
export const filterBlocked = (items, blocked, getUserId = (x) => x?.userId) => {
  const set = blocked instanceof Set ? blocked : blockedUserIdSet(blocked);
  if (set.size === 0) return Array.isArray(items) ? items : [];
  return (Array.isArray(items) ? items : []).filter((x) => !set.has(getUserId(x)));
};
