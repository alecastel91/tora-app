import React from 'react';

// Rotating wireframe globe — mirrors the intro splash artwork's globe
// (thin-stroke sphere with meridians). `size` is the glyph size in px;
// the app boot screen uses a large one, inline loaders the default.
const LoadingGlobe = ({ label = 'Loading...', size = 28, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}>
    <span
      aria-hidden
      className="text-infrared/80 animate-[spin_1.6s_linear_infinite]"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="10" />
        {/* meridians */}
        <ellipse cx="12" cy="12" rx="4.2" ry="10" />
        <ellipse cx="12" cy="12" rx="8" ry="10" />
        {/* equator + parallels */}
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M3.5 7 A 14.5 14.5 0 0 1 20.5 7" />
        <path d="M3.5 17 A 14.5 14.5 0 0 0 20.5 17" />
      </svg>
    </span>
    {label && <p className="text-sm text-white/40 m-0">{label}</p>}
  </div>
);

export default LoadingGlobe;
