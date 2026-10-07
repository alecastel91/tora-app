import { isPaidAgent } from './agentTiers';

/**
 * Premium gate shared by feature surfaces. Personal roles unlock via
 * subscriptionTier (TRIAL only while it hasn't expired); agents unlock via
 * an active member subscription (their roster is billed per seat).
 */
/**
 * Admin-operated (comp) profiles are seeded as YEARLY so feature gates open
 * for them, but they never pay. Billing surfaces (Premium page, seat picker)
 * read the tier through here so a comp account is shown the public prices.
 */
export const isCompAccount = (user) => !!user?.isAdminOperated;
export const billingTier = (user) => (isCompAccount(user) ? 'FREE' : (user?.subscriptionTier || 'FREE'));

export function isPremiumViewer(user) {
  if (!user) return false;
  // Agents unlock via a paid member subscription (MONTHLY/YEARLY).
  if (user.role === 'AGENT' && isPaidAgent(user)) return true;
  const tier = user.subscriptionTier || 'FREE';
  if (tier === 'TRIAL') {
    return !user.trialEndDate || new Date(user.trialEndDate) > new Date();
  }
  return tier === 'MONTHLY' || tier === 'YEARLY';
}

/**
 * Yearly-exclusive features (tour fee privacy, calendar privacy, travel
 * alerts, priority placement). Agents qualify via any active paid member
 * subscription — their pricing axis is the per-seat roster, not the tier.
 * Mirrors backend utils/subscription.js#isYearlyTier.
 */
export function isYearlyViewer(user) {
  if (!user) return false;
  if (user.role === 'AGENT' && isPaidAgent(user)) return true;
  return user.subscriptionTier === 'YEARLY';
}

/**
 * One Stripe plan per account. 'agency' = seats live on the agent profile;
 * 'membership' = a paid, non-comp profile with no seats; null = nothing paid
 * (gifted tiers have no Stripe subscription and report null too).
 */
export function accountPlan(profiles = [], accountUser) {
  const agentProfile = profiles.find((p) => p.role === 'AGENT') || null;
  const agencyRoster = agentProfile?.representingArtists?.length || 0;
  if (!accountUser?.hasStripeSubscription) return { kind: null, agencyRoster };
  if (agentProfile?.agentSeats) return { kind: 'agency', agencyRoster };
  const paid = profiles.some((p) => !isCompAccount(p) && ['MONTHLY', 'YEARLY'].includes(p.subscriptionTier));
  return { kind: paid ? 'membership' : null, agencyRoster };
}
