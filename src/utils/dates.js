// One place for date/time formatting, split by what the value MEANS — because
// the whole class of "event shows the wrong day" bugs (finding F5-01) came from
// deciding per-call-site whether to pin a timezone, and getting it wrong at 9
// of 11 sites.
//
// Two kinds of value, two functions:
//
//   formatEventDate  — a CALENDAR DATE (`@db.Date`: deal.date, tour start/end,
//     availableDates). Prisma returns these as UTC midnight, so they MUST be
//     rendered pinned to UTC or they shift a day for viewers west of UTC (a
//     Tokyo-set Oct 1 reads Sep 30 in São Paulo). The stored day is the day,
//     everywhere.
//
//   formatTimestamp  — a MOMENT IN TIME (`DateTime`: createdAt, message times).
//     These SHOULD render in the viewer's local zone — "sent 3:42pm" means
//     3:42pm where you are. Pinning these to UTC would be the same bug in
//     reverse.
//
// The name is the decision. A tenth calendar-date site can't reintroduce the
// bug by forgetting a flag, because there is no flag — you pick the function
// that matches the kind of value.

/**
 * Format a `@db.Date` calendar date, pinned to UTC so it reads as its stored
 * day in every timezone. `locale` is the app locale (e.g. t('dateFormat.locale')).
 * Returns '' for a null/invalid date.
 */
export function formatEventDate(value, locale, opts = {}) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  });
}

/**
 * The viewer's own calendar day as 'YYYY-MM-DD', `offsetDays` from today —
 * LOCAL, not UTC (before 9am in Tokyo, UTC is still on yesterday).
 */
export function localIsoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Format a `DateTime` moment in the viewer's LOCAL zone (a timestamp, not a
 * calendar date). Returns '' for a null/invalid value.
 */
export function formatTimestamp(value, locale, opts = {}) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}

/**
 * Keep an ordered pair of 'YYYY-MM-DD' strings consistent when one side
 * changes: the end can never precede the start. Moving the start past the end
 * drags the end along; picking an end before the start snaps it to the start.
 * Keys default to startDate/endDate; pass others for e.g. deposit/final deadlines.
 */
export function clampDateRange(prev, field, value, keys = { start: 'startDate', end: 'endDate' }) {
  const next = { ...prev, [field]: value };
  const start = next[keys.start];
  const end = next[keys.end];
  if (field === keys.start && end && value && end < value) next[keys.end] = value;
  if (field === keys.end && start && value && value < start) next[keys.end] = start;
  return next;
}
