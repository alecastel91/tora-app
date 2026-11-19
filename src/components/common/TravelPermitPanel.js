import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { permitStatusFor, weeksUntil } from '../../utils/performerPermits';
import { entryStatusFor } from '../../utils/visitorEntry';
import { TRAVEL_ENABLED, useTravelData } from '../../utils/travelData';
import TravelReportSheet from './TravelReportSheet';
import { formatEventDate } from '../../utils/dates';

/**
 * "Travel" on the booking page, for the artist's passport(s) and the event
 * country. Closed: one line with an entry pill and a work pill. Open: how the
 * artist gets in as a visitor (visa-free days, anything to file before flying,
 * the arrival card), what performing for a fee needs (permit, who applies,
 * lead time, steps, tax), and, when a permit applies, plain facts on what a
 * visitor entry covers. Guidance only, every section sends people to the
 * official sources. The rules come from the server, checked against the
 * official pages every week (tora-backend services/travelWatch): a change in
 * the last 60 days shows on the bookings it reaches, and a country whose page
 * changed in a way not yet confirmed says to check the official site.
 */
const WORK_PILL = { exempt: 'ok', required: 'warn', depends: 'check', 'no-data': 'check' };
const ENTRY_PILL = { visa_free: 'ok', visa_on_arrival: 'ok', evisa: 'check', visa: 'warn', 'no-data': 'check' };
const SHORT_NAME = 10;
// The weekly check missed a few runs: say the dates may be behind.
const STALE_DAYS = 21;
const RECENT_DAYS = 60;
const DAY = 86400e3;

const Section = ({ title, children }) => (
  <section className="permit-panel-section">
    <h4 className="permit-panel-heading">{title}</h4>
    {children}
  </section>
);

const Sources = ({ label, list }) => (
  <p className="permit-panel-sources">
    {label}{' '}
    {list.map((src, i) => (
      <React.Fragment key={src.url}>
        {i > 0 && ' · '}
        <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a>
      </React.Fragment>
    ))}
  </p>
);

