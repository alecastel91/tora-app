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

/** Both embed URLs for a profile row (null when a link does not embed). */
export const profileEmbeds = (p) => ({ soundcloud: soundcloudEmbedUrl(p?.mixtape), spotify: spotifyEmbedUrl(p?.spotify) });

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** youtube.com/watch?v= · youtu.be/ · /live/ · /shorts/ · /embed/ → the 11-char video id; else null. */
export function youtubeId(link) {
  const u = parse(link);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com') id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:live|shorts|embed)\/([^/?#]+)/) || [])[1];
  return id && YT_ID.test(id) ? id : null;
}

/**
 * The player for one set or video (sanitised server-side, so provider and
 * host already agree). Autoplays: it only opens because the member tapped
 * play. Null when the link has no embeddable player.
 */
export function playerUrl(item) {
  const u = parse(item?.url);
  if (!u) return null;
  switch (item.provider) {
    case 'soundcloud': {
      const sc = soundcloudEmbedUrl(item.url);
      return sc ? sc.replace('auto_play=false', 'auto_play=true').replace('visual=true', 'visual=false') : null;
    }
    case 'mixcloud':
      return `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&autoplay=1&feed=${encodeURIComponent(u.pathname)}`;
    case 'youtube': {
      const id = youtubeId(item.url);
      return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&controls=1&playsinline=1` : null;
    }
    case 'vimeo': {
      const id = (u.pathname.match(/\/(\d+)/) || [])[1];
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
    default:
      return null;
  }
}
