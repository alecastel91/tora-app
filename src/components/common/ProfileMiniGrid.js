import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAvatarClass, ROLE_COLOR } from '../../utils/roles';
import { ROLE_GLYPHS } from '../../utils/icons';
import InlineDrawer from './InlineDrawer';

// Compact profile tiles (avatar + name).
//
// variant="grid" (default — network strips): one row of three; when more
// exist the 3rd tile carries a "+N" overlay and tapping it expands the strip
// inline (drawer-style) with a "See less" collapse.
//
// variant="scroll" (recommendation strips): smaller tiles — 4 per row plus a
// sliver of the 5th peeking in so the horizontal scroll is discoverable —
// in a single snap row with a right-edge fade while more content remains.
// Each tile carries a role chip: a small role icon tinted with the canonical
// role color (language-independent, Artist/Agent stay distinct).
// cols — tiles per row in the grid variant (3 on the phone; the desktop
// pages pass 4). Static class names so Tailwind emits them.
const COLS = { 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' };

const ProfileMiniGrid = ({ profiles, onOpenProfile, variant = 'grid', cols = 3 }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const list = Array.isArray(profiles) ? profiles : [];
  if (list.length === 0) return null;

  const roleChip = (role) => (
    <span
      className="absolute top-1 left-1 flex items-center justify-center rounded border bg-black/70 p-0.5"
      style={{ color: ROLE_COLOR[role] || '#fff', borderColor: `${ROLE_COLOR[role] || '#ffffff'}55` }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ROLE_GLYPHS[role] || <circle cx="12" cy="12" r="9" />}
      </svg>
    </span>
  );

  const renderTile = (p, overlayCount, withRoleChip) => (
    <button
      key={p.id}
      type="button"
      onClick={() => (overlayCount ? setExpanded(true) : onOpenProfile && onOpenProfile(p))}
      className={`group block p-0 bg-transparent border-none text-center cursor-pointer
                  ${variant === 'scroll' ? 'w-[calc((100%-2rem)/4.4)] flex-none snap-start' : ''}`}
    >
      <span className="relative block aspect-square rounded-xl border border-white/10 bg-[#0a0a0e] overflow-hidden
                       transition-colors group-hover:border-infrared/40">
        {p.avatar ? (
          <img src={p.avatar} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className={`w-full h-full flex items-center justify-center text-2xl font-bold text-white
                            font-space-grotesk ${getAvatarClass(p.role)}`}>
            {(p.name || '?').charAt(0).toUpperCase()}
          </span>
        )}
        {withRoleChip && roleChip(p.role)}
        {overlayCount ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60
                           text-xl font-bold text-white font-space-grotesk">
            +{overlayCount}
          </span>
        ) : null}
      </span>
      <span className={`block mt-1.5 font-medium truncate ${p.dormant ? 'text-white/45' : 'text-white'} ${variant === 'scroll' ? 'text-[11px]' : 'text-xs'}`}>
        {p.name}
      </span>
      {/* Owner-only flag from GET /profiles/:id: this agent's representation
          is inactive on their free plan (others never see the link at all). */}
      {p.dormant && <span className="block text-[9px] uppercase tracking-[0.15em] text-white/40">{t('agentPlan.dormant')}</span>}
    </button>
  );

  if (variant === 'scroll') {
    const overflows = list.length > 4;
    const onScroll = (e) => {
      const el = e.currentTarget;
      setScrolledToEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    return (
      <div className="relative">
        <div
          onScroll={overflows ? onScroll : undefined}
          className="flex gap-2 overflow-x-auto snap-x pb-1
                     [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {list.map((p) => renderTile(p, 0, true))}
        </div>
        {/* right-edge fade: signals more content, gone once fully scrolled */}
        {overflows && !scrolledToEnd && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10
                       bg-gradient-to-l from-black/80 to-transparent"
          />
        )}
      </div>
    );
  }

  const n = COLS[cols] ? cols : 3;
  const extras = list.slice(n);

  return (
    <div>
      <div className={`grid ${COLS[n]} gap-2`}>
        {list.slice(0, n).map((p, i) =>
          renderTile(p, i === n - 1 && extras.length > 0 && !expanded ? extras.length : 0, false)
        )}
      </div>

      {/* Inline drawer with the remaining profiles */}
      {extras.length > 0 && (
        <div className={`overflow-hidden transition-[max-height] duration-300 ${expanded ? 'max-h-[1200px]' : 'max-h-0'}`}>
          <div className={`grid ${COLS[n]} gap-2 pt-2`}>
            {extras.map((p) => renderTile(p, 0, false))}
          </div>
        </div>
      )}
      {expanded && (
        <button
          type="button"
          className="mt-2 bg-transparent border-none p-0 text-infrared text-xs cursor-pointer hover:underline"
          onClick={() => setExpanded(false)}
        >
          {t('profile.seeLess')}
        </button>
      )}
    </div>
  );
};

export default ProfileMiniGrid;
