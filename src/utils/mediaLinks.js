// SoundCloud / Spotify links → embed URLs. One set of rules for the owner's
// profile, the public profile and the agent's artist view, and the same
// rules the Edit Profile hints promise (editProfile.soundcloudHint/spotifyHint).

const SC_PLAYER = 'https://w.soundcloud.com/player/?url=';
const SC_OPTS = '&color=%23ff3366&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true';

/**
 * Track, set or profile page link (soundcloud.com/… or m.soundcloud.com/…)
 * → player embed URL. The app's short share links (on.soundcloud.com) cannot
 * be embedded and return null.
 */
export function soundcloudEmbedUrl(link) {
  const url = String(link || '').trim();
  if (!url || url.includes('on.soundcloud.com')) return null;
  if (!/(^|\/\/|\.)m?\.?soundcloud\.com\//.test(url) && !url.includes('soundcloud.com/')) return null;
  return SC_PLAYER + encodeURIComponent(url.replace('m.soundcloud.com', 'soundcloud.com')) + SC_OPTS;
}

/** open.spotify.com/artist/<id>[?…] → <id>; anything else (track, album, short link) → null. */
export function spotifyArtistId(link) {
  const url = String(link || '').trim();
  if (!url.includes('open.spotify.com') || !url.includes('/artist/')) return null;
  const id = url.split('/artist/')[1]?.split('?')[0]?.split('/')[0];
  return id || null;
}

export function spotifyEmbedUrl(link) {
  const id = spotifyArtistId(link);
  return id ? `https://open.spotify.com/embed/artist/${id}` : null;
}
