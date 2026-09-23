// SoundCloud / Spotify links → embed URLs. Pure, hostname-based. One set of
// rules for the own profile, the public profile and the agent's artist view —
// the same rules the Edit Profile hints promise. Short share links are
// expanded to the real page by the backend on save (utils/mediaLinks there),
// so by the time a link reaches these helpers it is a page URL.

const SC_PLAYER = 'https://w.soundcloud.com/player/?url=';
const SC_OPTS = '&color=%23ff3366&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true';

const parse = (link) => { try { return new URL(String(link || '').trim()); } catch { return null; } };

/** Track, set or profile page (soundcloud.com / m.soundcloud.com) → player embed URL; else null. */
export function soundcloudEmbedUrl(link) {
  const u = parse(link);
  if (!u || !/^(m\.|www\.)?soundcloud\.com$/i.test(u.hostname)) return null;
  u.hostname = 'soundcloud.com';
  return SC_PLAYER + encodeURIComponent(u.toString()) + SC_OPTS;
}

/** open.spotify.com/artist/<id>[?…] → <id>; track/album/short links → null. */
export function spotifyArtistId(link) {
  const u = parse(link);
  if (!u || u.hostname.toLowerCase() !== 'open.spotify.com') return null;
  const m = u.pathname.match(/\/artist\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export function spotifyEmbedUrl(link) {
  const id = spotifyArtistId(link);
  return id ? `https://open.spotify.com/embed/artist/${id}` : null;
}
