import { goTab, goProfileThen, goTourSubTab } from '../../utils/navigation';
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { isPremiumViewer } from '../../utils/subscription';

/**
 * Activation checklist — a collapsible drawer of first-session actions with
 * deep links. Completion is derived from data the app already has; the card
 * disappears for good only when every visible action is done. Collapsing
 * (the chevron) persists per profile. The Tour Kickstart item only shows for
 * Premium accounts — it appears ("pops back") after an upgrade.
 */
const OnboardingChecklist = () => {
  const { t } = useLanguage();
  const { user, likedProfiles, connectedUsers } = useAppContext();
  const collapseKey = user?.id ? `tora:checklist-collapsed:${user.id}` : null;
  const [collapsed, setCollapsed] = useState(() => !!(collapseKey && localStorage.getItem(collapseKey)));

  // Visited-Tour flag as state: the flag is written by App.switchTab while
  // this (kept-mounted) Profile tab is hidden, so a render-time read of
  // localStorage would stay stale until the next reload.
  const visitedKey = `tora:visited-tour:${user?.id}`;
  const [visitedTour, setVisitedTour] = useState(() => !!localStorage.getItem(visitedKey));
  useEffect(() => {
    const sync = () => setVisitedTour(!!localStorage.getItem(visitedKey));
    window.addEventListener('tora:visited-tour', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('tora:visited-tour', sync); window.removeEventListener('storage', sync); };
  }, [visitedKey]);

  if (!user?.id) return null;

  // Land directly on the Tour Kickstart sub-tab (same intent flag ViewProfile
  // uses) — and count the visit immediately.
  const goKickstart = () => {
    localStorage.setItem(visitedKey, '1');
    setVisitedTour(true);
    sessionStorage.setItem('tora:tour-kickstart-intent', '1');
    goTab('tour');
    window.dispatchEvent(new CustomEvent('tora:tour-kickstart'));
  };

  const isAgent = user.role === 'AGENT';
  const items = [
    {
      key: 'completeProfile',
      done: !!(user.avatar && user.bio),
      go: () => goProfileThen('tora:open-edit-profile'),
    },
    // First on the list after the profile itself: nothing else on TORA can be
    // initiated until this is done, so leaving it implicit made the other
    // items look broken rather than locked.
    {
      key: 'verifyAccount',
      done: user.verifyStatus === 'VERIFIED',
      go: () => window.dispatchEvent(new CustomEvent('tora:verification-required', {
        detail: { code: 'VERIFICATION_REQUIRED' },
      })),
    },
    // Agents don't manage their own calendar — their activation step is
    // building the roster. The calendar itself lives behind the Premium
    // Manage screen, so for FREE non-agents the item is omitted entirely
    // (a checklist must never deep-link into a paywall, and an
    // uncompletable item would keep the card alive forever).
    ...(isAgent
      ? [{
          key: 'addArtist',
          done: (Array.isArray(user.representingArtists) ? user.representingArtists : []).length > 0,
          go: () => goProfileThen('tora:open-roster'),
        }]
      : isPremiumViewer(user)
        ? [{
            key: 'setAvailability',
            done: (user.availableDates || []).length > 0,
            go: () => goTourSubTab('calendar'),
          }]
        : []),
    {
      key: 'likeProfiles',
      done: (likedProfiles?.size || 0) >= 3,
      go: () => goTab('search'),
    },
    {
      key: 'makeConnection',
      done: (connectedUsers?.size || 0) >= 1,
      go: () => goTab('search'),
    },
    // Kickstart is Premium-gated in the app — don't send free accounts to a
    // paywall from their onboarding list.
    ...(isPremiumViewer(user)
      ? [{
          key: 'exploreTours',
          done: visitedTour,
          go: goKickstart,
        }]
      : []),
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null;

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (collapseKey) {
        if (next) localStorage.setItem(collapseKey, '1');
        else localStorage.removeItem(collapseKey);
      }
      return next;
    });
  };

  return (
    <div className="onboarding-checklist">
      <button type="button" className="onboarding-checklist-header" onClick={toggleCollapsed}>
        <p className="onboarding-checklist-title">{t('onboarding.checklistTitle')}</p>
        <div className="flex items-center gap-2">
          <span className="onboarding-checklist-progress">{doneCount}/{items.length}</span>
          <span className={`onboarding-checklist-chevron ${collapsed ? '' : 'open'}`} aria-hidden="true">›</span>
        </div>
      </button>
      {!collapsed && items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`onboarding-check-row ${item.done ? 'done' : ''}`}
          onClick={item.done ? undefined : item.go}
          disabled={item.done}
        >
          <span className={`onboarding-check-box ${item.done ? 'checked' : ''}`}>
            {item.done ? '✓' : ''}
          </span>
          <span className="onboarding-check-label">{t(`onboarding.${item.key}`)}</span>
          {!item.done && <span className="onboarding-check-go">›</span>}
        </button>
      ))}
    </div>
  );
};

export default OnboardingChecklist;
