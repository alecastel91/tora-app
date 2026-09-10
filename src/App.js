import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Header from './components/common/Header';
import TabBar from './components/common/TabBar';
import ProfileScreen from './components/screens/ProfileScreen';
import SearchScreen from './components/screens/SearchScreen';
import TourScreen from './components/screens/TourScreen';
import BookingsScreen from './components/screens/BookingsScreen';
import MessagesScreen from './components/screens/MessagesScreen';
import NewsScreen from './components/screens/NewsScreen';
import ChatScreen from './components/screens/ChatScreen';
import ViewProfileScreen from './components/screens/ViewProfileScreen';
import LoginScreen from './components/screens/LoginScreen';
import SignupScreen from './components/screens/SignupScreen';
import ForgotPasswordScreen from './components/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './components/screens/ResetPasswordScreen';
import Modal from './components/common/Modal';
import AgentSeatPricing from './components/common/AgentSeatPricing';
import AgentTierCard from './components/common/AgentTierCard';
import ExtrasShop from './components/common/ExtrasShop';
import { rosterUsage } from './utils/agentTiers';
import { billingTier } from './utils/subscription';
import { useLanguage } from './contexts/LanguageContext';
import { useAppContext } from './contexts/AppContext';
import apiService from './services/api';
import { StarIcon } from './utils/icons';
import { CURRENCIES } from './utils/currencies';
import './styles/App.css';
import './styles/responsive.css';
import LoadingGlobe from './components/common/LoadingGlobe';
import AchievementsScreen from './components/screens/AchievementsScreen';
import InviteFriendsSection from './components/common/InviteFriendsSection';
import VerificationModal from './components/common/VerificationModal';
import AppDialogHost from './components/common/AppDialogHost';
import CelebrationHost from './components/common/CelebrationHost';
import StripeCheckout from './components/common/StripeCheckout';
import BetaTools from './components/common/BetaTools';
import AssistantChat from './components/common/AssistantChat';
import GuideScreen from './components/common/GuideScreen';
import GettingStartedSheet from './components/common/GettingStartedSheet';
import PushSettingsToggle from './components/common/PushSettingsToggle';
import PushNudge from './components/common/PushNudge';
import InstallSheet, { InstallSettingsSection } from './components/common/InstallSheet';
import ToastHost from './components/common/ToastHost';
import { isStandalone } from './services/install';
import { appConfirm, appAlert } from './utils/dialogs';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // /reset-password?token=... on boot enters the reset flow. URL is stable
  // after mount, so the token is a one-shot const rather than state.
  const resetToken = typeof window !== 'undefined' && window.location.pathname === '/reset-password'
    ? new URLSearchParams(window.location.search).get('token')
    : null;
  // 'login' | 'signup' | 'forgot' | 'reset'
  // ?code=TORA-... in the URL (invitation emails link here) boots straight
  // into Activate Your Account with the code prefilled — no hunting for the
  // signup link on the login screen.
  const inviteCodeFromUrl = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('code') || ''
    : '';
  const [authMode, setAuthMode] = useState(resetToken ? 'reset' : (inviteCodeFromUrl ? 'signup' : 'login'));
  const [loading, setLoading] = useState(true);
  // News is home: first tab in the bar, and where every session starts.
  const HOME_TAB = 'news';
  const [activeTab, setActiveTab] = useState(HOME_TAB);

  // Cross-screen tab navigation (e.g. ViewProfile -> Tour Kickstart).
  // Goes through switchTab so the target joins mountedTabs (keep-mounted
  // invariant) and scroll bookkeeping runs.
  useEffect(() => {
    const onNav = (e) => e.detail?.tab && switchTab(e.detail.tab);
    window.addEventListener('tora:navigate-tab', onNav);
    return () => window.removeEventListener('tora:navigate-tab', onNav);
  });

  // A push-notification tap while the app is open: the service worker posts
  // the target URL (/?tab=...) instead of re-navigating the window. A tap
  // that LAUNCHES the app arrives as a real URL — handled by the same param.
  useEffect(() => {
    const toTab = (url) => {
      const tab = new URL(url, window.location.origin).searchParams.get('tab');
      if (tab) switchTab(tab);
    };
    const onSwMessage = (e) => {
      if (e.data?.type === 'tora:push-navigate' && e.data.url) toTab(e.data.url);
    };
    navigator.serviceWorker?.addEventListener?.('message', onSwMessage);
    // Cold start from a notification tap:
    const bootTab = new URLSearchParams(window.location.search).get('tab');
    if (bootTab) switchTab(bootTab);
    // Opening (or returning to) the app clears the icon badge the push set.
    const clearBadge = () => {
      if (document.visibilityState === 'visible') navigator.clearAppBadge?.().catch(() => {});
    };
    clearBadge();
    document.addEventListener('visibilitychange', clearBadge);
    return () => {
      navigator.serviceWorker?.removeEventListener?.('message', onSwMessage);
      document.removeEventListener('visibilitychange', clearBadge);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep-mounted tabs: once visited, a tab's screen stays mounted and is
  // hidden with display:none, so switching back is instant — no refetch,
  // no rebuild. Realtime subscriptions (deals, inbox) and the context poll
  // keep hidden tabs fresh. Scroll position is saved per tab.
  const [mountedTabs, setMountedTabs] = useState([HOME_TAB]);
  const appContentRef = useRef(null);
  const tabScrollPositions = useRef({});
  const switchTab = (tab) => {
    if (activeTab !== tab && appContentRef.current) {
      tabScrollPositions.current[activeTab] = appContentRef.current.scrollTop;
    }
    setActiveTab(tab);
    setMountedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));
    // Activation checklist: "explore Tour Kickstart" completes on first visit.
    // Keyed by the ACTIVE PROFILE id — the same key the checklist reads.
    if (tab === 'tour' && user?.id) {
      localStorage.setItem(`tora:visited-tour:${user.id}`, '1');
    }
    closeAllOverlays();
  };

  // Open a conversation AND land on the Messages tab.
  //
  // Callers used to do this as two calls — onOpenChat(profile) then
  // onNavigateToMessages() — which quietly cancelled itself: switchTab runs
  // closeAllOverlays, so the second call wiped the chat the first had just
  // opened and the user arrived at the conversation list instead. Doing both
  // here makes the order explicit (clear, then set) and gives the three
  // screens one thing to call.
  const openChatInMessages = (profile, deal = null) => {
    if (!profile) return;
    closeAllOverlays();
    setActiveTab('messages');
    setMountedTabs((prev) => (prev.includes('messages') ? prev : [...prev, 'messages']));
    setActiveChatUser(profile);
    setChatOpenDeal(deal);
  };

  // Overlays belong to the context they were opened in — closed on tab
  // navigation and on logout (a stale overlay otherwise survives re-login).
  const closeAllOverlays = () => {
    setActiveChatUser(null);
    setChatOpenDeal(null);
    setViewingProfile(null);
    setShowSettings(false);
    setShowPremium(false);
    setShowAchievements(false);
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
      setMountedTabs([HOME_TAB]);
      return;
    }
    const warmup = setTimeout(
      () => setMountedTabs([HOME_TAB, 'search', 'profile', 'tour', 'bookings', 'messages']),
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
  // The written guide is what the help icon opens; the Assistant is offered
  // from inside it rather than being the only way in.
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    const open = () => setShowGuide(true);
    window.addEventListener('tora:open-guide', open);
    return () => window.removeEventListener('tora:open-guide', open);
  }, []);
  const [activeChatUser, setActiveChatUser] = useState(null);
  // Deal the chat should open on arrival (Bookings "Review" CTA) — consumed once.
  const [chatOpenDeal, setChatOpenDeal] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  // Agent per-seat detail ({ seats, amount, priceLabel, perMonthLabel }) so the
  // summary shows the roster-based price instead of the personal-tier default.
  const [planDetail, setPlanDetail] = useState(null);
  // Real charge quoted by the backend once checkout mounts — on plan changes
  // this is the prorated difference, not the headline plan price.
  const [checkoutQuote, setCheckoutQuote] = useState(null);
  const [subscriptionStep, setSubscriptionStep] = useState('payment'); // payment, processing, success
  const [infoFeature, setInfoFeature] = useState(null); // premium feature whose explainer is open
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
  // Bookings tab notification dot: shows whenever there are pending booking
  // actions (offers, counters, contracts to sign/send, payments to mark/confirm)
  // and the user isn't currently on the Bookings tab. It persists until those
  // actions are actually handled (the count drops to 0), so a still-unhandled
  // item keeps signalling instead of vanishing after one glance.
  const [bookingsActionCount, setBookingsActionCount] = useState(0);
  // First-login "Getting started" carousel (reopenable from Settings).
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [preferredCurrency, setPreferredCurrency] = useState('USD');
  const [accountUser, setAccountUser] = useState(null); // Account-level user data (email, currency, etc)

  // Show Getting Started once per ACCOUNT (server-side onboardedAt — any
  // device). Skip counts as seen; reopenable from Settings. The localStorage
  // flag is only a fast-path guard for accounts that closed it before the
  // next /auth/me refresh.
  useEffect(() => {
    if (
      isAuthenticated && accountUser?.id && !accountUser.onboardedAt
      && !localStorage.getItem(`tora:onboarded:${accountUser.id}`)
    ) {
      setShowGettingStarted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accountUser?.id, accountUser?.onboardedAt]);
  // Install tracking: running standalone means the PWA is installed — record
  // it once per device (server keeps only the first timestamp per user).
  useEffect(() => {
    if (isAuthenticated && isStandalone() && !localStorage.getItem('tora:pwa-tracked')) {
      apiService.markPwaInstalled()
        .then(() => localStorage.setItem('tora:pwa-tracked', '1'))
        .catch(() => {}); // retried on a later launch
    }
  }, [isAuthenticated]);

  const closeGettingStarted = () => {
    if (accountUser?.id) {
      localStorage.setItem(`tora:onboarded:${accountUser.id}`, '1');
      if (!accountUser.onboardedAt) {
        setAccountUser((u) => (u ? { ...u, onboardedAt: new Date().toISOString() } : u));
        apiService.updateUserPreferences({ onboarded: true }).catch(() => {});
      }
    }
    setShowGettingStarted(false);
  };
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

  // Open the Premium screen from anywhere (e.g. the agent at-cap modal).
  useEffect(() => {
    const openPremium = () => setShowPremium(true);
    window.addEventListener('tora:open-premium', openPremium);
    return () => window.removeEventListener('tora:open-premium', openPremium);
  }, []);

  // Token expired/invalid mid-session (F6-01). api.js raises this on a
  // token-rejection 401; without it the app looked logged in while every call
  // failed, recovering only on a manual reload. Clear the dead token locally
  // (no backend /logout — the token is already rejected) and drop to login.
  useEffect(() => {
    const onExpired = () => {
      apiService.removeToken();
      updateUser(null);
      closeAllOverlays();
      setActiveTab(HOME_TAB);
      setIsAuthenticated(false);
    };
    window.addEventListener('tora:session-expired', onExpired);
    return () => window.removeEventListener('tora:session-expired', onExpired);
  }, [updateUser]);


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
    // Clear the previous profile's badges immediately on switch (F6-02): these
    // counts are App-level state, so without this reset the new profile's tab
    // bar briefly shows the old profile's unread count / bookings dot until the
    // async refetch below lands. Zero-then-fill avoids the cross-profile flash.
    setUnreadMessagesCount(0);
    setBookingsActionCount(0);

    const fetchUnreadCount = async () => {
      if (!isAuthenticated || !user || !user.id) return;

      try {
        // Badge = unread messages + pending connection requests. Uses the
        // lightweight count endpoint instead of downloading every
        // conversation just to sum unreadCount fields.
        const [countData, requestsData, actionData] = await Promise.all([
          apiService.getUnreadCount(user.id),
          apiService.getReceivedRequests(user.id),
          apiService.getActionSummary(user.id).catch(() => null)
        ]);

        const requestsCount = (requestsData.requests || []).length;
        setUnreadMessagesCount((countData.unreadCount || 0) + requestsCount);

        // Bookings dot: count booking-workflow actions only (representation
        // requests route to Messages, not Bookings).
        if (actionData?.counts?.byType) {
          const bt = actionData.counts.byType;
          const bookingCount =
            (bt.offer_received || 0) +
            (bt.counter_offer_pending || 0) +
            (bt.contract_to_send || 0) +
            (bt.contract_to_sign || 0) +
            (bt.payment_to_mark_sent || 0) +
            (bt.payment_to_confirm_received || 0);
          setBookingsActionCount(bookingCount);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    // Refresh every 30 seconds when authenticated — but only while the tab is
    // actually being looked at. A background tab polling around the clock is
    // work nobody sees: it was the bulk of the traffic on prod, and there is
    // nothing to update in a view that isn't on screen.
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (isAuthenticated && user && user.id) {
        fetchUnreadCount();
      }
    }, 30000);

    // Coming back to the tab refreshes immediately, so pausing never shows a
    // stale badge.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && user?.id) {
        fetchUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
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

  // Delete account (Settings): password re-check, then the GDPR cascade.
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const closeDeleteAccount = () => {
    setShowDeleteAccount(false);
    setDeleteAccountPassword('');
    setDeleteAccountError('');
  };
  const handleDeleteAccount = async () => {
    if (!deleteAccountPassword || deleteAccountBusy) return;
    setDeleteAccountBusy(true);
    setDeleteAccountError('');
    try {
      await apiService.deleteAccount(deleteAccountPassword);
      closeDeleteAccount();
      handleLogout();
      appAlert(t('settings.accountDeleted'));
    } catch (err) {
      setDeleteAccountError(err.message || t('settings.deleteAccountFailed'));
    } finally {
      setDeleteAccountBusy(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    updateUser(null);
    // next login starts fresh on the home tab
    closeAllOverlays();
    setActiveTab(HOME_TAB);
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
    profile: <ProfileScreen onOpenPremium={() => setShowPremium(true)} onOpenAchievements={() => setShowAchievements(true)} accountUser={accountUser} onSwitchTab={switchTab} />,
    search: <SearchScreen onOpenChat={openChatInMessages} onNavigateToMessages={() => switchTab('messages')} onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} />,
    news: <NewsScreen onOpenProfile={(profile) => setViewingProfile(profile)} onOpenPremium={() => setShowPremium(true)} />,
    tour: <TourScreen onOpenChat={openChatInMessages} onNavigateToMessages={() => switchTab('messages')} onUnreadProposalsChange={setUnreadProposalsCount} onOpenPremium={() => setShowPremium(true)} accountUser={accountUser} isActive={activeTab === 'tour'} />,
    bookings: <BookingsScreen onOpenChat={openChatInMessages} onNavigateToMessages={() => switchTab('messages')} isActive={activeTab === 'bookings'} onActionCountChange={setBookingsActionCount} />,
    // chatOpen (not a key remount): MessagesScreen refetches once when a
    // chat closes, to pick up read-state changes. A key here remounted the
    // permanently-mounted screen twice per chat session.
    messages: <MessagesScreen onOpenChat={openChatInMessages} chatOpen={!!activeChatUser} isActive={activeTab === 'messages'} />,
  };

  // Stripe-hosted billing portal: update card, view invoices, cancel.
  const handleOpenBillingPortal = async () => {
    try {
      const res = await apiService.openBillingPortal({ profileId: user?.id, returnUrl: window.location.href });
      if (res?.url) window.location.assign(res.url);
    } catch (e) {
      appAlert(e.message || t('premium.paymentFailed'));
    }
  };

  // Billing status line in Settings — renewal date, or the access-until date
  // after a cancellation.
  const [billingInfo, setBillingInfo] = useState(null);
  const refreshBillingInfo = useCallback(() => {
    if (!user?.id || !['MONTHLY', 'YEARLY'].includes(user?.subscriptionTier)) { setBillingInfo(null); return; }
    apiService.getBillingStatus(user.id).then(setBillingInfo).catch(() => setBillingInfo(null));
  }, [user?.id, user?.subscriptionTier]);
  useEffect(() => { if (showSettings) refreshBillingInfo(); }, [showSettings, refreshBillingInfo]);

  const handleCancelSubscription = async () => {
    if (!(await appConfirm(t('premium.cancelSubConfirm')))) return;
    try {
      const res = await apiService.cancelSubscription(user?.id);
      // Complimentary plans don't renew, so there is nothing to cancel — the
      // server says so and we explain rather than claiming a cancellation.
      appAlert(res?.noRenewal
        ? t('premium.subNoRenewal', { date: res.accessUntil ? new Date(res.accessUntil).toLocaleDateString(t('dateFormat.locale')) : '—' })
        : t('premium.cancelSubDone'));
      refreshBillingInfo();
    } catch (e) {
      appAlert(e.message || t('premium.paymentFailed'));
    }
  };

  // Deep link from lifecycle emails: /?upgrade=premium opens the Premium page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') && user?.id) {
      setShowPremium(true);
      params.delete('upgrade');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSelectPlan = (plan, detail = null) => {
    setSelectedPlan(plan);
    setPlanDetail(detail);
    setCheckoutQuote(null);
    // Keep the Premium screen mounted underneath so closing the checkout
    // returns there (not to the profile page).
    setShowSubscription(true);
    setSubscriptionStep('payment');
  };

  // Closing the checkout mid-flow returns to TORA Premium; on the success
  // step it finishes and drops the user into the app.
  const handleCloseSubscription = () => {
    if (subscriptionStep === 'success') { handleSubscriptionComplete(); return; }
    setShowSubscription(false);
    setSelectedPlan(null);
    setPlanDetail(null);
  };

  // A feature-table label that reveals a plain-language explainer when tapped.
  // Keeps the comparison table scannable while making each row self-explaining
  // for people who don't yet know the app's vocabulary.
  const FeatureName = ({ k }) => (
    <button type="button" className="feature-name feature-name-info" onClick={() => setInfoFeature(k)}>
      <span>{t(`premium.${k}`)}</span>
      <svg className="feature-info-dot" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="7.5" r="1.1" fill="currentColor" />
      </svg>
    </button>
  );

  const handleSubscriptionComplete = () => {
    setShowSubscription(false);
    setShowPremium(false);
    setSubscriptionStep('payment');
    setSelectedPlan(null);
    setPlanDetail(null);
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
        <>
          <SignupScreen
            onSignupSuccess={handleSignupSuccess}
            onSwitchToLogin={() => setAuthMode('login')}
            initialCode={inviteCodeFromUrl}
          />
          <InstallSheet delay={4500} />
        </>
      );
    }
    return (
      <>
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onSwitchToSignup={() => setAuthMode('signup')}
          onSwitchToForgotPassword={() => setAuthMode('forgot')}
        />
        {/* Install CTA before login too — long delay so the intro splash
            (form fades in ~2.8s, splash gone at 3.5s) finishes first. */}
        <InstallSheet delay={4500} />
      </>
    );
  }

  return (
    <Router>
      <div className={`app-container tab-${activeTab}`}>
        <BetaTools />
      <AppDialogHost />
      <ToastHost />
      <CelebrationHost />
        <AssistantChat />
        {showGuide && <GuideScreen onClose={() => setShowGuide(false)} />}
        <GettingStartedSheet open={showGettingStarted} onClose={closeGettingStarted} />
        <Header
          onOpenSettings={() => setShowSettings(true)}
          onSwitchTab={switchTab}
          activeTab={activeTab}
        />
        <main className="app-content" ref={appContentRef}>
          {/* Notifications soft-ask: visible right after login on ANY tab
              (one card, dismissible; native prompt only on its button). */}
          <PushNudge />
          {/* First-run "Get the app" install sheet — browser-only (never in
              the installed PWA), one-tap native install where supported. */}
          <InstallSheet />
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
            key={activeChatUser.id} // a chat switch remounts: fresh load state, no leaked thread
            user={activeChatUser}
            openDeal={chatOpenDeal}
            onOpenDealHandled={() => setChatOpenDeal(null)}
            onClose={() => { setActiveChatUser(null); setChatOpenDeal(null); }}
            onOpenProfile={(profile) => setViewingProfile(profile)}
          />
        )}
        {viewingProfile && (
          <ViewProfileScreen
            profile={viewingProfile}
            onClose={() => setViewingProfile(null)}
            onOpenChat={openChatInMessages}
          />
        )}
        <TabBar activeTab={activeTab} onTabChange={switchTab} unreadMessagesCount={unreadMessagesCount} unreadProposalsCount={unreadProposalsCount} bookingsHasDot={bookingsActionCount > 0 && activeTab !== 'bookings'} />
        
        {/* Achievements Screen */}
        {showAchievements && (
          <AchievementsScreen onClose={() => setShowAchievements(false)} />
        )}

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
            {/* Subscription & Usage Section */}
            <div className="settings-section subscription-section">
              <h3>{user?.role === 'AGENT' ? t('settingsExtra.agentPlan') : t('settingsExtra.subscriptionUsage')}</h3>
              {/* The Premium page left the header (2026-09-06); this card is
                  its entrance for every tier and role. */}
              <div className="settings-premium-card">
                <strong>{t('premium.title')}</strong>
                <p>{t('settingsExtra.premiumTeaser')}</p>
                <button
                  className="btn btn-primary"
                  onClick={() => { setShowSettings(false); setShowPremium(true); }}
                >
                  {t('settingsExtra.explorePremium')}
                </button>
              </div>

              {user?.role === 'AGENT' ? (
                <>
                  <AgentTierCard
                    profile={user}
                    onManage={() => { setShowSettings(false); setShowPremium(true); }}
                  />
                  {['MONTHLY', 'YEARLY'].includes(user?.subscriptionTier) && (
                    <button className="btn btn-outline btn-full manage-billing-btn" onClick={handleOpenBillingPortal}>
                      {t('premium.manageBilling')}
                    </button>
                  )}
                </>
              ) : (
                <>
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
                  {/* Full-width by design — must sit OUTSIDE the pill row or
                      the row overflows the viewport on MONTHLY. */}
                  {['MONTHLY', 'YEARLY'].includes(user?.subscriptionTier) && (
                    <>
                      <button className="btn btn-outline btn-full manage-billing-btn" onClick={handleOpenBillingPortal}>
                        {t('premium.manageBilling')}
                      </button>
                      <button className="btn btn-outline btn-full manage-billing-btn" onClick={handleCancelSubscription}>
                        {t('premium.cancelSubscription')}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Renewal / cancellation status line. refreshBillingInfo
                  already clears this for non-paid tiers. */}
              {billingInfo?.renewsAt && (
                <p className={`billing-status-line${billingInfo.cancelAtPeriodEnd ? ' is-cancelled' : ''}`}>
                  {t(billingInfo.cancelAtPeriodEnd ? 'premium.subEndsOn'
                    : billingInfo.hasStripe ? 'premium.subRenewsOn' : 'premium.subNoRenewal',
                  { date: new Date(billingInfo.renewsAt).toLocaleDateString(t('dateFormat.locale')) })}
                </p>
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

            <div className="settings-section">
              <h3>{t('settings.language')}</h3>
              <select
                className="form-input currency-dropdown"
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </option>
                ))}
              </select>
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

            <InviteFriendsSection />

            <div className="settings-section">
              <h3>{t('onboarding.helpSection')}</h3>
              <button
                type="button"
                className="btn btn-outline btn-full-width"
                onClick={() => { setShowSettings(false); setShowGettingStarted(true); }}
              >
                {t('onboarding.reopen')}
              </button>
            </div>

            <div className="settings-section">
              <h3>{t('push.settingsSection')}</h3>
              <PushSettingsToggle />
            </div>

            <div className="settings-section">
              <h3>{t('install.settingsSection')}</h3>
              <InstallSettingsSection />
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
              <button className="btn btn-danger" onClick={() => setShowDeleteAccount(true)}>{t('settings.deleteAccount')}</button>
            </div>
            </div>
          </div>
        )}

        {/* Delete Account Modal — App Store + GDPR self-service deletion */}
        <Modal isOpen={showDeleteAccount} onClose={closeDeleteAccount} title={t('settings.deleteAccount')}>
          <div className="password-change-content">
            <p className="text-sm text-white/70 mb-4">{t('settings.deleteAccountWarning')}</p>
            {deleteAccountError && <div className="error-message">{deleteAccountError}</div>}
            <div className="form-group">
              <label>{t('settingsExtra.currentPassword')}</label>
              <input
                type="password"
                value={deleteAccountPassword}
                onChange={(e) => setDeleteAccountPassword(e.target.value)}
                placeholder={t('settingsExtra.enterCurrentPassword')}
                className="form-input"
                autoComplete="current-password"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-outline btn-full" onClick={closeDeleteAccount} disabled={deleteAccountBusy}>{t('common.cancel')}</button>
              <button className="btn btn-danger btn-full" onClick={handleDeleteAccount} disabled={deleteAccountBusy || !deleteAccountPassword}>
                {deleteAccountBusy ? t('common.loading') : t('settings.deleteAccountConfirm')}
              </button>
            </div>
          </div>
        </Modal>

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
        {showPremium && (() => {
          // Billing view: a comp (admin-operated) account is shown the public
          // prices — see billingTier. Paid agents keep their real seats/plan.
          const paidAgent = user?.role === 'AGENT' && billingTier(user) !== 'FREE';
          return (
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
                  <FeatureName k="searchVisibility" />
                  <div className="tier-value">{t('premium.usersCity')}</div>
                  <div className="tier-value">Global</div>
                  <div className="tier-value tier-value-highlight">Global</div>
                </div>

                <div className="features-table-row">
                  <FeatureName k="professionalDashboard" />
                  <div className="tier-value">{t('premium.preview')}</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                {(user?.role === 'ARTIST' || user?.role === 'AGENT') && (
                  <div className="features-table-row">
                    <FeatureName k="updateTravelSchedule" />
                    <div className="tier-value">—</div>
                    <div className="tier-value">✓</div>
                    <div className="tier-value tier-value-highlight">✓</div>
                  </div>
                )}

                <div className="features-table-row">
                  <FeatureName k="calendarMatching" />
                  <div className="tier-value">—</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <FeatureName k="tourKickstarter" />
                  <div className="tier-value">—</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                {(user?.role === 'PROMOTER' || user?.role === 'VENUE') && (
                  <div className="features-table-row">
                    <FeatureName k="artistTravelAlerts" />
                    <div className="tier-value">—</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value tier-value-highlight">✓</div>
                  </div>
                )}

                <div className="features-table-row">
                  <FeatureName k="calendarPrivacy" />
                  <div className="tier-value">—</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                {(user?.role === 'ARTIST' || user?.role === 'AGENT') && (
                  <div className="features-table-row">
                    <FeatureName k="feePrivacy" />
                    <div className="tier-value">—</div>
                    <div className="tier-value">—</div>
                    <div className="tier-value tier-value-highlight">✓</div>
                  </div>
                )}

                <div className="features-table-row">
                  <FeatureName k="messaging" />
                  <div className="tier-value">✓</div>
                  <div className="tier-value">✓</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <FeatureName k="prioritySearch" />
                  <div className="tier-value">—</div>
                  <div className="tier-value">—</div>
                  <div className="tier-value tier-value-highlight">✓</div>
                </div>

                <div className="features-table-row">
                  <FeatureName k="sendLikes" />
                  <div className="tier-value">2 x day</div>
                  <div className="tier-value">5 x day</div>
                  <div className="tier-value tier-value-highlight">Unlimited</div>
                </div>
                <div className="features-table-row">
                  <FeatureName k="sendOffers" />
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
                  <FeatureName k="connectionRequests" />
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
                {/* Current status: seats used / purchased + which plan is active */}
                {(() => {
                  const usage = rosterUsage(user);
                  const capLabel = usage.cap === Infinity ? '∞' : usage.cap;
                  const pct = usage.cap === Infinity ? 100 : Math.min(100, Math.round((usage.current / Math.max(usage.cap, 1)) * 100));
                  return (
                    <div className="agent-status-banner">
                      <div className="agent-status-main">
                        <div className="agent-status-roster">
                          <span className="agent-status-count">{usage.current} / {capLabel}</span>
                          <span className="agent-status-label">{t('agentSeat.seatsUsed')}</span>
                        </div>
                        <div className="agent-status-bar"><span style={{ width: `${pct}%` }} /></div>
                      </div>
                      <span className={`agent-status-plan${paidAgent ? ' is-paid' : ''}`}>
                        {paidAgent ? t('agentSeatCard.perSeatPlan') : t('agentSeatCard.freePlan')}
                      </span>
                    </div>
                  );
                })()}
                <AgentSeatPricing
                  rosterCount={user?.representingArtists?.length || 0}
                  currentSeats={paidAgent ? (user?.agentSeats || 0) : 0}
                  isPaid={paidAgent}
                  currentInterval={user?.subscriptionTier === 'YEARLY' ? 'year' : 'month'}
                  onSubscribe={(interval, detail) => handleSelectPlan(interval === 'year' ? 'yearly' : 'monthly', detail)}
                />
              </div>
            ) : (() => {
              // Reflect the current plan: a Monthly subscriber sees Monthly as
              // their current plan and Yearly as an upgrade; a Yearly subscriber
              // is already at the top; FREE/TRIAL sees both as choices.
              const hasMonthly = billingTier(user) === 'MONTHLY';
              const hasYearly = billingTier(user) === 'YEARLY';
              return (
              <>
                <div className="premium-pricing">
                  {/* Monthly always leads — the first price on the page is
                      the small one. A Yearly subscriber sees it inert. */}
                  <div className={`price-card${hasMonthly ? ' is-current' : ''}`}>
                    {hasMonthly && <div className="badge badge-current">{t('premium.currentPlan')}</div>}
                    <h4>{t('premium.monthly')}</h4>
                    <div className="price">€19.90<span>/month</span></div>
                    {hasMonthly ? (
                      <button className="btn btn-outline" disabled>{t('premium.currentPlan')}</button>
                    ) : hasYearly ? (
                      <button className="btn btn-outline" disabled>{t('premium.onYearlyAlready')}</button>
                    ) : (
                      <button className="btn btn-outline" onClick={() => handleSelectPlan('monthly')}>{t('premium.chooseMonthly')}</button>
                    )}
                  </div>
                  <div className={`price-card featured${hasYearly ? ' is-current' : ''}`}>
                    <div className="badge">{hasYearly ? t('premium.currentPlan') : t('premium.yearlySaveBadge')}</div>
                    <h4>{t('premium.yearly')}</h4>
                    <div className="price">€199.90<span>/year</span></div>
                    {hasYearly ? (
                      <button className="btn btn-primary" disabled>{t('premium.currentPlan')}</button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => handleSelectPlan('yearly')}>
                        {hasMonthly ? t('premium.upgradeToYearly') : t('premium.chooseYearly')}
                      </button>
                    )}
                  </div>
                </div>

                <p className="premium-note">
                  {t('premium.cancelAnytime')}
                </p>
              </>
              );
            })()}

            <ExtrasShop user={user} />
          </div>
          </div>
          );
        })()}

        {/* Feature explainer — plain-language description of a table row */}
        <Modal
          isOpen={!!infoFeature}
          onClose={() => setInfoFeature(null)}
          className="explainer-modal"
          title={infoFeature ? t(`premium.${infoFeature}`) : ''}
        >
          <div className="feature-explainer">
            <p className="feature-explainer-text">
              {infoFeature ? t(`premium.explain.${infoFeature}`) : ''}
            </p>
            <button className="btn btn-primary btn-full" onClick={() => setInfoFeature(null)}>
              {t('common.gotIt')}
            </button>
          </div>
        </Modal>

        {/* Subscription Modal */}
        <Modal
          isOpen={showSubscription}
          onClose={handleCloseSubscription}
          className="subscription-modal"
          title={subscriptionStep === 'success' ? t('premium.welcomeTitle') : t('premium.completeSubscription')}
        >
          <div className="subscription-content">
            {subscriptionStep === 'payment' && (() => {
              // Agents subscribe on the per-seat scale (planDetail carries the
              // configured roster price); everyone else on the personal tier.
              const isYearly = selectedPlan === 'yearly';
              const cycleWord = isYearly ? t('agentSeat.perYear') : t('agentSeat.perMonth');
              const priceLabel = planDetail?.priceLabel || (isYearly ? '€199.90' : '€19.90');
              const perMonthEq = planDetail ? planDetail.perMonthLabel : '€16.66';
              const planName = planDetail
                ? `${planDetail.seats} ${t('agentSeat.artists')}`
                : t('premium.title');
              const addedSeats = planDetail?.added || 0;
              return (
              <>
                <div className="subscription-summary">
                  <div className="summary-plan">
                    <div className="summary-plan-name">
                      {planName}
                      <span className="summary-plan-cycle">
                        {isYearly ? t('premium.yearly') : t('premium.monthly')}
                      </span>
                    </div>
                    <div className="summary-plan-price">
                      {priceLabel}
                      <em>/{cycleWord}</em>
                    </div>
                  </div>
                  {addedSeats > 0 && (
                    <div className="summary-breakdown">
                      <div className="summary-breakdown-row">
                        <span>{t('premium.inPlanSeats', { n: planDetail.currentSeats })}</span>
                        <span>{planDetail.currentPriceLabel}/{cycleWord}</span>
                      </div>
                      <div className="summary-breakdown-row is-add">
                        <span>{t('premium.addingSeatsRow', { n: addedSeats })}</span>
                        <span>+{planDetail.addedPriceLabel}/{cycleWord}</span>
                      </div>
                    </div>
                  )}
                  {isYearly && perMonthEq && (
                    <div className="summary-saving">
                      <span className="summary-saving-badge">{t('premium.yearlySaveBadge')}</span>
                      <span className="summary-saving-eq">≈ {perMonthEq}/{t('agentSeat.perMonth')}</span>
                    </div>
                  )}
                  {(() => {
                    // The backend quote is the real charge: prorated on plan
                    // changes, discounted under a launch coupon. Show it as
                    // "Due today" whenever it differs from the headline price.
                    const showDue = (checkoutQuote?.change || checkoutQuote?.coupon) && checkoutQuote.amountDue != null;
                    return (
                      <>
                        <div className="summary-total">
                          <span>{showDue ? t('premium.dueToday') : t('premium.total')}</span>
                          <span className="total-value">
                            {showDue ? `€${Number(checkoutQuote.amountDue).toFixed(2)}` : priceLabel}
                          </span>
                        </div>
                        {checkoutQuote?.change && (
                          <p className="summary-change-note">
                            {t('premium.thenRecurring', { price: priceLabel, cycle: cycleWord })}
                          </p>
                        )}
                      </>
                    );
                  })()}
                  <p className="summary-renewal">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 11a8 8 0 1 0-.6 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M20 5v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t('premium.autoRenew', { cycle: cycleWord })}
                  </p>
                </div>

                <div className="payment-section">
                  <h3>{t('premium.paymentMethod')}</h3>
                  <StripeCheckout
                    profileId={user?.id}
                    interval={isYearly ? 'year' : 'month'}
                    seats={planDetail?.seats}
                    onQuote={setCheckoutQuote}
                    onSuccess={async () => {
                      setSubscriptionStep('success');
                      // Pull the fresh tier onto the active profile so premium
                      // unlocks immediately across the app.
                      try {
                        const data = await apiService.getCurrentUser();
                        const active = (data.profiles || []).find((p) => p.id === user?.id) || data.profile;
                        if (active) {
                          updateUser(active);
                          setAccountSubscriptionTier(active.subscriptionTier);
                        }
                        if (data.user) setAccountUser(data.user);
                      } catch { /* webhook will reconcile */ }
                    }}
                  />
                  <p className="payment-note">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                    {t('premium.securedByStripe')}
                  </p>
                </div>
              </>
              );
            })()}

            {subscriptionStep === 'processing' && (
              <div className="processing-state">
                <LoadingGlobe label="" className="py-2" />
                <h3>{t('premium.processingPayment')}</h3>
                <p>{t('premium.processingWait')}</p>
              </div>
            )}

            {subscriptionStep === 'success' && (
              <div className="success-state">
                <div className="success-icon">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2>{t('premium.nowPremium')}</h2>
                <p>{t('premium.welcomeDesc')}</p>

                {/* What you actually unlocked, per role. The comparison table
                    above this screen has always been role-aware; this list was
                    a fixed four, so a venue was told "Travel mode enabled" —
                    a feature that only exists for the artist side. */}
                <div className="success-features">
                  {(user?.role === 'ARTIST' || user?.role === 'AGENT'
                    ? ['successGlobalSearch', 'successCalendarMatching', 'successTourKickstart',
                       'successTravelMode', 'successFeePrivacy', 'successPrioritySearch']
                    : ['successGlobalSearch', 'successCalendarMatching', 'successTourKickstart',
                       'successTravelAlerts', 'successCalendarPrivacy', 'successPrioritySearch']
                  ).map((k) => (
                    <div key={k} className="success-feature"><span>✓</span> {t(`premium.${k}`)}</div>
                  ))}
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