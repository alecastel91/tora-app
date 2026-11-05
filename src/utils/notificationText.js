import { formatEventDate } from './dates';

/**
 * Render a notification in the viewer's language.
 *
 * The server stores an English `text` (also used for push) plus the structured
 * bits in `relatedData`; the app rebuilds the sentence from a per-type
 * template with the sender's name and those bits. Anything the template
 * cannot express (older rows without the structured field, free-text types)
 * falls back to the stored English text, so nothing ever renders empty.
 */
const quoted = (text) => (text || '').match(/: «(.*)»$/)?.[1] || null;

export function renderNotificationText(notif, t, locale) {
  const type = notif?.type || '';
  const text = notif?.message || notif?.text || '';
  const name = notif?.sender?.name;
  const rd = notif?.relatedData || {};
  const has = (key) => t(key) !== key; // a missing catalog key returns itself
  const tr = (key, params) => (has(`notifications.types.${key}`) ? t(`notifications.types.${key}`, params) : text);
  const withName = (key, params = {}) => (name ? tr(key, { name, ...params }) : text);

  switch (type) {
    case 'LIKE':
      // The beta welcome "like" carries a custom message — keep it verbatim.
      return /liked your profile$/.test(text) ? withName('LIKE') : text;
    case 'CONNECTION_REQUEST': {
      const message = quoted(text);
      return message ? withName('CONNECTION_REQUEST_MESSAGE', { message }) : withName('CONNECTION_REQUEST');
    }
    case 'CONNECTION_ACCEPTED': return withName('CONNECTION_ACCEPTED');
    case 'REPRESENTATION_ACCEPTED': return withName('REPRESENTATION_ACCEPTED');
    case 'REPRESENTATION_CANCELLED': return withName('REPRESENTATION_CANCELLED');
    case 'OFFER_RECEIVED':
      return rd.eventName ? withName('OFFER_RECEIVED_EVENT', { event: rd.eventName }) : withName('OFFER_RECEIVED');
    case 'OFFER_ACCEPTED': return withName('OFFER_ACCEPTED');
    case 'DEAL_DECLINED': return withName('DEAL_DECLINED');
    case 'COUNTER_OFFER': return withName('COUNTER_OFFER');
    case 'CONTRACT_SENT': return withName('CONTRACT_SENT');
    case 'CONTRACT_WITHDRAWN': return withName('CONTRACT_WITHDRAWN');
    case 'DOCUMENT_SHARED': return withName('DOCUMENT_SHARED');
    case 'DEAL_CANCELLED': return rd.eventName ? tr('DEAL_CANCELLED', { event: rd.eventName }) : text;
    case 'DEAL_HANDED_TO_AGENT': return rd.eventName ? tr('DEAL_HANDED_TO_AGENT', { name: rd.artistName, event: rd.eventName }) : text;
    case 'DEAL_AGENT_TOOK_OVER': return rd.eventName ? tr('DEAL_AGENT_TOOK_OVER', { name: rd.agentName, event: rd.eventName }) : text;
    case 'DEAL_COMPLETED': return rd.eventName ? tr('DEAL_COMPLETED', { event: rd.eventName }) : text;
    case 'VENUE_EVENT_REQUEST':
      return rd.date ? withName('VENUE_EVENT_REQUEST', { date: formatEventDate(rd.date, locale) }) : text;
    case 'MESSAGE': {
      const preview = name && text.startsWith(`${name}: `) ? text.slice(name.length + 2) : null;
      return preview ? withName('MESSAGE', { preview }) : text;
    }
    case 'MESSAGE_DOCUMENT': {
      const title = text.split('sent a document: ')[1];
      return title ? withName('MESSAGE_DOCUMENT', { title }) : text;
    }
    case 'POST_COMMENTED': return rd.preview ? withName('POST_COMMENTED', { preview: rd.preview }) : text;
    case 'CONNECTION_POSTED': return rd.preview ? withName('CONNECTION_POSTED', { preview: rd.preview }) : text;
    case 'OFFICIAL_POST': return rd.preview ? tr('OFFICIAL_POST', { preview: rd.preview }) : text;
    case 'TOUR_INTEREST': return withName('TOUR_INTEREST');
    case 'TOUR_PROPOSAL': return withName('TOUR_PROPOSAL');
    case 'TOUR_PROPOSAL_ACCEPTED': return tr('TOUR_PROPOSAL_ACCEPTED');
    case 'TOUR_PROPOSAL_DECLINED': return tr('TOUR_PROPOSAL_DECLINED');
    case 'TRAVEL_ALERT': {
      const place = rd.city || rd.country || rd.zone;
      return place ? withName('TRAVEL_ALERT', { place }) : text;
    }
    case 'VERIFICATION_APPROVED':
      return name && text.startsWith(name) ? withName('VERIFICATION_VOUCHED') : tr('VERIFICATION_APPROVED');
    case 'VERIFICATION_REJECTED': return tr('VERIFICATION_REJECTED');
    case 'VERIFICATION_REVOKED': return tr('VERIFICATION_REVOKED');
    case 'VERIFICATION_VOUCH_REQUEST': return withName('VERIFICATION_VOUCH_REQUEST');
    default: return text; // free-text types (REPRESENTATION_REQUEST, PAYMENT_*, TEXT, …)
  }
}
