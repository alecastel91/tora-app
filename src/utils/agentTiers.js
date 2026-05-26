// Agent pricing ladder — frontend mirror of tora-backend-sql/src/utils/
// agentTiers.js. Keep in sync if you tweak prices. `artistCap: null`
// means unlimited (ENTERPRISE). A NULL agentTier on a profile means
// "no paid tier yet" → 0 artists allowed.

export const AGENT_TIER_PRICING = {
  SOLO:         { label: 'Solo Agent', monthlyEur: 19.90,  yearlyEur: 189.90,  artistCap: 3   },
  AGENCY_S:     { label: 'Agency S',   monthlyEur: 39.90,  yearlyEur: 379.90,  artistCap: 10  },
  AGENCY_M:     { label: 'Agency M',   monthlyEur: 69.90,  yearlyEur: 669.90,  artistCap: 25  },
  AGENCY_L:     { label: 'Agency L',   monthlyEur: 199.90, yearlyEur: 1899.90, artistCap: 50  },
  AGENCY_LPLUS: { label: 'Agency L+',  monthlyEur: 349.90, yearlyEur: 3349.90, artistCap: 100 },
  ENTERPRISE:   { label: 'Enterprise', monthlyEur: null,   yearlyEur: null,    artistCap: null },
};

export const AGENT_TIER_KEYS = Object.keys(AGENT_TIER_PRICING);

// Mirrors prisma BillingInterval enum.
export const BILLING_INTERVAL = { MONTHLY: 'MONTHLY', YEARLY: 'YEARLY' };

export function getAgentTierPricing(tier) {
  return AGENT_TIER_PRICING[tier] || null;
}

export function getAgentRosterCap(profile) {
  if (!profile?.agentTier) return 0;
  const t = AGENT_TIER_PRICING[profile.agentTier];
  if (!t) return 0;
  return t.artistCap === null ? Infinity : t.artistCap;
}

export function rosterUsage(profile) {
  const cap = getAgentRosterCap(profile);
  const current = Array.isArray(profile?.representingArtists) ? profile.representingArtists.length : 0;
  return { current, cap, atLimit: cap !== Infinity && current >= cap };
}

export function formatEur(amount) {
  if (amount === null || amount === undefined) return '—';
  return `€${amount.toFixed(2).replace(/\.00$/, '')}`;
}
