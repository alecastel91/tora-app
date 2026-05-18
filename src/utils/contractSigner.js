// Display-only helpers for the sign-and-send flow. The backend recomputes the
// authoritative signerCapacity at submit time; the values here just drive the
// modal copy so the user sees the same wording.

export function deriveSignerCapacity(deal, profile) {
  if (!deal || !profile) return null;
  if (deal.venueId === profile.id) return 'As Venue/Promoter';
  if (deal.artistId === profile.id || deal.bookedArtistId === profile.id) return 'As Artist';
  if (profile.role === 'AGENT') {
    const artists = profile.representingArtists || [];
    if (artists.some((a) => (a.profileId || a.id) === deal.artistId)) {
      const artistName = deal.artist?.name || deal.bookedArtistName || 'the artist';
      return `As Agent on behalf of ${artistName}`;
    }
  }
  return null;
}

export function deriveRecipientName(deal, profile) {
  if (!deal || !profile) return null;
  if (deal.venueId === profile.id) return deal.artist?.name || 'the artist';
  return deal.venue?.name || 'the venue';
}

// Contracts are always initiated by the artist side: the artist themselves,
// the booked artist (agent flow), or an agent representing the artist.
// The venue/promoter is the recipient and never the originator.
export function isArtistSideForDeal(deal, profile) {
  if (!deal || !profile) return false;
  if (profile.id === deal.artistId || profile.id === deal.bookedArtistId) return true;
  if (profile.role === 'AGENT') {
    const artists = profile.representingArtists || [];
    return artists.some((a) => (a.profileId || a.id) === deal.artistId);
  }
  return false;
}
