import React, { useCallback, useEffect, useState } from 'react';
import apiService from '../../services/api';
import { formatEventDate } from '../../utils/dates';

/**
 * The official account's review page for the Travel panel's weekly check
 * (tora-backend services/travelWatch). Stricter and unclear changes apply on
 * their own; what waits here is a looser change the check could not prove
 * from the official page, plus members' reports and pages to open by hand.
 * One reader (the TORA team), so the copy is English, not catalogued.
 */
const day = (d) => formatEventDate(d, 'en-GB');
const DIRECTION = {
  STRICTER: ['Stricter', 'is-warn'], LOOSER: ['Looser', 'is-ok'], MIXED: ['Mixed', 'is-check'],
  UNCLEAR: ['Unclear', 'is-check'], DETAIL: ['Detail', 'is-check'],
};
const REASON = { border: 'At the border it was different', changed: 'The rule changed', link: 'A link is broken', other: 'Other' };

const Pill = ({ direction }) => {
  const [label, tone] = DIRECTION[direction] || [direction, 'is-check'];
  return <span className={`permit-panel-pill ${tone}`}>{label}</span>;
};

const Section = ({ title, children }) => (
  <section className="travel-review-section">
    <h2 className="permit-panel-heading">{title}</h2>
    {children}
  </section>
);

const TravelReviewScreen = ({ onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    apiService.getTravelReview().then(setData).catch((e) => setError(e.message || 'Could not load'));
  }, []);
  useEffect(load, [load]);

  const act = async (key, path, body) => {
    if (busy) return;
    setBusy(key);
    try {
      await apiService.travelReviewAction(path, body);
      load();
    } catch (e) {
      setError(e.message || 'That did not work');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="screen active travel-review">
      <div className="settings-header">
        <button type="button" className="back-button" onClick={onClose} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>Travel rules</h1>
        <div style={{ width: '24px' }} />
      </div>

      {error && <p className="permit-panel-warn travel-review-pad">{error}</p>}
      {!data && !error && <p className="permit-panel-text travel-review-pad">Loading…</p>}

      {data && (
        <div className="travel-review-body">
          <p className="permit-panel-text">
            Last check {day(data.dates.entry.checkedAt) || 'not yet'} · rules reviewed {day(data.dates.entry.reviewedAt)}
          </p>
          <div className="travel-review-stats">
            <div><strong>{data.sources.total}</strong><span>official pages</span></div>
            <div><strong>{data.sources.changedThisWeek}</strong><span>changed this week</span></div>
            <div><strong>{data.applied.length}</strong><span>applied, 30 days</span></div>
            <div className={data.pending.length ? 'is-due' : ''}><strong>{data.pending.length}</strong><span>waiting for you</span></div>
          </div>

          <Section title="Waiting for you">
            {!data.pending.length && <p className="permit-panel-text">Nothing to decide.</p>}
            {data.pending.map((c) => (
              <article key={c.id} className="travel-review-card is-due">
                <div className="travel-review-row"><strong>{c.country}</strong><Pill direction={c.direction} /></div>
                <p className="permit-panel-lead">{c.summary}</p>
                <p className="permit-panel-warn">
                  {c.quoteFound
                    ? 'The second check did not agree the sentence says this. Until you decide, the panel keeps the old, stricter rule.'
                    : 'The check could not find this sentence on the official page. Until you decide, the panel keeps the old, stricter rule.'}
                </p>
                {c.quote && <blockquote className="travel-review-quote">“{c.quote}”</blockquote>}
                {c.sourceUrl && <a className="permit-panel-text" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">Open the official page</a>}
                <p className="permit-panel-foot">Your only question: does the page say what the summary says?</p>
                <div className="travel-review-actions">
                  <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => act(c.id, `changes/${c.id}/approve`)}>Yes, apply and alert</button>
                  <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => act(c.id, `changes/${c.id}/reject`)}>No, keep the stricter rule</button>
                </div>
              </article>
            ))}
          </Section>

          {data.unsettled.length > 0 && (
            <Section title="Telling people to check the official site">
              {data.unsettled.map((u) => (
                <article key={`${u.dataset}:${u.country}`} className="travel-review-card">
                  <div className="travel-review-row"><strong>{u.country}</strong><span className="permit-panel-foot">since {day(u.since)}</span></div>
                  <p className="permit-panel-text">{u.note}</p>
                  <div className="travel-review-actions">
                    <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => act(`s:${u.country}`, 'settle', { dataset: u.dataset, country: u.country })}>The rules shown are right</button>
                  </div>
                </article>
              ))}
            </Section>
          )}

          <Section title="Applied automatically, last 30 days">
            {!data.applied.length && <p className="permit-panel-text">No changes.</p>}
            {data.applied.map((c) => (
              <div key={c.id} className="travel-review-line">
                <strong>{c.country}</strong>
                <Pill direction={c.direction} />
                <span className="travel-review-grow">{c.summary}</span>
                <span className="permit-panel-foot">{day(c.createdAt)} · told {c.alerted}</span>
                <button type="button" className="permit-panel-report" disabled={!!busy} onClick={() => act(c.id, `changes/${c.id}/undo`)}>Undo</button>
              </div>
            ))}
          </Section>

          <Section title="Reports from members">
            {!data.reports.length && <p className="permit-panel-text">No open reports.</p>}
            {data.reports.map((r) => (
              <article key={r.id} className="travel-review-card">
                <div className="travel-review-row">
                  <strong>{r.reporter?.name || 'Member'}</strong>
                  <span className="permit-panel-foot">{r.reporter?.role?.toLowerCase()} · {r.country} · {day(r.createdAt)}</span>
                </div>
                <span className="permit-panel-pill is-check">{REASON[r.reason] || r.reason}</span>
                {r.note && <p className="permit-panel-text">“{r.note}”</p>}
                <div className="travel-review-actions">
                  <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => act(r.id, `reports/${r.id}/close`)}>Done</button>
                </div>
              </article>
            ))}
          </Section>

          {data.datesDue.length > 0 && (
            <Section title="Dates in the rules, now or within 30 days">
              {data.datesDue.map((d) => (
                <div key={`${d.dataset}:${d.country}:${d.what}`} className="travel-review-line">
                  <strong>{d.country}</strong>
                  <span className="travel-review-grow">{d.what}</span>
                  <span className={d.passed ? 'permit-panel-warn' : 'permit-panel-foot'}>{day(d.date)}</span>
                </div>
              ))}
            </Section>
          )}

          {(data.sources.failing.length > 0 || data.sources.unreadable.length > 0) && (
            <Section title="Pages to open by hand">
              <p className="permit-panel-foot">These sites block automatic reading, or stopped answering, so a change there is not seen. Open them now and then.</p>
              {[...data.sources.failing.map((x) => ({ ...x, why: 'stopped answering' })), ...data.sources.unreadable.map((x) => ({ ...x, why: 'blocks automatic reading' }))].map((x) => (
                <a key={x.url} className="travel-review-link" href={x.url} target="_blank" rel="noopener noreferrer">
                  <span>{x.url.replace(/^https:\/\//, '')}</span>
                  <span className="permit-panel-foot">{x.why}{x.status ? ` · ${x.status}` : ''}</span>
                </a>
              ))}
            </Section>
          )}

          <div className="travel-review-actions">
            <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => act('run', 'run')}>{busy === 'run' ? 'Checking… (about a minute)' : 'Run the check now'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelReviewScreen;
