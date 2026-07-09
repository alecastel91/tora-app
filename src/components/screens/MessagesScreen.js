import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import { subscribeToInbox } from '../../services/realtime';
import LoadingGlobe from '../common/LoadingGlobe';
import { getAvatarClass } from '../../utils/roles';
import CountBadge from '../common/CountBadge';

const MessagesScreen = ({ onOpenChat, chatOpen = false, isActive = true }) => {
  const { user, getConversations, acceptRequest, declineRequest } = useAppContext();
  const { t } = useLanguage();
  const [conversations, setConversations] = useState([]);
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('messages'); // 'messages' or 'requests'
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data is loaded

  // Function to fetch all data
  const fetchData = async () => {
    if (!user || !user.id) {
      setLoading(false);
      return;
    }

    if (loading) return; // Prevent duplicate fetches

    try {
      setLoading(true);

      // OPTIMIZED: Fetch both in parallel
      const [convos, requestsData] = await Promise.all([
        getConversations(),
        apiService.getReceivedRequests(user.id)
      ]);

      setConversations(convos);
      setConnectionRequests(requestsData.requests || []);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error fetching messages data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch data when component mounts or user changes
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Keep-mounted awareness: while this tab is hidden, don't refetch on every
  // inbox broadcast — just mark the list stale and refetch once on reveal.
  const isActiveRef = React.useRef(isActive);
  isActiveRef.current = isActive;
  const staleRef = React.useRef(false);
  useEffect(() => {
    if (isActive && staleRef.current) {
      staleRef.current = false;
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Refetch once when a chat closes (messages were marked read there).
  // Replaces the old key-remount which refetched on open AND close.
  const prevChatOpenRef = React.useRef(chatOpen);
  useEffect(() => {
    if (prevChatOpenRef.current && !chatOpen) {
      if (isActiveRef.current) fetchData();
      else staleRef.current = true;
    }
    prevChatOpenRef.current = chatOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  // Realtime: subscribe to inbox updates so the conversation list refreshes
  // automatically when a new message arrives or a request is sent.
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToInbox(user.id, () => {
      if (isActiveRef.current) fetchData();
      else staleRef.current = true;
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now - messageTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('messages.justNow');
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return messageTime.toLocaleDateString();
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };


  // Obsidian Neon segmented tab (Messages / Requests) with count pill.
  const TabButton = ({ id, label, icon, count }) => (
    <button
      className={`flex-1 flex items-center justify-center gap-[7px] py-3.5 text-[11px] font-tech font-semibold
                  uppercase tracking-[0.15em] whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer
                  ${activeTab === id
                    ? 'text-infrared border-infrared'
                    : 'text-white/40 border-transparent hover:text-white/70'}`}
      onClick={() => setActiveTab(id)}
    >
      {icon}
      {label}
      <CountBadge count={count} />
    </button>
  );

  if (loading) {
    return (
      <div className="screen active messages-screen">
        <LoadingGlobe />
      </div>
    );
  }

  const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

  return (
    <div className="screen active messages-screen relative isolate">
      {/* faint engineering grid fading from the top (quiet-premium backdrop) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 -z-10 bg-grid
                   [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
      />
      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 mb-5 px-1">
        <TabButton
          id="messages"
          label="Messages"
          count={totalUnread}
          icon={(
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
        />
        <TabButton
          id="requests"
          label="Requests"
          count={connectionRequests.length}
          icon={(
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          )}
        />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {activeTab === 'messages' ? (
          // Messages Tab
          conversations.length > 0 ? (
            conversations.map(conv => {
              const isDeleted = conv.profile.isDeleted || false;
              const unread = conv.unreadCount > 0;
              return (
                <div
                  key={conv.profile.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 cursor-pointer transition-colors
                              ${unread ? 'border-infrared/30 bg-white/[0.05]' : 'border-white/10 bg-white/[0.03]'}
                              ${isDeleted ? 'opacity-70' : ''} hover:border-infrared/40 hover:bg-white/[0.06]`}
                  onClick={() => onOpenChat && onOpenChat(conv.profile)}
                >
                  <div className={`message-avatar shrink-0 ${isDeleted ? 'avatar-deleted' : getAvatarClass(conv.profile.role)}`}>
                    {conv.profile.avatar ? (
                      <img src={conv.profile.avatar} alt={conv.profile.name} />
                    ) : (
                      getInitial(conv.profile.name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-[15px] truncate ${unread ? 'font-bold' : 'font-medium'}
                                    ${isDeleted ? 'text-white/40' : 'text-white'}`}>
                      {conv.profile.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {conv.lastMessage.isSystemMessage && conv.lastMessage.dealId && (
                        <span className="shrink-0 text-infrared/70 [&>svg]:w-3.5 [&>svg]:h-3.5">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                            <polygon points="12,11.5 13.2,14 15.8,14.3 13.9,16.1 14.4,18.7 12,17.4 9.6,18.7 10.1,16.1 8.2,14.3 10.8,14" fill="currentColor" stroke="none"></polygon>
                          </svg>
                        </span>
                      )}
                      <p className={`text-xs truncate ${unread ? 'text-white/80 font-semibold' : 'text-white/50'}
                                     ${isDeleted ? 'text-white/40' : ''}`}>
                        {conv.lastMessage.text}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-white/40 font-tech">{getTimeAgo(conv.lastMessage.createdAt)}</span>
                    {unread && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-infrared text-white text-[10px] font-semibold
                                       flex items-center justify-center shadow-[0_0_8px_rgba(255,51,102,0.5)]">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-sm text-white/40 py-16">{t('messages.noMessages')}</p>
          )
        ) : (
          // Requests Tab
          connectionRequests.length > 0 ? (
            connectionRequests.map(request => (
              <div
                key={request.requestId}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 cursor-pointer
                           transition-colors hover:border-infrared/40 hover:bg-white/[0.06]"
                onClick={() => onOpenChat && onOpenChat(request.profile)}
              >
                <div className="flex items-center gap-3">
                  <div className={`message-avatar shrink-0 ${getAvatarClass(request.profile.role)}`}>
                    {request.profile.avatar ? (
                      <img src={request.profile.avatar} alt={request.profile.name} />
                    ) : (
                      getInitial(request.profile.name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-medium text-white truncate">{request.profile.name}</h3>
                    <p className="text-xs text-white/50 truncate mt-0.5">
                      {request.type === 'REPRESENTATION_REQUEST'
                        ? 'Representation Request'
                        : (request.message || 'Connection request')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    className="btn btn-sm btn-primary flex-1"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (request.type === 'REPRESENTATION_REQUEST') {
                        await apiService.acceptRepresentationRequest(request.requestId);
                      } else {
                        await acceptRequest(request.requestId);
                      }
                      await fetchData(); // Refresh the requests list
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-sm btn-outline flex-1"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (request.type === 'REPRESENTATION_REQUEST') {
                        await apiService.declineRepresentationRequest(request.requestId);
                      } else {
                        await declineRequest(request.requestId);
                      }
                      await fetchData(); // Refresh the requests list
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-white/40 py-16">No pending requests</p>
          )
        )}
      </div>
    </div>
  );
};

export default MessagesScreen;