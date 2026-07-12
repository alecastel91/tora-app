/**
 * Premium gate shared by feature surfaces. Personal roles unlock via
 * subscriptionTier (TRIAL only while it hasn't expired); agents unlock via
 * their (roster-based) agent plan.
 */
export function isPremiumViewer(user) {
  if (!user) return false;
  if (user.role === 'AGENT') return !!user.agentTier;
  const tier = user.subscriptionTier || 'FREE';
  if (tier === 'TRIAL') {
    return !user.trialEndDate || new Date(user.trialEndDate) > new Date();
  }
  return tier === 'MONTHLY' || tier === 'YEARLY';
}
