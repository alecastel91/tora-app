import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { premiumFeatureRows } from '../../utils/premiumFeatures';
import { yearlyPerMonth, EXTRA_PRICES } from '../../utils/money';

/* Desktop v3 Premium: three plan columns — Free, Monthly, Yearly — each with
   its price on top and what it includes beneath, the current plan marked.
   Same prices, limits and checkout handler as the phone page; App.js passes
   them in. Agents keep their per-seat pricing (not a three-plan shape). */

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

const Row = ({ label, value, highlight, onExplain }) => {
  const off = value === false;
  return (
    <li className={`flex items-start gap-2.5 py-2 text-[13px] ${off ? 'text-white/30' : 'text-white/85'}`}>
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full [&>svg]:h-2.5 [&>svg]:w-2.5
                        ${off ? 'border border-white/15 text-transparent' : highlight ? 'bg-infrared text-white' : 'bg-white/15 text-white'}`}>
        {!off && <Check />}
      </span>
      <button onClick={() => onExplain?.()} className={`min-w-0 flex-1 cursor-pointer bg-transparent p-0 text-left ${off ? 'line-through decoration-white/20' : ''}`}>
        {label}
      </button>
      {typeof value === 'string' && (
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] ${highlight ? 'border-infrared/40 text-infrared' : 'border-white/15 text-white/60'}`}>{value}</span>
      )}
    </li>
  );
};

const PremiumPlans = ({
  user, money, memberPrice, currency, hasMonthly, hasYearly,
  onAgentPlan, onMembership, onSelectPlan, onExplain,
}) => {
  const { t } = useLanguage();
  const rows = premiumFeatureRows(user, t);
  const isFree = !hasMonthly && !hasYearly;
  const perMonth = t('agentSeat.perMonth');

  const cta = (plan) => {
    // Free first: a profile covered by the account's Agent plan is not on
    // Free, so this column offers nothing — switching to a membership means
    // monthly or yearly, and routing 'free' into onSelectPlan opened checkout.
    if (plan === 'free') {
      if (onAgentPlan) return <div className="h-[38px]" />;
      return isFree
        ? <button className="btn btn-outline w-full" disabled>{t('premium.currentPlan')}</button>
        : <div className="h-[38px]" />;
    }
    if (onAgentPlan) {
      return (
        <button className={`btn ${plan === 'yearly' ? 'btn-primary' : 'btn-outline'} w-full`} onClick={() => onSelectPlan(plan)}>
          {t('premium.switchToMembership')}
        </button>
      );
    }
    if (plan === 'monthly') {
      if (hasMonthly) return <button className="btn btn-outline w-full" disabled>{t('premium.currentPlan')}</button>;
      if (hasYearly) return <button className="btn btn-outline w-full" disabled>{t('premium.onYearlyAlready')}</button>;
      return <button className="btn btn-outline w-full" onClick={() => onSelectPlan('monthly')}>{t('premium.chooseMonthly')}</button>;
    }
    if (hasYearly) return <button className="btn btn-primary w-full" disabled>{t('premium.currentPlan')}</button>;
    return <button className="btn btn-primary w-full" onClick={() => onSelectPlan('yearly')}>{hasMonthly ? t('premium.upgradeToYearly') : t('premium.chooseYearly')}</button>;
  };

  const columns = [
    { id: 'free', title: t('premium.free'), current: isFree, highlight: false,
      price: <>{money(0)}<span className="text-[13px] font-normal text-white/45">/{perMonth}</span></> },
    { id: 'monthly', title: t('premium.monthly'), current: hasMonthly, highlight: false,
      price: <>{money(memberPrice.monthly)}<span className="text-[13px] font-normal text-white/45">/{perMonth}</span></> },
    { id: 'yearly', title: t('premium.yearly'), current: hasYearly, highlight: true,
      badge: hasYearly ? t('premium.currentPlan') : t('premium.yearlySaveBadge'),
      price: <><s className="mr-2 text-[16px] font-normal text-white/35">{money(memberPrice.monthly)}</s>{money(yearlyPerMonth(memberPrice.yearly))}<span className="text-[13px] font-normal text-white/45">/{perMonth}</span></>,
      sub: t('premium.billedYearly', { total: money(memberPrice.yearly) }) },
  ];

  return (
    <div className="d3-plans">
      {onAgentPlan && <p className="d3-plans-note">{t('premium.coveredByAgency')}</p>}
      {onMembership && <p className="d3-plans-note">{t('premium.coversAllProfiles')}</p>}

      <div className="d3-plans-grid">
        {columns.map((c) => (
          <section
            key={c.id}
            className={`relative flex flex-col rounded-xl border p-6 ${c.highlight ? 'border-infrared/50 bg-[#120a0f]' : 'border-white/10 bg-[#0a0a0e]'} ${c.current && !c.highlight ? 'ring-1 ring-white/20' : ''}`}
          >
            {(c.badge || (c.current && !c.highlight)) && (
              <span className={`absolute -top-3 left-6 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]
                               ${c.highlight ? 'border-infrared/60 bg-[#120a0f] text-infrared' : 'border-white/20 bg-[#0a0a0e] text-white/70'}`}>
                {c.badge || t('premium.currentPlan')}
              </span>
            )}
            <h3 className={`m-0 text-[11px] font-semibold uppercase tracking-[0.18em] ${c.highlight ? 'text-infrared' : 'text-white/50'}`}>{c.title}</h3>
            <p className="d3-plan-price m-0 mt-3 font-futuristic text-[32px] font-semibold leading-none text-white">{c.price}</p>
            <p className="m-0 mt-1.5 min-h-[18px] text-[12px] text-white/45">{c.sub || ''}</p>
            <div className="mt-5">{cta(c.id)}</div>
            <ul className="m-0 mt-5 list-none divide-y divide-white/[0.06] border-t border-white/[0.08] p-0">
              {rows.map((r) => (
                <Row key={r.key} label={t(`premium.${r.key}`)} value={r[c.id]} highlight={c.highlight} onExplain={() => onExplain?.(r.key)} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="d3-plans-note">
        {t('premium.cancelAnytime')}
        {' · '}
        <span className="uppercase tracking-[0.1em] text-white/35">
          5 {t('premium.sendLikes')} {money(EXTRA_PRICES.likes_5[currency])} · 7d {money(EXTRA_PRICES.likes_week[currency])} · +1 {t('premium.connectionRequests')} {money(EXTRA_PRICES.connections_1[currency])} · +3 {money(EXTRA_PRICES.connections_3[currency])}
        </span>
      </p>
    </div>
  );
};

export default PremiumPlans;
