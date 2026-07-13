import React from 'react';

/**
 * Crimson padlock + message overlay for blurred premium teasers (locked
 * tours on ViewProfile, locked Manage tabs for free tier). Render it as the
 * last child of a `relative` container whose other child is the blurred
 * content; pointer-events-none lets an enclosing button take the click.
 */
const LockOverlay = ({ message }) => (
  <div className="absolute inset-0 flex items-center justify-center gap-2.5 bg-black/35 px-4 text-center pointer-events-none">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-infrared">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
    <span className="text-xs text-white/85 leading-snug">{message}</span>
  </div>
);

export default LockOverlay;
