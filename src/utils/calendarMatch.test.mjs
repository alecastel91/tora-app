import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counterpartRoles, isValidRoleMatch, matchDatesFor } from './calendarMatch.js';

const ROLES = ['ARTIST', 'AGENT', 'PROMOTER', 'VENUE'];

test('counterpart roles never include the viewer role', () => {
  assert.deepEqual(counterpartRoles('ARTIST'), ['PROMOTER', 'VENUE']);
  assert.deepEqual(counterpartRoles('AGENT'), ['PROMOTER', 'VENUE']);
  assert.deepEqual(counterpartRoles('VENUE'), ['ARTIST', 'PROMOTER']);
  assert.deepEqual(counterpartRoles('PROMOTER'), ['ARTIST', 'VENUE']);
  assert.deepEqual(counterpartRoles('X'), []);
});

test('all 16 role combinations', () => {
  const ok = new Set(['ARTIST|PROMOTER', 'ARTIST|VENUE', 'AGENT|PROMOTER', 'AGENT|VENUE', 'PROMOTER|VENUE']);
  for (const a of ROLES) for (const b of ROLES) {
    const expected = ok.has(`${a}|${b}`) || ok.has(`${b}|${a}`);
    assert.equal(isValidRoleMatch(a, b), expected, `${a} vs ${b}`);
  }
  // explicitly: same role and agent↔artist are out
  assert.equal(isValidRoleMatch('ARTIST', 'ARTIST'), false);
  assert.equal(isValidRoleMatch('VENUE', 'VENUE'), false);
  assert.equal(isValidRoleMatch('PROMOTER', 'PROMOTER'), false);
  assert.equal(isValidRoleMatch('AGENT', 'ARTIST'), false);
  assert.equal(isValidRoleMatch('AGENT', 'AGENT'), false);
});

const artist = { role: 'ARTIST', country: 'Japan', genres: ['House'], availableDates: ['2026-11-21', '2026-11-22', '2026-12-5'],
  travelSchedule: [{ country: 'Germany', startDate: '2026-12-01', endDate: '2026-12-07' }] };
const tokyoVenue = { role: 'VENUE', country: 'Japan', genres: ['House', 'Techno'], availableDates: ['2026-11-21', '2026-12-05'] };
const berlinVenue = { role: 'VENUE', country: 'Germany', genres: ['House'], availableDates: ['2026-11-22', '2026-12-05'] };

test('shared dates count only where the artist is that day', () => {
  assert.deepEqual(matchDatesFor(artist, tokyoVenue), ['2026-11-21', '2026-12-05']); // based in Japan: both
  assert.deepEqual(matchDatesFor(artist, berlinVenue), ['2026-12-05']);              // in Germany only during the trip
  assert.deepEqual(matchDatesFor(berlinVenue, artist), ['2026-12-05']);              // symmetric when the venue is the source
});

test('genre, country and role gates', () => {
  assert.deepEqual(matchDatesFor(artist, { ...tokyoVenue, genres: ['Jazz'] }), []);
  assert.deepEqual(matchDatesFor(artist, { ...tokyoVenue, country: '' }), []);
  assert.deepEqual(matchDatesFor({ ...artist, country: null }, tokyoVenue), []);
  assert.deepEqual(matchDatesFor(artist, { ...artist }), []);
});

test('promoter↔venue: same country, every shared date; agents match as artists', () => {
  const promoter = { role: 'PROMOTER', country: 'Japan', genres: ['House'], availableDates: ['2026-11-21'] };
  assert.deepEqual(matchDatesFor(promoter, tokyoVenue), ['2026-11-21']);
  assert.deepEqual(matchDatesFor(promoter, berlinVenue), []);
  const rosterArtist = { ...artist, role: 'ARTIST' };
  assert.deepEqual(matchDatesFor({ ...rosterArtist, role: 'AGENT' }, berlinVenue), ['2026-12-05']);
});
