# TORA App SQL - Project Summary

## Overview
TORA App SQL is the PostgreSQL-compatible React frontend for the TORA platform, a networking application for electronic music industry professionals. It is functionally identical to the MongoDB version (`tora-app`) but connects to `tora-backend-sql` (Prisma + PostgreSQL) instead of the MongoDB backend. All `_id` references have been replaced with `id` to match PostgreSQL/Prisma UUID conventions.

- **Build tool**: Vite 6 (migrated from react-scripts/CRA on April 10, 2026)
- **Backend**: tora-backend-sql on port 5002 (local) / Railway (production)
- **Database**: PostgreSQL via Prisma ORM
- **Entity IDs**: UUIDs (never MongoDB ObjectIds)
- **ID field**: Always `.id` (never `._id`)
- **Production URL**: https://app.torahub.io (also reachable at https://tora-app-five.vercel.app — same Vercel deployment)
- **Realtime**: Supabase Broadcast channels (no Postgres Changes). **RLS is now enabled on every public-schema table** (default-deny for `anon` role) — backend uses `service_role` which bypasses RLS, so the app keeps working unaffected. See `tora-backend-sql/scripts/enable-rls.js`.
- **Production DB**: Supabase Project 2 on **Pro tier** (daily backups, 7-day retention, spend cap ON). PITR not enabled (extra $100+/mo, not justified pre-launch).

## Deployment Topology (as of April 12, 2026)

**Local dev** → `localhost:3002` → `localhost:5002` → Supabase Project 1 (`kujkzoaobkpqnbtpskpo`)
**Production** → `tora-app-five.vercel.app` → Railway (`tora-backend-production.up.railway.app`) → Supabase Project 2 (`jzhrtaivrfegxbvpkfjg`)

