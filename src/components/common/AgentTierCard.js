import React from 'react';
import { isPaidAgent, rosterUsage } from '../../utils/agentTiers';
import { useLanguage } from '../../contexts/LanguageContext';

// Settings summary card for AGENT profiles: which plan runs, how many artists,
// and — on the free plan — how many are inactive until the Agent plan.
// `plan` is the account's Stripe plan kind (utils/subscription accountPlan).
const AgentTierCard = ({ profile, plan, onManage }) => {
  const { t } = useLanguage();
  const onAgentPlan = isPaidAgent(profile) && plan !== 'membership';
  const usage = rosterUsage(profile);
  const title = onAgentPlan ? t('agentPlan.name') : plan === 'membership' ? t('agentPlan.coveredTitle') : t('agentPlan.freeName');
  const line = onAgentPlan ? t('agentPlan.paidStatus', { n: usage.current }) : usage.dormant ? t('agentPlan.freeStatus', { n: usage.dormant }) : t('agentPlan.freeIncludes');

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-xs text-white/55">{line}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onManage}>
          {onAgentPlan ? t('agentPlan.manage') : t('agentPlan.choose')}
        </button>
      </div>
    </div>
  );
};

export default AgentTierCard;
