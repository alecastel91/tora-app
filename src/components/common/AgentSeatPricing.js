import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

import { AGENT_BANDS as BANDS, agentMonthlyTotal, formatMoney } from '../../utils/money';

const bandLabel = (band, i) => {
  const from = i === 0 ? 1 : BANDS[i - 1].upTo + 1;
  return band.upTo === Infinity ? `${from}+` : `${from}–${band.upTo}`;
};

/**
 * Per-seat pricing panel for AGENT profiles. Replaces the old fixed-tier
 * ladder: agents pay per artist they represent, on a graduated scale, so
 * the price scales with the roster instead of forcing a package.
 */
const AgentSeatPricing = ({ rosterCount = 0, currentSeats = 0, isPaid = false, currentInterval = 'month', currency = 'USD', onSubscribe }) => {
  // Account currency (fixed once subscribed); formats every amount below.
  const money = (n) => formatMoney(n, currency);
  const total = (n) => agentMonthlyTotal(n, currency);
  const { t } = useLanguage();
  // Paid agents start on their ACTUAL billing interval, so the CTA reads as
  // "current plan" until they change something (seats or interval). Everyone
  // else lands on Yearly: it now leads with the discounted per-month figure,
  // so the best deal is also the smallest number on screen (comp accounts
  // arrive here as unpaid, see billingTier).
  const [interval, setInterval] = useState(isPaid ? currentInterval : 'year');
  // Seats the agent already holds and won't be charged again for: a paid agent's
  // purchased seats, or a free agent's current roster (their included allowance).
  const baseline = isPaid ? currentSeats : rosterCount;
  // Floor = current roster (can't hold fewer seats than artists represented).
  // A paid agent MAY pick below their purchased seats — that's a downgrade:
  // nothing due today, the renewal price drops.
  const minSeats = Math.max(rosterCount, 1);
  const [estimate, setEstimate] = useState(Math.max(currentSeats, minSeats));
  // Props can arrive after mount (profile loads late) — keep the picker legal.
  useEffect(() => {
    setEstimate((n) => Math.max(n, minSeats));
  }, [minSeats]);
  const additional = Math.max(0, estimate - baseline);
  const reducing = isPaid ? Math.max(0, currentSeats - estimate) : 0;
  const intervalChanged = isPaid && interval !== currentInterval;
  const unchanged = isPaid && estimate === currentSeats && !intervalChanged;

  const isYearly = interval === 'year';
  const mult = isYearly ? 10 : 1; // yearly per-artist rate = monthly × 10 (2 months free)

  const est = useMemo(() => {
    const mo = total(estimate);
    return { perPeriod: mo * mult, perMonth: isYearly ? mo * 10 / 12 : mo };
  }, [estimate, mult, isYearly]);

  return (
    <div className="agent-seat">
      <div className="agent-seat-head">
        <div>
          <h3 className="agent-seat-title">{t('agentSeat.title')}</h3>
          <p className="agent-seat-sub">{t('agentSeat.intro')}</p>
        </div>
        <div className="agent-seat-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isYearly}
            className={!isYearly ? 'is-active' : ''}
            onClick={() => setInterval('month')}
          >
            {t('premium.monthly')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isYearly}
            className={isYearly ? 'is-active' : ''}
            onClick={() => setInterval('year')}
          >
            {t('premium.yearly')}
            <span className="agent-seat-save">{t('premium.yearlySaveBadge')}</span>
          </button>
        </div>
      </div>

      {/* Interactive estimator — makes the graduated model tangible. */}
      <div className="agent-seat-estimator">
        <div className="agent-seat-estimator-row">
          <span className="agent-seat-estimator-label">{t('agentSeat.estimatorLabel')}</span>
          <div className="agent-seat-stepper">
            <button type="button" onClick={() => setEstimate((n) => Math.max(minSeats, n - 1))} aria-label="−">−</button>
            <span className="agent-seat-count">{estimate}</span>
            <button type="button" onClick={() => setEstimate((n) => Math.min(200, n + 1))} aria-label="+">+</button>
          </div>
        </div>
        {/* Clarify what's already yours vs. what you're adding/removing */}
        <p className="agent-seat-context">
          {additional > 0
            ? (isPaid
                ? t('agentSeat.addingSeats', { n: additional })
                : t('agentSeat.buyingSeats', { n: estimate }))
            : reducing > 0
              ? t('agentSeat.reducingSeats', { n: reducing })
              : (isPaid
                  ? t('agentSeat.alreadyHave', { artists: rosterCount })
                  : t('agentSeat.freeRepresenting', { artists: rosterCount }))}
        </p>
        <input
          type="range"
          min={minSeats}
          max={Math.max(60, minSeats)}
          value={Math.min(estimate, Math.max(60, minSeats))}
          onChange={(e) => setEstimate(Number(e.target.value))}
          className="agent-seat-range"
          aria-label={t('agentSeat.estimatorLabel')}
        />
        {/* Yearly: lead with the per-month equivalent (monthly rate struck
            through), the yearly total in small print — a year's total reads
            as expensive. Monthly: the plain monthly figure. */}
        <div className="agent-seat-estimate-out">
          <span className="agent-seat-estimate-total">
            {isYearly && <s className="price-was">{money(total(estimate))}</s>}
            {money(est.perMonth)}<em>/{t('agentSeat.perMonth')}</em>
          </span>
          {isYearly && (
            <span className="agent-seat-estimate-eq">{t('premium.billedYearly', { total: money(est.perPeriod) })}</span>
          )}
        </div>
      </div>

      {/* Band breakdown */}
      <div className="agent-seat-bands">
        {BANDS.map((band, i) => {
          const rate = band.monthly[currency] * mult;
          const active = estimate > (i === 0 ? 0 : BANDS[i - 1].upTo);
          return (
            <div key={i} className={`agent-seat-band${active ? ' is-active' : ''}`}>
              <span className="agent-seat-band-range">{bandLabel(band, i)} {t('agentSeat.artists')}</span>
              <span className="agent-seat-band-rate">
                {money(rate)}<em>/{t('agentSeat.perArtist')} · {isYearly ? t('agentSeat.perYear') : t('agentSeat.perMonth')}</em>
              </span>
            </div>
          );
        })}
      </div>

      {!isPaid && <p className="agent-seat-note">{t('agentSeat.freeNote')}</p>}

      <button
        type="button"
        className="btn btn-primary btn-full agent-seat-cta"
        disabled={unchanged}
        onClick={() => {
          if (unchanged) return; // nothing to change
          // The seats the agent picked (never below their roster).
          const seats = Math.max(estimate, minSeats);
          const perPeriod = total(seats) * mult;
          const currentPeriod = total(currentSeats) * mult;
          onSubscribe(interval, {
            seats,
            added: isPaid ? Math.max(0, seats - currentSeats) : 0,
            currentSeats,
            currentPriceLabel: money(currentPeriod),
            addedPriceLabel: money(perPeriod - currentPeriod),
            amount: perPeriod,
            priceLabel: money(perPeriod),
            perMonthLabel: isYearly ? money(total(seats) * 10 / 12) : null,
          });
        }}
      >
        {isPaid
          ? (unchanged
              ? t('agentSeat.currentSeats', { n: currentSeats })
              : (intervalChanged && additional === 0 && reducing === 0)
                ? (isYearly
                    ? t('agentSeat.switchToYearly', { price: money(total(estimate) * mult) })
                    : t('agentSeat.switchToMonthly', { price: money(total(estimate) * mult) }))
                : reducing > 0
                  ? t('agentSeat.reduceSeats', { n: estimate, price: money(total(estimate) * mult) })
                  : t('agentSeat.upgradeSeats', { n: estimate, price: money(total(estimate) * mult) }))
          : t('agentSeat.buySeats', { n: estimate, price: money(total(estimate) * mult) })}
      </button>
      <p className="agent-seat-foot">{t('agentSeat.foot')}</p>
    </div>
  );
};

export default AgentSeatPricing;
