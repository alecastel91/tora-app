// Shared derivations for the desktop deal rows (dashboard gigs, pipeline
// table). Everything here mirrors a rule BookingsScreen already applies to its
// cards — the same helpers, so a row and the card it opens never disagree.
import { isArtistSideForDeal } from '../../utils/contractSigner';
import { DOC_CATEGORIES, categoryStatus } from '../../utils/documentCategories';
import { bookingStatusLine } from '../../utils/bookingStatus';
import { isOffDeal } from '../../utils/dealStatus';

const STATUS_KEY = {
  PENDING: 'statusPending',
  NEGOTIATING: 'statusNegotiating',
  ACCEPTED: 'statusAccepted',
  'CONTRACT SIGNED': 'statusContractSigned',
  'DOCS SHARED': 'statusDocsShared',
  PAID: 'statusPaid',
  COMPLETED: 'statusCompleted',
  DECLINED: 'statusDeclined',
  CANCELLED: 'statusCancelled',
};

export const statusLabel = (status, t) => (STATUS_KEY[status] ? t(`bookings.${STATUS_KEY[status]}`) : status);

// Chip colour by meaning: amber = still negotiating, green = happening,
// red = dead, muted = done. Same three hues the app's status tokens use.
const TONE = {
  amber: 'border-[#FFC107]/45 bg-[#FFC107]/10 text-[#FFC107]',
  green: 'border-[#43E97B]/40 bg-[#43E97B]/10 text-[#43E97B]',
  red: 'border-[#F5576C]/40 bg-[#F5576C]/10 text-[#F5576C]',
  muted: 'border-white/15 bg-white/5 text-white/55',
};

export function statusChipClass(status) {
  const tone = status === 'PENDING' || status === 'NEGOTIATING' ? 'amber'
    : status === 'DECLINED' || status === 'CANCELLED' ? 'red'
    : status === 'COMPLETED' ? 'muted'
    : 'green';
  return `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap ${TONE[tone]}`;
}

/** The deal only reaches this profile as the tagged event venue — no commercials to show. */
export const isConsentOnlyFor = (deal, user) =>
  !!user && deal.eventVenueId === user.id
  && deal.initiator?.id !== user.id && deal.venue?.id !== user.id && deal.artist?.id !== user.id;

/** Who the viewer is dealing with, as BookingsScreen names it on the card. */
export function counterpartFor(deal, user) {
  if (!deal?.initiator || !user) return null;
  const isOutgoing = deal.initiator.id === user.id;
  return (isOutgoing ? (deal.venue?.id === user.id ? deal.artist : deal.venue) : deal.initiator) || null;
}

/** An agent sees whose booking a row is; everyone else already knows. */
export function bookedArtistName(deal, user) {
  if (user?.role !== 'AGENT' || !deal.bookedArtistId) return null;
  return deal.bookedArtistName || deal.artist?.name || null;
}

/** The status sentence with the same pending-docs input the card uses. */
export function statusLineFor(deal, user, t) {
  const hasPendingDocs = deal.contract?.status === 'FULLY_SIGNED' && isArtistSideForDeal(deal, user)
    && DOC_CATEGORIES.some((c) => categoryStatus(deal.sharedDocuments, c.key) === 'pending');
  return bookingStatusLine(deal, user, t, { hasPendingDocs });
}

export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/** upcoming | past | declined — the Bookings tab a deal belongs to. */
export function tabFor(deal) {
  if (isOffDeal(deal)) return 'declined';
  const day = new Date(deal.date); day.setHours(0, 0, 0, 0);
  return day >= startOfToday() ? 'upcoming' : 'past';
}

export const feeText = (deal) =>
  (Number(deal.currentFee) > 0 ? `${Number(deal.currentFee).toLocaleString()} ${deal.currency || ''}`.trim() : '—');

/** Local calendar key for a Date, matching the 'YYYY-MM-DD' strings in availableDates. */
export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A deal.date is a @db.Date at UTC midnight: its stored day is the first 10 chars. */
export const dealDayKey = (deal) => String(deal.date || '').slice(0, 10);
