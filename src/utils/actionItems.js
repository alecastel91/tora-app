import {
  HandshakeIcon,
  FileIcon,
  DollarIcon,
  MailIcon,
  AlertIcon,
} from './icons';

export const ACTION_ICONS = {
  offer_received: HandshakeIcon,
  counter_offer_pending: HandshakeIcon,
  contract_to_send: FileIcon,
  contract_to_sign: FileIcon,
  payment_to_mark_sent: DollarIcon,
  payment_to_confirm_received: DollarIcon,
  representation_request_received: MailIcon,
};

export function getActionIcon(type) {
  return ACTION_ICONS[type] || AlertIcon;
}

export function handleActionTarget(target, { onSwitchTab, onClose }) {
  if (!target?.screen) return;
  if (target.screen === 'BookingsScreen') onSwitchTab('bookings');
  else if (target.screen === 'MessagesScreen') onSwitchTab('messages');
  onClose?.();
}

// The action-summary API sends English titles/labels; the templates are stable
// per item type, so localize client-side by extracting the dynamic parts.
const ACTION_TITLE_PATTERNS = {
  offer_received: [/^Offer from (.+)$/, 'manage.actionOfferReceived'],
  counter_offer_pending: [/^Counter offer from (.+)$/, 'manage.actionCounterOffer'],
  contract_to_send: [/^Send contract for (.+)$/, 'manage.actionContractToSend'],
  contract_to_sign: [/^Sign contract from (.+)$/, 'manage.actionContractToSign'],
  payment_to_mark_sent: [/^Mark payment sent to (.+)$/, 'manage.actionPaymentToMarkSent'],
  representation_request_received: [/^Representation request from (.+)$/, 'manage.actionRepresentationRequest'],
};

const ACTION_LABEL_KEYS = {
  'Review': 'manage.actionReview',
  'Send': 'manage.actionSend',
  'Sign': 'manage.actionSign',
  'Mark Sent': 'manage.actionMarkSent',
  'Confirm': 'manage.actionConfirm',
};

const ACTION_TYPE_KEYS = {
  offer_received: 'manage.actionOfferReceived',
  counter_offer_pending: 'manage.actionCounterOffer',
  contract_to_send: 'manage.actionContractToSend',
  contract_to_sign: 'manage.actionContractToSign',
  payment_to_mark_sent: 'manage.actionPaymentToMarkSent',
  representation_request_received: 'manage.actionRepresentationRequest',
};

export function localizeActionItem(item, t) {
  let title = item.title;
  // Preferred path: the API ships typed params (titleParams) so no string
  // parsing is needed and backend copy changes can't break localization.
  if (item.titleParams) {
    if (item.type === 'payment_to_confirm_received') {
      title = item.titleParams.amount
        ? t('manage.actionPaymentToConfirm', item.titleParams)
        : t('manage.actionPaymentToConfirmFull', item.titleParams);
    } else if (ACTION_TYPE_KEYS[item.type]) {
      title = t(ACTION_TYPE_KEYS[item.type], item.titleParams);
    }
    const labelKey = ACTION_LABEL_KEYS[item.actionLabel];
    return { title, actionLabel: labelKey ? t(labelKey) : item.actionLabel };
  }
  // Legacy fallback: regex-extract from the English template.
  if (item.type === 'payment_to_confirm_received') {
    let m = /^Confirm receipt of full payment from (.+)$/.exec(item.title);
    if (m) {
      title = t('manage.actionPaymentToConfirmFull', { name: m[1] });
    } else if ((m = /^Confirm receipt of (.+) from (.+)$/.exec(item.title))) {
      title = t('manage.actionPaymentToConfirm', { amount: m[1], name: m[2] });
    }
  } else if (ACTION_TITLE_PATTERNS[item.type]) {
    const [re, key] = ACTION_TITLE_PATTERNS[item.type];
    const m = re.exec(item.title);
    if (m) title = t(key, { name: m[1] });
  }
  const labelKey = ACTION_LABEL_KEYS[item.actionLabel];
  return { title, actionLabel: labelKey ? t(labelKey) : item.actionLabel };
}
