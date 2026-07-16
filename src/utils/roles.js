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
export const ROLE_COLOR = {
  ARTIST: '#6B5FFF',
  AGENT: '#00C875',
  PROMOTER: '#FFB800',
  VENUE: '#FF5757',
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