Vercel env vars (Production scope):
- `VITE_API_URL` = `https://tora-backend-production.up.railway.app/api`
- `VITE_SUPABASE_URL` = `https://jzhrtaivrfegxbvpkfjg.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = Project 2 anon key

Local `.env` is for local dev only — it points at Project 1. The two stacks are fully isolated (different JWT_SECRETs, different databases). Test users on local don't exist on production and vice versa.

## Recent Updates (May 22-25, 2026)

### Paperclip rework — modal mirrors Share Documents, auto-broadcasts to active deals
The chat paperclip's old categorized library picker (~320 lines) was redundant once Share Documents (booking-card) + Send Contract + Invoice (per-deal) handled the workflow-bound flows. New design:

- **Modal layout** mirrors `ShareDocumentsModal`: one section per category (Press Kit / Tech Rider / Hospitality Rider) showing the artist's library docs, plus a new **Other file** slot for ad-hoc PDF / image uploads (≤10 MB, multipart upload to `chat-attachments/{senderProfileId}/...` via new backend endpoint).
- For agents, the artist-selector stays at the top (multi-artist agents pick which library to draw from).
- **Auto-broadcast to active deals:** sending a categorized doc via paperclip now writes into `deal.sharedDocuments[category]` for every active deal (PENDING / NEGOTIATING / ACCEPTED) between sender and recipient. The booking card reads `sharedDocuments`, so the share appears in the workflow checklist with no extra action from the user. Override via the booking-card Share Documents modal still works (same field).
- **Agent-aware:** when Alessandro (agent) sends on Al Jones's behalf, the deal lookup expands the sender's profile to include all artists they represent — so `artistId = AlJones` deals still match `senderId = Alessandro`. Same expansion on the recipient side.
- **Seed on deal-accept:** newly accepted deals scan the last 200 doc-attachment messages between the parties and pre-fill any unset categories from the most recent share. Catches the "shared in chat before the deal existed" case.
- **Visual unification:** paperclip-sent categorized docs now render with the same green "shared X" card as system-message shares (was rendering with the generic doc-attachment look). The render branch dropped the `isSystem` + `dealId` gates — same JSX serves both flavours.

### Booking card `for {artist}` sub-line
When `deal.bookedArtistId` is set and the viewer isn't the booked artist, the card shows a sub-line `for {bookedArtistName}` below `otherParty.name`. Critical for agents scanning their roster — without it, agents couldn't distinguish bookings since `otherParty.name` showed only the promoter.

### Simplify pass — second wave
- `otherFileInputRef = useRef(null)` replaces `window.__chatOtherFileInput` global mutation (race-on-remount fix).
- `BROADCAST_DOC_CATEGORY_KEYS` exported from `utils/documentCategories.js` (via `broadcast: true` flag per entry). Replaces 4 inline copies of the same `['pressKit','technicalRider','hospitalityRider']` literal in ChatScreen.
- `labelForCategory()` replaces the two inline `{pressKit: 'Press Kit', ...}` label maps in ChatScreen.
- `isBackendFileUrl(doc)` (in `utils/urls.js`) used at the JSX label sites in both Manage screens — earlier simplify pass had caught the handler sites only.

## Recent Updates (May 20-21, 2026)

### Production launch-ready: deal lifecycle shipped, security hardened, infra resilient

End-to-end deal flow validated on `app.torahub.io`: offer → counter → accept → contract sign-and-send → countersign → fully signed → email delivered with signed contract + Certificate of Completion attached. Share Documents (Press Kit / Tech Rider / Hospitality Rider / **Invoice** new) + payment proof + confirm receipt all live.

### Document sharing polish + Invoice category
- New `components/common/ShareDocumentsModal.js` extracted as a shared component (was inline in BookingsScreen). Used by both BookingsScreen and the fully-signed contract card in ChatScreen.
- **Change / Unskip** controls per category — artist can revert a previously shared or skipped entry via new `PUT /api/deals/:dealId/reset-document` backend endpoint (`apiService.resetDocument`). Mirrors the share/skip authorization model.
- **Invoice** is a fourth `DOC_CATEGORIES` entry with `uploadOnly: true`. Unlike the others (picked from the artist's library), invoice is a fresh PDF upload per booking — modal renders an `UploadOnlyPicker` that hits `/api/contracts/upload-document`, then calls `shareDocument` with the resulting URL. Backend share/skip/reset routes accept it via the whitelist in `utils/documentCategories.js`.
- Optimistic local update in `ShareDocumentsModal` propagates `updatedDeal` to parent's `onDealUpdated` so the booking-card status badge updates the instant the user shares/unshares/skips — no `fetchDeals` lag. The `useEffect` that syncs from `deal` prop now keys on `deal?.id` only (not full ref) so optimistic updates don't get clobbered.

### New shared `PdfViewerModal` common component
- `components/common/PdfViewerModal.js` — portals to `document.body` (iOS Safari fix), full-screen via `100dvh`, header with **filename + Download + Open-in-new-tab + Close** icons. Used by BookingsScreen, ChatScreen, ManageProfileScreen, ManageArtistScreen — replaced ~140 lines of duplicated inline modal markup.
- `utils/urls.js#getAuthedBackendUrl` hardened to rewrite **absolute backend URLs with any host** (legacy `localhost`, current `alessandro.local`, prod Railway) onto the current backend base + append `?profileId&token`. External URLs (Supabase signed URLs) unchanged. Makes stored values portable across dev hosts.
- New `isBackendFileUrl(doc)` helper in `urls.js` — used by ManageProfile/ManageArtist `openDocument` to decide between in-app PdfViewer vs new-tab.

### Booking-card UX overhaul
- **CTA reorder** in workflow-actions row: View Contract → Share / Manage Documents → recap pills → Skip Documents → payment chip → Update Payment → Message. All inside one `.workflow-actions` flex-wrap row so the four key CTAs sit visually-consistent.
- **View Contract** button added for both sides when contract is FULLY_SIGNED (was previously hidden after signing — only the sign-state had it). Booker side also sees View Contract + Sign Contract side-by-side during sign-pending state (can preview without committing).
- **Document recap pills** are clickable when `status === 'shared'` — opens the document in `PdfViewerModal`.
- **Payment recap pill removed** — `WorkflowTimeline`'s payment-progress bar has an inline italic **view details** link at the right end of "Remaining: X EUR" that opens the deposit-history modal. Single source for payment review.
- **Status badge palette** bumped from 15% → 55% opacity backgrounds with white text + 85% borders. Reads as fully-coloured chips instead of grey-with-thin-outline.
- **`for {artist}` sub-line** on the booking card whenever `deal.bookedArtistId` is set and the viewer isn't that artist. Critical for agents scanning their roster — without it, agents couldn't distinguish bookings since `otherParty.name` shows the promoter, not the artist.

