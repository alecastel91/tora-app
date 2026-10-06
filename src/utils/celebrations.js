/**
 * Celebrations: what we mark, and how we notice.
 *
 * The rule: celebrate completions the member CAUSED, never arrivals. An offer
 * landing in your inbox is an inbox event — the bell and the Bookings dot are
 * the right weight for it. Celebrating incoming things teaches people to
 * ignore the animation, and then the moments that should feel rare don't.
 *
 * Two ways a celebration starts:
 *
 *  1. A badge became earned. Badges are DERIVED server-side (no stored
 *     "earned at"), so there is no event to listen for — we notice by diffing
 *     the computed set against a small per-profile record of what this device
 *     has already shown.
 *
 *  2. One of three action moments fired, raised at the action site.
 *
 * Both render through the same overlay, so the app has one celebration, not a
 * collection of effects.
 */

/**
 * "Has this device already shown X?" — the one mechanism both detectors use.
 *
 * Returns null when nothing was ever recorded, which is what distinguishes a
 * genuinely new member from one whose history predates this feature. Writes
 * MERGE rather than replace: the deals list is paginated, so a milestone that
 * scrolls off the newest page must not be forgotten and celebrated again.
 */
const seenStore = (key) => ({
  read() {
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw)) : null;
    } catch {
      return null;   // private mode — treat as "never recorded"
    }
  },
  merge(previous, ids) {
    try {
      localStorage.setItem(key, JSON.stringify([...new Set([...(previous || []), ...ids])]));
    } catch {
      /* quota / private mode — a celebration is not worth breaking a screen for */
    }
  },
});

/**
 * The shared shape of both detectors: work out what is currently true, compare
 * against what has been shown, seed silently the first time.
 *
 * `exempt` is what still gets celebrated on that first silent seed — the
 * founding badge, because it is a moment existing members were never given.
 */
function diffAgainstSeen(key, items, idOf, exempt = () => false, bulkLimit = 2) {
  const store = seenStore(key);
  const ids = items.map(idOf);
  const seen = store.read();

  if (seen === null) {
    store.merge([], ids);
    return items.filter(exempt);
  }

  const fresh = items.filter((item) => !seen.has(idOf(item)));
  if (fresh.length) store.merge(seen, ids);

  // A BULK of fresh items means history was rewritten under us (beta reseed,
  // snapshot restore, backfill) — real use earns these one at a time. Absorb
  // silently, exactly like the first-run seed; an overlay parade teaches
  // people to dismiss the animation unread.
  if (fresh.length > bulkLimit) return fresh.filter(exempt);
  return fresh;
}

/**
 * A badge's identity for "have we shown this?" purposes.
 *
 * Tier is part of it: reaching Gold on a badge you already held at Silver is a
 * new moment, and keying on the badge alone would swallow it.
 */
const badgeId = (b) => (b.level ? `${b.key}:${b.level}` : b.key);

/**
 * Which badges deserve a reveal right now — and record them as shown.
 *
 * The first run for a profile seeds SILENTLY: a member of six months must not
 * get five overlays in a row the day this ships.
 */
export function collectBadgeReveals(profileId, badges) {
  if (!profileId || !Array.isArray(badges) || badges.length === 0) return [];
  // Badges get a higher bulk threshold: one completed deal can legitimately
  // earn 3 badge tiers at once — that is a moment, not a history rewrite.
  return diffAgainstSeen(
    `tora:badges-seen:${profileId}`,
    badges.filter((b) => b && b.key),
    badgeId,
    (b) => b.key === 'founding',
    4,
  );
}

/**
 * Deal milestones, noticed the same way badges are.
 *
 * Two of the three moments cannot be raised where the button is pressed: the
 * promoter whose offer was ACCEPTED, and the party who countersigned second,
 * both learn about it on their own screen later. So the deal list is diffed on
 * load instead — the milestone belongs to the member, not to the click.
 */
const dealMilestones = (deal, profileId, ownedIds) => {
  const out = [];
  // Seeded rehearsal content ([DEMO] history, [BETA] ladder rungs) is not an
  // achievement — it arrived by script, not by the member's actions.
  if (/^\[(DEMO|BETA)\]/.test(deal.eventName || deal.venueName || '')) return out;
  const mine = (id) => id && (id === profileId || ownedIds.has(id));

  // The offer landing a yes belongs to whoever sent it.
  if (deal.status === 'ACCEPTED' && mine(deal.initiatorId)) {
    out.push({ id: `${deal.id}:offer`, moment: MOMENT.OFFER_ACCEPTED, deal });
  }
  // Fully signed is the "it's official" beat, and it belongs to both sides.
  if (deal.contract?.status === 'FULLY_SIGNED' && !deal.contract?.skipped) {
    out.push({ id: `${deal.id}:signed`, moment: MOMENT.CONTRACT_SIGNED, deal });
  }
  return out;
};

export function celebrateDealMilestones(profileId, deals, ownedProfileIds = []) {
  if (!profileId || !Array.isArray(deals) || deals.length === 0) return;
  const owned = new Set(ownedProfileIds.filter(Boolean));

  const mine = (id) => id && (id === profileId || owned.has(id));
  const fresh = diffAgainstSeen(
    `tora:deal-moments-seen:${profileId}`,
    deals.flatMap((d) => dealMilestones(d, profileId, owned)),
    (m) => m.id,
  );

  for (const m of fresh) {
    // The copy names who it was with: the booker for the artist's side, the
    // artist for the booker's side.
    const onArtistSide = mine(m.deal.artistId) || mine(m.deal.bookedArtistId);
    celebrateMoment(m.moment, {
      name: m.deal.eventName || m.deal.venueName || '',
      counterpart: (onArtistSide ? m.deal.venue?.name : m.deal.artist?.name) || '',
    });
  }
}

/** Raise a celebration from anywhere. App.js hosts the only listener. */
export function celebrate(detail) {
  window.dispatchEvent(new CustomEvent('tora:celebrate', { detail }));
}

/** Convenience for the badge path, so callers don't build the payload twice. */
export function celebrateBadges(profileId, badges) {
  for (const badge of collectBadgeReveals(profileId, badges)) {
    celebrate({ kind: 'badge', badgeKey: badge.key, tier: badge.tier || null });
  }
}

/** The three action moments. Named so the call sites read as English. */
export const MOMENT = {
  OFFER_ACCEPTED: 'offerAccepted',
  CONTRACT_SIGNED: 'contractSigned',
  REPRESENTATION: 'representationConfirmed',
};

export function celebrateMoment(moment, vars = {}) {
  celebrate({ kind: 'moment', moment, vars });
}
