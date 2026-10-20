import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import { isVerificationGate } from '../../utils/errors';
import { toRepEntries, repEntryId, repEntryName, findRepEntry } from '../../utils/representation';
import OverlayPortal from './OverlayPortal';
import ConnectionChoiceModal from './ConnectionChoiceModal';
import LimitReachedModal from './LimitReachedModal';

/* The Message / Pending / Connect control for a profile row, with the whole
   connect flow behind it: an artist who has an agent gets the choice modal
   (reach the artist or their agent), everyone else gets the note box, and a
   403 connection-limit answer opens the upgrade modal.
   SearchScreen and ViewProfileScreen still carry their own copies of this —
   fold them onto this component when the phone screens are next touched. */
const ConnectAction = ({ profile, onMessage, onOpenPremium }) => {
  const { t } = useLanguage();
  const { connectedUsers, sentRequests, receivedRequests, sendConnectionRequest } = useAppContext();
  const [showChoice, setShowChoice] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(null);

  const id = profile.id;
  const connected = connectedUsers.has(id);
  const pending = sentRequests.has(id) || receivedRequests.has(id);

  // A 403 limit answer is the one error worth its own modal; the verification
  // gate is handled globally by api.js.
  const report = (error, fallbackKey) => {
    const data = error.response?.data;
    if (error.response?.status === 403 && data?.error === 'CONNECTION_LIMIT_EXCEEDED') {
      setLimit({ limit: data.limit, tier: data.tier });
      return;
    }
    if (!isVerificationGate(error)) appAlert(t(fallbackKey));
  };

  const start = () => {
    if (pending) return;
    const agents = toRepEntries(profile.representedBy);
    if (agents.some((a) => repEntryName(a) && repEntryId(a))) setShowChoice(true);
    else { setNote(''); setShowNote(true); }
  };

  const choose = async (targetProfileId, type, artistContext = null, userMessage = '') => {
    if (busy) return;
    setBusy(true);
    try {
      await sendConnectionRequest(targetProfileId, userMessage);
      const name = type === 'AGENT' && artistContext
        ? (repEntryName(findRepEntry(artistContext.representedBy, targetProfileId)) || t('search.agent'))
        : profile.name;
      appAlert(t('search.connectionRequestSent', { name }));
      setShowChoice(false);
    } catch (error) {
      report(error, 'search.failedToSendRequest');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!note.trim()) { appAlert(t('search.pleaseWriteMessage')); return; }
    if (busy) return;
    setBusy(true);
    try {
      await sendConnectionRequest(id, note.trim());
      appAlert(t('search.connectionRequestSent', { name: profile.name }));
      setShowNote(false);
      setNote('');
    } catch (error) {
      report(error, 'search.failedToSendRequest');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {connected ? (
        <button className="btn btn-message btn-connect" onClick={() => onMessage?.(profile)}>{t('search.message')}</button>
      ) : pending ? (
        <button className="btn btn-disabled btn-connect" disabled>{t('search.pending')}</button>
      ) : (
        <button className="btn btn-primary btn-connect" onClick={start}>{t('search.connect')}</button>
      )}

      {showChoice && (
        <ConnectionChoiceModal artist={profile} onClose={() => setShowChoice(false)} onConnect={choose} />
      )}

      {showNote && (
        <OverlayPortal><div className="message-modal-overlay" onClick={() => setShowNote(false)}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">{t('search.sendMessageTo')} {profile.name}</h2>
            <textarea
              className="message-textarea-bottom"
              placeholder={t('messages.writeMessage')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
            <div className="message-modal-actions">
              <button className="btn btn-outline btn-modal-cancel" onClick={() => setShowNote(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary btn-modal-send" onClick={send} disabled={busy}>
                {busy ? '...' : t('messages.send')}
              </button>
            </div>
          </div>
        </div></OverlayPortal>
      )}

      {limit && (
        <LimitReachedModal type="connections" data={limit} onClose={() => setLimit(null)} onOpenPremium={onOpenPremium} />
      )}
    </>
  );
};

export default ConnectAction;
