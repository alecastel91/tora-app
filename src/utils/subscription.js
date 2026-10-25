import { isPaidAgent } from './agentTiers';

/**
 * Premium gate shared by feature surfaces. Personal roles unlock via
 * subscriptionTier (TRIAL only while it hasn't expired); agents unlock via
 * the Agent plan, or a member plan on the same account.
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
 * alerts, priority placement). Agents qualify via the Agent plan, monthly
 * or yearly.
 * Mirrors backend utils/subscription.js#isYearlyTier.
 */
export function isYearlyViewer(user) {
  if (!user) return false;
  if (user.role === 'AGENT' && isPaidAgent(user)) return true;
  return user.subscriptionTier === 'YEARLY';
}

/**
 * One Stripe plan per account. 'agent' = the Agent plan (marker 1 on the agent
 * profile); 'membership' = a paid, non-comp member plan; null = nothing paid
 * (gifted tiers have no Stripe subscription and report null too).
 */
export function accountPlan(profiles = [], accountUser) {
  const agentProfile = profiles.find((p) => p.role === 'AGENT') || null;
  if (!accountUser?.hasStripeSubscription) return { kind: null };
  if (agentProfile && agentProfile.agentSeats > 0) return { kind: 'agent' };
  const paid = profiles.some((p) => !isCompAccount(p) && ['MONTHLY', 'YEARLY'].includes(p.subscriptionTier));
  return { kind: paid ? 'membership' : null };
}