const TravelPermitPanel = ({ deal, artistSide }) => {
  const { t } = useLanguage();
  const travel = useTravelData();
  const [reporting, setReporting] = useState(false);
  const s = permitStatusFor(deal.country, deal.artist?.nationalities);
  if (!TRAVEL_ENABLED || s.kind === 'no-country') return null;
  const locale = t('dateFormat.locale');
  const date = (d) => formatEventDate(d, locale);

  // Home country or free movement: nothing to file, one line says so.
  if (s.kind === 'home' || s.kind === 'free') {
    return (
      <details className="permit-panel">
        <summary>
          <span className="permit-panel-title">{t('permits.title')}</span>
          <span className="permit-panel-pill is-ok">{t('entry.pill.none')}</span>
        </summary>
        <div className="permit-panel-body">
          <p className="permit-panel-lead">{s.kind === 'home' ? t('permits.home', { country: s.country }) : t('permits.free', { passport: s.passport, country: s.country })}</p>
        </div>
      </details>
    );
  }

  const passports = (deal.artist?.nationalities || []).filter(Boolean);
  const entry = passports.length ? entryStatusFor(s.country, passports, deal.date) : null;
  const liveAuths = entry?.authorisations.filter((a) => a.status !== 'upcoming') || [];
  const { rule } = s;
  const weeks = weeksUntil(deal.date);
  const tight = s.kind === 'required' && rule?.leadTimeWeeks && weeks !== null && weeks >= 0 && weeks < rule.leadTimeWeeks;

  let entryPill = null;
  if (entry) {
    entryPill = t(`entry.pill.${entry.kind}`);
    if (entry.kind === 'visa_free' && liveAuths.length) {
      const name = liveAuths[0].name;
      entryPill = t('entry.pill.withForm', { name: name.length <= SHORT_NAME ? name : t('entry.pill.form') });
    }
  }
  const workKind = s.kind === 'no-passport' ? null : s.kind;

  let entryLead = null;
  if (entry) {
    const p = { passport: entry.passport, country: s.country, n: entry.days };
    if (entry.kind === 'no-data') entryLead = t('entry.noData', p);
    else if (entry.kind === 'visa') entryLead = t('entry.visa', p);
    else entryLead = t(`entry.${entry.kind}${entry.days ? 'Days' : ''}`, p);
  }

  let workLead;
  if (s.kind === 'no-passport') workLead = artistSide ? t('permits.addPassport', { country: s.country }) : t('permits.artistNoPassport');
  else if (s.kind === 'no-data') workLead = t('permits.noData', { country: s.country });
  else if (s.kind === 'exempt') workLead = t('permits.exempt', { passport: s.passport, country: s.country });
  else workLead = t('permits.needed', { passport: s.passport, country: s.country });

  const detail = rule && ['required', 'depends', 'no-passport', 'exempt'].includes(s.kind);
  const who = rule?.whoApplies && t(`permits.who.${rule.whoApplies}`);
  // The older of the two datasets' dates is the honest one to show.
  const oldest = (key) => [travel.dates?.entry?.[key], travel.dates?.permits?.[key]].filter(Boolean).sort()[0];
  const checked = oldest('checkedAt');
  const reviewed = oldest('reviewedAt');
  const stale = !checked || Date.now() - new Date(checked).getTime() > STALE_DAYS * DAY;
  const upcoming = new Date(deal.date).getTime() >= Date.now() - DAY;
  const changes = upcoming ? (travel.changes || []).filter((c) => c.country === s.country && Date.now() - new Date(c.createdAt).getTime() < RECENT_DAYS * DAY) : [];
  const unsettled = travel.entry?.[s.country]?._unsettled || travel.permits?.[s.country]?._unsettled;

  return (
    <details className="permit-panel" open={tight || changes.length > 0 || undefined}>
      <summary>
        <span className="permit-panel-title">{t('permits.title')}</span>
        {entryPill && <span className={`permit-panel-pill is-${ENTRY_PILL[entry.kind]}`}>{entryPill}</span>}
        <span className={`permit-panel-pill is-${workKind ? WORK_PILL[workKind] : 'check'}`}>
          {workKind ? t(`permits.pill.${WORK_PILL[workKind]}`) : t('permits.pillAddPassport')}
        </span>
      </summary>
      <div className="permit-panel-body">
        {unsettled && <p className="permit-panel-warn">{t('travel.unsettled', { country: s.country, date: date(unsettled.since) })}</p>}
        {changes.length > 0 && (
          <div className="permit-panel-changed">
            {changes.map((c) => (
              <p key={c.id} className="permit-panel-text">
                <strong>{t('travel.changedOn', { date: date(c.createdAt) })}</strong> {c.summary}
              </p>
            ))}
          </div>
        )}
        {entry && (
          <Section title={t('entry.heading')}>
            <p className="permit-panel-lead">{entryLead}</p>
            {entry.note && <p className="permit-panel-text">{entry.note}</p>}
            {entry.kind === 'visa' && entry.otherwise && <p className="permit-panel-text">{entry.otherwise}</p>}
            {entry.authorisations.length > 0 && (
              <ul className="permit-panel-forms">
                {entry.authorisations.map((a) => (
                  <li key={a.name}>
                    <span className="permit-panel-form-name">
                      {a.status !== 'upcoming' ? t('entry.beforeYouFly', { name: a.name }) : a.startsOn ? t('entry.upcoming', { name: a.name, date: date(a.startsOn) }) : t('entry.upcomingNoDate', { name: a.name })}
                    </span>
                    {[a.cost, a.leadTime, a.note].filter(Boolean).join(' · ')}
                    {a.url && <> · <a href={a.url} target="_blank" rel="noopener noreferrer">{t('entry.officialSite')}</a></>}
                  </li>
                ))}
              </ul>
            )}
            {entry.arrivalCard && (
              <p className="permit-panel-text">
                <strong>{t(entry.arrivalCard.required ? 'entry.arrivalCardRequired' : 'entry.arrivalCardOptional', { name: entry.arrivalCard.name })}</strong>
                {entry.arrivalCard.note ? ` ${entry.arrivalCard.note}` : ''}
                {entry.arrivalCard.url && <> · <a href={entry.arrivalCard.url} target="_blank" rel="noopener noreferrer">{t('entry.officialSite')}</a></>}
              </p>
            )}
            {entry.rule?.sources?.length > 0 && <Sources label={t('permits.sources')} list={entry.rule.sources} />}
          </Section>
        )}

        <Section title={t('permits.workHeading')}>
          <p className="permit-panel-lead">{workLead}</p>
          {detail && (
            <>
              {rule.permitName && <p className="permit-panel-name">{rule.permitName}</p>}
              <p className="permit-panel-text">{s.kind === 'no-passport' && <strong>{t('permits.inGeneral')} </strong>}{rule.summary}</p>
              {s.kind === 'exempt' && rule.exemptNote && <p className="permit-panel-text">{rule.exemptNote}</p>}
              {s.kind !== 'exempt' && <dl className="permit-panel-facts">
                {who && <div><dt>{t('permits.whoApplies')}</dt><dd>{who}</dd></div>}
                {rule.leadTimeWeeks ? <div><dt>{t('permits.leadTime')}</dt><dd>{t('permits.weeks', { n: rule.leadTimeWeeks })}</dd></div> : null}
                {rule.cost && <div><dt>{t('permits.cost')}</dt><dd>{rule.cost}</dd></div>}
              </dl>}
              {tight && <p className="permit-panel-warn">{t('permits.tight', { weeks, n: rule.leadTimeWeeks })}</p>}
              {rule.steps?.length > 0 && (
                <ol className="permit-panel-steps">{rule.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              )}
            </>
          )}
          {rule?.tax && <p className="permit-panel-text"><strong>{t('permits.tax')}</strong> {rule.tax}</p>}
          {rule?.confidence === 'low' && <p className="permit-panel-text">{t('permits.lowConfidence')}</p>}
          {rule?.sources?.length > 0 && <Sources label={t('permits.sources')} list={rule.sources} />}
        </Section>

        {(s.kind === 'required' || s.kind === 'depends') && (
          <Section title={t('entry.borderHeading')}>
            <p className="permit-panel-text">{t('entry.border')}</p>
          </Section>
        )}

        <div className="permit-panel-foot">
          <p>{t('travel.checked', { checked: date(checked), reviewed: date(reviewed) })}</p>
          <p>{t(stale ? 'travel.notChecked' : 'travel.guidance')}</p>
          <button type="button" className="permit-panel-report" onClick={() => setReporting(true)}>{t('travel.report')}</button>
        </div>
      </div>
      <TravelReportSheet isOpen={reporting} onClose={() => setReporting(false)} country={s.country} dealId={deal.id} />
    </details>
  );
};

export default TravelPermitPanel;
