import apiService from '../services/api';
import { appAlert, appConfirm } from './dialogs';
import { showToast } from './toast';
import { BLOCK_EFFECT_KEYS } from './safety';

/**
 * Block / unblock a person, confirmation copy included.
 *
 * Shared because the same two flows are reachable from four places — a
 * profile, a chat, the blocked-profile card and Settings — and each one
 * having its own copy of the confirmation is how the wording drifts.
 * Returns true when the change went through.
 */
export async function confirmBlock(profile, t) {
  const ok = await appConfirm(
    `${t('safety.blockConfirmBody', { name: profile.name })}\n\n${BLOCK_EFFECT_KEYS.map((k) => `• ${t(`safety.${k}`)}`).join('\n')}`,
    { title: t('safety.blockConfirmTitle', { name: profile.name }), confirmLabel: t('safety.block'), danger: true },
  );
  if (!ok) return false;
  try {
    await apiService.blockMember(profile.id);
    showToast('safety.blockDone', { name: profile.name });
    return true;
  } catch (err) {
    appAlert(err.message || t('safety.blockFailed'));
    return false;
  }
}

export async function confirmUnblock(profile, t) {
  const ok = await appConfirm(t('safety.unblockConfirm', { name: profile.name }), { confirmLabel: t('safety.unblock') });
  if (!ok) return false;
  try {
    await apiService.unblockMember(profile.userId);
    return true;
  } catch (err) {
    appAlert(err.message || t('safety.unblockFailed'));
    return false;
  }
}
