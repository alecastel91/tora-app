import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLength } from './setLength.js';

test('the times win over a typed duration, across midnight', () => {
  assert.equal(setLength({ setStartTime: '23:00', setEndTime: '01:00', setDuration: 90 }), 120);
  assert.equal(setLength({ setStartTime: '22:30', setEndTime: '23:45' }), 75);
});

test('without both times, the stored duration; else nothing', () => {
  assert.equal(setLength({ setStartTime: '23:00', setDuration: 90 }), 90);
  assert.equal(setLength({ setStartTime: '23:00', setEndTime: '23:00', setDuration: 60 }), 60);
  assert.equal(setLength({ setStartTime: 'TBC', setEndTime: 'TBC' }), null);
  assert.equal(setLength({}), null);
  assert.equal(setLength(null), null);
});
