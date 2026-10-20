// Role → canonical avatar gradient class (styles/App.css .avatar-*).
// Single source for the mapping — it was previously copy-pasted per screen.
export function getAvatarClass(role) {
  const roleClass = {
    ARTIST: 'avatar-artist',
    VENUE: 'avatar-venue',
    PROMOTER: 'avatar-promoter',
    AGENT: 'avatar-agent',
  };
  return roleClass[role] || 'avatar-artist';
}

// Canonical role colors as JS values, for canvas/inline-style consumers that
// can't read the --color-role-* CSS tokens. Keep in sync with
// styles/variables.css and tora-theme.css.
/** One profile per role per account — so an account holds at most ROLES.length profiles. */
/** Outline pill colours for a role, from the --color-role-* theme tokens. */
export const roleChipClass = (role) => ({
  ARTIST: 'border-role-artist/50 text-role-artist',
  VENUE: 'border-role-venue/50 text-role-venue',
  PROMOTER: 'border-role-promoter/50 text-role-promoter',
  AGENT: 'border-role-agent/50 text-role-agent',
}[role] || 'border-white/30 text-white/70');

/** A soft wash of the role colour for backgrounds. */
export const roleBloom = (role, pct = 18) => (ROLES.includes(role)
  ? `color-mix(in srgb, var(--color-role-${role.toLowerCase()}) ${pct}%, transparent)`
  : 'rgba(255,255,255,0.08)');

export const ROLES = ['ARTIST', 'PROMOTER', 'VENUE', 'AGENT'];

export const ROLE_COLOR = {
  ARTIST: '#667EEA',
  AGENT: '#43E97B',
  PROMOTER: '#FFC107',
  VENUE: '#F5576C',
};

// i18n keys for role display labels — render with t(roleLabelKey(role)) and
// fall back to the raw role string for unknown values.
export const ROLE_LABEL_KEYS = {
  ARTIST: 'search.roleArtist',
  VENUE: 'search.roleVenue',
  PROMOTER: 'search.rolePromoter',
  AGENT: 'search.roleAgent',
};

export function roleLabel(role, t) {
  const key = ROLE_LABEL_KEYS[role];
  return key ? t(key) : role;
}