### Manage section refinements
- `RepresentedArtistsScreen` Manage CTA now shows the pink **action-required dot** (same pattern as ProfileScreen), fetched via `apiService.getActionSummary` per represented artist in a single `Promise.all`.
- Per-row Edit / Delete stacked vertically; the `+ Add` section-header buttons reduced to a borderless white **`+`** glyph (22px, 700 weight). Empty-state `+ Add` buttons trimmed from 14px → 12px.
- `.btn-sm` reduced from 12px → 10px font-size (was actually larger than the base `.btn` at 11px — bug).
- Doc rows show **View file** (in-app PdfViewer for backend uploads) or **Open link ↗** (new tab for external links) instead of raw `/api/contracts/files/...` paths leaking to the UI.
- Editing a doc refreshes its `addedDate` so the "Added DD/MM/YYYY" label reflects the most recent change.
- `AddContractModal` already uploads the file and returns `documentData.url` — `ManageArtistScreen.onSave` now respects that URL on upload-type docs (was previously discarded with `url: null`, leaving uploaded docs unviewable forever).

### Backend changes (May 20-21)
- `PUT /api/deals/:dealId/reset-document` new endpoint — artist-side only, clears a sharedDocuments category entry + system message + broadcast.
- `GET /api/messages/thread/...` embeds the full `deal` on each message via `include: { deal: true }`. Frontend builds `dealStatuses` from the response — eliminates the per-card getDeal round-trip and the visible flicker.
- `GET /api/contracts/files/:storagePath` authorization extended:
  - Now also matches the storagePath against `deal.sharedDocuments[pressKit|technicalRider|hospitalityRider|invoice].documentUrl` so venue/promoter participants can view docs the artist shared into the deal (was 403).
  - Standalone (non-deal) library files now also allow accepted agents of the file's owner to view (Manage Artist screen needs this).
  - Inlined agent-checks replaced with the existing `isAgentForArtist` helper in two places.

### Infra hardening
- **RLS enabled on every public-schema table** in both prod (Project 2) + dev (Project 1). Closed a real anon-readable data leak — verified Supabase auto-exposed `users` table with `email` column to anyone holding the public anon key. Service_role bypasses RLS so backend keeps working with default-deny (no policies).
- New `tora-backend-sql/scripts/enable-rls.js` (idempotent, single batched ALTER TABLE statement). Wired into `npm run migrate:deploy` so future Prisma migrations auto-secure new tables. Also exposed as `npm run db:secure` for manual / one-off runs.
- Supabase Project 2 upgraded to **Pro tier** ($25/mo). Daily backups + 7-day retention confirmed working. Spend cap ON by default — no overage billing.
- `SUPABASE_SERVICE_ROLE_KEY` rotated, propagated to Railway. Payment-proof MIME whitelist applied to prod via `scripts/allow-payment-proof-mimes.js`.

