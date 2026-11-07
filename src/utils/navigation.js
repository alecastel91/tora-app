/**
 * Cross-tab navigation for deep links. Tabs are keep-mounted, so the target
 * screen receives the follow-up event; the short delay lets the tab switch
 * commit first. One place for the timing so every deep link behaves the same.
 */
export const goTab = (tab) => window.dispatchEvent(new CustomEvent('tora:navigate-tab', { detail: { tab } }));

/** Switch to the Profile tab, then open one of its sub-screens (edit / roster / …). */
export const goProfileThen = (event) => {
  goTab('profile');
  setTimeout(() => window.dispatchEvent(new CustomEvent(event)), 200);
};

/** Open Manage on a tab (e.g. 'agency') from anywhere, even if Profile is not mounted yet. */
export const goManageTab = (tab) => {
  sessionStorage.setItem('tora:manage-intent', tab);
  goTab('profile');
  window.dispatchEvent(new CustomEvent('tora:open-manage', { detail: { tab } }));
};

/** Switch to the Tour tab on a given sub-tab, even if Tour is not mounted yet. */
export const goTourSubTab = (subTab) => {
  sessionStorage.setItem(`tora:tour-${subTab}-intent`, '1');
  goTab('tour');
  window.dispatchEvent(new CustomEvent(`tora:tour-${subTab}`));
};
