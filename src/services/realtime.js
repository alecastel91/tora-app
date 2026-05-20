import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { params: { eventsPerSecond: 10 } } }
);

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
export const subscribeToChat = (profileIdA, profileIdB, onNewMessage) => {
  const channel = supabase
    .channel(chatChannelName(profileIdA, profileIdB))
    .on('broadcast', { event: 'new_message' }, (payload) => {
      onNewMessage(payload.payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Subscribe to inbox-level events for a profile (new conversation, accepted request, etc.).
export const subscribeToInbox = (profileId, onUpdate) => {
  const channel = supabase
    .channel(inboxChannelName(profileId))
    .on('broadcast', { event: 'inbox_update' }, (payload) => {
      onUpdate(payload.payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Channel name for a profile's bookings stream (deal mutations).
// Must match backend dealsChannelName.
export const dealsChannelName = (profileId) => `deals:${profileId}`;

// Subscribe to deal-mutation events for a profile. Backend broadcasts here
// from every deal-mutating endpoint, so BookingsScreen can re-fetch
// instead of relying on manual refresh.
export const subscribeToDeals = (profileId, onDealUpdate) => {
  const channel = supabase
    .channel(dealsChannelName(profileId))
    .on('broadcast', { event: 'deal_update' }, (payload) => {
      onDealUpdate(payload.payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export default supabase;
