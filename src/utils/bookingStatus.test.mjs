import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingStatusLine } from './bookingStatus.js';

const t = (key, vars = {}) => `${key}|${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(',')}`;
const artist = { id: 'A', role: 'ARTIST' };
const booker = { id: 'V', role: 'VENUE' };
const base = { artistId: 'A', venueId: 'V', artist: { id: 'A', name: 'Lucio' }, venue: { id: 'V', name: 'CIRCUIT' }, initiator: { id: 'V' }, currency: 'EUR', currentFee: 800 };

test('incoming offer: artist must answer, booker waits', () => {
  const deal = { ...base, status: 'PENDING', offerHistory: [{ offeredBy: 'V', fee: 800 }] };
  assert.deepEqual(bookingStatusLine(deal, artist, t), { text: 'bookings.line.offerToAnswer|name=CIRCUIT', mine: true });
  assert.deepEqual(bookingStatusLine(deal, booker, t), { text: 'bookings.line.waitingAnswer|name=Lucio', mine: false });
});

test('counter offer from the artist side flips the turn', () => {
  const deal = { ...base, status: 'NEGOTIATING', offerHistory: [{ offeredBy: 'V', fee: 800 }, { offeredBy: 'A', fee: 900 }] };
  assert.equal(bookingStatusLine(deal, booker, t).text, 'bookings.line.counterToAnswer|name=Lucio');
  assert.equal(bookingStatusLine(deal, artist, t).mine, false);
});

test('accepted: contract to send, then to sign by the receiver', () => {
  const noContract = { ...base, status: 'ACCEPTED' };
  assert.equal(bookingStatusLine(noContract, artist, t).text, 'bookings.line.sendContract|name=CIRCUIT');
  assert.equal(bookingStatusLine(noContract, booker, t).text, 'bookings.line.waitingContract|name=Lucio');
  const sent = { ...base, status: 'ACCEPTED', contract: { status: 'SENT', sentBy: 'A' } };
  assert.equal(bookingStatusLine(sent, booker, t).text, 'bookings.line.signContract|name=Lucio');
  assert.equal(bookingStatusLine(sent, artist, t).text, 'bookings.line.waitingSignature|name=CIRCUIT');
  const venueSigned = { ...base, status: 'ACCEPTED', contract: { status: 'VENUE_SIGNED', sentBy: 'V' } };
  assert.equal(bookingStatusLine(venueSigned, artist, t).mine, true);
});

test('payment: marked deposit asks the artist to confirm, booker waits', () => {
  const deal = { ...base, status: 'ACCEPTED', contract: { status: 'FULLY_SIGNED' },
    payment: { depositHistory: [{ amount: 200, confirmedAt: null }], currency: 'EUR' } };
  assert.deepEqual(bookingStatusLine(deal, artist, t), { text: 'bookings.line.confirmPayment|name=CIRCUIT,amount=200 EUR', mine: true });
  assert.deepEqual(bookingStatusLine(deal, booker, t), { text: 'bookings.line.waitingConfirm|name=Lucio,amount=200 EUR', mine: false });
});

test('payment: nothing marked yet → booker must send; docs ask the artist', () => {
  const deal = { ...base, status: 'ACCEPTED', contract: { status: 'FULLY_SIGNED' } };
  assert.equal(bookingStatusLine(deal, booker, t).text, 'bookings.line.sendPayment|name=Lucio');
  assert.equal(bookingStatusLine(deal, artist, t).text, 'bookings.line.waitingPayment|name=CIRCUIT');
  assert.equal(bookingStatusLine(deal, artist, t, { hasPendingDocs: true }).text, 'bookings.line.shareDocs|name=CIRCUIT');
});

test('cancelled booking with an unconfirmed deposit asks the artist to resolve it', () => {
  const deal = { ...base, status: 'CANCELLED', payment: { depositHistory: [{ amount: 200, confirmedAt: null }], currency: 'EUR' } };
  assert.equal(bookingStatusLine(deal, artist, t).text, 'bookings.line.settle|name=CIRCUIT,amount=200 EUR');
  assert.equal(bookingStatusLine(deal, booker, t), null);
  assert.equal(bookingStatusLine({ ...base, status: 'DECLINED' }, artist, t), null);
});

test('parity with the backend: deposit marked at ARTIST_SIGNED asks the artist to confirm', () => {
  const deal = { ...base, status: 'ACCEPTED', contract: { status: 'ARTIST_SIGNED', sentBy: 'A' },
    payment: { depositHistory: [{ amount: 200, confirmedAt: null }], currency: 'EUR' } };
  assert.equal(bookingStatusLine(deal, artist, t).text, 'bookings.line.confirmPayment|name=CIRCUIT,amount=200 EUR');
  assert.equal(bookingStatusLine(deal, booker, t).mine, false);
});

test('SENT without sentBy counts as sent by the artist side', () => {
  const deal = { ...base, status: 'ACCEPTED', contract: { status: 'SENT' } };
  assert.equal(bookingStatusLine(deal, booker, t).text, 'bookings.line.signContract|name=Lucio');
});

test('cancelled booking with confirmed but unsettled money asks the artist to resolve it', () => {
  const deal = { ...base, status: 'CANCELLED', payment: { depositHistory: [{ amount: 200, confirmedAt: '2026-10-01' }], currency: 'EUR' } };
  assert.equal(bookingStatusLine(deal, artist, t).text, 'bookings.line.resolve|name=CIRCUIT');
  assert.equal(bookingStatusLine({ ...deal, payment: { ...deal.payment, settlement: { outcome: 'settled' } } }, artist, t), null);
});

test('an agent gets no line on a deal they do not lead', () => {
  const agent = { id: 'G', role: 'AGENT', representingArtists: [{ profileId: 'A' }] };
  const direct = { ...base, status: 'ACCEPTED', contract: { status: 'FULLY_SIGNED' } }; // artist-direct, no bookedArtistId
  assert.equal(bookingStatusLine(direct, agent, t), null);
  const led = { ...direct, bookedArtistId: 'A', agentId: 'G' };
  assert.equal(bookingStatusLine(led, agent, t).text, 'bookings.line.waitingPayment|name=CIRCUIT');
});
