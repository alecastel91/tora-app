import React, { useState } from 'react';
import { appAlert } from '../../utils/dialogs';
import { AGENT_TIER_PRICING, AGENT_TIER_KEYS, BILLING_INTERVAL, formatEur } from '../../utils/agentTiers';
import { useLanguage } from '../../contexts/LanguageContext';

const requestTierActivation = (tierKey) => {
  if (tierKey === 'ENTERPRISE') {
    window.location.href = 'mailto:support@torahub.io?subject=Enterprise plan inquiry';
    return;
  }
  appAlert(
    'Self-serve checkout is coming soon.\n\n'
    + `To activate ${AGENT_TIER_PRICING[tierKey].label} now, email support@torahub.io and we'll set it up manually.`
  );
};

const AgentTierLadder = ({ currentTier, scrollable = false }) => {
  const { t } = useLanguage();
  const [billingInterval, setBillingInterval] = useState(BILLING_INTERVAL.MONTHLY);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0 }}>{t('agentPlans.title')}</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
            {t('agentPlans.intro')}
          </p>
        </div>
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', padding: '3px' }}>
          {[BILLING_INTERVAL.MONTHLY, BILLING_INTERVAL.YEARLY].map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setBillingInterval(iv)}
              style={{
                padding: '6px 16px',
                borderRadius: '999px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: billingInterval === iv ? '#FF3366' : 'transparent',
                color: billingInterval === iv ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              {iv === BILLING_INTERVAL.MONTHLY ? t('premium.monthly') : <>{t('premium.yearly')} <span style={{ opacity: 0.7, fontSize: '10px' }}>{t('agentPlans.savePct')}</span></>}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        ...(scrollable ? { maxHeight: '60vh', overflowY: 'auto' } : null),
      }}>
        {AGENT_TIER_KEYS.map((key) => {
          const tier = AGENT_TIER_PRICING[key];
          const isCurrent = currentTier === key;
          const isEnterprise = key === 'ENTERPRISE';
          const price = billingInterval === BILLING_INTERVAL.MONTHLY ? tier.monthlyEur : tier.yearlyEur;
          const monthlyEquivalent = billingInterval === BILLING_INTERVAL.YEARLY && tier.yearlyEur != null
            ? formatEur(tier.yearlyEur / 12)
            : null;
          return (
            <div
              key={key}
              style={{
                border: isCurrent ? '1px solid rgba(255,51,102,0.6)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '14px 16px',
                background: isCurrent ? 'rgba(255,51,102,0.06)' : 'rgba(255,255,255,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: '120px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {tier.label}
                  {isCurrent && (
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: 'rgba(255,51,102,0.15)',
                      color: '#FF3366',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}>{t('agentPlans.current')}</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>
                  {tier.artistCap === null ? t('agentPlans.unlimitedArtists') : t('agentPlans.upToArtists', { n: tier.artistCap })}
                </div>
              </div>
              <div style={{ minWidth: '110px', textAlign: 'right' }}>
                {isEnterprise ? (
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>{t('agentPlans.custom')}</div>
                ) : (
                  <>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                      {formatEur(price)}
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginLeft: '3px' }}>
                        /{billingInterval === BILLING_INTERVAL.MONTHLY ? 'mo' : 'yr'}
                      </span>
                    </div>
                    {monthlyEquivalent && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>
                        ≈ {monthlyEquivalent}/mo
                      </div>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => requestTierActivation(key)}
                disabled={isCurrent}
                className={isCurrent ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
                style={{ minWidth: '110px' }}
              >
                {isCurrent ? t('agentPlans.currentPlan') : isEnterprise ? t('agentPlans.contactSales') : t('agentPlans.select')}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '16px 0 0 0', textAlign: 'center' }}>
        {t('agentPlans.checkoutSoon')} <a href="mailto:support@torahub.io" style={{ color: '#FF3366' }}>support@torahub.io</a> to activate a plan today.
      </p>
    </div>
  );
};

export default AgentTierLadder;
