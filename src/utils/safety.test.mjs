import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_REASONS, isReportReason, blockedUserIdSet, isBlockedUser, filterBlocked } from './safety.js';

test('report reasons are the five the backend accepts', () => {
  assert.deepEqual(REPORT_REASONS, ['spam', 'harassment', 'impersonation', 'inappropriate', 'other']);
  assert.equal(isReportReason('harassment'), true);
  assert.equal(isReportReason('because'), false);
  assert.equal(isReportReason(null), false);
});

test('blocked set, lookup and filtering tolerate every shape', () => {
  const blocks = [{ userId: 'u1', profiles: [] }, { userId: 'u2' }, {}];
  const set = blockedUserIdSet(blocks);
  assert.deepEqual([...set].sort(), ['u1', 'u2']);
  assert.equal(isBlockedUser(set, 'u1'), true);
  assert.equal(isBlockedUser(blocks, 'u2'), true);
  assert.equal(isBlockedUser(set, 'u3'), false);
  assert.equal(isBlockedUser(set, undefined), false);
  assert.deepEqual(blockedUserIdSet(null).size, 0);

  const rows = [{ id: 'a', userId: 'u1' }, { id: 'b', userId: 'u3' }, { id: 'c' }];
  assert.deepEqual(filterBlocked(rows, set).map((r) => r.id), ['b', 'c']);
  assert.deepEqual(filterBlocked(rows, []).map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(filterBlocked(null, set), []);
});
