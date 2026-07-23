import React from 'react';
import { isPaidAgent, rosterUsage, AGENT_FREE_ARTISTS } from '../../utils/agentTiers';
import { useLanguage } from '../../contexts/LanguageContext';

// Settings summary card for AGENT profiles. Reflects the per-seat model:
// a free plan covers AGENT_FREE_ARTISTS; a paid subscription is unlimited and
// billed by roster size (see AgentSeatPricing for the band table).
const AgentTierCard = ({ profile, onManage }) => {
  const { t } = useLanguage();
  const paid = isPaidAgent(profile);
  const usage = rosterUsage(profile);
  const interval = profile?.subscriptionTier === 'YEARLY' ? t('agentSeat.perYear') : t('agentSeat.perMonth');

  const title = paid ? t('agentSeatCard.perSeatPlan') : t('agentSeatCard.freePlan');
  const priceLine = paid
    ? t('agentSeatCard.billedRoster', { n: usage.current, interval })
    : t('agentSeatCard.freeIncludes', { n: AGENT_FREE_ARTISTS });

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{title}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>{priceLine}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onManage}>
          {paid ? t('agentSeatCard.manage') : t('agentSeatCard.choosePlan')}
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
        <strong>{t('agentSeatCard.roster')}: {usage.current}/{usage.cap === Infinity ? '∞' : usage.cap}</strong>
        {usage.atLimit && ` — ${t('agentSeatCard.subscribeToAdd')}`}
      </div>
    </div>
  );
};

export default AgentTierCard;
