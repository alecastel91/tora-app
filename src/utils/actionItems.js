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
