import { isArtistSideForDeal } from './contractSigner.js';
import { summarizeDealPayment } from './paymentSummary.js';
import { OFF_STATUSES } from './dealStatus.js';

/**
 * One sentence per booking card, written from the viewer's side: what is
 * waiting, and on whom. Mirrors the backend action-summary rules (which drive
 * the tab dot) and adds the "waiting for the other side" half, so a card never
 * needs the reader to decode chips, buttons and the timeline to know where
 * things stand.
 *
 * Returns { text, mine } or null when nothing is pending (mine = the next move
 * is the viewer's).
 */
export function bookingStatusLine(deal, viewer, t, { hasPendingDocs = false } = {}) {
  if (!deal || !viewer) return null;
  const artistSide = isArtistSideForDeal(deal, viewer);
  // An agent only has a move on deals they lead (same rule as the backend's
  // ledByViewer): on an artist-direct deal of a roster artist they just watch.
  if (viewer.role === 'AGENT' && !artistSide) return null;
  const name = (artistSide ? deal.venue?.name : deal.artist?.name) || t('bookings.theOtherParty');
  const line = (key, mine, vars = {}) => ({ text: t(`bookings.line.${key}`, { name, ...vars }), mine });
  const summary = summarizeDealPayment(deal);
  const amountOf = (n) => `${n} ${summary.currency || deal.currency || ''}`.trim();
  const awaiting = summary.totalMarked - summary.totalConfirmed;

  if (OFF_STATUSES.includes(deal.status)) {
    // Money moved on a dead booking: the owed side has to close the question
    // (backend: payment_to_confirm_received / payment_to_resolve).
    if (!artistSide || !summary.hasAnyPayment || deal.payment?.settlement) return null;
    return awaiting > 0 ? line('settle', true, { amount: amountOf(awaiting) }) : line('resolve', true);
  }

  if (deal.status === 'PENDING' || deal.status === 'NEGOTIATING') {
    const history = Array.isArray(deal.offerHistory) ? deal.offerHistory : [];
    const last = history[history.length - 1];
    const isCounter = history.length > 1;
    // Agents offer on the artist's behalf: anyone who is not the booker is artist side.
    const lastFromArtistSide = last ? last.offeredBy !== deal.venueId : deal.initiator?.id !== deal.venueId;
    const mine = artistSide !== lastFromArtistSide;
    if (mine) return line(isCounter ? 'counterToAnswer' : 'offerToAnswer', true);
    return line(isCounter ? 'waitingCounter' : 'waitingAnswer', false);
  }

  if (deal.status === 'COMPLETED') return line('completed', false);
  if (deal.status !== 'ACCEPTED') return null;

  const contract = deal.contract || {};
  const status = contract.status || 'NOT_SENT';
  if (status === 'NOT_SENT' && !contract.skipped) return artistSide ? line('sendContract', true) : line('waitingContract', false);

  // Money already marked beats a missing signature: the booker may pay a
  // deposit as soon as the artist side has signed (same gate as the backend).
  if (awaiting > 0) {
    return artistSide
      ? line('confirmPayment', true, { amount: amountOf(awaiting) })
      : line('waitingConfirm', false, { amount: amountOf(awaiting) });
  }

  if (status !== 'FULLY_SIGNED' && !contract.skipped) {
    // Whose signature is missing: the side that did not send it, then the side that has not signed.
    const sentByBooker = contract.sentBy === deal.venueId;
    const myTurn = status === 'SENT' ? artistSide === sentByBooker
      : status === 'ARTIST_SIGNED' ? !artistSide
      : status === 'VENUE_SIGNED' ? artistSide
      : false;
    return myTurn ? line('signContract', true) : line('waitingSignature', false);
  }

  if (artistSide && hasPendingDocs) return line('shareDocs', true);
  if (summary.isFullyConfirmed) return line('paid', false);
  return artistSide ? line('waitingPayment', false) : line('sendPayment', true);
}
