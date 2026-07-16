import React, { useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

// Bandcamp-style revenue chart with calendar paging: Week / Month / Year /
// All-time filters, ‹ › arrows (and horizontal swipe) step to previous /
// next periods, and the bars always fit the container — column width adapts
// to the bucket count. `events` = [{ date, amount }] in the viewer's
// preferred currency; each event is one gig.
const DAY = 86400e3;
const PERIODS = ['week', 'month', 'year', 'all'];
const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FLOOR = new Date(2026, 0, 1); // history starts January 2026

// Round a max value up to a "nice" axis number (1/2/5 × 10^k).
const niceMax = (v) => {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) {
    if (v <= m * pow) return m * pow;
  }
  return 10 * pow;
};

const mondayOf = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

// Calendar-aligned window for a period at `offset` steps back from now.
function windowFor(period, offset, now = new Date()) {
  if (period === 'week') {
    const start = mondayOf(now);
    start.setDate(start.getDate() - 7 * offset);
    return { start, end: new Date(+start + 7 * DAY) };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear() - offset, 0, 1);
    return { start, end: new Date(start.getFullYear() + 1, 0, 1) };
  }
  return { start: FLOOR, end: new Date(+now + DAY) }; // all
}

function buildBuckets(events, period, { start, end }) {
  const buckets = [];
  if (period === 'week' || period === 'month') {
    for (let t = +start; t < +end; ) {
      const d = new Date(t);
      buckets.push({ kind: 'day', day: d.getDate(), monthIdx: d.getMonth(), start: t, end: t + DAY, amount: 0, gigs: 0 });
      t += DAY;
    }
  } else {
    const iter = new Date(start.getFullYear(), start.getMonth(), 1);
    while (iter < end) {
      const s = new Date(iter.getFullYear(), iter.getMonth(), 1);
      const e = new Date(iter.getFullYear(), iter.getMonth() + 1, 1);
      buckets.push({ kind: 'month', monthIdx: iter.getMonth(), year: iter.getFullYear(), start: +s, end: +e, amount: 0, gigs: 0 });
      iter.setMonth(iter.getMonth() + 1);
    }
  }
  for (const ev of events) {
    const t = +new Date(ev.date);
    const b = buckets.find((x) => t >= x.start && t < x.end);
    if (b) { b.amount += ev.amount; b.gigs += 1; }
  }
  return buckets;
}

const sumIn = (events, { start, end }) => {
  let total = 0, gigs = 0;
  for (const ev of events) {
    const t = +new Date(ev.date);
    if (t >= +start && t < +end) { total += ev.amount; gigs += 1; }
  }
  return { total, gigs };
};

const RevenueChart = ({ events = [], currencySymbol = '€' }) => {
  const { t } = useLanguage();
  const [period, setPeriodRaw] = useState('year');
  const [offset, setOffset] = useState(0); // 0 = current period, 1 = previous…
  const setPeriod = (p) => { setPeriodRaw(p); setOffset(0); };

  const win = useMemo(() => windowFor(period, offset), [period, offset]);
  const { buckets, total, gigs, axisMax, prev } = useMemo(() => {
    const b = buildBuckets(events, period, win);
    const cur = sumIn(events, win);
    const prevWin = period === 'all' ? null : windowFor(period, offset + 1);
    return {
      buckets: b,
      total: cur.total,
      gigs: cur.gigs,
      axisMax: niceMax(Math.max(...b.map((x) => x.amount), 0)),
      prev: prevWin ? sumIn(events, prevWin) : null,
    };
  }, [events, period, offset, win]);

  const canPrev = period !== 'all' && +windowFor(period, offset + 1).end > +FLOOR;
  const canNext = period !== 'all' && offset > 0;

  const fmt = (v) => `${currencySymbol}${Math.round(v).toLocaleString()}`;
  const mon = (i) => t(`manage.month${MONTH_KEYS[i]}`);
  const windowLabel = () => {
    if (period === 'week') {
      const a = win.start, b = new Date(+win.end - DAY);
      return `${a.getDate()} ${mon(a.getMonth())} – ${b.getDate()} ${mon(b.getMonth())} ${b.getFullYear()}`;
    }
    if (period === 'month') return `${mon(win.start.getMonth())} ${win.start.getFullYear()}`;
    if (period === 'year') return `${win.start.getFullYear()}`;
    return t('manage.periodAll');
  };

  // avg fee per gig, benchmarked against the previous window of the same size
  const avg = gigs > 0 ? total / gigs : 0;
  const prevAvg = prev && prev.gigs > 0 ? prev.total / prev.gigs : 0;
  const delta = avg > 0 && prevAvg > 0 ? ((avg - prevAvg) / prevAvg) * 100 : null;

  const labelFor = (b) =>
    b.kind === 'day' ? `${b.day} ${mon(b.monthIdx)}` : `${mon(b.monthIdx)} ${String(b.year).slice(2)}`;
  const labelStep = Math.max(1, Math.ceil(buckets.length / 5));
  const showLabel = (i) => i % labelStep === 0 || i === buckets.length - 1;

  // horizontal swipe pages through periods
  const swipe = useRef(null);
  const onPointerDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    if (!swipe.current) return;
    const dx = e.clientX - swipe.current.x;
    const dy = e.clientY - swipe.current.y;
    swipe.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0 && canPrev) setOffset(offset + 1);      // swipe right → back in time
    else if (dx < 0 && canNext) setOffset(offset - 1); // swipe left → forward
  };

  return (
    <div>
      {/* period tabs */}
      <div className="mb-3 flex rounded-full border border-white/10 bg-black/20 p-0.5 text-[10px] font-tech uppercase tracking-[0.12em]">
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

      {/* window pager + total */}
      <div className="mb-1 flex items-center justify-center gap-3">
        <button
          onClick={() => canPrev && setOffset(offset + 1)}
          disabled={!canPrev}
          aria-label="Previous period"
          className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-base ${canPrev ? 'text-white/70' : 'text-white/15'}`}
        >
          ‹
        </button>
        <div className="min-w-[170px] text-center">
          <div className="text-[10px] font-tech uppercase tracking-[0.15em] text-white/40">{windowLabel()}</div>
          <div className="text-3xl font-semibold text-white">{fmt(total)}</div>
        </div>
        <button
          onClick={() => canNext && setOffset(offset - 1)}
          disabled={!canNext}
          aria-label="Next period"
          className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-base ${canNext ? 'text-white/70' : 'text-white/15'}`}
        >
          ›
        </button>
      </div>

      {/* avg fee per gig, vs the previous window */}
      {gigs > 0 && (
        <p className="mb-4 text-center text-xs text-white/45">
          {t('manage.avgPerGig', { amount: fmt(avg) })}
          {delta !== null && (
            <span className={delta >= 0 ? 'text-[#34e3a0]' : 'text-infrared'}>
              {' '}{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% {t(`manage.vsPrev${period[0].toUpperCase()}${period.slice(1)}`)}
            </span>
          )}
        </p>
      )}
      {gigs === 0 && <div className="mb-4" />}

      {/* chart — bars always fit the width; swipe to page */}
      <div className="relative h-[180px] touch-pan-y" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        {[1, 0.5].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-white/[0.07]" style={{ top: `${(1 - f) * 100}%` }}>
            <span className="absolute -top-2.5 left-0 text-[10px] text-white/30">{fmt(axisMax * f)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pt-3">
          {buckets.map((b) => (
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
