import React from 'react';
import { AGENT_TIER_PRICING, BILLING_INTERVAL, rosterUsage, formatEur } from '../../utils/agentTiers';

const AgentTierCard = ({ profile, onManage }) => {
  const tierKey = profile?.agentTier || null;
  const tierMeta = tierKey ? AGENT_TIER_PRICING[tierKey] : null;
  const usage = rosterUsage(profile);
  const interval = profile?.agentBillingInterval === BILLING_INTERVAL.YEARLY
    ? BILLING_INTERVAL.YEARLY
    : BILLING_INTERVAL.MONTHLY;

  let priceLine;
  if (!tierMeta) priceLine = 'Pick a plan to start representing artists';
  else {
    const price = interval === BILLING_INTERVAL.YEARLY ? tierMeta.yearlyEur : tierMeta.monthlyEur;
    priceLine = price != null
      ? `${formatEur(price)} / ${interval === BILLING_INTERVAL.YEARLY ? 'yr' : 'mo'}`
      : 'Custom pricing';
  }

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>
            {tierMeta ? tierMeta.label : 'No plan yet'}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>
            {priceLine}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onManage}>
          {tierMeta ? 'Manage subscription' : 'Choose plan'}
        </button>
      </div>
      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        borderRadius: '8px',
        background: usage.atLimit ? 'rgba(255,51,102,0.08)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${usage.atLimit ? 'rgba(255,51,102,0.3)' : 'rgba(255,255,255,0.06)'}`,
        fontSize: '13px',
        color: usage.atLimit ? '#FF3366' : 'rgba(255,255,255,0.75)',
      }}>
        <strong>Roster: {usage.current}/{usage.cap === Infinity ? '∞' : usage.cap}</strong>
        {usage.atLimit && (usage.cap === 0
          ? ' — Pick a plan to start representing artists.'
          : ' — Upgrade to add more.')}
      </div>
    </div>
  );
};

export default AgentTierCard;
