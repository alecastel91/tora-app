// Deal statuses that mean "this booking is not happening" — declined before
// acceptance or cancelled after. Shared by every surface that hides dead
// deals (Bookings tabs, the calendar's gig markers).
export const OFF_STATUSES = ['DECLINED', 'CANCELLED'];
export const isOffDeal = (deal) => OFF_STATUSES.includes(deal?.status);
/** A deal booked for this artist, directly or through an agent. */
export const dealIsForArtist = (deal, artistId) => !!artistId && (deal?.artistId === artistId || deal?.bookedArtistId === artistId);

/** Format a fee for display; null when missing/redacted so callers can omit it instead of crashing. */
export const formatFee = (fee) => {
  const n = Number(fee);
  if (fee == null || fee === '' || Number.isNaN(n)) return null;
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
/** The profile only reaches this deal as the tagged event venue (a promoter's event held here). */
export const isConsentOnlyFor = (deal, profile) =>
  !!profile && deal.eventVenueId === profile.id
  && deal.initiator?.id !== profile.id && deal.venue?.id !== profile.id && deal.artist?.id !== profile.id;
