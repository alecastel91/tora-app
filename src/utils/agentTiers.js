// Agent billing — frontend mirror of tora-backend/src/config/pricing.js +
// utils/agentTiers.js. Agents pay PER SEAT (per represented artist), FLAT by
// band: every artist is billed at the rate the count reaches — your own roster
// solo, the agency's total in an agency. The free plan covers
// AGENT_FREE_ARTISTS; paid agents are capped by the seats they bought.
// See AgentSeatPricing for the band table.

// Free agents can represent this many artists before a subscription is needed.
export const AGENT_FREE_ARTISTS = 1;

// Mirrors prisma BillingInterval enum.
export const BILLING_INTERVAL = { MONTHLY: 'MONTHLY', YEARLY: 'YEARLY' };

// A paid agent is one on an active member subscription — roster is uncapped.
export function isPaidAgent(profile) {
  return ['MONTHLY', 'YEARLY'].includes(profile?.subscriptionTier);
}

function rosterCount(profile) {
  return Array.isArray(profile?.representingArtists) ? profile.representingArtists.length : 0;
}

// Seat model: a paid agent's cap = purchased seats (profile.agentSeats). Free
// agents get AGENT_FREE_ARTISTS. Legacy paid agents without a stored seat count
// fall back to their current roster so they're never retroactively over-cap.
export function getAgentRosterCap(profile) {
  // Admin-operated (beta persona) agents represent every tester the ladder
  // points at them — never capped. Policy here, not a seeded seat count.
  if (profile?.isAdminOperated) return Infinity;
  if (!isPaidAgent(profile)) return AGENT_FREE_ARTISTS;
  const seats = Number(profile?.agentSeats);
  if (Number.isFinite(seats) && seats > 0) return seats;
  return Math.max(rosterCount(profile), AGENT_FREE_ARTISTS);
}

export function rosterUsage(profile) {
  const cap = getAgentRosterCap(profile);
  const current = rosterCount(profile);
  return { current, cap, atLimit: cap !== Infinity && current >= cap };
}