### Code quality (`/simplify` pass, no behaviour change)
- Backend `contracts.js` agent-check inlined twice → replaced with `isAgentForArtist` helper.
- Frontend `BookingsScreen.openContractPdf` rebuilt URL manually → uses `getAuthedBackendUrl`.
- Duplicated `openDocument` helper in both Manage screens → extracted `isBackendFileUrl(doc)` predicate to `urls.js`.
- `enable-rls.js` moved out of build step (wrong concern; slowed Railway deploys) → kept in `migrate:deploy`. Inner per-table check removed since `ALTER TABLE ENABLE RLS` is idempotent at the catalog level; statements batched into one query.
- `BookingsScreen` `pendingDocCategories` was computed twice per card render (Share Documents + Skip Documents blocks) → hoisted once to card-scope.
- `RepresentedArtistsScreen` raw `fetch` for cancel-representation → uses `apiService.cancelRepresentation` (signature changed to object param to support both directions; `SearchAgentsModal` caller updated).
- Two mutually-exclusive Message buttons in BookingsScreen collapsed into one with combined condition.
- Stripped `=== DOCUMENT SAVE DEBUG ===` block (~15 console.logs) + dead `convertCurrency` / `exchangeRates` locals from ManageProfileScreen.

## Recent Updates (May 15-19, 2026)

### Contract sign-and-send flow (replaces old "send then sign" two-step)
The old `apiService.sendContract(...)` flow was replaced with a combined `sendAndSignContract(...)` so the sender pre-signs at delivery time. A second flow `confirmPaymentReceipt(...)` lets the artist side acknowledge incoming payments.

- `SignContractModal.js` now supports both modes (`sign` for recipient, `sign-and-send` for sender) via a `mode` prop. Type tab dropped — the modal renders one signature canvas (`react-signature-canvas`) plus a required Full Legal Name field above. Type-as-signature was redundant since the legal name is the binding identifier.
- View-required gate: the recipient must open the contract PDF at least once before they can sign. `viewConfirmedSignal` is bumped by the PdfViewer's `onLoaded` callback so closing the modal before the PDF actually loads does NOT count. The state persists across the chat-card open + sign-modal open via `deal.contract.viewedBy[]`.
- Per-deal `signerCapacity` (`As Artist` / `As Venue/Promoter` / `As Agent on behalf of {artist}`) is computed by `utils/contractSigner.js#deriveSignerCapacity` and shown in the modal + included in every signature record.
- After both parties sign (FULLY_SIGNED), backend generates a Certificate of Completion PDF + emails the signed contract + certificate to all parties (separately, one email per recipient — venue can't see the artist's email and vice versa).
- Contract card in chat collapses sent/withdrawn/partial-signed/fully-signed into a single card whose icon + text + action buttons change based on `_withdrawn` / `_signedByOne` / `_fullySigned` flags computed in `getFilteredMessages`. No more separate withdrawal cards.

### Documents — consolidated Share + Skip
The four per-type Share/Skip Press Kit / Tech Rider buttons were replaced with a single **Share Documents** + single **Skip Documents** CTA. A unified modal shows three sections (Press Kit, Technical Rider, **Hospitality Rider** — new type). Each section shows status (`shared` / `skipped` / `pending`), the picker for pending categories, and an empty state pointing to **Profile > Manage > Documents**.

- For agent-led deals the picker pulls from `artistProfile.documents.*` (fetched once when the modal opens), not the agent's own library. ManageProfileScreen + ManageArtistScreen both grew a Hospitality Rider category alongside Press Kit / Technical Rider.
- Booking card recap pills show "✓ Press Kit shared · — Tech Rider skipped · · Hospitality Rider pending".
- Sharing/skipping creates per-event chat system messages and routes via `getRecipientId` so agent-led deals reach the agent, not the artist.

### Payment flow — proof, accumulation, confirmation
- `apiService.updatePayment` is now multipart; **proof file required** (PDF or image, ≤10MB). Stored in Supabase Storage under `payment-proofs/{profileId}/...` (same bucket as contracts, separate prefix). Hashed with SHA-256.
- Deposits accumulate: each `Mark Deposit Paid` appends to `deal.payment.depositHistory[]` with its own `{amount, date, proof, paidBy, confirmedAt}`. `depositAmount` is the running sum. Auto-promotes to FULLY_PAID when cumulative deposits reach the fee.
- Custom deposit amount (was hardcoded 50%).
- Each payment proof is auth-gated by `GET /api/deals/:dealId/payment-proof?type=deposit|full&index=N` which proxies the bytes (not redirect) — image tags can't follow cross-origin redirects without breaking.
- Artist side has a **Confirm receipt** flow (`PUT /api/deals/:dealId/confirm-payment-receipt`) per installment + full payment. Step 4 of the WorkflowTimeline ticks ✓ only after confirmation; the progress bar has two layers (dark green = confirmed, light green = marked-but-pending).
- New `payment_to_confirm_received` action item — Manage CTA dots on ProfileScreen (own + per-represented-artist) light up when there's anything to do.
- `Update Payment` button on the venue side is gated to unlock once the artist has signed (`ARTIST_SIGNED` / `VENUE_SIGNED` / `FULLY_SIGNED` / skipped). Pre-launch industry workflow: booker pays deposit once artist commits, then both countersign.

