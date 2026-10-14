/**
 * Report + block constants, shared with the mobile app verbatim
 * (scripts/sync-shared.sh). Pure: no React, no imports.
 *
 * Deliberately only constants. Blocking is enforced on the SERVER — it strips
 * blocked members out of search, the feed, conversations and notifications
 * before they reach the client — so a second, client-side filter would be an
 * unenforced rule free to drift from the real one.
 */

/** The five reasons a report can carry. Mirrored in tora-backend/src/services/reports.js. */
export const REPORT_REASONS = ['spam', 'harassment', 'impersonation', 'inappropriate', 'other'];

/** What a report is about. */
export const REPORT_TARGETS = { PROFILE: 'PROFILE', MESSAGE: 'MESSAGE', POST: 'POST' };

/** The four things a block does, spelled out before it is confirmed. */
export const BLOCK_EFFECT_KEYS = ['blockEffectHidden', 'blockEffectMessages', 'blockEffectRequests', 'blockEffectBookings'];
