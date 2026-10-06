import React from 'react';

/**
 * One quiet line that answers "who can see this?" on private screens
 * (Manage dashboard/documents, Manage Artist). Members kept asking whether
 * their revenue was public; the screen never said. Always visible, never
 * dismissible — new members keep arriving.
 */
const PrivacyNote = ({ children }) => (
  <p className="privacy-note" role="note">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
    <span>{children}</span>
  </p>
);

export default PrivacyNote;