### PdfViewer + image proof viewer
- New `components/common/PdfViewer.js` wraps `react-pdf` with zoom controls, all-pages stacked layout, dark theme.
- Contract opens, payment-proof opens, contract-from-chat opens all go through one of two modals (PDF or image) rendered via `createPortal` to `document.body`. iOS Safari clips position:fixed children when their `.app-container` ancestor has `overflow:hidden + max-width`; portal escapes that. `100dvh` instead of `100vh` so the URL bar doesn't push the close X off-screen.
- Backend Helmet config relaxed to `Cross-Origin-Resource-Policy: cross-origin` so `<img src>` works across dev's port:3002 → port:5002 boundary.

### Other behavioural changes
- Status badge on booking cards now reflects highest **voluntarily-completed** step: `PENDING → NEGOTIATING → ACCEPTED → CONTRACT SIGNED → DOCS SHARED → COMPLETED`. Skipping a step does NOT promote the label (skip is not "done"), but the action UI advances regardless.
- "Via {agent} · Agent" sub-line on the booker's card now requires `deal.bookedArtistId` set — was incorrectly showing on direct bookings whenever the artist had any agent on file.
- Artist side never sees "Sign Contract" — they only send. Side-based gate replaced fragile per-signature `signedBy === currentUser.id` matching that broke across profile switches.
- 429 from `/auth/me` no longer logs the user out — only 401/403 clears the token. Dev rate limit raised 100 → 600 req/min; prod stays at 100.
- Notifications now route to the relevant tab (bookings vs messages) when clicked. Manage CTAs show a pink dot when actions are pending for that profile.
- Email pipeline: separate sends per recipient (no shared To-list — keeps the parties from emailing each other off-platform). TORA-branded HTML matching the application-received family, signed contract + Certificate of Completion both attached, links to `app.torahub.io`.

### Simplify pass (cleanup, no behaviour change)
- New shared utils: `src/utils/documentCategories.js`, `src/utils/paymentSummary.js`, `src/utils/urls.js`, `src/utils/contractSigner.js`. Backend mirror at `tora-backend-sql/src/utils/documentCategories.js`. Replaced ~6 inline string-array duplicates, 3 copies of payment math, and 2 copies of the URL builder.
- `summarizeDealPayment(deal)` is now the single source for marked vs confirmed totals — previously WorkflowTimeline, BookingsScreen recap pill, and the deposit-history modal each had their own copy and drifted.
- `isArtistSide` extracted in backend (`utils/dealParticipants.js`) — collapsed 5 inline copies in `routes/deals.js`.
- `contractStorage._uploadToBucket` shared by `uploadContract` and `uploadPaymentProof`.
- WorkflowTimeline derivations wrapped in `useMemo` keyed on the deal (avoids re-running reduces per Bookings card on every parent render).
- ProfileScreen action-flags fetch now runs self + all represented artists in a single `Promise.all` (was sequential).
- 41/41 backend tests still pass after the refactor.

## Recent Updates (May 13-14, 2026)

### Agent ↔ artist deal dynamics — conceptual model
End-to-end deal lifecycle testing surfaced that the system was treating the artist and their agent as two independent counter-parties. Refined to a coherent model:

