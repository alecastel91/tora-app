# TORA App SQL - Project Summary

## Overview
TORA App SQL is the PostgreSQL-compatible React frontend for the TORA platform, a networking application for electronic music industry professionals. It is functionally identical to the MongoDB version (`tora-app`) but connects to `tora-backend-sql` (Prisma + PostgreSQL) instead of the MongoDB backend. All `_id` references have been replaced with `id` to match PostgreSQL/Prisma UUID conventions.

- **Build tool**: Vite 6 (migrated from react-scripts/CRA on April 10, 2026)
- **Backend**: tora-backend-sql on port 5002 (local) / Railway (production)
- **Database**: PostgreSQL via Prisma ORM
- **Entity IDs**: UUIDs (never MongoDB ObjectIds)
- **ID field**: Always `.id` (never `._id`)
- **Production URL**: https://tora-app-five.vercel.app (will move to `app.torahub.io`)
- **Realtime**: Supabase Broadcast channels (no Postgres Changes / no RLS setup)

## Deployment Topology (as of April 12, 2026)

**Local dev** → `localhost:3002` → `localhost:5002` → Supabase Project 1 (`kujkzoaobkpqnbtpskpo`)
**Production** → `tora-app-five.vercel.app` → Railway (`tora-backend-production.up.railway.app`) → Supabase Project 2 (`jzhrtaivrfegxbvpkfjg`)

