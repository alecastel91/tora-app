import React from 'react';

// Rotating globe loader — the app's branded alternative to a plain spinner.
// Quiet-premium: thin-stroke globe in crimson, small label underneath.
const LoadingGlobe = ({ label = 'Loading...', className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}>
    <span
      aria-hidden
      className="text-infrared/80 animate-[spin_1.4s_linear_infinite] [&>svg]:w-7 [&>svg]:h-7"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    </span>
    {label && <p className="text-sm text-white/40 m-0">{label}</p>}
  </div>
);

export default LoadingGlobe;
