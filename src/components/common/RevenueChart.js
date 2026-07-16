import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

// Bandcamp-style revenue chart: period tabs, a big total, and a bar chart
// that always fits the container — column width adapts to the bucket count
// (no horizontal scrolling). `events` = [{ date, amount }] in the viewer's
// preferred currency.
const DAY = 86400e3;
const PERIODS = ['week', 'month', 'year', 'all'];
const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Round a max value up to a "nice" axis number (1/2/5 × 10^k).
const niceMax = (v) => {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) {
    if (v <= m * pow) return m * pow;
  }
  return 10 * pow;
};

function buildBuckets(events, period, now = new Date()) {
  const buckets = [];
  if (period === 'week' || period === 'month') {
    const days = period === 'week' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      buckets.push({ kind: 'day', day: d.getDate(), monthIdx: d.getMonth(), start: d.getTime(), end: d.getTime() + DAY, amount: 0 });
    }
  } else {
    let start;
    if (period === 'year') {
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    } else {
      const first = events.length
        ? new Date(Math.min(...events.map((e) => +new Date(e.date))))
        : now;
      start = new Date(first.getFullYear(), first.getMonth(), 1);
      const minStart = new Date(now.getFullYear(), now.getMonth() - 5, 1); // at least 6 months
      if (start > minStart) start = minStart;
    }
    const iter = new Date(start);
    while (iter <= now) {
      const s = new Date(iter.getFullYear(), iter.getMonth(), 1);
      const e = new Date(iter.getFullYear(), iter.getMonth() + 1, 1);
      buckets.push({ kind: 'month', monthIdx: iter.getMonth(), year: iter.getFullYear(), start: +s, end: +e, amount: 0 });
      iter.setMonth(iter.getMonth() + 1);
    }
  }
  for (const ev of events) {
    const t = +new Date(ev.date);
    const b = buckets.find((x) => t >= x.start && t < x.end);
    if (b) b.amount += ev.amount;
  }
  return buckets;
}

const RevenueChart = ({ events = [], currencySymbol = '€' }) => {
  const { t } = useLanguage();
  const [period, setPeriod] = useState('year');

  const { buckets, total, axisMax } = useMemo(() => {
    const b = buildBuckets(events, period);
    const sum = b.reduce((n, x) => n + x.amount, 0);
    return { buckets: b, total: sum, axisMax: niceMax(Math.max(...b.map((x) => x.amount), 0)) };
  }, [events, period]);

  const fmt = (v) => `${currencySymbol}${Math.round(v).toLocaleString()}`;
  const labelFor = (b) =>
    b.kind === 'day' ? `${b.day} ${t(`manage.month${MONTH_KEYS[b.monthIdx]}`)}` : `${t(`manage.month${MONTH_KEYS[b.monthIdx]}`)} ${String(b.year).slice(2)}`;
  // sparse x labels — at most ~5, always including the first and last bucket
  const labelStep = Math.max(1, Math.ceil(buckets.length / 5));
  const showLabel = (i) => i % labelStep === 0 || i === buckets.length - 1;

  return (
    <div>
      {/* period tabs */}
      <div className="mb-4 flex rounded-full border border-white/10 bg-black/20 p-0.5 text-[10px] font-tech uppercase tracking-[0.12em]">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-full px-2 py-1.5 transition ${period === p ? 'bg-infrared/70 text-white' : 'text-white/45'}`}
          >
            {t(`manage.period${p[0].toUpperCase()}${p.slice(1)}`)}
          </button>
        ))}
      </div>

      {/* period total */}
      <div className="mb-4 text-center">
        <span className="text-3xl font-semibold text-white">{fmt(total)}</span>
      </div>

      {/* chart — bars always fit the width */}
      <div className="relative h-[190px]">
        {/* y gridlines */}
        {[1, 0.5].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-white/[0.07]" style={{ top: `${(1 - f) * 100}%` }}>
            <span className="absolute -top-2.5 left-0 text-[10px] text-white/30">{fmt(axisMax * f)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pt-3">
          {buckets.map((b, i) => (
            <div key={`${b.start}`} className="flex h-full flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: `${(b.amount / axisMax) * 100}%`,
                  background: b.amount > 0 ? 'linear-gradient(to top, rgba(255,51,102,0.28), rgba(255,51,102,0.75))' : 'transparent',
                  minHeight: b.amount > 0 ? 3 : 0,
                }}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 translate-y-full border-t border-white/10" />
      </div>

      {/* x labels */}
      <div className="mt-1.5 flex gap-[2px] border-t border-white/10 pt-1.5">
        {buckets.map((b, i) => (
          <div key={`${b.start}-l`} className="flex-1 overflow-visible">
            {showLabel(i) && (
              <span className="block whitespace-nowrap text-[9px] text-white/35">{labelFor(b)}</span>
            )}
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <p className="mt-3 text-center text-xs text-white/35">{t('manage.noRevenueYet')}</p>
      )}
    </div>
  );
};

export default RevenueChart;
