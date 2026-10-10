/**
 * System messages are written once, from the counterpart's point of view
 * ("Vela Ramos accepted your offer"). Shown to the actor themselves that
 * reads wrong, so the actor's own name becomes "You" and "your" becomes "the".
 */
export function fromMySide(text, myName, t) {
  if (!text || !myName || !text.startsWith(myName)) return text;
  return `${t('chat.you')}${text.slice(myName.length)}`.replace(/\byour\b/, 'the');
}
