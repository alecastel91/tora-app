import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { permitStatusFor, weeksUntil, PERMITS_VERIFIED_AT } from '../../utils/performerPermits';
import { formatEventDate } from '../../utils/dates';

/**
 * "Travel & work permit" on the booking page: what the artist's passport
 * needs to play a paid show in the event country. Collapsed to one line with
 * a status pill; open, it shows the permit, who applies, the lead time
 * against the weeks left, steps, tax and the official sources. Guidance only.
 */
const PILL = {
  home: 'ok', free: 'ok', exempt: 'ok',
  required: 'warn', depends: 'check', 'no-data': 'check', 'no-passport': 'check',
};

const TravelPermitPanel = ({ deal, artistSide }) => {
  const { t } = useLanguage();
  const s = permitStatusFor(deal.country, deal.artist?.nationalities);
  if (s.kind === 'no-country') return null;
  const { rule } = s;
  const weeks = weeksUntil(deal.date);
  const tight = s.kind === 'required' && rule?.leadTimeWeeks && weeks !== null && weeks >= 0 && weeks < rule.leadTimeWeeks;
  const pill = s.kind === 'no-passport' ? t('permits.pillAddPassport') : t(`permits.pill.${PILL[s.kind]}`);

  let lead;
  if (s.kind === 'home') lead = t('permits.home', { country: s.country });
  else if (s.kind === 'free') lead = t('permits.free', { passport: s.passport, country: s.country });
  else if (s.kind === 'no-data') lead = t('permits.noData', { country: s.country });
  else if (s.kind === 'no-passport') lead = artistSide ? t('permits.addPassport', { country: s.country }) : t('permits.artistNoPassport');
  else if (s.kind === 'exempt') lead = t('permits.exempt', { passport: s.passport, country: s.country });
  else lead = t('permits.needed', { passport: s.passport, country: s.country });

  // The rule's detail shows when a permit may be needed, or as general
  // guidance while the passport is unknown.
  const detail = rule && ['required', 'depends', 'no-passport', 'exempt'].includes(s.kind);
  const who = rule?.whoApplies && t(`permits.who.${rule.whoApplies}`);

  return (
    <details className={`permit-panel is-${PILL[s.kind]}`} open={tight || undefined}>
      <summary>
        <span className="permit-panel-title">{t('permits.title')}</span>
        <span className="permit-panel-pill">{pill}</span>
      </summary>
      <div className="permit-panel-body">
        <p className="permit-panel-lead">{lead}</p>
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
        {rule?.tax && (
          <p className="permit-panel-text"><strong>{t('permits.tax')}</strong> {rule.tax}</p>
        )}
        {rule?.confidence === 'low' && <p className="permit-panel-text">{t('permits.lowConfidence')}</p>}
        {rule?.sources?.length > 0 && (
          <p className="permit-panel-sources">
            {t('permits.sources')}{' '}
            {rule.sources.map((src, i) => (
              <React.Fragment key={src.url}>
                {i > 0 && ' · '}
                <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a>
              </React.Fragment>
            ))}
          </p>
        )}
        <p className="permit-panel-foot">{t('permits.disclaimer', { date: formatEventDate(PERMITS_VERIFIED_AT, t('dateFormat.locale')) })}</p>
      </div>
    </details>
  );
};

export default TravelPermitPanel;