- **Agent-led vs artist-direct deals.** Signal is `deal.bookedArtistId`. When set, the booker routed the offer through the agent flow → agent is the negotiation lead. When `null`, the offer went directly to the artist → agent has no authority.
- **Same side.** Artist + their accepted agents are a single side. An agent countering on behalf of the artist is treated as an outgoing action — the artist (and the agent-viewing-the-artist) do NOT see a pending response card; only the booker side does.
- **Counter card title credits the actual offerer.** Reads `offerHistory[last].offeredBy` and resolves to: artist name, booker name, or `"{agent name} ({artist name}'s agent)"` for agent-side offerers. Backend batch-fetches offerer profiles only when needed.
- **Booker view shows via-agent context.** `BookingsScreen` renders a sub-line under the artist name (`via Alessandro · Agent`) when the artist has an accepted agent. The booker's Message button + Review CTA now route to the agent profile when the agent is leading; the booker keeps all workflow buttons.
- **Agent visibility-only on artist-direct deals.** When `bookedArtistId` is null and an agent views one of their represented artist's deals, `BookingsScreen` shows the card with a `via {Artist} · Artist-direct` sub-line, all workflow buttons hidden — visibility without intervention.

### Two flag refactor in BookingsScreen
The conflated `isViaAgent` was split:
- `isViaAgent` — show the via sub-line on the card. Both artist viewer (agent-led deal) and booker viewer (artist has an agent) see it.
- `delegateToAgent` — artist viewer whose deal is agent-led; their agent handles workflow buttons.
- `agentReadOnly` — agent viewer of an artist-direct deal; visibility only.
- `hideWorkflow = delegateToAgent || agentReadOnly` — composite gate for buttons.

### CTA double-click guards (sweep #2)
Added `actionBusy` / per-screen busy flags + `disabled={busy}` across roughly 20 CTAs that fire async API calls. The pattern is identical everywhere: handler early-returns if busy, try/finally to reset, button shows `...` placeholder while in flight. Files touched:
- `ChatScreen.js` — handleSubmitReview, handleAcceptOffer, handleDeclineOffer, handleAcceptCounterOffer, handleDeclineCounterOffer, handleAcceptRepresentation, handleDeclineRepresentation, handleSend (regular text)
- `BookingsScreen.js` — handleAcceptDeal, handleDeclineDeal, handleDeleteDeal, handleWithdrawContract + 7 inline async onClick CTAs (skip/sign contract, send/share document picker, deposit/full payment, AddContractModal onSave)
- `TourScreen.js` — handleCreateTour, handleUpdateTour
- `ViewProfileScreen.js` — handleConnectionChoice, handleSendMessage, handleRemoveConnection

### Bugs found via testing and fixed
- `cancel-representation` returned 400 because `findFirst({where: {userId}})` picked any of the user's profiles; multi-profile users got a non-AGENT row. Now accepts `currentProfileId` in the request body.
- `SearchArtistsModal` had `key={Date.now()}` on the parent which remounted the modal on every render, wiping the search input. Removed the key.
- `ManageArtistScreen` read `artist.id` from a representingArtists cache entry that uses `artist.profileId`; the useEffect early-returned and Actions Required was empty.
- Connection accept/decline endpoints (4 of them) didn't verify the caller was the recipient — any authenticated user could mutate any pending request. Now checks `toProfileId → userId === req.userId`.
- ChatScreen rep-request modal showed Accept/Decline to the sender too; now shows "Awaiting response from X" instead.
- Counter-offer Send button had no disabled state; double-click sent two API calls and produced two duplicate cards. Plus a one-off duplicate was trimmed in prod via a direct DB delete.
- `scripts/reset-representation.js` added for clearing rep request state between test runs (dry-run + real, direction-agnostic).
- `representedBy` cleaned up in delete-user / cancel-representation cascade.
- BookingsScreen "Extras:" section rendered twice after a counter offer (counter writes to `additionalTerms` but the original `deal.extras` was never updated). Now resolves a single `latestExtras` (additionalTerms when parseable JSON, else deal.extras).
- Empty `contract = {}` (fresh ACCEPTED state) was making BookingsScreen show "Sign Contract" because `undefined !== 'NOT_SENT'`. Both blocks now treat `!contract.status` the same as `NOT_SENT`.
- Skip Contract CTA was missing from the chat-thread offer footer (it existed in BookingsScreen). Added.

