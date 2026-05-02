import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import ViewProfileScreen from './ViewProfileScreen';

const MatchesScreen = ({ onOpenChat, onNavigateToMessages, accountUser }) => {
  const { user, getCalendarMatches, sentRequests, sendConnectionRequest, connectedUsers } = useAppContext();
  const { t } = useLanguage();
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  // Generate month/year options starting from current month for next 12 months
  const generateMonthOptions = () => {
    const options = [{ value: 'all', label: 'All Months' }];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    for (let i = 0; i < 12; i++) {
      const monthIndex = (currentMonth + i) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      const monthName = months[monthIndex];
      options.push({
        value: `${monthName.toLowerCase()}-${year}`,
        label: `${monthName} ${year}`
      });
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();
  const allMatches = getCalendarMatches();
  
  // Filter matches based on selected filters
  const filteredMatches = allMatches.filter(match => {
    // Genre matching - must have at least one genre in common
    const userGenres = user?.genres || [];
    const matchGenres = match.profile.genres || [];
    const hasCommonGenre = userGenres.some(genre => matchGenres.includes(genre));
    
    if (!hasCommonGenre && userGenres.length > 0 && matchGenres.length > 0) {
      return false;
    }
    
    // Role filter
    if (roleFilter !== 'all' && match.profile.role !== roleFilter) {
      return false;
    }
    
    // Month/Year filter
    if (monthFilter !== 'all') {
      // Extract month and year from dates string (e.g., "Jan 8-10, 2025")
      const dateParts = match.dates.split(' ');
      const matchMonth = dateParts[0].toLowerCase();
      const matchYear = dateParts[dateParts.length - 1];
      
      // Extract month and year from filter (e.g., "jan-2025")
      const [filterMonth, filterYear] = monthFilter.split('-');
      
      if (matchMonth !== filterMonth || matchYear !== filterYear) {
        return false;
      }
    }
    
    return true;
  });
  
  const matches = filteredMatches;

  const handleConnect = (profile) => {
    if (!sentRequests.has(profile.id)) {
      setSelectedProfile(profile);
      setShowMessageModal(true);
    }
  };

  const handleMessage = (profile) => {
    // Open chat and navigate to messages tab
    if (onOpenChat) {
      onOpenChat(profile);
    }
    if (onNavigateToMessages) {
      onNavigateToMessages();
    }
  };

  const handleSendMessage = () => {
    if (selectedProfile) {
      const profileId = selectedProfile.id;
      sendConnectionRequest(profileId, message.trim() || '');
      setShowMessageModal(false);
      setMessage('');
      setSelectedProfile(null);
    }
  };

  const handleProfileClick = (profileId) => {
    setViewingProfile(profileId);
  };

  // Show viewing profile if selected
  if (viewingProfile) {
    return (
      <ViewProfileScreen
        profileId={viewingProfile}
        onClose={() => setViewingProfile(null)}
        onOpenChat={onOpenChat}
        onNavigateToMessages={onNavigateToMessages}
      />
    );
  }

  // Show upgrade prompt for FREE users (per-profile subscription)
  const tier = user?.subscriptionTier || 'FREE';
  const hasPremiumAccess = ['TRIAL', 'MONTHLY', 'YEARLY'].includes(tier);
  if (!hasPremiumAccess) {
    return (
      <div className="screen active matches-screen">
        <div className="matches-header">
          <h1>Calendar Matches</h1>
        </div>
        <div className="upgrade-prompt">
          <div className="upgrade-card">
            <div className="upgrade-icon">✨</div>
            <h2>Unlock Calendar Matching</h2>
            <p>Get premium access to:</p>
            <ul>
              <li>📅 Find profiles with matching availability</li>
              <li>🌍 Search globally, not just locally</li>
              <li>🎯 See when artists are touring your city</li>
              <li>🔒 Control your calendar visibility</li>
            </ul>
            <button className="btn btn-premium">
              Upgrade to Premium
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen active matches-screen">
      <div className="matches-header">
        <h1>Calendar Matches</h1>
        <div className="premium-badge">
          <span>✨ Premium</span>
        </div>
      </div>

      {/* Filters Section */}
      <div className="matches-filters">
        <div className="filter-group">
          <label className="filter-label">Role</label>
          <select 
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="VENUE">Venues</option>
            <option value="PROMOTER">Promoters</option>
            <option value="AGENT">Agents</option>
            <option value="ARTIST">Artists</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label className="filter-label">Period</label>
          <select 
            className="filter-select"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            {monthOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {(roleFilter !== 'all' || monthFilter !== 'all') && (
          <button 
            className="filter-clear-btn"
            onClick={() => {
              setRoleFilter('all');
              setMonthFilter('all');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {matches.length > 0 ? (
        <div className="matches-results">
          <p className="matches-count">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'} found
          </p>
          
          {matches.map((match, index) => {
            const isRequested = sentRequests.has(match.profile.id);
            const isConnected = connectedUsers.has(match.profile.id);

            return (
              <div key={`${match.profile.id}-${index}`} className="match-card-simple">
                <div className="match-date-location">
                  <span>📅 {match.dates}</span>
                  <span>📍 {match.location}</span>
                </div>
                
                <div className="match-profile-content">
                  <div 
                    className={`match-avatar avatar-${match.profile.role.toLowerCase()} clickable`}
                    onClick={() => handleProfileClick(match.profile.id)}
                  >
                    {match.profile.avatar ? (
                      <img src={match.profile.avatar} alt={match.profile.name} />
                    ) : (
                      match.profile.name.charAt(0).toUpperCase()
                    )}
                    {match.profile.isVerified && <span className="verified-badge">✓</span>}
                  </div>
                  
                  <div 
                    className="match-info clickable"
                    onClick={() => handleProfileClick(match.profile.id)}
                  >
                    <div className="match-name-role">
                      <h3>{match.profile.name}</h3>
                      <span className={`role-badge ${match.profile.role.toLowerCase()}`}>
                        {match.profile.role}
                      </span>
                    </div>
                    <p className="match-base-location">{match.profile.location}</p>
                  </div>
                </div>
                
                {match.profile.genres && match.profile.genres.length > 0 && (
                  <div className="match-genres-simple">
                    {match.profile.genres.slice(0, 3).map(genre => (
                      <span key={genre} className="genre-tag-small">{genre}</span>
                    ))}
                    {match.profile.genres.length > 3 && (
                      <span className="genre-tag-small">+{match.profile.genres.length - 3}</span>
                    )}
                  </div>
                )}
                
                {isConnected ? (
                  <button
                    className="btn btn-message btn-match-full"
                    onClick={() => handleMessage(match.profile)}
                  >
                    Message
                  </button>
                ) : (
                  <button
                    className={`btn ${isRequested ? 'btn-disabled' : 'btn-primary'} btn-match-full`}
                    onClick={() => handleConnect(match.profile)}
                    disabled={isRequested}
                  >
                    {isRequested ? 'Requested' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="no-matches">
          <div className="no-matches-icon">📅</div>
          <h2>No Calendar Matches</h2>
          <p>No profiles match your travel schedule or events.</p>
          <div className="no-matches-tips">
            <h4>Tips to get more matches:</h4>
            <ul>
              <li>Add travel dates to your calendar</li>
              <li>Make sure your calendar is visible</li>
              <li>Check if there are profiles in your destinations</li>
            </ul>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && selectedProfile && (
        <div className="message-modal-overlay" onClick={() => {
          setShowMessageModal(false);
          setSelectedProfile(null);
          setMessage('');
        }}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">Connect with {selectedProfile.name}</h2>
            <textarea
              placeholder="Introduce yourself and mention the calendar match..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="4"
              className="message-textarea-bottom"
            />
            <div className="message-modal-actions">
              <button 
                className="btn btn-outline btn-modal-cancel"
                onClick={() => {
                  setShowMessageModal(false);
                  setSelectedProfile(null);
                  setMessage('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary btn-modal-send"
                onClick={handleSendMessage}
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchesScreen;