// Deal statuses that mean "this booking is not happening" — declined before
// acceptance or cancelled after. Shared by every surface that hides dead
// deals (Bookings tabs, the calendar's gig markers).
export const OFF_STATUSES = ['DECLINED', 'CANCELLED'];
export const isOffDeal = (deal) => OFF_STATUSES.includes(deal?.status);
/** A deal booked for this artist, directly or through an agent. */
export const dealIsForArtist = (deal, artistId) => !!artistId && (deal?.artistId === artistId || deal?.bookedArtistId === artistId);