### Brand framing — electronic → club
The site copy was previously "electronic music industry"; replaced with "club music industry" across hero copy, terms (EN + JP), metadata title/description, and stub bio. See tora-application CLAUDE.md for the marketing-site surface.

### Supreme font, selective
Pangram Pangram Supreme self-hosted via `next/font/local`. Used on a small set of marketing elements (home tagline, Apply CTAs, subpage subtitles). Detail in tora-application CLAUDE.md. Frontend-only repo unaffected.

## Recent Updates (May 10-12, 2026)

### Phase 4b — Actions Required cards wired
- ManageProfileScreen (used by all 4 roles for their own profile) and ManageArtistScreen (agent-per-artist) previously rendered three hardcoded placeholder rows. Both now fetch `GET /api/profiles/:id/action-summary` on mount and render real items.
- New `apiService.getActionSummary(profileId, { artistProfileId })` — optional `artistProfileId` scopes to a represented artist; backend rejects without an accepted REPRESENTATION_REQUEST between the two profiles.
- Six action types live: `offer_received` (incl. tour proposals via the auto-Deal at `tora-backend-sql/src/routes/tours.js:672`), `counter_offer_pending`, `contract_to_send`, `contract_to_sign`, `payment_to_mark_sent`, `representation_request_received`. `payment_to_confirm_received` was scoped but deferred until a receipt-confirmation endpoint + matching button exist (separate small PR).
- New `src/utils/actionItems.js` exports `ACTION_ICONS` map + `getActionIcon(type)` + `handleActionTarget(target, deps)`. Both Manage screens use it. Fixed a copy-paste bug where `ManageArtistScreen` had a local switch missing `offer_received` and `counter_offer_pending`.
- New `onSwitchTab` prop chain: App.js → ProfileScreen → Manage*. Action button clicks call `setActiveTab('bookings')` or `setActiveTab('messages')` then close the modal.

### ChatScreen rep-request modal — sender view fix
- Modal in `ChatScreen.js:~2125` used to show Accept/Decline whenever the request status was PENDING, regardless of whether the viewer was the recipient or the sender. Now only the recipient sees the buttons; the sender sees "Awaiting response from {name}". The underlying security gap is closed on the backend (see tora-backend-sql CLAUDE.md).
- Bug found via the user's own testing of the production rep request flow. Backend was never verifying caller identity on accept/decline — any authenticated user holding a Connection id could mutate any pending request. Pre-launch this needed to land.

### `/simplify` pass (post-Phase-4b)
- Both Manage screens had near-duplicate icon-mapping logic; consolidated into `src/utils/actionItems.js`.
- `onSwitchTab` now defaults to a no-op so the defensive `&&` guards in the click handler are no longer needed.

### Brand framing — electronic → club music
- `src/services/raService.js` stub bio updated. Marketing site has the bigger surface area for this change — see tora-application CLAUDE.md.

## Recent Updates (May 9, 2026)

### LoginScreen accessibility
- Added `aria-label` and `autoComplete` attributes to email + password inputs in `src/components/screens/LoginScreen.js`. Lighthouse a11y was flagging "Form elements do not have associated labels" because the inputs only had a `placeholder`. `aria-label` keeps the placeholder-only visual look (no visible label added). `autoComplete="email"` and `autoComplete="current-password"` help password managers and is a Lighthouse best-practice item.
- After deploy, mobile a11y went 89 → 93. SignupScreen has the same issue on its inputs but isn't reachable from the public entry, so Lighthouse doesn't score it — fix later for consistency.

### Lighthouse measurement note
- Single-run PageSpeed scores are noisy: same code, two consecutive runs, desktop perf swung 70 → 99 (±29). The measurement is TBT-bound and TBT is highly sensitive to lab CPU contention. Treat single runs as directional only — for a real baseline, run 3-5 times and take the median, or use Lighthouse CI.

