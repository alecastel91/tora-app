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