Vercel env vars (Production scope):
- `VITE_API_URL` = `https://tora-backend-production.up.railway.app/api`
- `VITE_SUPABASE_URL` = `https://jzhrtaivrfegxbvpkfjg.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = Project 2 anon key

Local `.env` is for local dev only — it points at Project 1. The two stacks are fully isolated (different JWT_SECRETs, different databases). Test users on local don't exist on production and vice versa.

## Recent Updates (May 2, 2026)

### Per-Profile Subscription Model (Frontend)
- Subscription tier and usage stats now read from active profile (`user`) instead of account (`accountUser`)
- **App.js**: Settings displays `user.subscriptionTier`, `user.likesSentToday`, `user.connectionsSentThisMonth`
- **AppContext.js**: `accountSubscriptionTier` syncs from active profile on profile switch
- **Header.js**: Premium badge reads `user.subscriptionTier`
- **SearchScreen.js**: Passes `activeProfileId` to search API; tier check from `user`
- **TourScreen.js, MatchesScreen.js**: Premium gates read from `user.subscriptionTier`
- **ProfileScreen.js**: Trial countdown reads from `user.trialEndDate`
- Switching profiles updates subscription UI immediately

## Recent Updates (April 11-12, 2026)

### Database Split Validated End-to-End
- Pushed Prisma schema to Project 2 (was empty) — all 11 tables created
- Created test invitation `TORA-TEST-001` in Project 2 for smoke testing
- Both Vercel surfaces validated:
  - Landing page form → Project 2 `waitlist` table ✅
  - Main app signup with invitation → Project 2 `users` + `profiles` ✅
- Documentation header comments added to local `.env` files clarifying which project each environment uses

### Realtime Subscriptions (Supabase Broadcast)
- New `src/services/realtime.js` with `subscribeToChat(profileA, profileB, callback)` and `subscribeToInbox(profileId, callback)` helpers
- Channel names sorted by profile ID so both participants subscribe to the same channel
- ChatScreen subscribes to chat thread channel — refetches messages on broadcast
- MessagesScreen subscribes to inbox channel — refetches conversation list on broadcast
- Polling fallback removed
- See `tora-backend-sql/src/services/realtime.js` for the broadcaster side

### Counter Offer + Decline Card Rendering
- ChatScreen `getFilteredMessages` no longer collapses counter-offer messages — they render as separate cards alongside the original offer
- Decline messages render as separate cards (red X icon, "View Reason" button)
- Original offer card always shows "sent an offer" regardless of deal status — declined/accepted state is shown on a SEPARATE card
- `handleViewOffer` shows the ORIGINAL offer values (from `offerHistory[0]`) when the deal has been countered, with `isHistoricalView` flag that hides action buttons
- `handleReviewCounterOffer` now fetches the full deal first so `handleSubmitReview` has `selectedOffer.id` available

### Connection Request Flow
- Message is now mandatory (frontend alert + backend validation)
- Original request message survives accept and appears as the first chat message in the new conversation

### UI Polish (won't carry over to Tailwind, but tracked here for completeness)
- Date/time inputs: custom calendar/clock SVG icons, `color-scheme: dark`, `-webkit-min-logical-width: 0` to fix iOS intrinsic-width overflow
- `min-width: 0` on `.form-row .form-group` so flex children can shrink
- Make Offer modal converted to full-screen
- Offer card name truncates with ellipsis, View Details button stays anchored
- Disable wheel scroll on fee number inputs

## Recent Updates (April 10, 2026)
- **Subscription tier fix**: Header, TourScreen, MatchesScreen now read from accountUser (User model) not profile
- **AppContext fix**: Calendar matching and location filtering use accountSubscriptionTier (set from App.js)
- **Removed isPremium references**: Replaced with proper subscriptionTier checks everywhere
- **accountUser prop**: Passed to Header, TourScreen, SearchScreen, ProfileScreen

## Recent Updates (April 8, 2026)
- **Settings screen**: Shows firstName, lastName, phone, email from User (accountUser)
- **Subscription/usage stats**: Read from accountUser (User table), not profile
- **LinkedIn field**: Only shows in Edit Profile for AGENT role
- **RA link construction**: Uses convertToRASlug logic matching admin dashboard (handles "DNG (1)" → "dng-1")
- **Edit Profile RA placeholder**: Changed to "RA artist name"

## Recent Updates (April 7, 2026)
- **Multi-agent support**: `representedBy` is now an array — all screens handle multiple agents
- **Signup with invitation code**: Skips Step 2 (profile setup) when code is valid — profile already pre-created
- **Find Agent / Find Artist**: Converted to full-screen layout, search-only (no auto-loading all users)
- **Heart icon**: Fills pink (#FF3366) when liked
- **Remove artist from agent roster**: ✕ button on Represented Artists cards
- **Via agent bookings**: Only shown when `bookedArtistId` is set (direct bookings have full CTAs)
- **Extras display**: additionalTerms parsed as JSON and rendered as tagged items
- **SearchArtistsModal**: Fixed `roles` param (was `role`), response extraction

## Recent Updates (April 5, 2026)
- **Via agent bookings**: Artist sees "via agent" badge and no CTAs for agent-managed deals; direct bookings have full CTAs
- **Find Agent CTA**: Always shows "Find Agent" (not "Message Agent"); Message button available inside the modal for connected agents
- **Counter-offer accept**: Fixed in BookingsScreen and ChatScreen — checks last offerer, supports NEGOTIATING status
- **Additional Terms display**: JSON strings parsed and rendered as nice tagged extras (same as Extras field)
- **Genres list**: Removed "Acid", added "Pop" — matches application landing page (36 genres)
- **Agent artist filter**: Dropdown in Bookings screen for agents to filter by represented artist

## Migration Changes (April 3, 2026)

### MongoDB to PostgreSQL Frontend Migration
- All 294 `_id` references replaced with `id` across 18+ files
- API service endpoints unchanged (same routes, backend handles the DB difference)
- Mock data removed from ManageArtistScreen (shows zeros until real data populated)
- Counter-offer accept logic fixed in BookingsScreen and ChatScreen
- No UI/UX changes -- visually identical to the MongoDB frontend

## Project Structure
```
tora-app-sql/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── AddContractModal.js      # Contract creation modal
│   │   │   ├── Button.js               # Reusable button component
│   │   │   ├── Calendar.js             # Travel schedule & availability calendar
│   │   │   ├── Card.js                 # Reusable card component
│   │   │   ├── ConnectionChoiceModal.js # Connection request dialog
│   │   │   ├── ContractViewer.js       # Contract document viewer
│   │   │   ├── Header.js              # App header with notifications, premium & settings
│   │   │   ├── InteractiveMap.js       # Map component
│   │   │   ├── IntroSplash.js          # Intro animation screen
│   │   │   ├── MakeOfferModal.js       # Deal/offer creation modal
│   │   │   ├── Modal.js               # Reusable modal component
│   │   │   ├── NotificationDropdown.js # Notification display
│   │   │   ├── RAEventsModal.js        # Resident Advisor events display
│   │   │   ├── SearchAgentsModal.js    # Find Agent full-screen
│   │   │   ├── SearchArtistsModal.js   # Artist search modal
│   │   │   ├── SignContractModal.js    # Contract signing workflow
│   │   │   ├── TabBar.js              # Bottom navigation (5 tabs)
│   │   │   └── WorkflowTimeline.js    # Deal/booking workflow steps
│   │   └── screens/
│   │       ├── AddProfileScreen.js     # Create new profile
│   │       ├── BookingsScreen.js       # Deals & bookings management
│   │       ├── CalendarScreen.js       # Full-page calendar with travel schedules
│   │       ├── ChatScreen.js           # Individual chat conversations
│   │       ├── EditProfileScreen.js    # Full-page profile editing
│   │       ├── ExploreScreen.js        # Swipeable cards (Tinder-style)
│   │       ├── LoginScreen.js          # User login
│   │       ├── ManageArtistScreen.js   # Artist management hub
│   │       ├── ManageProfileScreen.js  # Profile management
│   │       ├── MatchesScreen.js        # Calendar-based matching with filters
│   │       ├── MessagesScreen.js       # Split Messages/Requests tabs
│   │       ├── ProfileScreen.js        # User profile with embeds & switching
│   │       ├── RepresentedArtistsScreen.js # Agent artist management
│   │       ├── SearchScreen.js         # Search with filters & profiles
│   │       ├── SignupScreen.js         # User registration
│   │       ├── TourScreen.js           # Tour planning & management
│   │       └── ViewProfileScreen.js    # Full-page profile viewing
│   ├── contexts/
│   │   ├── AppContext.js              # Global state (likes, requests, connections)
│   │   └── LanguageContext.js         # Translation system (EN/JA)
│   ├── data/
│   │   └── profiles.js               # Sample/reference data
│   ├── hooks/                         # Custom React hooks
│   ├── navigation/                    # Navigation utilities
│   ├── services/
│   │   ├── api.js                     # API service (all backend communication)
│   │   ├── contractService.js         # Contract-specific API logic
│   │   ├── mockData.js                # Mock data for development
│   │   └── raService.js               # Resident Advisor API service
│   ├── styles/
│   │   ├── App.css                    # Main styles
│   │   ├── index.css                  # Base styles
│   │   ├── responsive.css             # Responsive breakpoints
│   │   └── variables.css              # CSS custom properties
│   ├── translations/
│   │   ├── en.js                      # English translations
│   │   └── ja.js                      # Japanese translations
│   ├── utils/
│   │   └── icons.js                   # SVG icon components
│   ├── App.js                         # Main app component
│   └── index.js                       # App entry point
├── public/
│   └── index.html
├── CLAUDE.md                          # This file
└── package.json
```

## Running the App

```bash
# Install dependencies
npm install

