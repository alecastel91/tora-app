import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from './Modal';
import MakeOfferModal from './MakeOfferModal';
import LimitReachedModal from './LimitReachedModal';
import { HandshakeIcon, InfoIcon, UserIcon } from '../../utils/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import { appAlert } from '../../utils/dialogs';
import { isVerificationGate, connectionLimitOf } from '../../utils/errors';
import { toRepEntries } from '../../utils/representation';
import apiService from '../../services/api';

/* Make an Offer, for every entry point. An artist with an agent first asks who
   the offer is for: some artists book certain regions themselves and have
   different agents elsewhere, so the booker chooses. Offers only go between
   connected members, so anyone not yet connected gets a connection request
   first (the server refuses the offer otherwise). */
const OfferFlow = ({ isOpen, onClose, recipientProfile, onSuccess, onOpenPremium, dockAsDrawer = false, preferCountry = null }) => {
  const { t } = useLanguage();
  const { connectedUsers, sentRequests, receivedRequests, sendConnectionRequest } = useAppContext();
  const [agents, setAgents] = useState(null);
  const [offerTo, setOfferTo] = useState(null);
  const [connectTo, setConnectTo] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(null);

  const recipientId = recipientProfile?.id;

  // Offer if connected, else ask to connect; a pending request just waits.
  const offerOrConnect = (profile, artist, { closeIfPending = false } = {}) => {
    if (connectedUsers.has(profile.id)) {
      setOfferTo({ profile, artist });
    } else if (sentRequests.has(profile.id) || receivedRequests.has(profile.id)) {
      appAlert(t('offerRoute.requestPending'));
      if (closeIfPending) onClose();
    } else {
      setConnectTo(profile);
    }
  };

  useEffect(() => {
    if (!isOpen || !recipientProfile) {
      setAgents(null);
      setOfferTo(null);
      setConnectTo(null);
      setMessage('');
      setLimit(null);
      return undefined;
    }
    const route = (list) => {
      const live = list.filter((a) => !a.dormant);
      if (live.length) setAgents(live); else offerOrConnect(recipientProfile, undefined, { closeIfPending: true });
    };
    if (recipientProfile.role !== 'ARTIST') { route([]); return undefined; }
    if (recipientProfile.representedByProfiles) { route(recipientProfile.representedByProfiles); return undefined; }
    // Some lists carry no representation at all, so an empty list isn't proof.
    if (Array.isArray(recipientProfile.representedBy) && !toRepEntries(recipientProfile.representedBy).length) {
      route([]);
      return undefined;
    }
    let cancelled = false;
    apiService.getProfile(recipientProfile.id)
      .then((full) => { if (!cancelled) route(full?.representedByProfiles || []); })
      .catch(() => { if (!cancelled) route([]); });
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
      await sendConnectionRequest(connectTo.id, message.trim());
      appAlert(agents && connectTo.id !== recipientProfile.id
        ? t('offerRoute.connectSent', { name: connectTo.name, artist: recipientProfile.name })
        : t('search.connectionRequestSent', { name: connectTo.name }));
      onClose();
    } catch (error) {
      const reached = connectionLimitOf(error);
      if (reached) setLimit(reached);
      else if (!isVerificationGate(error)) appAlert(t('search.failedToSendRequest'));
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
            maxLength={500}
            className="message-textarea-bottom"
          />
          <div className="message-modal-actions">
            <button type="button" className="btn btn-outline btn-modal-cancel" onClick={() => (agents ? setConnectTo(null) : onClose())}>
              {t(agents ? 'offerRoute.back' : 'editProfile.cancel')}
            </button>
            <button type="button" className="btn btn-primary btn-modal-send" disabled={busy} onClick={sendRequest}>
              {busy ? '...' : t('search.connect')}
            </button>
          </div>
        </div>
        {limit && <LimitReachedModal type="connections" data={limit} onClose={() => setLimit(null)} onOpenPremium={onOpenPremium} />}
      </div>,
      document.body,
    );
  }

  if (!agents) return null;

  const artistConnected = connectedUsers.has(recipientProfile.id);
  const artistPending = !artistConnected && (sentRequests.has(recipientProfile.id) || receivedRequests.has(recipientProfile.id));

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
              onClick={() => offerOrConnect(
                { ...agent, location: place },
                { profileId: recipientProfile.id, name: recipientProfile.name },
              )}
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
          disabled={artistPending}
          onClick={() => offerOrConnect(recipientProfile)}
        >
          <div className="option-icon"><UserIcon /></div>
          <div className="option-content">
            <div className="option-title">{t(artistConnected ? 'offerRoute.sendDirect' : artistPending ? 'offerRoute.requestPending' : 'offerRoute.connectArtistFirst')}</div>
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
