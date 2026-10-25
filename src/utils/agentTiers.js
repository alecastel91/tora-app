// Agent roster rules — frontend mirror of tora-backend/src/utils/agentTiers.js.
// The Agent plan (one flat price, see utils/money AGENT_PRICES) covers
// unlimited artists. Without it, AGENT_FREE_ARTISTS artists stay ACTIVE and
// the rest of the roster is DORMANT: listed for the agent, greyed, hidden as
// representation from everyone else, until they subscribe again.

export const AGENT_FREE_ARTISTS = 1;

// Mirrors prisma BillingInterval enum.
export const BILLING_INTERVAL = { MONTHLY: 'MONTHLY', YEARLY: 'YEARLY' };

const PAID = ['MONTHLY', 'YEARLY'];
const notExpired = (p) => !p?.subscriptionEndDate || new Date(p.subscriptionEndDate) > new Date();

// `agentSeats` is a legacy column name, now the plan marker: 1 = the account
// pays the Agent plan, 0 = it pays a member plan (which never unlocks an agent
// roster), null = no Stripe plan (complimentary tiers count as the Agent plan).
export function isPaidAgent(profile) {
  return PAID.includes(profile?.subscriptionTier) && notExpired(profile) && profile?.agentSeats !== 0;
}

export const rosterEntryIds = (profile) => (Array.isArray(profile?.representingArtists) ? profile.representingArtists : [])
  .map((e) => e?.profileId || e?.id).filter(Boolean);

export function getAgentRosterCap(profile) {
  if (profile?.isAdminOperated) return Infinity;
  return isPaidAgent(profile) ? Infinity : AGENT_FREE_ARTISTS;
}

/** Roster artists the agent can act for now: all on the plan, else the chosen one (or the first). */
export function activeRosterIds(profile) {
  const ids = rosterEntryIds(profile);
  if (getAgentRosterCap(profile) === Infinity) return ids;
  const chosen = profile?.freeActiveArtistId;
  return chosen && ids.includes(chosen) ? [chosen] : ids.slice(0, AGENT_FREE_ARTISTS);
}

export function isDormantArtist(profile, artistId) {
  return rosterEntryIds(profile).includes(artistId) && !activeRosterIds(profile).includes(artistId);
}

export function rosterUsage(profile) {
  const cap = getAgentRosterCap(profile);
  const current = rosterEntryIds(profile).length;
  return { current, cap, atLimit: cap !== Infinity && current >= cap, dormant: Math.max(0, current - activeRosterIds(profile).length) };
}
