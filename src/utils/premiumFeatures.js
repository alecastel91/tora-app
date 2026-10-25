// The Premium comparison, as data: one row per feature with its value on each
// plan. The phone's table in App.js still spells these rows out in JSX; the
// desktop plan columns (components/desktop/PremiumPlans) read them from here.
// Keep the two in step — values are the product's limits, not copy.
//
// value: true = included, false = not included, string = a t() key or literal.

const CHECK = true;
const NO = false;

export function premiumFeatureRows(user, t) {
  const role = user?.role;
  const artistSide = role === 'ARTIST' || role === 'AGENT';
  const bookerSide = role === 'PROMOTER' || role === 'VENUE';
  const rows = [
    { key: 'searchVisibility', free: t('premium.usersCity'), monthly: 'Global', yearly: 'Global' },
    { key: 'professionalDashboard', free: t('premium.preview'), monthly: CHECK, yearly: CHECK },
    artistSide && { key: 'updateTravelSchedule', free: NO, monthly: CHECK, yearly: CHECK },
    { key: 'calendarMatching', free: NO, monthly: CHECK, yearly: CHECK },
    { key: 'tourKickstarter', free: NO, monthly: CHECK, yearly: CHECK },
    bookerSide && { key: 'artistTravelAlerts', free: NO, monthly: NO, yearly: CHECK },
    { key: 'calendarPrivacy', free: NO, monthly: NO, yearly: CHECK },
    artistSide && { key: 'feePrivacy', free: NO, monthly: NO, yearly: CHECK },
    artistSide && { key: 'aiInvoices', free: NO, monthly: NO, yearly: CHECK },
    artistSide && { key: 'aiContracts', free: NO, monthly: NO, yearly: CHECK },
    { key: 'messaging', free: CHECK, monthly: CHECK, yearly: CHECK },
    { key: 'prioritySearch', free: NO, monthly: NO, yearly: CHECK },
    { key: 'sendLikes', free: '2 x day', monthly: '5 x day', yearly: t('premium.unlimited') },
    { key: 'sendOffers', free: t('premium.perMonth', { n: 3 }), monthly: t('premium.unlimited'), yearly: t('premium.unlimited') },
    { key: 'connectionRequests', free: '3 x month', monthly: '10 x month', yearly: t('premium.unlimited') },
  ];
  return rows.filter(Boolean);
}
