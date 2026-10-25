import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AGENT_PRICES, formatMoney, normalizeCurrency, yearlyPerMonth } from '../../utils/money';
import { rosterUsage, isPaidAgent } from '../../utils/agentTiers';
import { billingTier } from '../../utils/subscription';

/**
 * The Agent plan: one flat price per agent, unlimited artists (2026-10-26).
 * Used on the Premium screen and in the roster's upgrade prompt.
 *
 * `planKind` is the account's Stripe plan (utils/subscription accountPlan):
 * 'agent' → this plan is running; 'membership' → a member plan covers the
 * account, so the cards become a switch to the Agent plan.
 */
const AgentPlanCard = ({ profile, currency, planKind = null, onSelectPlan }) => {
  const { t } = useLanguage();
  const cur = normalizeCurrency(currency);
  const price = AGENT_PRICES[cur];
  const money = (n) => formatMoney(n, cur);
  const usage = rosterUsage(profile);
  const onAgentPlan = isPaidAgent(profile) && billingTier(profile) !== 'FREE' && planKind !== 'membership';
  const hasMonthly = onAgentPlan && profile?.subscriptionTier === 'MONTHLY';
  const hasYearly = onAgentPlan && profile?.subscriptionTier === 'YEARLY';
  const switching = planKind === 'membership';

  return (
    <div className="agent-plan">
      <div className="agent-status-banner">
        <div className="agent-status-main">
          <div className="agent-status-roster">
            <span className="agent-status-count">{usage.current}</span>
            <span className="agent-status-label">
              {onAgentPlan ? t('agentPlan.paidStatus', { n: usage.current }) : usage.dormant ? t('agentPlan.freeStatus', { n: usage.dormant }) : t('agentPlan.freeIncludes')}
            </span>
          </div>
        </div>
        <span className={`agent-status-plan${onAgentPlan ? ' is-paid' : ''}`}>
          {onAgentPlan ? t('agentPlan.name') : t('agentPlan.freeName')}
        </span>
      </div>

      <p className="premium-note" style={{ marginTop: 0 }}>{t('agentPlan.intro')}</p>
      {switching && <p className="premium-note" style={{ marginTop: 0 }}>{t('agentPlan.coveredByMembership')}</p>}

      <div className="premium-pricing">
        <div className={`price-card${hasMonthly ? ' is-current' : ''}`}>
          {hasMonthly && <div className="badge badge-current">{t('premium.currentPlan')}</div>}
          <h4>{t('premium.monthly')}</h4>
          <div className="price">{money(price.monthly)}<span>/{t('agentSeat.perMonth')}</span></div>
          <div className="price-billed">{t('agentPlan.unlimited')}</div>
          {hasMonthly ? <button className="btn btn-outline" disabled>{t('premium.currentPlan')}</button>
            : hasYearly ? <button className="btn btn-outline" disabled>{t('premium.onYearlyAlready')}</button>
              : <button className="btn btn-outline" onClick={() => onSelectPlan('monthly')}>{switching ? t('agentPlan.switchToAgent') : t('premium.chooseMonthly')}</button>}
        </div>
        <div className={`price-card featured${hasYearly ? ' is-current' : ''}`}>
          <div className="badge">{hasYearly ? t('premium.currentPlan') : t('premium.yearlySaveBadge')}</div>
          <h4>{t('premium.yearly')}</h4>
          <div className="price">
            <s className="price-was">{money(price.monthly)}</s>
            {money(yearlyPerMonth(price.yearly))}<span>/{t('agentSeat.perMonth')}</span>
          </div>
          <div className="price-billed">{t('premium.billedYearly', { total: money(price.yearly) })}</div>
          {hasYearly ? <button className="btn btn-primary" disabled>{t('premium.currentPlan')}</button>
            : <button className="btn btn-primary" onClick={() => onSelectPlan('yearly')}>
              {switching ? t('agentPlan.switchToAgent') : hasMonthly ? t('premium.upgradeToYearly') : t('premium.chooseYearly')}
            </button>}
        </div>
      </div>

      <p className="premium-note">{t('agentPlan.freeRule')}</p>
      <p className="premium-note">
        {t('agentPlan.agencyDeals')}{' '}
        <a href="mailto:support@torahub.io?subject=Agency%20deal" className="text-white underline">support@torahub.io</a>
      </p>
      <p className="premium-note">{t('premium.cancelAnytime')}</p>
    </div>
  );
};

export default AgentPlanCard;
