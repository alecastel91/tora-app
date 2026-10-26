// Imperative, promise-based replacements for the native window.alert /
// window.confirm popups (which render OS-white and ignore the app theme).
// <AppDialogHost/> registers itself here; call sites just import appAlert /
// appConfirm. Falls back to the native dialogs if the host isn't mounted.

let pushDialog = null;

export function registerDialogHost(fn) {
  pushDialog = fn;
  return () => {
    if (pushDialog === fn) pushDialog = null;
  };
}

/** Styled alert. Resolves when dismissed. */
export function appAlert(message, opts = {}) {
  if (!pushDialog) {
    window.alert(message);
    return Promise.resolve();
  }
  return pushDialog({ type: 'alert', message, ...opts });
}

/**
 * Styled confirm. Resolves true/false.
 * opts: { title, confirmLabel, cancelLabel, danger }
 */
export function appConfirm(message, opts = {}) {
  if (!pushDialog) {
    return Promise.resolve(window.confirm(message));
  }
  return pushDialog({ type: 'confirm', message, ...opts });
}

/**
 * Copy text to the clipboard. Resolves true when it worked; when the
 * clipboard is unavailable (http dev host, old WebView) shows the text in an
 * alert so it can still be copied by hand.
 */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { appAlert(text); return false; }
}
