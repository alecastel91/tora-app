import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockUsers, mockConversations, mockExploreFeed } from '../services/mockData';
import apiService from '../services/api';

const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [likedProfiles, setLikedProfiles] = useState(new Set());
  const [likedProfilesData, setLikedProfilesData] = useState([]); // Full profile objects
  const [sentRequests, setSentRequests] = useState(new Set());
  const [receivedRequests, setReceivedRequests] = useState(new Set());
  const [connectedUsers, setConnectedUsers] = useState(new Set());
  const [connectedUsersData, setConnectedUsersData] = useState([]); // Full profile objects
  const [likerProfilesData, setLikerProfilesData] = useState([]); // Full profile objects for likers

  // User will be set from backend after authentication
  const [user, setUser] = useState(null);

  // Multiple profiles for the same user (to be loaded from backend)
  const [userProfiles, setUserProfiles] = useState([]);

  // Account-level preferred currency (not profile-specific)
  const [preferredCurrency, setPreferredCurrency] = useState('USD');

  // Subscription tier from active profile (per-profile, synced when user changes)
  const [accountSubscriptionTier, setAccountSubscriptionTier] = useState('FREE');

  // Callback to refresh accountUser in App.js (registered by App.js on mount)
  const [refreshAccountUserCallback, setRefreshAccountUserCallback] = useState(null);

  // Track loading state to prevent duplicate fetches
  const [isLoadingProfileData, setIsLoadingProfileData] = useState(false);

  // Sync subscription tier from active profile whenever user changes
  useEffect(() => {
    if (user?.subscriptionTier) {
      setAccountSubscriptionTier(user.subscriptionTier);
    } else if (user) {
      setAccountSubscriptionTier('FREE');
    }
  }, [user]);

  // Load profile-specific data when user/profile changes
  useEffect(() => {
    const loadProfileData = async () => {
      const userId = user?.id;
      if (!user || !userId) return;
      if (isLoadingProfileData) return; // Prevent duplicate fetches

      const startTime = performance.now();
      console.log('🔄 [AppContext] Starting to load profile data for:', userId);

      try {
        setIsLoadingProfileData(true);

        const apiStartTime = performance.now();
        // OPTIMIZED: Fetch all data in one request
        const data = await apiService.getProfileData(userId);
        const apiEndTime = performance.now();
        console.log(`✅ [AppContext] API call completed in ${(apiEndTime - apiStartTime).toFixed(0)}ms`);

        setLikedProfiles(new Set(data.likedProfileIds || []));
        setLikedProfilesData(data.likedProfiles || []); // Store full profile objects
        setConnectedUsers(new Set(data.connectedProfileIds || []));
        setConnectedUsersData(data.connectedProfiles || []); // Store full profile objects
        setSentRequests(new Set(data.sentRequestIds || []));
        setReceivedRequests(new Set(data.receivedRequestIds || []));
        setLikerProfilesData(data.likerProfiles || []); // Store likers full profile objects
        setNotifications(data.notifications || []);

        const endTime = performance.now();
        console.log(`✅ [AppContext] Profile data loaded in ${(endTime - startTime).toFixed(0)}ms`);
      } catch (error) {
        console.error('❌ [AppContext] Error loading profile data:', error);
        // Reset to empty sets on error
        setLikedProfiles(new Set());
        setLikedProfilesData([]);
        setConnectedUsers(new Set());
        setConnectedUsersData([]);
        setSentRequests(new Set());
        setReceivedRequests(new Set());
        setLikerProfilesData([]);
        setNotifications([]);
      } finally {
        setIsLoadingProfileData(false);
      }
    };

    loadProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Re-load when active profile changes

  const [searchResults, setSearchResults] = useState([]);
  const [conversations] = useState(mockConversations);
  const [exploreFeed] = useState(mockExploreFeed);

  // Messages will be populated as users interact
  const [messages, setMessages] = useState({});
  
  const [notifications, setNotifications] = useState([]);

  const updateUser = (userData) => {
    if (!userData) {
      setUser(null);
      setUserProfiles([]);
      return;
    }

    // Case 1: userData is already an array of profiles (from login/refresh)
    if (Array.isArray(userData)) {
      console.log('🔍 [AppContext updateUser] Received profiles ARRAY - count:', userData.length);
      console.log('🔍 [AppContext updateUser] Profiles:', userData.map(p => p.name));
      console.log('🔍 [AppContext updateUser] First profile id:', userData[0]?.id);
      setUserProfiles(userData);
      // Set the first profile as active
      const activeProfile = userData[0];
      console.log('🔍 [AppContext updateUser] Setting active profile:', activeProfile.name, 'id:', activeProfile.id);
      setUser(activeProfile);
    }
    // Case 2: userData has a profiles property (object with profiles array)
    else if (userData.profiles && Array.isArray(userData.profiles)) {
      console.log('🔍 [AppContext updateUser] Setting profiles from object - count:', userData.profiles.length);
      console.log('🔍 [AppContext updateUser] Profiles:', userData.profiles.map(p => p.name));
      setUserProfiles(userData.profiles);
      // Set the first profile as active or find the active one
      const activeProfile = userData.profiles.find(p => p.isActive) || userData.profiles[0];
      setUser(activeProfile);
    }
    // Case 3: Single profile object
    else {
      console.log('🔍 [AppContext updateUser] Setting SINGLE profile:', userData.name || userData);
      console.log('🔍 [AppContext updateUser] Profile data:', userData);
      console.log('🔍 [AppContext updateUser] Profile id:', userData.id);
      // Single profile update - update within existing profiles array
      const profileId = userData.id;

      if (!profileId) {
        console.error('🔍 [AppContext updateUser] WARNING: Profile has no id!', userData);
      }

      // Check if this profile already exists in userProfiles
      const existingIndex = userProfiles.findIndex(p => p.id === profileId);

      if (existingIndex >= 0) {
        // Update existing profile in the array
        const updatedProfiles = [...userProfiles];
        updatedProfiles[existingIndex] = userData;
        console.log('🔍 [AppContext updateUser] Updated profile in array at index', existingIndex);
        setUserProfiles(updatedProfiles);
        setUser(userData);
      } else {
        // New profile (from signup/login) - add to array
        console.log('🔍 [AppContext updateUser] Adding new profile to array');
        setUser(userData);
        setUserProfiles([...userProfiles, userData]);
      }
    }
  };

  const switchProfile = (profileId) => {
    const newProfile = userProfiles.find(p => p.id === profileId);
    if (newProfile) {
      setUser(newProfile);
      // Profile data will reload automatically via useEffect
    }
  };

  const addProfile = (newProfile) => {
    setUserProfiles(prev => [...prev, newProfile]);
  };

  const deleteProfile = async (profileId) => {
    try {
      // Call backend API to delete profile
      await apiService.deleteProfile(profileId);

      // Remove from userProfiles array
      const updatedProfiles = userProfiles.filter(p => p.id !== profileId);
      setUserProfiles(updatedProfiles);

      // If we deleted the current profile, switch to another one
      if (user.id === profileId) {
        if (updatedProfiles.length > 0) {
          switchProfile(updatedProfiles[0].id);
        }
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  };

  // Helper function to reload profile data (call after likes/connections change)
  const reloadProfileData = async () => {
    const userId = user?.id;
    if (!user || !userId) return;
    if (isLoadingProfileData) return; // Prevent duplicate fetches

    try {
      setIsLoadingProfileData(true);

      // OPTIMIZED: Fetch all data in one request
      const [profileData, userData] = await Promise.all([
        apiService.getProfileData(userId),
        apiService.getCurrentUser()
      ]);

      setLikedProfiles(new Set(profileData.likedProfileIds || []));
      setLikedProfilesData(profileData.likedProfiles || []);
      setConnectedUsers(new Set(profileData.connectedProfileIds || []));
      setConnectedUsersData(profileData.connectedProfiles || []);
      setSentRequests(new Set(profileData.sentRequestIds || []));
      setReceivedRequests(new Set(profileData.receivedRequestIds || []));
      setLikerProfilesData(profileData.likerProfiles || []);
      setNotifications(profileData.notifications || []);

      // Also reload user stats. Only swap the objects when the payload
      // actually changed — every poll used to publish fresh identities,
      // re-running every effect that depends on `user` app-wide.
      const currentProfileId = user.id;
      const currentProfile = userData.profiles.find(p => p.id === currentProfileId);
      if (currentProfile) {
        setUser(prev =>
          JSON.stringify(prev) === JSON.stringify(currentProfile) ? prev : currentProfile
        );
        setUserProfiles(prev =>
          JSON.stringify(prev) === JSON.stringify(userData.profiles) ? prev : userData.profiles
        );
      }
      // Also refresh accountUser in App.js (usage stats, subscription tier)
      if (refreshAccountUserCallback) {
        refreshAccountUserCallback();
      }
    } catch (error) {
      console.error('Error reloading profile data:', error);
    } finally {
      setIsLoadingProfileData(false);
    }
  };

  // Periodic polling: refresh profile data to catch cross-user changes
  // (e.g. when another user accepts your connection request). Realtime
  // broadcasts cover chat; this is only a safety net, so 60s is plenty.
  useEffect(() => {
    if (!user?.id) return;

    const pollInterval = setInterval(() => {
      if (!isLoadingProfileData) {
        reloadProfileData();
      }
    }, 60000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Calendar matching functionality
  const getCalendarMatches = () => {
    const hasPremium = ['TRIAL', 'MONTHLY', 'YEARLY'].includes(accountSubscriptionTier);
    if (!user || !hasPremium) {
      return [];
    }

    // Get user's available dates
    const userAvailableDates = user.availableDates || [];
    if (userAvailableDates.length === 0) {
      return [];
    }

    // Convert user's available dates to Set for faster lookup
    const userDatesSet = new Set(userAvailableDates);

    const matches = [];

    // Search through all profiles (we'll need to fetch from backend in real implementation)
    // For now, we'll use the connected users and liked profiles we already have loaded
    const allProfilesToCheck = [
      ...connectedUsersData,
      ...likedProfilesData,
      ...likerProfilesData
    ];

    // Remove duplicates by ID
    const uniqueProfiles = Array.from(
      new Map(allProfilesToCheck.map(p => [p.id, p])).values()
    );

    for (const profile of uniqueProfiles) {
      // Skip self
      if (profile.id === user.id) continue;

      // Check role compatibility
      if (!isValidMatch(user.role, profile.role)) continue;

      // Check genre matching - must have at least one genre in common
      const userGenres = user.genres || [];
      const profileGenres = profile.genres || [];
      const hasCommonGenre = userGenres.some(genre => profileGenres.includes(genre));

      if (!hasCommonGenre && userGenres.length > 0 && profileGenres.length > 0) {
        continue;
      }

      // Check for overlapping available dates
      const profileAvailableDates = profile.availableDates || [];
      const overlappingDates = profileAvailableDates.filter(date => userDatesSet.has(date));

      if (overlappingDates.length > 0) {
        // Format dates for display
        const datesFormatted = formatMatchDates(overlappingDates);

        matches.push({
          profile,
          dates: datesFormatted,
          matchCount: overlappingDates.length,
          rawDates: overlappingDates
        });
      }
    }

    // Sort by number of matching dates (most matches first)
    matches.sort((a, b) => b.matchCount - a.matchCount);

    return matches;
  };

  // Helper function to format overlapping dates for display
  const formatMatchDates = (dates) => {
    if (dates.length === 0) return '';

    // Sort dates
    const sortedDates = [...dates].sort();

    // Group consecutive dates
    const groups = [];
    let currentGroup = [sortedDates[0]];

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        // Consecutive date
        currentGroup.push(sortedDates[i]);
      } else {
        // Gap - start new group
        groups.push(currentGroup);
        currentGroup = [sortedDates[i]];
      }
    }
    groups.push(currentGroup);

    // Format each group
    const formattedGroups = groups.slice(0, 3).map(group => {
      const startDate = new Date(group[0]);
      const endDate = new Date(group[group.length - 1]);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[startDate.getMonth()];
      const year = startDate.getFullYear();

      if (group.length === 1) {
        return `${month} ${startDate.getDate()}, ${year}`;
      } else {
        return `${month} ${startDate.getDate()}-${endDate.getDate()}, ${year}`;
      }
    });

    return formattedGroups.join('; ');
  };

  // Helper function to determine valid matches based on roles
  const isValidMatch = (role1, role2) => {
    const validPairs = [
      ['ARTIST', 'VENUE'],
      ['ARTIST', 'PROMOTER'],
      ['PROMOTER', 'VENUE'],
      ['AGENT', 'VENUE'],
      ['AGENT', 'PROMOTER']
    ];
    
    return validPairs.some(([r1, r2]) => 
      (role1 === r1 && role2 === r2) || (role1 === r2 && role2 === r1)
    );
  };

  // Get filtered profiles based on account type and location
  const getLocationFilteredProfiles = (profiles, searchLocation = null) => {
    if (!user) return profiles;

    // Premium users can see all profiles globally
    const hasPremium = ['TRIAL', 'MONTHLY', 'YEARLY'].includes(accountSubscriptionTier);
    if (hasPremium) {
      return searchLocation 
        ? profiles.filter(p => p.city.toLowerCase().includes(searchLocation.toLowerCase()) || 
                              p.country.toLowerCase().includes(searchLocation.toLowerCase()))
        : profiles;
    }

    // Basic users only see local profiles (same city)
    return profiles.filter(p => p.city === user.city);
  };

  const searchUsers = (query, filters) => {
    let results = mockUsers;
    
    if (query) {
      results = results.filter(u => 
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.role.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (filters.role && filters.role !== 'all') {
      results = results.filter(u => u.role === filters.role);
    }

    if (filters.location) {
      results = results.filter(u => 
        u.location.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    if (filters.genres && filters.genres.length > 0) {
      results = results.filter(u => 
        filters.genres.some(genre => u.genres?.includes(genre))
      );
    }

    setSearchResults(results);
  };

  const getConversations = async () => {
    if (!user || !user.id) {
      console.error('No active user profile');
      return [];
    }

    try {
      const data = await apiService.getConversations(user.id);
      return data.conversations || [];
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  };

  const getMessageThread = async (otherProfileId) => {
    if (!user || !user.id) {
      console.error('No active user profile');
      return [];
    }

    try {
      const data = await apiService.getMessageThread(user.id, otherProfileId);
      return data.messages || [];
    } catch (error) {
      console.error('Error getting message thread:', error);
      return [];
    }
  };

  const sendMessage = async (otherProfileId, text, connectionRequestId = null) => {
    if (!user || !user.id) {
      console.error('No active user profile');
      return;
    }

    try {
      const data = await apiService.sendMessage(user.id, otherProfileId, text, connectionRequestId);
      return data.message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
  };

  const clearNotifications = async () => {
    if (!user || !user.id) return;

    try {
      await apiService.clearNotifications(user.id);
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const toggleLike = async (profileId) => {
    if (!user || !user.id) {
      console.error('No active user profile');
      return;
    }

    // Optimistic UI update
    const isCurrentlyLiked = likedProfiles.has(profileId);
    const newLikedProfiles = new Set(likedProfiles);

    if (isCurrentlyLiked) {
      newLikedProfiles.delete(profileId);
    } else {
      newLikedProfiles.add(profileId);
    }
    setLikedProfiles(newLikedProfiles);

    try {
      // Call backend to toggle like
      await apiService.toggleLike(user.id, profileId);

      // Force reload profile data by temporarily resetting loading flag
      setIsLoadingProfileData(false);
      await reloadProfileData();
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on error
      setLikedProfiles(likedProfiles);
      // Re-throw error so component handlers can show proper modal
      throw error;
    }
  };

  const sendConnectionRequest = async (profileId, message) => {
    if (!user || !user.id) {
      console.error('No active user profile');
      return;
    }

    try {
      // Send connection request to backend
      await apiService.sendConnectionRequest(user.id, profileId, message);

      // Reload profile data to get updated sent requests
      await reloadProfileData();
    } catch (error) {
      console.error('Error sending connection request:', error);
      throw error;
    }
  };

  const acceptRequest = async (requestId) => {
    if (!user || !user.id) {
      console.error('No active user profile');
      return;
    }

    try {
      // Call backend to accept the request
      await apiService.acceptConnectionRequest(requestId);

      // Reload profile data to get updated connections and requests
      await reloadProfileData();
    } catch (error) {
      console.error('Error accepting connection request:', error);
      throw error;
    }
  };

  const declineRequest = async (requestId) => {
    if (!user || !user.id) {
      console.error('No active user profile');
      return;
    }

    try {
      // Call backend to decline the request
      await apiService.declineConnectionRequest(requestId);

      // Reload profile data to get updated requests
      await reloadProfileData();
    } catch (error) {
      console.error('Error declining connection request:', error);
      throw error;
    }
  };

  const removeConnection = async (profileId) => {
    if (!user || !user.id) {
      console.error('No active user profile');
      return;
    }

    try {
      // Call backend to remove the connection
      await apiService.removeConnection(user.id, profileId);

      // Reload profile data to get updated connections
      await reloadProfileData();
    } catch (error) {
      console.error('Error removing connection:', error);
      throw error;
    }
  };

  const value = {
    user,
    updateUser,
    userProfiles,
    switchProfile,
    addProfile,
    deleteProfile,
    reloadProfileData,
    getCalendarMatches,
    getLocationFilteredProfiles,
    searchResults,
    searchUsers,
    conversations,
    exploreFeed,
    messages,
    getConversations,
    getMessageThread,
    sendMessage,
    notifications,
    addNotification,
    clearNotifications,
    likedProfiles,
    likedProfilesData, // OPTIMIZED: Full profile objects
    toggleLike,
    sentRequests,
    receivedRequests,
    connectedUsers,
    connectedUsersData, // OPTIMIZED: Full profile objects
    likerProfilesData, // OPTIMIZED: Full profile objects for likers
    connectionRequests: sentRequests, // Backward compatibility
    sendConnectionRequest,
    acceptRequest,
    declineRequest,
    removeConnection,
    preferredCurrency,
    setPreferredCurrency,
    accountSubscriptionTier,
    setAccountSubscriptionTier,
    setRefreshAccountUserCallback
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};