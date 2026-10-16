import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDesktopStrings } from './strings';
import apiService from '../../services/api';
import { getDealDisplayStatus } from '../screens/BookingsScreen';
import { formatEventDate } from '../../utils/dates';
import { roleLabel } from '../../utils/roles';
import { Avatar } from './primitives';
import { statusLabel, statusChipClass, statusLineFor, feeText } from './dealRow';

/* Desktop v3 Messages: the deal beside the thread. A desk has room for the
   context the phone makes you leave the chat to check — who this is, and
   where every booking between you stands. Rendered by App.js as a sibling of
   the chat overlay; the chat shrinks to make room (desktop-v3.css). */

const ChatContextPanel = ({ profile, onOpenProfile, onSwitchTab }) => {
  const { user } = useAppContext();
  const { t } = useLanguage();
  const td = useDesktopStrings();
  const locale = t('dateFormat.locale');
  const [deals, setDeals] = useState(null);

  useEffect(() => {
    if (!user?.id || !profile?.id) return undefined;
    let on = true;
    apiService.getDeals({ profileId: user.id })
      .then((r) => {
        if (!on) return;
        const pid = profile.id;
        setDeals((r.deals || [])
          .filter((d) => [d.artist?.id, d.venue?.id, d.initiator?.id, d.agentId, d.bookedArtistId].includes(pid))
          .sort((a, b) => new Date(b.date) - new Date(a.date)));
      })
      .catch(() => on && setDeals([]));
    return () => { on = false; };
  }, [user?.id, profile?.id]);

  const openDeal = (dealId) => {
    onSwitchTab('bookings');
    setTimeout(() => window.dispatchEvent(new CustomEvent('tora:open-deal', { detail: { dealId } })), 60);
  };

  if (!profile) return null;

  return (
    <aside className="d3-chat-context">
      <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
        <Avatar profile={profile} className="h-16 w-16 text-xl" />
        <h2 className="mt-3 text-[16px] font-semibold text-white">{profile.name}</h2>
        <p className="mt-0.5 text-[12px] text-white/50">
          {roleLabel(profile.role, t)}{profile.city ? ` · ${profile.city}` : ''}
        </p>
        <button
          onClick={() => onOpenProfile(profile)}
          className="mt-3 cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/80 transition-colors hover:border-white/35 hover:text-white"
        >
          {td('viewProfile')}
        </button>
      </div>

      <div className="border-t border-white/[0.07] px-4 pb-4 pt-3.5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{td('dealsWith', { name: profile.name })}</h3>
        {deals === null ? null : deals.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-white/35">{td('noDealsWith', { name: profile.name })}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {deals.map((deal) => {
              const st = getDealDisplayStatus(deal);
              const line = statusLineFor(deal, user, t);
              return (
                <li key={deal.id}>
                  <button
                    onClick={() => openDeal(deal.id)}
                    className="w-full cursor-pointer rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/20"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] text-white">{deal.eventName || t('bookings.theOtherParty')}</span>
                      <span className="shrink-0 text-[11px] text-white/45">{formatEventDate(deal.date, locale, { year: undefined })}</span>
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-2">
                      <span className={statusChipClass(st)}>{statusLabel(st, t)}</span>
                      <span className="text-[11.5px] tabular-nums text-white/60">{feeText(deal)}</span>
                    </span>
                    {line && <span className={`mt-1.5 block text-[11.5px] ${line.mine ? 'text-infrared' : 'text-white/45'}`}>{line.text}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};

export default ChatContextPanel;
