import React from 'react';
import introGlobe from '../../assets/intro-globe.png';

// Rotating brand globe — the actual intro-artwork globe icon (extracted from
// Intro.svg, transparent background). `size` is the glyph size in px; the app
// boot screen uses a large one, inline loaders the default.
const LoadingGlobe = ({ label = 'Loading...', size = 28, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`}>
    <img
      src={introGlobe}
      alt=""
      aria-hidden
      className="animate-[spin_2.4s_linear_infinite] select-none"
      style={{ width: size, height: size }}
      draggable={false}
    />
    {label && <p className="text-sm text-white/40 m-0">{label}</p>}
  </div>
);

export default LoadingGlobe;
