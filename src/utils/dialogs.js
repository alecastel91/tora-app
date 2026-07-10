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
