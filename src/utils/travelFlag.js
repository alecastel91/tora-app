// One switch for the panel, the passport field and the review page, kept in
// its own module so the rule data (utils/travelData) stays out of the main
// bundle while it is off. Off since 2026-11-19 (parked by the founder); the
// server check is off too (TRAVEL_WATCH_ENABLED on Railway). Turn both back
// on together.
export const TRAVEL_ENABLED = false;
