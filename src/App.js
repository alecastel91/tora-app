import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Header from './components/common/Header';
import TabBar from './components/common/TabBar';
import ProfileScreen from './components/screens/ProfileScreen';
import SearchScreen from './components/screens/SearchScreen';
import TourScreen from './components/screens/TourScreen';
import ExploreScreen from './components/screens/ExploreScreen';
import BookingsScreen from './components/screens/BookingsScreen';
import MessagesScreen from './components/screens/MessagesScreen';
import ChatScreen from './components/screens/ChatScreen';
import ViewProfileScreen from './components/screens/ViewProfileScreen';
import LoginScreen from './components/screens/LoginScreen';
import SignupScreen from './components/screens/SignupScreen';
import ForgotPasswordScreen from './components/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './components/screens/ResetPasswordScreen';
import Modal from './components/common/Modal';
import AgentTierLadder from './components/common/AgentTierLadder';
import AgentTierCard from './components/common/AgentTierCard';
import { useLanguage } from './contexts/LanguageContext';
import { useAppContext } from './contexts/AppContext';
import apiService from './services/api';
import { StarIcon } from './utils/icons';
import './styles/App.css';
import './styles/responsive.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // /reset-password?token=... on boot enters the reset flow. URL is stable
  // after mount, so the token is a one-shot const rather than state.
  const resetToken = typeof window !== 'undefined' && window.location.pathname === '/reset-password'
    ? new URLSearchParams(window.location.search).get('token')
    : null;
  // 'login' | 'signup' | 'forgot' | 'reset'
  const [authMode, setAuthMode] = useState(resetToken ? 'reset' : 'login');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [subscriptionStep, setSubscriptionStep] = useState('payment'); // payment, processing, success
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChangeData, setPasswordChangeData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadProposalsCount, setUnreadProposalsCount] = useState(0);
  const [preferredCurrency, setPreferredCurrency] = useState('USD');
  const [accountUser, setAccountUser] = useState(null); // Account-level user data (email, currency, etc)
  const { t, language, changeLanguage, availableLanguages } = useLanguage();
  const { updateUser, user, getConversations, setPreferredCurrency: setContextCurrency, setAccountSubscriptionTier, setRefreshAccountUserCallback } = useAppContext();

  // Available currencies
  const availableCurrencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' }
  ];

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const data = await apiService.getCurrentUser();
          if (data.user) {
            setAccountUser(data.user);
            const currency = data.user.preferredCurrency || 'USD';
            setPreferredCurrency(currency);
            setContextCurrency(currency);
          }
          updateUser(data.profiles || data.profile);
          setIsAuthenticated(true);
        } catch (error) {
          // Only clear the token on a genuine auth failure. 429 (rate limit),
          // 5xx, or network errors are transient — keep the user signed in
          // and let them retry instead of bouncing them to the login screen.
          const status = error?.response?.status;
          if (status === 401 || status === 403) {
            console.error('Auth check failed — token rejected:', error);
            localStorage.removeItem('token');
          } else {
            console.warn(`Auth check transient error (status ${status ?? 'network'}); keeping session`, error);
            // Optimistically authenticate based on token presence; downstream
            // /me retries will recover once the rate window resets.
            setIsAuthenticated(true);
          }
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // Refresh accountUser from backend (called after likes, connections, etc.)
  const refreshAccountUser = async () => {
    try {
      const data = await apiService.getCurrentUser();
      if (data.user) {
        setAccountUser(data.user);
      }
    } catch (error) {
      console.error('Error refreshing account user:', error);
    }
  };

  // Register the refresh callback with AppContext so it can trigger accountUser updates
  useEffect(() => {
    if (setRefreshAccountUserCallback) {
      setRefreshAccountUserCallback(() => refreshAccountUser);
    }
  }, [isAuthenticated]);

  // Sync account-level data to AppContext when accountUser loads
  useEffect(() => {
    if (accountUser) {
      if (accountUser.preferredCurrency) {
        setPreferredCurrency(accountUser.preferredCurrency);
        setContextCurrency(accountUser.preferredCurrency);
      }
      // Subscription tier is now per-profile, synced from active profile
      if (user?.subscriptionTier) {
        setAccountSubscriptionTier(user.subscriptionTier);
      }
    }
  }, [accountUser]);

  // Fetch unread messages count (includes both unread messages and connection requests)
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!isAuthenticated || !user || !user.id) return;

      try {
        // Fetch both conversations and connection requests
        const [conversations, requestsData] = await Promise.all([
          getConversations(),
          apiService.getReceivedRequests(user.id)
        ]);

        // Count unread messages in conversations
        const conversationUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

        // Count pending connection requests
        const requestsCount = (requestsData.requests || []).length;

        // Total badge count = unread messages + pending requests
        const totalBadgeCount = conversationUnread + requestsCount;

        setUnreadMessagesCount(totalBadgeCount);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    // Refresh every 30 seconds when authenticated
    const interval = setInterval(() => {
      if (isAuthenticated && user && user.id) {
        fetchUnreadCount();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user, activeChatUser]); // Refresh when chat changes

  const handleLoginSuccess = async (data) => {
    console.log('[App] Login success, received data:', data);
    console.log('[App] Profiles:', data.profiles);
    console.log('[App] Profile:', data.profile);

    // Store account-level user data
    if (data.user) {
      setAccountUser(data.user);
      const currency = data.user.preferredCurrency || 'USD';
      setPreferredCurrency(currency);
      setContextCurrency(currency); // Also update AppContext
    }
    // Use profiles array if available, otherwise fallback to single profile
    const profileData = data.profiles || data.profile;
    console.log('[App] Updating user with profile data:', profileData);
    updateUser(profileData);
    setIsAuthenticated(true);

    // Detect and update user timezone if not set
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('[App] Detected timezone:', userTimezone);

    // Update timezone for all profiles if not already set
    if (Array.isArray(profileData)) {
      for (const profile of profileData) {
        if (!profile.timezone || profile.timezone === 'UTC') {
          try {
            await apiService.updateProfile(profile.id, { timezone: userTimezone });
            console.log(`[App] Updated timezone for profile ${profile.id} to ${userTimezone}`);
          } catch (error) {
            console.error('[App] Failed to update timezone:', error);
          }
        }
      }
    } else if (profileData && (!profileData.timezone || profileData.timezone === 'UTC')) {
      try {
        await apiService.updateProfile(profileData.id, { timezone: userTimezone });
        console.log(`[App] Updated timezone for profile ${profileData.id} to ${userTimezone}`);
      } catch (error) {
        console.error('[App] Failed to update timezone:', error);
      }
    }
  };

  const handleSignupSuccess = (data) => {
    updateUser(data.profile);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    updateUser(null);
  };

  const handlePasswordChange = async () => {
    setPasswordChangeError('');

    // Validate passwords
    if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
      setPasswordChangeError('New passwords do not match');
      return;
    }

    if (passwordChangeData.newPassword.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters');
      return;
    }

    setPasswordChangeLoading(true);

    try {
      await apiService.changePassword(
        passwordChangeData.currentPassword,
        passwordChangeData.newPassword
      );

      setPasswordChangeSuccess(true);
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordChangeData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordChangeSuccess(false);
      }, 2000);
    } catch (error) {
      setPasswordChangeError(error.message || 'Failed to change password');
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleCurrencyChange = async (currencyCode) => {
    if (!accountUser) return;

    try {
      // Update local state immediately for better UX
      setPreferredCurrency(currencyCode);
      setContextCurrency(currencyCode); // Also update AppContext

      // Update on backend (account-level, not profile-level)
      const response = await apiService.updateUserPreferences({
        preferredCurrency: currencyCode
      });

      // Update account user state
      if (response.user) {
        setAccountUser(response.user);
      }
    } catch (error) {
      console.error('Failed to update currency preference:', error);
      // Revert on error
      const originalCurrency = accountUser.preferredCurrency || 'USD';
      setPreferredCurrency(originalCurrency);
      setContextCurrency(originalCurrency);
    }
  };

  const handleMarketingConsentChange = async (nextValue) => {
    if (!accountUser) return;
    const previousValue = accountUser.marketingConsent === true;
    setAccountUser({ ...accountUser, marketingConsent: nextValue });
    try {
      const response = await apiService.updateUserPreferences({
        marketingConsent: nextValue
      });
      if (response.user) {
        setAccountUser(response.user);
      }
    } catch (error) {
      console.error('Failed to update marketing consent:', error);
      setAccountUser({ ...accountUser, marketingConsent: previousValue });
    }
  };

  const renderScreen = () => {
    switch(activeTab) {
      case 'profile':
        return <ProfileScreen onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} onSwitchTab={setActiveTab} />;
      case 'search':
        return <SearchScreen onOpenChat={setActiveChatUser} onNavigateToMessages={() => setActiveTab('messages')} onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} />;
      case 'tour':
        return <TourScreen onOpenChat={setActiveChatUser} onNavigateToMessages={() => setActiveTab('messages')} onUnreadProposalsChange={setUnreadProposalsCount} onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} />;
      case 'bookings':
        return <BookingsScreen onOpenChat={setActiveChatUser} onNavigateToMessages={() => setActiveTab('messages')} />;
      case 'messages':
        return <MessagesScreen onOpenChat={setActiveChatUser} key={activeChatUser ? 'with-chat' : 'without-chat'} />;
      default:
        return <ProfileScreen onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} onSwitchTab={setActiveTab} />;
    }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setShowPremium(false);
    setShowSubscription(true);
    setSubscriptionStep('payment');
  };

  const handlePaymentSubmit = () => {
    setSubscriptionStep('processing');
    // Simulate payment processing
    setTimeout(() => {
      setSubscriptionStep('success');
    }, 2000);
  };

  const handleSubscriptionComplete = () => {
    setShowSubscription(false);
    setSubscriptionStep('payment');
    setSelectedPlan(null);
    // Here you would update the user's premium status
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-container">
          <div className="auth-header">
            <img src="/tora_logo.png" alt="TORA" className="auth-logo" />
            <p className="auth-subtitle">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show login/signup/forgot/reset screen if not authenticated
  if (!isAuthenticated) {
    const goToLogin = () => {
      // Clear ?token= from the URL when leaving the reset screen so a refresh
      // doesn't reopen it with the now-used (or expired) token.
      if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') {
        window.history.replaceState({}, '', '/');
      }
      setAuthMode('login');
    };
    if (authMode === 'reset' && resetToken) {
      return <ResetPasswordScreen token={resetToken} onBackToLogin={goToLogin} />;
    }
    if (authMode === 'forgot') {
      return <ForgotPasswordScreen onBackToLogin={goToLogin} />;
    }
    if (authMode === 'signup') {
      return (
        <SignupScreen
          onSignupSuccess={handleSignupSuccess}
          onSwitchToLogin={() => setAuthMode('login')}
        />
      );
    }
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onSwitchToSignup={() => setAuthMode('signup')}
        onSwitchToForgotPassword={() => setAuthMode('forgot')}
      />
    );
  }

  return (
    <Router>
      <div className="app-container">
        <Header
          onOpenSettings={() => setShowSettings(true)}
          onOpenPremium={() => setShowPremium(true)}
          accountUser={accountUser}
          onSwitchTab={setActiveTab}
        />
        <main className="app-content">
          {renderScreen()}
        </main>
        {activeChatUser && !viewingProfile && (
          <ChatScreen
            user={activeChatUser}
            onClose={() => setActiveChatUser(null)}
            onOpenProfile={(profile) => setViewingProfile(profile)}
          />
        )}
        {viewingProfile && (
          <ViewProfileScreen
            profile={viewingProfile}
            onClose={() => setViewingProfile(null)}
            onOpenChat={(user) => {
              setViewingProfile(null);
              setActiveChatUser(user);
            }}
          />
        )}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} unreadMessagesCount={unreadMessagesCount} unreadProposalsCount={unreadProposalsCount} />
        
        {/* Settings Screen */}
        {showSettings && (
          <div className="screen active settings-screen">
            <div className="settings-header">
              <button className="back-button" onClick={() => setShowSettings(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1>{t('settings.title')}</h1>
              <div style={{ width: '24px' }}></div>
            </div>

            <div className="settings-content">
            {/* Account Section */}
            <div className="settings-section">
              <h3>{t('settings.account')}</h3>
              {(accountUser?.firstName || accountUser?.lastName) && (
                <div className="settings-item">
                  <span>Name</span>
                  <span className="settings-value">{[accountUser.firstName, accountUser.lastName].filter(Boolean).join(' ')}</span>
                </div>
              )}
              {accountUser?.phone && (
                <div className="settings-item">
                  <span>Phone</span>
                  <span className="settings-value">{accountUser.phone}</span>
                </div>
              )}
              <div className="settings-item">
                <span>{t('settings.email')}</span>
                <span className="settings-value">{accountUser?.email || user?.email || 'Not available'}</span>
              </div>
              <button className="btn btn-outline btn-change-password" onClick={() => setShowPasswordChange(true)}>{t('settings.changePassword')}</button>
            </div>

            {/* Subscription & Usage Section */}
            <div className="settings-section subscription-section">
              <h3>{user?.role === 'AGENT' ? 'Agent plan' : 'Subscription & Usage'}</h3>

              {user?.role === 'AGENT' ? (
                <AgentTierCard
                  profile={user}
                  onManage={() => { setShowSettings(false); setShowPremium(true); }}
                />
              ) : (
                <div className="subscription-tier-badge">
                  <span className={`tier-label ${user?.subscriptionTier?.toLowerCase() || 'free'}`}>
                    {user?.subscriptionTier || 'FREE'}
                  </span>
                  {(!user?.subscriptionTier || user?.subscriptionTier === 'FREE') && (
                    <button
                      className="btn btn-upgrade-small"
                      onClick={() => {
                        setShowSettings(false);
                        setShowPremium(true);
                      }}
                    >
                      Upgrade to Premium
                    </button>
                  )}
                  {user?.subscriptionTier === 'MONTHLY' && (
                    <button
                      className="btn btn-upgrade-small"
                      onClick={() => {
                        setShowSettings(false);
                        setShowPremium(true);
                      }}
                    >
                      Upgrade to Yearly
                    </button>
                  )}
                </div>
              )}

              {/* Trial Countdown */}
              {user?.subscriptionTier === 'TRIAL' && user?.trialEndDate && (
                <div className="trial-countdown-settings">
                  <div className="trial-countdown-icon">⏱️</div>
                  <div className="trial-countdown-text">
                    <strong>Trial Period</strong>
                    <p>
                      {(() => {
                        const now = new Date();
                        const endDate = new Date(user.trialEndDate);
                        const diffTime = endDate - now;
                        if (diffTime <= 0) return 'Trial expired';

                        const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffHours < 24) {
                          return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} remaining`;
                        } else {
                          return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} remaining`;
                        }
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {/* Usage Stats (per-profile) */}
              <div className="usage-stats">
                <h4>Usage This Period</h4>

                {/* Likes Today */}
                <div className="usage-item">
                  <div className="usage-header">
                    <span className="usage-label">Likes Today</span>
                    <span className="usage-count">
                      {user?.likesSentToday || 0} / {(() => {
                        const tier = user?.subscriptionTier || 'FREE';
                        if (tier === 'YEARLY') return '∞';
                        if (tier === 'MONTHLY') return '5';
                        return '2'; // FREE or TRIAL
                      })()}
                    </span>
                  </div>
                  {user?.subscriptionTier !== 'YEARLY' && (
                    <div className="usage-progress-bar">
                      <div
                        className={`usage-progress-fill ${(() => {
                          const tier = user?.subscriptionTier || 'FREE';
                          const limit = tier === 'MONTHLY' ? 5 : 2;
                          const used = user?.likesSentToday || 0;
                          if (used >= limit) return 'danger';
                          if (used >= limit - 1) return 'warning';
                          return 'safe';
                        })()}`}
                        style={{ width: `${(() => {
                          const tier = user?.subscriptionTier || 'FREE';
                          const limit = tier === 'MONTHLY' ? 5 : 2;
                          const used = user?.likesSentToday || 0;
                          return Math.min((used / limit) * 100, 100);
                        })()}%` }}
                      />
                    </div>
                  )}
                  <div className="usage-reset">
                    {user?.subscriptionTier === 'YEARLY' ? 'Unlimited Likes' : 'Resets daily at midnight'}
                  </div>
                </div>

                {/* Connections This Month */}
                <div className="usage-item">
                  <div className="usage-header">
                    <span className="usage-label">Connections This Month</span>
                    <span className="usage-count">
                      {user?.connectionsSentThisMonth || 0} / {(() => {
                        const tier = user?.subscriptionTier || 'FREE';
                        if (tier === 'YEARLY') return '∞';
                        if (tier === 'MONTHLY') return '10';
                        return '3'; // FREE or TRIAL
                      })()}
                    </span>
                  </div>
                  {user?.subscriptionTier !== 'YEARLY' && (
                    <div className="usage-progress-bar">
                      <div
                        className={`usage-progress-fill ${(() => {
                          const tier = user?.subscriptionTier || 'FREE';
                          const limit = tier === 'MONTHLY' ? 10 : 3;
                          const used = user?.connectionsSentThisMonth || 0;
                          if (used >= limit) return 'danger';
                          if (used >= limit - 1) return 'warning';
                          return 'safe';
                        })()}`}
                        style={{ width: `${(() => {
                          const tier = user?.subscriptionTier || 'FREE';
                          const limit = tier === 'MONTHLY' ? 10 : 3;
                          const used = user?.connectionsSentThisMonth || 0;
                          return Math.min((used / limit) * 100, 100);
                        })()}%` }}
                      />
                    </div>
                  )}
                  <div className="usage-reset">
                    {user?.subscriptionTier === 'YEARLY' ? 'Unlimited Connections' : (() => {
                      const now = new Date();
                      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                      const daysUntil = Math.ceil((nextMonth - now) / (1000 * 60 * 60 * 24));
                      return `Resets in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} (${nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>{t('settings.language')}</h3>
              <div className="language-selector">
                {availableLanguages.map(lang => (
                  <button
                    key={lang.code}
                    className={`language-option ${language === lang.code ? 'active' : ''}`}
                    onClick={() => changeLanguage(lang.code)}
                  >
                    <span className="lang-name">{lang.nativeName}</span>
                    {language === lang.code && <span className="checkmark">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3>Preferred Currency</h3>
              <div className="language-selector">
                {availableCurrencies.map(curr => (
                  <button
                    key={curr.code}
                    className={`language-option ${preferredCurrency === curr.code ? 'active' : ''}`}
                    onClick={() => handleCurrencyChange(curr.code)}
                  >
                    <span className="lang-name">{curr.symbol} {curr.code}</span>
                    <span className="lang-native">{curr.name}</span>
                    {preferredCurrency === curr.code && <span className="checkmark">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3>{t('settings.notifications')}</h3>
              <div className="settings-item">
                <label className="settings-toggle">
                  <input type="checkbox" defaultChecked />
                  <span>{t('settings.pushNotifications')}</span>
                </label>
              </div>
              <div className="settings-item">
                <label className="settings-toggle">
                  <input type="checkbox" defaultChecked />
                  <span>{t('settings.emailNotifications')}</span>
                </label>
              </div>
            </div>
            
            <div className="settings-section">
              <h3>{t('settings.privacy')}</h3>
              <div className="settings-item">
                <label className="settings-toggle">
                  <input type="checkbox" defaultChecked />
                  <span>{t('settings.showProfile')}</span>
                </label>
              </div>
              <div className="settings-item">
                <label className="settings-toggle">
                  <input type="checkbox" defaultChecked />
                  <span>{t('settings.allowMessages')}</span>
                </label>
              </div>
              <div className="settings-item">
                <label className="settings-toggle">
                  <input type="checkbox" />
                  <span>{t('settings.shareLocation')}</span>
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h3>Email Preferences</h3>
              <div className="settings-item">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={accountUser?.marketingConsent === true}
                    onChange={(e) => handleMarketingConsentChange(e.target.checked)}
                  />
                  <span>Product updates, new features, and tips for getting the most out of TORA</span>
                </label>
              </div>
              <div className="settings-item">
                <label className="settings-toggle settings-toggle-locked">
                  <input type="checkbox" checked disabled readOnly />
                  <span>Transactional emails (booking confirmations, security alerts, password resets) — required for the service to work</span>
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h3>{t('settings.about')}</h3>
              <div className="settings-item">
                <span>{t('settings.version')}</span>
                <span className="settings-value">1.0.0</span>
              </div>
              <div className="settings-item">
                <button className="settings-link" onClick={() => console.log('Terms of Service')}>{t('settings.termsOfService')}</button>
              </div>
              <div className="settings-item">
                <button className="settings-link" onClick={() => console.log('Privacy Policy')}>{t('settings.privacyPolicy')}</button>
              </div>
            </div>
            
            <div className="settings-actions">
              <button className="btn btn-outline" onClick={handleLogout}>{t('settings.signOut') || 'Sign Out'}</button>
              <button className="btn btn-danger">{t('settings.deleteAccount')}</button>
            </div>
            </div>
          </div>
        )}

        {/* Password Change Modal */}
        <Modal
          isOpen={showPasswordChange}
          onClose={() => {
            setShowPasswordChange(false);
            setPasswordChangeData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordChangeError('');
            setPasswordChangeSuccess(false);
          }}
          title="Change Password"
        >
          <div className="password-change-content">
            {passwordChangeSuccess ? (
              <div className="success-state">
                <div className="success-icon">✓</div>
                <h3>Password Changed Successfully</h3>
                <p>Your password has been updated.</p>
              </div>
            ) : (
              <>
                {passwordChangeError && (
                  <div className="error-message">
                    {passwordChangeError}
                  </div>
                )}

                <div className="form-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={passwordChangeData.currentPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      currentPassword: e.target.value
                    })}
                    placeholder="Enter current password"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={passwordChangeData.newPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      newPassword: e.target.value
                    })}
                    placeholder="Enter new password (min 6 characters)"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordChangeData.confirmPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      confirmPassword: e.target.value
                    })}
                    placeholder="Re-enter new password"
                    className="form-input"
                  />
                </div>

                <button
                  className="btn btn-primary btn-full"
                  onClick={handlePasswordChange}
                  disabled={passwordChangeLoading ||
                    !passwordChangeData.currentPassword ||
                    !passwordChangeData.newPassword ||
                    !passwordChangeData.confirmPassword}
                >
                  {passwordChangeLoading ? 'Changing Password...' : 'Change Password'}
                </button>
              </>
            )}
          </div>
        </Modal>

        {/* Premium Upgrade Screen */}
        {showPremium && (
          <div className="screen active premium-screen">
            <div className="premium-header">
              <button className="back-button" onClick={() => setShowPremium(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <h1>TORA Premium</h1>
              <div style={{ width: '24px' }}></div>
            </div>

            <div className="premium-content">
            <div className="premium-hero">
              <div className="premium-icon-large">
                <StarIcon />
              </div>
              <h2 className="premium-title">Unlock Global Access</h2>
              <p className="premium-description">
                Connect with music professionals worldwide and access exclusive features
              </p>
            </div>
            
            <div className="premium-features">
              <h3>Compare Plans</h3>
              <div className="features-table">
                <div className="features-table-header">
                  <div className="feature-name-col">Feature</div>
                  <div className="tier-col">Free</div>
                  <div className="tier-col">Monthly</div>
                  <div className="tier-col tier-col-highlight">Yearly</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">Search Visibility</div>
                  <div className="tier-value">User's city</div>
                  <div className="tier-value">Global</div>
                  <div className="tier-value tier-value-highlight">Global</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">Professional Dashboard</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                {(user?.role === 'ARTIST' || user?.role === 'AGENT') && (
                  <div className="features-table-row">
                    <div className="feature-name">Update Travel Schedule</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value">✓</div>
                    <div className="tier-value tier-value-highlight">✓</div>
                  </div>
                )}

                <div className="features-table-row">
                  <div className="feature-name">Calendar Matching</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">Tour Kick-starter</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                {(user?.role === 'PROMOTER' || user?.role === 'VENUE') && (
                  <div className="features-table-row">
                    <div className="feature-name">Artist Travel Alerts</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value tier-value-highlight">✓</div>
                  </div>
                )}

                <div className="features-table-row">
                  <div className="feature-name">Calendar Privacy Controls</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">Messaging</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">Priority Search Placement</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">Send Likes</div>
                  <div className="tier-value">2 x day</div>
                  <div className="tier-value">5 x day</div>
                  <div className="tier-value tier-value-highlight">Unlimited</div>
                </div>
              </div>

              <div className="premium-extras-note">
                <div className="extras-text">(10 EXTRA LIKES €2, 7-DAYS UNLIMITED LIKES €5)</div>
              </div>

              <div className="features-table" style={{ marginTop: '0' }}>
                <div className="features-table-row" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div className="feature-name">Connection Requests</div>
                  <div className="tier-value">3 x month</div>
                  <div className="tier-value">10 x month</div>
                  <div className="tier-value tier-value-highlight">Unlimited</div>
                </div>
              </div>

              <div className="premium-extras-note">
                <div className="extras-text">(1 EXTRA REQUEST €5, 5 EXTRA REQUESTS €15, 10 EXTRA CONTACTS €25)</div>
              </div>
            </div>
            
            {user?.role === 'AGENT' ? (
              <div style={{ marginTop: '24px' }}>
                <AgentTierLadder currentTier={user?.agentTier || null} />
              </div>
            ) : (
              <>
                <div className="premium-pricing">
                  <div className="price-card">
                    <h4>Monthly</h4>
                    <div className="price">€19.90<span>/month</span></div>
                    <button className="btn btn-outline" onClick={() => handleSelectPlan('monthly')}>Choose Monthly</button>
                  </div>
                  <div className="price-card featured">
                    <div className="badge">Save 21%</div>
                    <h4>Yearly</h4>
                    <div className="price">€189.90<span>/year</span></div>
                    <button className="btn btn-primary" onClick={() => handleSelectPlan('yearly')}>Choose Yearly</button>
                  </div>
                </div>

                <p className="premium-note">
                  Cancel anytime. All prices in EUR.
                </p>
              </>
            )}
          </div>
          </div>
        )}

        {/* Subscription Modal */}
        <Modal
          isOpen={showSubscription}
          onClose={() => setShowSubscription(false)}
          title={subscriptionStep === 'success' ? 'Welcome to TORA Premium!' : 'Complete Your Subscription'}
        >
          <div className="subscription-content">
            {subscriptionStep === 'payment' && (
              <>
                <div className="subscription-summary">
                  <h3>Order Summary</h3>
                  <div className="summary-item">
                    <span>TORA Premium</span>
                    <span className="summary-value">
                      {selectedPlan === 'monthly' ? '€19.90/month' : '€189.90/year'}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span>Plan Type</span>
                    <span className="summary-value">
                      {selectedPlan === 'monthly' ? 'Monthly' : 'Yearly (Save 21%)'}
                    </span>
                  </div>
                  <div className="summary-total">
                    <span>Total</span>
                    <span className="total-value">
                      {selectedPlan === 'monthly' ? '€19.90' : '€189.90'}
                    </span>
                  </div>
                </div>

                <div className="payment-section">
                  <h3>Payment Method</h3>
                  <div className="payment-methods">
                    <label className="payment-option">
                      <input type="radio" name="payment" defaultChecked />
                      <div className="payment-card">
                        <span className="payment-icon">💳</span>
                        <span>Credit/Debit Card</span>
                      </div>
                    </label>
                    <label className="payment-option">
                      <input type="radio" name="payment" />
                      <div className="payment-card">
                        <span className="payment-icon">📱</span>
                        <span>Apple Pay</span>
                      </div>
                    </label>
                    <label className="payment-option">
                      <input type="radio" name="payment" />
                      <div className="payment-card">
                        <span className="payment-icon">🅿️</span>
                        <span>PayPal</span>
                      </div>
                    </label>
                  </div>

                  <div className="card-details">
                    <input 
                      type="text" 
                      placeholder="Card Number" 
                      className="input-field"
                      maxLength="19"
                    />
                    <div className="card-row">
                      <input 
                        type="text" 
                        placeholder="MM/YY" 
                        className="input-field"
                        maxLength="5"
                      />
                      <input 
                        type="text" 
                        placeholder="CVV" 
                        className="input-field"
                        maxLength="3"
                      />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Cardholder Name" 
                      className="input-field"
                    />
                  </div>

                  <button 
                    className="btn btn-primary btn-full"
                    onClick={handlePaymentSubmit}
                  >
                    Subscribe Now
                  </button>
                  
                  <p className="payment-note">
                    🔒 Secure payment processed by Stripe
                  </p>
                </div>
              </>
            )}

            {subscriptionStep === 'processing' && (
              <div className="processing-state">
                <div className="spinner"></div>
                <h3>Processing Payment...</h3>
                <p>Please wait while we secure your subscription</p>
              </div>
            )}

            {subscriptionStep === 'success' && (
              <div className="success-state">
                <div className="success-icon">✨</div>
                <h2>You're Now Premium!</h2>
                <p>Welcome to TORA Premium. You now have access to all premium features.</p>
                
                <div className="success-features">
                  <div className="success-feature">
                    <span>✓</span> Global Search Unlocked
                  </div>
                  <div className="success-feature">
                    <span>✓</span> Calendar Matching Active
                  </div>
                  <div className="success-feature">
                    <span>✓</span> Unlimited Messages
                  </div>
                  <div className="success-feature">
                    <span>✓</span> Travel Mode Enabled
                  </div>
                </div>

                <button 
                  className="btn btn-primary btn-full"
                  onClick={handleSubscriptionComplete}
                >
                  Start Exploring
                </button>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </Router>
  );
}

export default App;