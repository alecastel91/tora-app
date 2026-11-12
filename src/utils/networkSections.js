// Role -> [key, items, titleKey] config for the completed-deal network
// strips, shared by ProfileScreen and ViewProfileScreen. Artists get ONE
// combined promoters+venues strip; agents get none (roster grid instead).
export function networkSectionsForRole(role, network) {
  const n = { promoters: [], venues: [], artists: [], ...(network || {}) };
  switch (role) {
    case 'ARTIST':
      return [['workedWith', [...n.promoters, ...n.venues], 'artistPage.playedAt']];
    case 'PROMOTER':
      return [
        ['venues', n.venues, 'viewProfile.venuesWorkedWith'],
        ['artists', n.artists, 'viewProfile.artistsPlayed'],
      ];
    case 'VENUE':
      return [
        ['promoters', n.promoters, 'viewProfile.promotersHosted'],
        ['artists', n.artists, 'viewProfile.artistsPlayedHere'],
      ];
    default:
      return [];
  }
}
