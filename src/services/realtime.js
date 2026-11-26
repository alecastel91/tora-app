import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { params: { eventsPerSecond: 10 } } }
);

// One channel per topic, shared by every screen listening to it. supabase-js
// hands back the SAME channel object for a topic, so a screen that removed
// "its" channel on unmount used to cut the updates off for every other
// screen still open on that topic (Bookings went stale after leaving the
// Dashboard; the inbox badge after leaving Messages). Listeners are counted
// here and the channel closes only when the last one leaves.
const topics = new Map(); // topic -> { channel, handlers: Map<event, Set<fn>> }

function listen(topic, event, handler) {
  let entry = topics.get(topic);
  if (!entry) {
    entry = { channel: supabase.channel(topic), handlers: new Map(), events: new Set() };
    topics.set(topic, entry);
  }
  clearTimeout(entry.closeTimer);
  if (!entry.handlers.has(event)) entry.handlers.set(event, new Set());
  entry.handlers.get(event).add(handler);
  if (!entry.events.has(event)) {
    entry.events.add(event);
    entry.channel.on('broadcast', { event }, (msg) => {
      for (const fn of entry.handlers.get(event) || []) fn(msg.payload);
    });
  }
  entry.channel.subscribe();

  return () => {
    entry.handlers.get(event)?.delete(handler);
    const left = [...entry.handlers.values()].reduce((n, set) => n + set.size, 0);
    // Closed a moment later, so a screen that remounts straight away (tab
    // switch, StrictMode) keeps the live channel instead of a closing one.
    if (left === 0) {
      clearTimeout(entry.closeTimer);
      entry.closeTimer = setTimeout(() => {
        const stillEmpty = [...entry.handlers.values()].every((set) => set.size === 0);
        if (stillEmpty && topics.get(topic) === entry) {
          topics.delete(topic);
          supabase.removeChannel(entry.channel);
        }
      }, 3000);
    }
  };
}

// Channel name for a one-on-one chat thread.
// Profile IDs are sorted so both participants subscribe to the same channel.
export const chatChannelName = (profileIdA, profileIdB) => {
  const [a, b] = [profileIdA, profileIdB].sort();
  return `chat:${a}:${b}`;
};

// Channel name for a profile's inbox (conversation list, requests).
export const inboxChannelName = (profileId) => `inbox:${profileId}`;

// Subscribe to new-message events on a chat thread.
// Returns a cleanup function.
export const subscribeToChat = (profileIdA, profileIdB, onNewMessage) =>
  listen(chatChannelName(profileIdA, profileIdB), 'new_message', onNewMessage);

// Subscribe to inbox-level events for a profile (new conversation, accepted request, etc.).
export const subscribeToInbox = (profileId, onUpdate) =>
  listen(inboxChannelName(profileId), 'inbox_update', onUpdate);

// Channel name for a profile's bookings stream (deal mutations).
// Must match backend dealsChannelName.
export const dealsChannelName = (profileId) => `deals:${profileId}`;

// Subscribe to deal-mutation events for a profile. Backend broadcasts here
// from every deal-mutating endpoint, so BookingsScreen can re-fetch
// instead of relying on manual refresh.
export const subscribeToDeals = (profileId, onDealUpdate) =>
  listen(dealsChannelName(profileId), 'deal_update', onDealUpdate);

// Tours are browsed, not addressed, so there is no per-profile channel:
// one `tours` channel carries state changes that other people's open screens
// need to reflect (right now, whether a tour still takes offers). Must match
// the backend's TOURS_CHANNEL.
export const TOURS_CHANNEL = 'tours';

export const subscribeToTours = (onTourUpdate) => listen(TOURS_CHANNEL, 'tour_update', onTourUpdate);

export default supabase;