### Sentry error monitoring (EU region)
- `@sentry/react` initialized in `src/index.js`. `<Sentry.ErrorBoundary>` wraps the LanguageProvider so any unhandled render error shows a friendly fallback instead of a blank screen.
- Reads `VITE_SENTRY_DSN` (Vite inlines it into the client bundle — Sentry DSNs are public-by-design)
- No-op when DSN unset (local dev). Production DSN set in Vercel `tora-app` project.

### Content Security Policy + security headers (via vercel.json)
- Added `headers` block to `vercel.json` setting CSP + X-Frame-Options DENY + X-Content-Type-Options + Referrer-Policy + Permissions-Policy
- CSP includes Supabase REST + WSS (Realtime), Sentry direct ingestion (`*.ingest.de.sentry.io`), Railway backend, embedded widgets (SoundCloud, Spotify, DocuSign)
- `img-src` permissive (`https:`) because user profile pictures could come from many sources

### Favicon
- New `public/tora_logo_square.png` — TORA wordmark in a 1015×1015 black square (centered, with black padding above/below) so the favicon doesn't get squeezed in browser tabs
- `index.html` updated to use the square version for both `rel="icon"` and `apple-touch-icon`

### Vercel + GitHub housekeeping
- Old Vercel project `tora-app-visibility` deleted (was duplicate of the active `tora-app` project, deploying old commits)
- GitHub repo renamed `tora-appVisibility` → `tora-app`. Local git remote updated. Vercel auto-detected the rename via stable internal repo ID. No code changes needed.

## Recent Updates (May 8, 2026)

### Marketing Consent UI
- **SignupScreen.js** — added optional marketing consent checkbox on Step 1 (visible to invitation-code signups too). Text: *"Send me product updates and tips for getting the most out of TORA (recommended — you can unsubscribe anytime)"*. Unchecked by default (GDPR opt-in). Plus a click-through Terms reaffirmation notice above the submit button (covers version drift between application stage and signup stage).
- **App.js Settings** — new "Email Preferences" section. Two rows: a controlled toggle for product updates (calls `apiService.updateUserPreferences({ marketingConsent })`), and a locked, always-on transactional emails toggle (visually identical white text but `disabled readOnly`, signals required-for-service).
- **Optimistic update pattern** with revert-on-error mirrors the existing `handleCurrencyChange` handler.
- **Backend support**: requires `User.marketingConsent` + `User.marketingConsentDate` on schema (shipped to both Supabase projects). Backend signup + `/me` + `/update-preferences` endpoints all handle the field.

### Login Page Overhaul
- Single "Don't have an account? Sign Up" CTA replaced with two distinct paths:
  - "Have an invitation? **Activate your account**" (primary, pink) — opens existing signup screen
  - "New to TORA? **Apply for membership**" (secondary, gray) — opens apply page in new tab
- Apply URL reads `VITE_APPLY_URL` env var with fallback `https://torahub.io/apply`. In dev: `http://alessandro.local:3000/apply`.
- SignupScreen heading: `Create Account` → `Activate Your Account` (matches the new CTA copy and signals invitation-only).
- SignupScreen footer: `Already have an account?` → `Already a member?` (member-language consistency).
- Removed the leftover demo credentials box (`demo@tora.com` / `demo123`) — never wired to a real user, just decorative copy.

### Vite Config: mDNS hostname support
- Added `allowedHosts: ['localhost', '.local']` to `vite.config.js` so requests to `alessandro.local:3002` are accepted (was returning 403 by default). Required because dev `.env` now uses `alessandro.local` instead of LAN IP for stability across WiFi networks.

## Recent Updates (May 6, 2026)

### Phase 0 Cleanup
- `.env.production` removed from git tracking (was containing only public URL — safe but messy). Added to `.gitignore`.
- Legacy MongoDB working directories archived to `~/Desktop/ARCHIVE/` (`tora-backend`, `tora-app`).

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