# Start development server (defaults to port 3002)
npm start

# With explicit API URL (e.g., on local network)
REACT_APP_API_URL=http://192.168.2.101:5002/api PORT=3002 npm start

# Build for production
npm run build
```

## Port Configuration

| Component | MongoDB Stack | PostgreSQL Stack |
|-----------|--------------|-----------------|
| Frontend  | 3001         | 3002            |
| Backend   | 5001         | 5002            |

## Key Features

1. **Multi-Profile System** - Users can have multiple profiles (Artist, Agent, Promoter, Venue) and switch between them
2. **Search & Discovery** - Name search with role/zone/country/city/genre filters; location-restricted for FREE tier
3. **Calendar & Travel Scheduling** - Available dates (green), travel schedules with zone/country/city, role-based display
4. **Bookings & Deals** - Full booking workflow: proposal, negotiation, counter-offers, contracts, payments
5. **Tour Management** - Tour creation, tour proposals from promoters/venues, multi-stop planning
6. **Messaging** - Split Messages/Requests tabs, chat with date separators, document sharing
7. **Explore (Swipe)** - Tinder-style card swiping with keyboard, touch, and mouse support
8. **Calendar Matching** - Find professionals with overlapping availability by role and genre
9. **Agent Management** - Represented artists roster, manage schedules/finances/contracts per artist
10. **Premium Subscription** - Feature comparison table, subscription flow with payment processing
11. **Translation** - English and Japanese with persistent language preference
12. **Currency Support** - Multi-currency display with exchange rate conversion

## API Service Endpoints

The `api.js` service class organizes endpoints into these groups:

### Auth (6 methods)
- `signup`, `login`, `logout`, `getCurrentUser`, `changePassword`, `updateUserPreferences`

### Profiles (6 methods)
- `searchProfiles`, `getProfile`, `updateProfile`, `createProfile`, `deleteProfile`, `getProfileAvatar`

### Connections (12 methods)
- `toggleLike`, `sendConnectionRequest`, `acceptConnectionRequest`, `declineConnectionRequest`, `removeConnection`
- `getLikedProfiles`, `getConnectedProfiles`, `getSentRequests`, `getReceivedRequests`, `getLikers`
- `getProfileData` (optimized batch fetch), `getNotifications`, `clearNotifications`

### Representation (5 methods)
- `sendRepresentationRequest`, `acceptRepresentationRequest`, `declineRepresentationRequest`
- `cancelRepresentation`, `getConnectionRequest`

### Messages (4 methods)
- `getConversations`, `getMessageThread`, `sendMessage`, `sendDocumentMessage`

### Deals / Bookings (8 methods)
- `createDeal`, `getDeals`, `getDealsForTour`, `getDeal`
- `acceptDeal`, `declineDeal`, `counterDeal`, `deleteDeal`

### Booking Workflow (5 methods)
- `sendContract`, `signContract`, `skipContract`, `withdrawContract`, `shareDocument`, `updatePayment`

### Currency (3 methods)
- `getCurrentRates`, `convertCurrency`, `updateExchangeRates`

### Tours (4 methods)
- `createTour`, `getTours`, `getMyTours`, `updateTour`

### Tour Proposals (3 methods)
- `createTourProposal`, `getTourProposals`, `acceptTourProposal`, `declineTourProposal`

### Utility (1 method)
- `resolveUrl`

## State Management

### AppContext
```javascript
{
  user: null,                        // Current active profile (from backend)
  userProfiles: [],                  // All profiles for the logged-in user
  likedProfiles: Set(),              // Liked profile UUIDs
  likedProfilesData: [],             // Full profile objects for liked profiles
  sentRequests: Set(),               // Connection request UUIDs I sent
  receivedRequests: Set(),           // Connection request UUIDs I received
  connectedUsers: Set(),             // Connected profile UUIDs
  connectedUsersData: [],            // Full profile objects for connections
  likerProfilesData: [],             // Profiles that liked the current user
  preferredCurrency: 'USD',          // Account-level currency preference
}
```

### LanguageContext
- Current language state (EN/JA)
- Translation function `t(key)`
- Language change handler

## Dependencies
- React 18, React Router DOM 6, Framer Motion, Styled Components
- Dev: TypeScript, Tailwind CSS, PostCSS, Autoprefixer

## Design Specifications
- **Background**: #0a0a0a (dark black)
- **Primary accent**: #FF3366 (pink)
- **Cards**: #1a1a1a
- **Borders**: #2a2a2a
- **Typography**: Rajdhani (headers), Inter (body)
- **Layout**: Mobile-first, bottom tab navigation (5 tabs), top header

## Important Notes
- All profile/entity IDs are UUIDs (not MongoDB ObjectIds)
- Uses `.id` everywhere (never `._id`)
- Multi-profile support: users can have multiple profiles with different roles
- Subscription tiers: FREE, TRIAL (48h), MONTHLY, YEARLY
- FREE tier: city-only search, 2 likes/day, 3 connections/month
- TRIAL tier: global search preview, same usage limits as FREE
- MONTHLY: global search, 5 likes/day, 10 connections/month
- YEARLY: unlimited likes/connections + exclusive features
- Backend handles subscription enforcement; frontend shows appropriate UI gates
- The API service defaults to `/api` (proxy) or uses `REACT_APP_API_URL` env var
