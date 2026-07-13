/**
 * Premium gate shared by feature surfaces. Personal roles unlock via
 * subscriptionTier (TRIAL only while it hasn't expired); agents unlock via
 * their (roster-based) agent plan.
 */
export function isPremiumViewer(user) {
  if (!user) return false;
  // Agents unlock via their roster plan OR a personal subscription — an
  // agent paying MONTHLY without an agentTier must not lose access.
  if (user.role === 'AGENT' && user.agentTier) return true;
  const tier = user.subscriptionTier || 'FREE';
  if (tier === 'TRIAL') {
    return !user.trialEndDate || new Date(user.trialEndDate) > new Date();
  }
  return tier === 'MONTHLY' || tier === 'YEARLY';
}

/**
 * Yearly-exclusive features (tour fee privacy, calendar privacy, travel
 * alerts, priority placement). Agents qualify via any active agent plan —
 * their pricing axis is the roster ladder. Mirrors backend
 * utils/subscription.js#isYearlyTier.
 */
export function isYearlyViewer(user) {
  if (!user) return false;
  if (user.agentTier) return true;
  return user.subscriptionTier === 'YEARLY';
}
