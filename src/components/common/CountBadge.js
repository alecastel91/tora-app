import React from 'react';

// Infrared count pill (tab bar, Messages/Requests tabs). One source for the
// glow/size treatment; pass className for positioning (e.g. absolute).
const CountBadge = ({ count, max = 99, className = '' }) => {
  if (!count || count <= 0) return null;
  return (
    <span
      className={`min-w-4 h-4 px-1 rounded-full bg-infrared text-white text-[10px] font-semibold
                  flex items-center justify-center shadow-[0_0_8px_rgba(255,51,102,0.5)] ${className}`}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
};

export default CountBadge;
