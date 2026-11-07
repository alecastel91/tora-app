import { useEffect, useState } from 'react';
import apiService from '../services/api';

// "Suggested for you": recommendations for the active profile, refetched on
// profile switch. Search shows them on its empty state (phone and desktop).
export default function useProfileSuggestions(profileId) {
  const [profiles, setProfiles] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setProfiles([]);
    if (!profileId) return undefined;
    apiService.getProfileSuggestions(profileId)
      .then((d) => { if (!cancelled) setProfiles(d.profiles || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profileId]);
  return profiles;
}
