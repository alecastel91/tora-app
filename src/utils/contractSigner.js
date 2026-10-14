// Display-only helpers for the sign-and-send flow. The backend recomputes the
// authoritative signerCapacity at submit time; the values here just drive the
// modal copy so the user sees the same wording.

// An artist can have several — often regional — agents, but only ONE runs a
// given deal (`deal.agentId`, persisted at creation). Where it's set, a
// co-agent is not on this deal's artist side. Legacy deals predate the column
// and carry no agentId; there we fall back to "any agent of the artist", which
// is what the backend does too, so the UI never offers an action the server
// will refuse (and never hides one it would allow).
function isDealAgent(deal, profile) {
  if (profile.role !== 'AGENT') return false;
  if (deal.agentId) return deal.agentId === profile.id;
  if (!deal.bookedArtistId) return false; // artist-direct: no agent acts
  const artists = profile.representingArtists || [];
  return artists.some((a) => (a.profileId || a.id) === deal.artistId);
}

export function deriveSignerCapacity(deal, profile) {
  if (!deal || !profile) return null;
  if (deal.venueId === profile.id) return 'As Venue/Promoter';
  if (deal.artistId === profile.id || deal.bookedArtistId === profile.id) return 'As Artist';
  if (isDealAgent(deal, profile)) {
    const artistName = deal.artist?.name || deal.bookedArtistName || 'the artist';
    return `As Agent (${profile.name}) on behalf of ${artistName}`;
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
  return isDealAgent(deal, profile);
}

/**
 * Which side a signature record belongs to. Records come in two shapes:
 * sender records { signedBy, role } (send-and-sign) and recipient records
 * { profileId, artistSide }. The flag wins, then the recorded role, then the
 * id as a legacy fallback — an agent signs for the artist, so its id alone
 * would land on the venue side.
 */
export function signatureIsArtistSide(sig, deal) {
  if (typeof sig?.artistSide === 'boolean') return sig.artistSide;
  if (sig?.role) return sig.role === 'ARTIST';
  return (sig?.profileId || sig?.signedBy) === deal?.artistId;
}
