import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Header from './components/common/Header';
import TabBar from './components/common/TabBar';
import ProfileScreen from './components/screens/ProfileScreen';
import SearchScreen from './components/screens/SearchScreen';
import TourScreen from './components/screens/TourScreen';
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
import { CURRENCIES } from './utils/currencies';
import './styles/App.css';
import './styles/responsive.css';
import LoadingGlobe from './components/common/LoadingGlobe';
import VerificationModal from './components/common/VerificationModal';
import AppDialogHost from './components/common/AppDialogHost';
import { appConfirm } from './utils/dialogs';

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

  // Cross-screen tab navigation (e.g. ViewProfile -> Tour Kickstart).
  // Goes through switchTab so the target joins mountedTabs (keep-mounted
  // invariant) and scroll bookkeeping runs.
  useEffect(() => {
    const onNav = (e) => e.detail?.tab && switchTab(e.detail.tab);
    window.addEventListener('tora:navigate-tab', onNav);
    return () => window.removeEventListener('tora:navigate-tab', onNav);
  });

  // Keep-mounted tabs: once visited, a tab's screen stays mounted and is
  // hidden with display:none, so switching back is instant — no refetch,
  // no rebuild. Realtime subscriptions (deals, inbox) and the context poll
  // keep hidden tabs fresh. Scroll position is saved per tab.
  const [mountedTabs, setMountedTabs] = useState(['profile']);
  const appContentRef = useRef(null);
  const tabScrollPositions = useRef({});
  const switchTab = (tab) => {
    if (activeTab !== tab && appContentRef.current) {
      tabScrollPositions.current[activeTab] = appContentRef.current.scrollTop;
    }
    setActiveTab(tab);
    setMountedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
    // Overlays belong to the context they were opened in — close them all
    // when navigating to another tab
    setActiveChatUser(null);
    setViewingProfile(null);
    setShowSettings(false);
    setShowPremium(false);
  };
  useLayoutEffect(() => {
    if (appContentRef.current) {
      appContentRef.current.scrollTop = tabScrollPositions.current[activeTab] || 0;
    }
  }, [activeTab]);
  // Warm the remaining tabs shortly after login: they mount hidden and
  // fetch their data in the background, so even the FIRST visit to a tab
  // shows content immediately. Delayed so the landing tab paints first.
  useEffect(() => {
    if (!isAuthenticated) {
      setMountedTabs(['profile']);
      return;
    }
    const warmup = setTimeout(
      () => setMountedTabs(['profile', 'search', 'tour', 'bookings', 'messages']),
      1000
    );
    return () => clearTimeout(warmup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
  // Identity gate UX: any API call rejected with VERIFICATION_REQUIRED
  // raises this event (api.js interceptor) and we open the verify prompt.
  const [verifyPrompt, setVerifyPrompt] = useState(null);
  useEffect(() => {
    const onRequired = () => setVerifyPrompt({
      contextMessage: t('verify.blockedContext'),
    });
    window.addEventListener('tora:verification-required', onRequired);
    return () => window.removeEventListener('tora:verification-required', onRequired);
  }, []);
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
  const { updateUser, user, setPreferredCurrency: setContextCurrency, setAccountSubscriptionTier, setRefreshAccountUserCallback } = useAppContext();

  // Free-tier offer limit tripped anywhere: styled upgrade prompt. Declared
  // after t/setShowPremium so the [t] dependency isn't read before init.
  useEffect(() => {
    const onLimit = async (e) => {
      const limit = e.detail?.limit ?? 3;
      const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      const when = nextMonth.toLocaleDateString(t('dateFormat.locale'), { month: 'long', day: 'numeric' });
      const upgrade = await appConfirm(
        t('offer.limitMessage', { n: limit, date: when }),
        { title: t('offer.limitTitle'), confirmLabel: t('search.upgradeNow') }
      );
      if (upgrade) setShowPremium(true);
    };
    window.addEventListener('tora:offer-limit', onLimit);
    return () => window.removeEventListener('tora:offer-limit', onLimit);
  }, [t]);

  // Available currencies

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
        // Badge = unread messages + pending connection requests. Uses the
        // lightweight count endpoint instead of downloading every
        // conversation just to sum unreadCount fields.
        const [countData, requestsData] = await Promise.all([
          apiService.getUnreadCount(user.id),
          apiService.getReceivedRequests(user.id)
        ]);

        const requestsCount = (requestsData.requests || []).length;
        setUnreadMessagesCount((countData.unreadCount || 0) + requestsCount);
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
    // Depend on ids, not object identities — the AppContext poll republishes
    // `user` and would otherwise restart this effect every cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, activeChatUser?.id]);

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
    // next login starts fresh on the Profile tab
    setShowSettings(false);
    setShowPremium(false);
    setActiveChatUser(null);
    setViewingProfile(null);
    setActiveTab('profile');
  };

  const handlePasswordChange = async () => {
    setPasswordChangeError('');

    // Validate passwords
    if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
      setPasswordChangeError(t('auth.passwordsDontMatch'));
      return;
    }

    if (passwordChangeData.newPassword.length < 6) {
      setPasswordChangeError(t('auth.passwordMinLength'));
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
      setPasswordChangeError(error.message || t('settingsExtra.changePasswordFailed'));
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

  const tabScreens = {
    profile: <ProfileScreen onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} onSwitchTab={switchTab} />,
    search: <SearchScreen onOpenChat={setActiveChatUser} onNavigateToMessages={() => switchTab('messages')} onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} />,
    tour: <TourScreen onOpenChat={setActiveChatUser} onNavigateToMessages={() => switchTab('messages')} onUnreadProposalsChange={setUnreadProposalsCount} onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} isActive={activeTab === 'tour'} />,
    bookings: <BookingsScreen onOpenChat={setActiveChatUser} onNavigateToMessages={() => switchTab('messages')} isActive={activeTab === 'bookings'} />,
    // chatOpen (not a key remount): MessagesScreen refetches once when a
    // chat closes, to pick up read-state changes. A key here remounted the
    // permanently-mounted screen twice per chat session.
    messages: <MessagesScreen onOpenChat={setActiveChatUser} chatOpen={!!activeChatUser} isActive={activeTab === 'messages'} />,
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

  // Show loading screen while checking auth — just the brand globe, centered
  if (loading) {
    return (
      // .auth-screen CSS sets align-items:flex-start — !items-center overrides
      <div className="auth-screen flex min-h-[100dvh] !items-center justify-center">
        <LoadingGlobe label="" size={75} className="py-0" />
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
      <AppDialogHost />
        <Header
          onOpenSettings={() => setShowSettings(true)}
          onOpenPremium={() => setShowPremium(true)}
          accountUser={accountUser}
          onSwitchTab={switchTab}
        />
        <main className="app-content" ref={appContentRef}>
          {/* The active tab always renders even if a code path bypassed
              switchTab's mount bookkeeping — never a blank main area. */}
          {(mountedTabs.includes(activeTab) ? mountedTabs : [...mountedTabs, activeTab]).map((tab) => (
            <div
              key={tab}
              className="tab-panel"
              style={{ display: activeTab === tab ? undefined : 'none' }}
            >
              {tabScreens[tab]}
            </div>
          ))}
        </main>
        {verifyPrompt && (
          <VerificationModal
            contextMessage={verifyPrompt.contextMessage}
            onClose={() => setVerifyPrompt(null)}
          />
        )}
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
        <TabBar activeTab={activeTab} onTabChange={switchTab} unreadMessagesCount={unreadMessagesCount} unreadProposalsCount={unreadProposalsCount} />
        
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
                  <span>{t('settingsExtra.name')}</span>
                  <span className="settings-value">{[accountUser.firstName, accountUser.lastName].filter(Boolean).join(' ')}</span>
                </div>
              )}
              {accountUser?.phone && (
                <div className="settings-item">
                  <span>{t('settingsExtra.phone')}</span>
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
              <h3>{user?.role === 'AGENT' ? t('settingsExtra.agentPlan') : t('settingsExtra.subscriptionUsage')}</h3>

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
                      {t('premium.upgradeToPremium')}
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
                      {t('premium.upgradeToYearly')}
                    </button>
                  )}
                </div>
              )}

              {/* Trial Countdown */}
              {user?.subscriptionTier === 'TRIAL' && user?.trialEndDate && (
                <div className="trial-countdown-settings">
                  <div className="trial-countdown-icon">⏱️</div>
                  <div className="trial-countdown-text">
                    <strong>{t('settingsExtra.trialPeriod')}</strong>
                    <p>
                      {(() => {
                        const now = new Date();
                        const endDate = new Date(user.trialEndDate);
                        const diffTime = endDate - now;
                        if (diffTime <= 0) return t('settingsExtra.trialExpired');

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
                <h4>{t('settingsExtra.usageThisPeriod')}</h4>

                {/* Likes Today */}
                <div className="usage-item">
                  <div className="usage-header">
                    <span className="usage-label">{t('settingsExtra.likesToday')}</span>
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
                    {user?.subscriptionTier === 'YEARLY' ? t('settingsExtra.unlimitedLikes') : t('settingsExtra.resetsDaily')}
                  </div>
                </div>

                {/* Connections This Month */}
                <div className="usage-item">
                  <div className="usage-header">
                    <span className="usage-label">{t('settingsExtra.connectionsThisMonth')}</span>
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
                    {user?.subscriptionTier === 'YEARLY' ? t('settingsExtra.unlimitedConnections') : (() => {
                      const now = new Date();
                      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                      const daysUntil = Math.ceil((nextMonth - now) / (1000 * 60 * 60 * 24));
                      return t(daysUntil === 1 ? 'settingsExtra.resetsInDay' : 'settingsExtra.resetsInDays', { n: daysUntil, date: nextMonth.toLocaleDateString(t('dateFormat.locale'), { month: 'short', day: 'numeric' }) });
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
              <h3>{t('settingsExtra.preferredCurrency')}</h3>
              <select
                className="form-input currency-dropdown"
                value={preferredCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.symbol}  {curr.code} — {curr.name}
                  </option>
                ))}
              </select>
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
              <h3>{t('settingsExtra.emailPreferences')}</h3>
              <div className="settings-item">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={accountUser?.marketingConsent === true}
                    onChange={(e) => handleMarketingConsentChange(e.target.checked)}
                  />
                  <span>{t('settingsExtra.marketingToggle')}</span>
                </label>
              </div>
              <div className="settings-item">
                <label className="settings-toggle settings-toggle-locked">
                  <input type="checkbox" checked disabled readOnly />
                  <span>{t('settingsExtra.transactionalToggle')}</span>
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
                <button className="settings-link" onClick={() => window.open('https://torahub.io/terms', '_blank', 'noopener')}>{t('settings.termsOfService')}</button>
              </div>
              <div className="settings-item">
                <button className="settings-link" onClick={() => window.open('https://torahub.io/privacy', '_blank', 'noopener')}>{t('settings.privacyPolicy')}</button>
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
          title={t('settings.changePassword')}
        >
          <div className="password-change-content">
            {passwordChangeSuccess ? (
              <div className="success-state">
                <div className="success-icon">✓</div>
                <h3>{t('settingsExtra.passwordChanged')}</h3>
                <p>{t('settingsExtra.passwordUpdatedDesc')}</p>
              </div>
            ) : (
              <>
                {passwordChangeError && (
                  <div className="error-message">
                    {passwordChangeError}
                  </div>
                )}

                <div className="form-group">
                  <label>{t('settingsExtra.currentPassword')}</label>
                  <input
                    type="password"
                    value={passwordChangeData.currentPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      currentPassword: e.target.value
                    })}
                    placeholder={t('settingsExtra.enterCurrentPassword')}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>{t('auth.newPassword')}</label>
                  <input
                    type="password"
                    value={passwordChangeData.newPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      newPassword: e.target.value
                    })}
                    placeholder={t('auth.newPasswordPlaceholder')}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>{t('auth.confirmNewPassword')}</label>
                  <input
                    type="password"
                    value={passwordChangeData.confirmPassword}
                    onChange={(e) => setPasswordChangeData({
                      ...passwordChangeData,
                      confirmPassword: e.target.value
                    })}
                    placeholder={t('settingsExtra.reenterNewPassword')}
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
                  {passwordChangeLoading ? t('settingsExtra.changingPassword') : t('settings.changePassword')}
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
              <h1>{t('premium.title')}</h1>
              <div style={{ width: '24px' }}></div>
            </div>

            <div className="premium-content">
            <div className="premium-hero">
              <div className="premium-icon-large">
                <StarIcon />
              </div>
              <h2 className="premium-title">{t('premium.unlockGlobalAccess')}</h2>
              <p className="premium-description">
                {t('premium.subtitle')}
              </p>
            </div>
            
            <div className="premium-features">
              <h3>{t('premium.comparePlans')}</h3>
              <div className="features-table">
                <div className="features-table-header">
                  <div className="feature-name-col">{t('premium.feature')}</div>
                  <div className="tier-col">{t('premium.free')}</div>
                  <div className="tier-col">{t('premium.monthly')}</div>
                  <div className="tier-col tier-col-highlight">{t('premium.yearly')}</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">{t('premium.searchVisibility')}</div>
                  <div className="tier-value">{t('premium.usersCity')}</div>
                  <div className="tier-value">Global</div>
                  <div className="tier-value tier-value-highlight">Global</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">{t('premium.professionalDashboard')}</div>
                  <div className="tier-value">{t('premium.preview')}</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                {(user?.role === 'ARTIST' || user?.role === 'AGENT') && (
                  <div className="features-table-row">
                    <div className="feature-name">{t('premium.updateTravelSchedule')}</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value">✓</div>
                    <div className="tier-value tier-value-highlight">✓</div>
                  </div>
                )}

                <div className="features-table-row">
                  <div className="feature-name">{t('premium.calendarMatching')}</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">{t('premium.tourKickstarter')}</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                {(user?.role === 'PROMOTER' || user?.role === 'VENUE') && (
                  <div className="features-table-row">
                    <div className="feature-name">{t('premium.artistTravelAlerts')}</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value tier-value-highlight">✓</div>
                  </div>
                )}

                <div className="features-table-row">
                  <div className="feature-name">{t('premium.calendarPrivacy')}</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                {(user?.role === 'ARTIST' || user?.role === 'AGENT') && (
                  <div className="features-table-row">
                    <div className="feature-name">{t('premium.feePrivacy')}</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value tier-value-highlight">✓</div>
                  </div>
                )}

                <div className="features-table-row">
                  <div className="feature-name">{t('premium.messaging')}</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">{t('premium.prioritySearch')}</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <div className="feature-name">{t('premium.sendLikes')}</div>
                  <div className="tier-value">2 x day</div>
                  <div className="tier-value">5 x day</div>
                  <div className="tier-value tier-value-highlight">Unlimited</div>
                </div>
                <div className="features-table-row">
                  <div className="feature-name">{t('premium.sendOffers')}</div>
                  <div className="tier-value">{t('premium.perMonth', { n: 3 })}</div>
                  <div className="tier-value tier-value-highlight">{t('premium.unlimited')}</div>
                  <div className="tier-value tier-value-highlight">{t('premium.unlimited')}</div>
                </div>
              </div>

              <div className="premium-extras-note">
                <div className="extras-text">(5 EXTRA LIKES €2, 7-DAYS UNLIMITED LIKES €5)</div>
              </div>

              <div className="features-table" style={{ marginTop: '0' }}>
                <div className="features-table-row" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div className="feature-name">{t('premium.connectionRequests')}</div>
                  <div className="tier-value">3 x month</div>
                  <div className="tier-value">10 x month</div>
                  <div className="tier-value tier-value-highlight">Unlimited</div>
                </div>
              </div>

              <div className="premium-extras-note">
                <div className="extras-text">(1 EXTRA REQUEST €5, 3 EXTRA REQUESTS €12)</div>
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
                    <h4>{t('premium.monthly')}</h4>
                    <div className="price">€19.90<span>/month</span></div>
                    <button className="btn btn-outline" onClick={() => handleSelectPlan('monthly')}>Choose Monthly</button>
                  </div>
                  <div className="price-card featured">
                    <div className="badge">Save 21%</div>
                    <h4>{t('premium.yearly')}</h4>
                    <div className="price">€189.90<span>/year</span></div>
                    <button className="btn btn-primary" onClick={() => handleSelectPlan('yearly')}>Choose Yearly</button>
                  </div>
                </div>

                <p className="premium-note">
                  {t('premium.cancelAnytime')}
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
          title={subscriptionStep === 'success' ? t('premium.welcomeTitle') : t('premium.completeSubscription')}
        >
          <div className="subscription-content">
            {subscriptionStep === 'payment' && (
              <>
                <div className="subscription-summary">
                  <h3>{t('premium.orderSummary')}</h3>
                  <div className="summary-item">
                    <span>{t('premium.title')}</span>
                    <span className="summary-value">
                      {selectedPlan === 'monthly' ? '€19.90/month' : '€189.90/year'}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span>{t('premium.planType')}</span>
                    <span className="summary-value">
                      {selectedPlan === 'monthly' ? t('premium.monthly') : t('premium.yearlySave')}
                    </span>
                  </div>
                  <div className="summary-total">
                    <span>{t('premium.total')}</span>
                    <span className="total-value">
                      {selectedPlan === 'monthly' ? '€19.90' : '€189.90'}
                    </span>
                  </div>
                </div>

                <div className="payment-section">
                  <h3>{t('premium.paymentMethod')}</h3>
                  <div className="payment-methods">
                    <label className="payment-option">
                      <input type="radio" name="payment" defaultChecked />
                      <div className="payment-card">
                        <span className="payment-icon">💳</span>
                        <span>{t('premium.creditCard')}</span>
                      </div>
                    </label>
                    <label className="payment-option">
                      <input type="radio" name="payment" />
                      <div className="payment-card">
                        <span className="payment-icon">📱</span>
                        <span>{t('premium.applePay')}</span>
                      </div>
                    </label>
                    <label className="payment-option">
                      <input type="radio" name="payment" />
                      <div className="payment-card">
                        <span className="payment-icon">🅿️</span>
                        <span>{t('premium.paypal')}</span>
                      </div>
                    </label>
                  </div>

                  <div className="card-details">
                    <input 
                      type="text" 
                      placeholder={t('premium.cardNumber')} 
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
                      placeholder={t('premium.cardholderName')} 
                      className="input-field"
                    />
                  </div>

                  <button 
                    className="btn btn-primary btn-full"
                    onClick={handlePaymentSubmit}
                  >
                    {t('premium.subscribeNow')}
                  </button>
                  
                  <p className="payment-note">
                    🔒 Secure payment processed by Stripe
                  </p>
                </div>
              </>
            )}

            {subscriptionStep === 'processing' && (
              <div className="processing-state">
                <LoadingGlobe label="" className="py-2" />
                <h3>{t('premium.processingPayment')}</h3>
                <p>{t('premium.processingWait')}</p>
              </div>
            )}

            {subscriptionStep === 'success' && (
              <div className="success-state">
                <div className="success-icon">✨</div>
                <h2>{t('premium.nowPremium')}</h2>
                <p>{t('premium.welcomeDesc')}</p>
                
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
                  {t('premium.startExploring')}
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