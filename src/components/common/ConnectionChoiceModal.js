import React, { useState } from 'react';
import { appAlert } from '../../utils/dialogs';
import Modal from './Modal';
import { InfoIcon, HandshakeIcon, UserIcon } from '../../utils/icons';
import { useLanguage } from '../../contexts/LanguageContext';

const ConnectionChoiceModal = ({ artist, onClose, onConnect }) => {
  const { t } = useLanguage();
  // This modal should only be shown when artist has a representedBy agent
  // The parent component (ViewProfileScreen) handles the check

  console.log('ConnectionChoiceModal rendered', { artist, onConnect, onClose });

  // Normalize representedBy to always be an array
  const representedByArray = Array.isArray(artist.representedBy)
    ? artist.representedBy
    : (artist.representedBy ? [artist.representedBy] : []);

  // Use the first agent as the primary agent for the choice modal
  const primaryAgent = representedByArray[0] || {};

  const [step, setStep] = useState('choice'); // 'choice', 'selectAgent', or 'message'
  const [selectedType, setSelectedType] = useState(null); // 'AGENT' or 'ARTIST'
  const [selectedAgent, setSelectedAgent] = useState(primaryAgent);
  const [message, setMessage] = useState('');

  const handleSelectAgent = () => {
    console.log('Agent selected');
    if (representedByArray.length > 1) {
      // Multiple agents: show agent selection step
      setStep('selectAgent');
    } else {
      // Single agent: go straight to message
      setSelectedAgent(primaryAgent);
      setSelectedType('AGENT');
      setStep('message');
    }
  };

  const handlePickAgent = (agent) => {
    setSelectedAgent(agent);
    setSelectedType('AGENT');
    setStep('message');
  };

  const handleSelectArtist = () => {
    console.log('Artist selected');
    setSelectedType('ARTIST');
    setStep('message');
  };

  const handleSendRequest = async () => {
    if (!message.trim()) {
      appAlert(t('search.pleaseWriteMessage'));
      return;
    }
    console.log('Sending request with message:', message);
    try {
      if (selectedType === 'AGENT') {
        const agentId = selectedAgent.agentId || selectedAgent.profileId || selectedAgent.id;
        console.log('Calling onConnect with agentId:', agentId);
        await onConnect(agentId, 'AGENT', artist, message);
      } else {
        console.log('Calling onConnect with artist.id:', artist.id);
        await onConnect(artist.id, 'ARTIST', null, message);
      }
      onClose();
    } catch (error) {
      // Error is already handled by the parent component (handleConnectionChoice)
      // Just close the modal so the parent's limit modal can show
      console.log('Connection request error caught in modal, closing...');
      onClose();
    }
  };

  const handleBack = () => {
    if (step === 'message' && selectedType === 'AGENT' && representedByArray.length > 1) {
      setStep('selectAgent');
    } else {
      setStep('choice');
    }
    setSelectedType(null);
    setMessage('');
  };

  // For the message step, show the simplified message modal
  if (step === 'message') {
    const targetName = selectedType === 'AGENT'
      ? (selectedAgent.name || selectedAgent.agentName || 'Agent')
      : artist.name;

    return (
      <div className="message-modal-overlay" onClick={onClose}>
        <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
          <h2 className="message-modal-title">{t('search.sendMessageTo')} {targetName}</h2>

          <textarea
            placeholder={t('messages.writeMessage')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="5"
            className="message-textarea-bottom"
          />

          <div className="message-modal-actions">
            <button
              className="btn btn-outline btn-modal-cancel"
              onClick={handleBack}
            >
              Back
            </button>
            <button
              className="btn btn-primary btn-modal-send"
              onClick={handleSendRequest}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Agent selection step (when multiple agents)
  if (step === 'selectAgent') {
    return (
      <Modal isOpen={true} onClose={onClose}>
        <div className="connection-choice-modal">
          <h2>{t('connect.selectAgent')}</h2>
          <p className="modal-description">
            {t('connect.multipleAgents')}
          </p>

          {representedByArray.map((agent, index) => (
            <button
              key={agent.agentId || agent.profileId || agent.id || index}
              className="connection-option agent-option"
              onClick={() => handlePickAgent(agent)}
            >
              <div className="option-icon">
                <HandshakeIcon />
              </div>
              <div className="option-content">
                <div className="option-name">{agent.name || agent.agentName || 'Agent'}</div>
                <div className="option-description">
                  {t('connect.forBooking')}
                </div>
              </div>
            </button>
          ))}

          <button className="btn btn-secondary btn-full" onClick={() => setStep('choice')}>
            Back
          </button>
        </div>
      </Modal>
    );
  }

  // For the choice step, show the selection modal
  const agentDisplayName = representedByArray.length === 1
    ? (primaryAgent.name || primaryAgent.agentName || 'Agent')
    : `${representedByArray.length} agents`;

  return (
    <Modal isOpen={true} onClose={onClose}>
      <div className="connection-choice-modal">
        <h2>{t('tour.connectWith', { name: artist.name })}</h2>

        <div className="info-banner">
          <InfoIcon />
          <span>This artist is represented by {representedByArray.length === 1 ? 'an agent' : `${representedByArray.length} agents`}</span>
        </div>

        <p className="modal-description">
          {t('connect.whoToConnect')}
        </p>

        {/* Option 1: Connect with Agent */}
        <button
          className="connection-option agent-option"
          onClick={handleSelectAgent}
        >
          <div className="option-icon">
            <HandshakeIcon />
          </div>
          <div className="option-content">
            <div className="option-title">{t('connect.withAgent')}</div>
            <div className="option-name">{agentDisplayName}</div>
            <div className="option-description">
              {t('connect.forBooking')}
            </div>
          </div>
        </button>

        {/* Option 2: Connect with Artist */}
        <button
          className="connection-option artist-option"
          onClick={handleSelectArtist}
        >
          <div className="option-icon">
            <UserIcon />
          </div>
          <div className="option-content">
            <div className="option-title">{t('connect.withArtist')}</div>
            <div className="option-name">{artist.name}</div>
            <div className="option-description">
              {t('connect.forCollaboration')}
            </div>
          </div>
        </button>

        <button className="btn btn-secondary btn-full" onClick={onClose}>
          {t('editProfile.cancel')}
        </button>
      </div>
    </Modal>
  );
};

export default ConnectionChoiceModal;
