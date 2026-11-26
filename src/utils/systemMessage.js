/**
 * Chat system messages (offers, contracts, payments, hand-overs…) are written
 * by the server in English. They are shown in the viewer's language by
 * matching each line against the server's sentences and rebuilding it from
 * the chat.sys.* catalog; a line that matches nothing (a quoted personal
 * note, an older wording) is shown as stored, so nothing ever renders empty.
 * When the named person is the viewer, "You" stands in for their name.
 */

const DOC_KEYS = {
  'Press Kit': 'chat.pressKit',
  'Technical Rider': 'chat.technicalRider',
  'Hospitality Rider': 'chat.hospitalityRider',
  Invoice: 'chat.sys.doc.invoice',
};

const LABELS = {
  Fee: 'fee', Date: 'date', Reason: 'reason', Notes: 'notes', Event: 'event', Amount: 'amount',
  'This installment': 'installment', 'Total deposits to date': 'depositsToDate',
};

// [pattern, key, param names] — first match wins, so the more specific
// sentence comes before the general one it would also match.
const LINES = [
  [/^New Booking Offer: (.+)$/, 'newOffer', ['event']],
  [/^New Booking Offer:?$/, 'newOfferPlain', []],
  [/^Booking Confirmed! (.+) accepted your offer$/, 'bookingConfirmedBy', ['name']],
  [/^Booking Confirmed!$/, 'bookingConfirmed', []],
  [/^(.+) accepted your offer\.$/, 'acceptedYourOffer', ['name']],
  [/^View details in the Bookings tab\.$/, 'viewInBookings', []],
  [/^Counter-Offer:$/, 'counterOffer', []],
  [/^Counter-Offer from (.+)$/, 'counterOfferFrom', ['name']],
  [/^Booking [Oo]ffer [Dd]eclined: (.+)$/, 'offerDeclined', ['event']],
  [/^(.+) withdrew the offer$/, 'withdrewOffer', ['name']],
  [/^📄 Contract sent for (.+)$/, 'contractSentFor', ['event']],
  [/^Contract sent \+ signed: (.+)$/, 'contractSentSigned', ['title']],
  [/^Contract sent: (.+)$/, 'contractSent', ['title']],
  [/^Please review and sign the contract\.$/, 'pleaseSign', []],
  [/^Please review and add your signature\.$/, 'pleaseAddSignature', []],
  [/^📄 (.+) sent and signed a contract for (.+)$/, 'sentAndSigned', ['name', 'event']],
  [/^📝 (?:✅ )?Contract fully signed! All parties have signed(?: the contract)?\.$/, 'fullySigned', []],
  [/^📝 (.+) signed the contract\. Waiting for (?:the )?other party to sign\.$/, 'signedWaiting', ['name']],
  [/^Reopened the contract step — a contract will be sent for this booking\.$/, 'contractReopened', []],
  [/^(.+) has withdrawn the contract for (.+)\. They can now send a new contract\.$/, 'contractWithdrawn', ['name', 'event']],
  [/^(.+) withdrew the contract$/, 'withdrewContract', ['name']],
  [/^(.+) handed you (.+)\. You now run this booking\.$/, 'handedYou', ['name', 'event']],
  [/^(.+) now runs (.+) for (.+)\.$/, 'nowRuns', ['name', 'event', 'artist']],
  [/^(.+) marked (.+) as not needed for (.+)\.$/, 'docSkipped', ['name', 'doc', 'event']],
  [/^(.+) marked (.+) as completed\.$/, 'markedCompleted', ['name', 'event']],
  [/^(.+) confirmed the payment for (.+) is settled\.$/, 'paymentSettled', ['name', 'event']],
  [/^(.+) closed the payment for (.+) with nothing further owed\.$/, 'paymentClosed', ['name', 'event']],
  [/^(.+) reset (.+) for (.+)\.$/, 'docReset', ['name', 'doc', 'event']],
  [/^(.+) cancelled (.+)\.$/, 'cancelled', ['name', 'event']],
  [/^📎 (.+) shared for (.+)$/, 'docShared', ['doc', 'event']],
  [/^(Press Kit|Technical Rider|Hospitality Rider|Invoice) shared: (.+)$/, 'docSharedTitle', ['doc', 'title']],
  [/^(Press Kit|Technical Rider|Hospitality Rider|Invoice) skipped$/, 'docSkippedShort', ['doc']],
  [/^(Press Kit|Technical Rider|Hospitality Rider|Invoice) reset$/, 'docResetShort', ['doc']],
  [/^💰 Full payment received for (.+)$/, 'fullPaymentReceived', ['event']],
  [/^💰 Deposit payment received for (.+)$/, 'depositReceived', ['event']],
  [/^✅ (.+) confirmed receipt of (.+) for (.+)$/, 'receiptConfirmed', ['name', 'amount', 'event']],
  [/^Receipt confirmed: (.+)$/, 'receiptConfirmedShort', ['amount']],
  [/^Your proposal for the (.+) tour was accepted!$/, 'proposalAccepted', ['zone']],
  [/^Your proposal for the (.+) tour was declined$/, 'proposalDeclined', ['zone']],
  [/^You've been invited to make an offer for (.+)'s (.+) tour \((.+)\)\.$/, 'invitedToOffer', ['artist', 'destination', 'dates']],
  [/^Invitation to offer — (.+) tour$/, 'invitedShort', ['destination']],
  [/^(.+) wants to represent you as an agent on TORA$/, 'wantsToRepresent', ['name']],
  [/^(.+) wants to be represented by you on TORA$/, 'wantsRepresentation', ['name']],
  [/^(.+) confirmed (.+) as their agent\.$/, 'confirmedAgent', ['name', 'agent']],
  [/^(.+) confirmed knowing (.+) professionally\.$/, 'confirmedKnowing', ['name', 'agent']],
];

