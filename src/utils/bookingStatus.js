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
  const name = (artistSide ? deal.venue?.name : deal.artist?.name) || t('bookings.theOtherParty');
  const line = (key, mine, vars = {}) => ({ text: t(`bookings.line.${key}`, { name, ...vars }), mine });
  const summary = summarizeDealPayment(deal);
  const amountOf = (n) => `${n} ${summary.currency || deal.currency || ''}`.trim();

  if (OFF_STATUSES.includes(deal.status)) {
    const awaiting = summary.totalMarked - summary.totalConfirmed;
    if (summary.hasAnyPayment && !deal.payment?.settlement && artistSide && awaiting > 0) {
      return line('settle', true, { amount: amountOf(awaiting) });
    }
    return null;
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
  const committed = status === 'FULLY_SIGNED' || contract.skipped === true;
  if (!committed) {
    if (status === 'NOT_SENT') return artistSide ? line('sendContract', true) : line('waitingContract', false);
    // Whose signature is missing: the side that did not send, then the side that has not signed.
    const sentByArtistSide = contract.sentBy ? contract.sentBy !== deal.venueId : true;
    const myTurn = status === 'SENT' ? artistSide !== sentByArtistSide
      : status === 'ARTIST_SIGNED' ? !artistSide
      : status === 'VENUE_SIGNED' ? artistSide
      : false;
    return myTurn ? line('signContract', true) : line('waitingSignature', false);
  }

  const awaiting = summary.totalMarked - summary.totalConfirmed;
  if (awaiting > 0) {
    return artistSide
      ? line('confirmPayment', true, { amount: amountOf(awaiting) })
      : line('waitingConfirm', false, { amount: amountOf(awaiting) });
  }
  if (artistSide && hasPendingDocs) return line('shareDocs', true);
  if (summary.isFullyConfirmed) return line('paid', false);
  return artistSide ? line('waitingPayment', false) : line('sendPayment', true);
}
