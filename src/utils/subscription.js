import { isPaidAgent } from './agentTiers';

/**
 * Premium gate shared by feature surfaces. Personal roles unlock via
 * subscriptionTier (TRIAL only while it hasn't expired); agents unlock via
 * an active member subscription (their roster is billed per seat).
 */
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