// Said by the viewer about themselves: "You accepted the offer", not "You accepted your offer".
const SELF_KEYS = { acceptedYourOffer: 'youAcceptedOffer', bookingConfirmedBy: 'bookingConfirmedByYou' };

function renderLine(line, t, myName) {
  const has = (key) => t(key) !== key; // a missing catalog key returns itself

  const label = line.match(/^((?:💰|📅|📍) ?)?(Fee|Date|Reason|Notes|Event|Amount|This installment|Total deposits to date): (.*)$/);
  if (label && has(`chat.sys.label.${LABELS[label[2]]}`)) {
    const value = label[2] === 'Reason' && label[3] === 'No reason provided' && has('chat.sys.noReason')
      ? t('chat.sys.noReason')
      : label[3].replace(/ of (?=[\d.,]+ [A-Z]{3}$)/, ' / ');
    const name = t(`chat.sys.label.${LABELS[label[2]]}`);
    return `${label[1] || ''}${has('chat.sys.labelLine') ? t('chat.sys.labelLine', { label: name, value }) : `${name}: ${value}`}`;
  }

  for (const [pattern, key, names] of LINES) {
    const m = line.match(pattern);
    if (!m) continue;
    const params = {};
    names.forEach((n, i) => {
      const v = m[i + 1];
      params[n] = n === 'doc' && DOC_KEYS[v] && has(DOC_KEYS[v]) ? t(DOC_KEYS[v]) : v;
    });
    const self = myName && params.name === myName;
    const finalKey = self && SELF_KEYS[key] ? SELF_KEYS[key] : key;
    if (!has(`chat.sys.${finalKey}`)) return line;
    if (!self) return t(`chat.sys.${finalKey}`, params);
    // The viewer is never addressed with an honorific ("あなたさん").
    const you = t('chat.you');
    return t(`chat.sys.${finalKey}`, { ...params, name: you }).split(`${you}さん`).join(you).split(`${you}님`).join(you);
  }
  return line;
}

/** A system message's text in the viewer's language. */
export function renderSystemText(text, t, myName) {
  if (!text) return text;
  return String(text).split('\n').map((line) => renderLine(line, t, myName)).join('\n');
}

/**
 * The phone app's older name for renderSystemText (it imports this through
 * sync-shared). Only pass system messages: a member's own text is shown as typed.
 */
export function fromMySide(text, myName, t) {
  return renderSystemText(text, t, myName);
}
