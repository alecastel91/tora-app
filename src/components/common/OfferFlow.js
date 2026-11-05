import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from './Modal';
import MakeOfferModal from './MakeOfferModal';
import { HandshakeIcon, InfoIcon, UserIcon } from '../../utils/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import { appAlert } from '../../utils/dialogs';
import { isVerificationGate } from '../../utils/errors';
import { toRepEntries } from '../../utils/representation';
import apiService from '../../services/api';

/* Make an Offer, for every entry point. An artist with an agent first asks who
   the offer is for: some artists book certain regions themselves and have
   different agents elsewhere, so the booker chooses. An agent they aren't
   connected to gets a connection request first. */
const OfferFlow = ({ isOpen, onClose, recipientProfile, onSuccess, dockAsDrawer = false, preferCountry = null }) => {
  const { t } = useLanguage();
  const { connectedUsers, sentRequests, receivedRequests, sendConnectionRequest } = useAppContext();
  const [agents, setAgents] = useState(null);
  const [offerTo, setOfferTo] = useState(null);
  const [connectTo, setConnectTo] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const recipientId = recipientProfile?.id;

  useEffect(() => {
    if (!isOpen || !recipientProfile) {
      setAgents(null);
      setOfferTo(null);
      setConnectTo(null);
      setMessage('');
      return undefined;
    }
    const direct = () => setOfferTo({ profile: recipientProfile });
    if (recipientProfile.role !== 'ARTIST') { direct(); return undefined; }
    const known = recipientProfile.representedByProfiles;
    if (known) {
      const live = known.filter((a) => !a.dormant);
      if (live.length) setAgents(live); else direct();
      return undefined;
    }
    // Some lists carry no representation at all, so an empty list isn't proof.
    if (Array.isArray(recipientProfile.representedBy) && !toRepEntries(recipientProfile.representedBy).length) {
      direct();
      return undefined;
    }
    let cancelled = false;
    apiService.getProfile(recipientProfile.id)
      .then((full) => {
        if (cancelled) return;
        const live = (full?.representedByProfiles || []).filter((a) => !a.dormant);
        if (live.length) setAgents(live); else direct();
      })
      .catch(() => { if (!cancelled) direct(); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, recipientId]);

  if (!isOpen || !recipientProfile) return null;

  if (offerTo) {
    return (
      <MakeOfferModal
        isOpen
        onClose={onClose}
        recipientProfile={offerTo.profile}
        presetArtist={offerTo.artist}
        onSuccess={onSuccess}
        dockAsDrawer={dockAsDrawer}
        preferCountry={preferCountry}
      />
    );
  }

  const sendRequest = async () => {
    if (!message.trim()) {
      appAlert(t('search.pleaseWriteMessage'));
      return;
    }
    setBusy(true);
    try {
      await sendConnectionRequest(connectTo.id, message);
      appAlert(t('offerRoute.connectSent', { name: connectTo.name, artist: recipientProfile.name }));
      onClose();
    } catch (error) {
      if (!isVerificationGate(error)) appAlert(t('search.failedToSendRequest'));
    } finally {
      setBusy(false);
    }
  };

  if (connectTo) {
    return createPortal(
      <div className="message-modal-overlay" onClick={onClose}>
        <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
          <h2 className="message-modal-title">{t('search.sendMessageTo')} {connectTo.name}</h2>
          <p className="modal-description">{t('offerRoute.connectHint', { name: connectTo.name })}</p>
          <textarea
            placeholder={t('messages.writeMessage')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="5"
            className="message-textarea-bottom"
          />
          <div className="message-modal-actions">
            <button type="button" className="btn btn-outline btn-modal-cancel" onClick={() => setConnectTo(null)}>
              {t('offerRoute.back')}
            </button>
            <button type="button" className="btn btn-primary btn-modal-send" disabled={busy} onClick={sendRequest}>
              {busy ? '...' : t('search.connect')}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!agents) return null;

  return (
    <Modal isOpen onClose={onClose}>
      <div className="connection-choice-modal">
        <h2>{t('offerRoute.title')}</h2>
        <div className="info-banner">
          <InfoIcon />
          <span>{t(agents.length === 1 ? 'offerRoute.representedOne' : 'offerRoute.representedMany', { artist: recipientProfile.name })}</span>
        </div>

        {agents.map((agent) => {
          const connected = connectedUsers.has(agent.id);
          const pending = !connected && (sentRequests.has(agent.id) || receivedRequests.has(agent.id));
          const place = [agent.city, agent.country].filter(Boolean).join(', ');
          const titleKey = connected ? 'offerRoute.sendToAgent' : pending ? 'offerRoute.requestPending' : 'offerRoute.connectFirst';
          return (
            <button
              key={agent.id}
              type="button"
              className="connection-option agent-option"
              disabled={pending}
              onClick={() => {
                if (connected) {
                  setOfferTo({
                    profile: { ...agent, location: place },
                    artist: { profileId: recipientProfile.id, name: recipientProfile.name },
                  });
                } else {
                  setConnectTo(agent);
                }
              }}
            >
              <div className="option-icon"><HandshakeIcon /></div>
              <div className="option-content">
                <div className="option-title">{t(titleKey)}</div>
                <div className="option-name">{agent.name}</div>
                {place && <div className="option-description">{place}</div>}
              </div>
            </button>
          );
        })}

        <button
          type="button"
          className="connection-option artist-option"
          onClick={() => setOfferTo({ profile: recipientProfile })}
        >
          <div className="option-icon"><UserIcon /></div>
          <div className="option-content">
            <div className="option-title">{t('offerRoute.sendDirect')}</div>
            <div className="option-name">{recipientProfile.name}</div>
            <div className="option-description">{t('offerRoute.directHint')}</div>
          </div>
        </button>

        <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>
          {t('editProfile.cancel')}
        </button>
      </div>
    </Modal>
  );
};

export default OfferFlow;
