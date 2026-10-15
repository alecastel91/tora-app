import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDesktopStrings } from './strings';
import apiService from '../../services/api';
import { subscribeToDeals } from '../../services/realtime';
import NewsScreen from '../screens/NewsScreen';
import { getDealDisplayStatus } from '../screens/BookingsScreen';
import { isOffDeal } from '../../utils/dealStatus';
import { formatEventDate, formatTimestamp } from '../../utils/dates';
import { getAvatarClass, roleLabel } from '../../utils/roles';
import { localizeActionItem, getActionIcon, handleActionTarget } from '../../utils/actionItems';
import { HandshakeIcon, MessageIcon, CalendarCheckIcon, BookingsIcon } from '../../utils/icons';
import {
  statusLabel, statusChipClass, counterpartFor, isConsentOnlyFor, bookedArtistName,
  feeText, startOfToday, dayKey, dealDayKey,
} from './dealRow';

/* Desktop v3 home: the cockpit. A desk user (an agent, a venue booker) lands
   on what needs them, not on a feed — the feed is one panel at the bottom. */

const Panel = ({ title, action, children, className = '' }) => (
  <section className={`d3-panel flex min-w-0 flex-col ${className}`}>
    <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{title}</h2>
      {action && (
        <button
          onClick={action.onClick}
          className="cursor-pointer text-[11px] font-medium text-white/45 transition-colors hover:text-white"
        >
          {action.label}
        </button>
      )}
    </header>
    <div className="min-h-0 flex-1 px-2 pb-2">{children}</div>
  </section>
);

const Empty = ({ text }) => (
  <p className="px-2 py-8 text-center text-[13px] text-white/35">{text}</p>
);

const StatTile = ({ icon, label, value, accent = false, onClick }) => (
  <button
    onClick={onClick}
    className={`d3-panel flex min-w-[150px] cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#101014]
                ${accent && value > 0 ? 'border-infrared/40' : ''}`}
  >
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] [&>svg]:h-4 [&>svg]:w-4
                      ${accent && value > 0 ? 'text-infrared' : 'text-white/60'}`}>
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block font-futuristic text-[22px] font-semibold leading-none tracking-tight text-white">{value}</span>
      <span className="mt-1 block truncate text-[10.5px] uppercase tracking-[0.12em] text-white/45">{label}</span>
    </span>
  </button>
);

const Avatar = ({ profile, size = 'h-9 w-9' }) => (
  <span className={`${size} shrink-0 overflow-hidden rounded-full flex items-center justify-center text-[13px] font-semibold text-white ${getAvatarClass(profile?.role)}`}>
    {profile?.avatar
      ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
      : (profile?.name || '?').charAt(0).toUpperCase()}
  </span>
);

// The sidebar dot counts booking-workflow actions only (representation
// requests route to Messages); the tile says the same number as the dot.
const BOOKING_ACTIONS = new Set(['offer_received', 'counter_offer_pending', 'contract_to_send', 'contract_to_sign', 'payment_to_mark_sent', 'payment_to_confirm_received', 'payment_to_resolve']);
const ACTION_ROWS = 8;

const DashboardScreen = ({ onOpenChat, onOpenProfile, onSwitchTab, onOpenPremium, isActive = true }) => {
  const { user } = useAppContext();
  const { t } = useLanguage();
  const td = useDesktopStrings();
  const locale = t('dateFormat.locale');

  const [data, setData] = useState({ actions: [], deals: [], conversations: [] });

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [a, d, c] = await Promise.all([
      apiService.getActionSummary(user.id).catch(() => null),
      apiService.getDeals({ profileId: user.id }).catch(() => null),
      apiService.getConversations(user.id).catch(() => null),
    ]);
    setData({
      actions: a?.items || [],
      deals: d?.deals || [],
      conversations: c?.conversations || [],
    });
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  // Deals change under us (the other side signs, pays): the same channel
  // BookingsScreen listens on. Threads refresh on the visible-tab poll.
  useEffect(() => (user?.id ? subscribeToDeals(user.id, load) : undefined), [user?.id, load]);
  useEffect(() => {
    if (!isActive) return undefined;
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [isActive, load]);

  const today = startOfToday();
  const deals = useMemo(() => data.deals.filter((d) => !isConsentOnlyFor(d, user) && !d.redactedForVenue), [data.deals, user]);
  const openOffers = useMemo(() => deals.filter((d) => d.status === 'PENDING' || d.status === 'NEGOTIATING').length, [deals]);
  const upcoming = useMemo(() => deals
    .filter((d) => !isOffDeal(d) && d.status === 'ACCEPTED' && new Date(d.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date)), [deals, today]);
  const unread = useMemo(() => data.conversations.reduce((n, c) => n + (c.unreadCount || 0), 0), [data.conversations]);
  const yourMove = useMemo(() => data.actions.filter((a) => BOOKING_ACTIONS.has(a.type)).length, [data.actions]);
  const threads = useMemo(() => [...data.conversations]
    .sort((a, b) => (b.unreadCount > 0) - (a.unreadCount > 0) || new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0))
    .slice(0, 6), [data.conversations]);

  // Next 14 days: availability (profile), gigs (confirmed deals), travel.
  const days = useMemo(() => {
    const available = new Set(user?.availableDates || []);
    const gigDays = new Set(upcoming.map(dealDayKey));
    const trips = user?.travelSchedule || [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() + i);
      const key = dayKey(d);
      return {
        key,
        date: d,
        available: available.has(key),
        gig: gigDays.has(key),
        travel: trips.some((s) => s.startDate && s.endDate && s.startDate <= key && key <= s.endDate),
      };
    });
  }, [user?.availableDates, user?.travelSchedule, upcoming, today]);

  const openDeal = (dealId) => {
    onSwitchTab('bookings');
    // The board is a keep-mounted tab, but let the switch render first so a
    // not-yet-warmed board still catches the event.
    setTimeout(() => window.dispatchEvent(new CustomEvent('tora:open-deal', { detail: { dealId } })), 60);
  };

  const openAction = (item) => {
    const dealId = item?.target?.params?.dealId;
    if (dealId) openDeal(dealId);
    else handleActionTarget(item?.target, { onSwitchTab });
  };

  if (!user) return null;

  return (
    <div className="screen active d3-screen">
      <div className="d3-dash">
        {/* ---- header: who you are, and the four numbers that matter ---- */}
        <div className="d3-dash-span flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-center gap-4">
            <Avatar profile={user} size="h-12 w-12" />
            <div>
              <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-white">{user.name}</h1>
              <p className="mt-0.5 text-[12.5px] text-white/50">
                {roleLabel(user.role, t)}{user.city ? ` · ${user.city}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <StatTile icon={<HandshakeIcon />} label={td('yourMove')} value={yourMove} accent onClick={() => onSwitchTab('bookings')} />
            <StatTile icon={<BookingsIcon />} label={td('openOffers')} value={openOffers} onClick={() => onSwitchTab('bookings')} />
            <StatTile icon={<CalendarCheckIcon />} label={td('confirmedAhead')} value={upcoming.length} onClick={() => onSwitchTab('tour')} />
            <StatTile icon={<MessageIcon />} label={td('unread')} value={unread} accent onClick={() => onSwitchTab('messages')} />
          </div>
        </div>

        {/* ---- left: the work ---- */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title={td('needsAction')}
            action={{ label: data.actions.length > ACTION_ROWS ? `${td('viewAll')} · ${data.actions.length}` : td('viewAll'), onClick: () => onSwitchTab('bookings') }}
          >
            {data.actions.length === 0 ? <Empty text={td('allClear')} /> : (
              <ul className="flex flex-col">
                {data.actions.slice(0, ACTION_ROWS).map((item) => {
                  const { title, actionLabel } = localizeActionItem(item, t);
                  const Icon = getActionIcon(item.type);
                  return (
                    <li key={item.id || title}>
                      <button
                        onClick={() => openAction(item)}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] [&>svg]:h-4 [&>svg]:w-4 ${item.urgent ? 'text-infrared' : 'text-white/70'}`}>
                          <Icon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-white">{title}</span>
                          {item.subtitle && <span className="block truncate text-[12px] text-white/45">{item.subtitle}</span>}
                        </span>
                        <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-infrared">{actionLabel}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={td('upcomingGigs')} action={{ label: td('viewAll'), onClick: () => onSwitchTab('bookings') }}>
            {upcoming.length === 0 ? <Empty text={td('noUpcoming')} /> : (
              <ul className="flex flex-col">
                {upcoming.slice(0, 6).map((deal) => {
                  const other = counterpartFor(deal, user);
                  const forName = bookedArtistName(deal, user);
                  const status = getDealDisplayStatus(deal);
                  return (
                    <li key={deal.id}>
                      <button
                        onClick={() => openDeal(deal.id)}
                        className="grid w-full cursor-pointer grid-cols-[52px_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="text-center">
                          <span className="block text-[9.5px] uppercase tracking-[0.12em] text-white/40">
                            {formatEventDate(deal.date, locale, { month: 'short', day: undefined, year: undefined })}
                          </span>
                          <span className="block font-futuristic text-[17px] font-semibold leading-tight text-white">
                            {formatEventDate(deal.date, locale, { day: 'numeric', month: undefined, year: undefined })}
                          </span>
                        </span>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar profile={other} size="h-8 w-8" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] text-white">{other?.name || t('bookings.theOtherParty')}</span>
                            {forName && <span className="block truncate text-[11.5px] text-white/45">{td('forArtist', { name: forName })}</span>}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-white/85">{deal.eventName || '—'}</span>
                          <span className="block truncate text-[11.5px] text-white/45">{[deal.city, deal.country].filter(Boolean).join(', ')}</span>
                        </span>
                        <span className="text-[12.5px] tabular-nums text-white/75">{feeText(deal)}</span>
                        <span className={statusChipClass(status)}>{statusLabel(status, t)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* ---- right: time and people ---- */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title={td('nextDays')} action={{ label: td('viewAll'), onClick: () => onSwitchTab('tour') }}>
            <div className="grid grid-cols-7 gap-1.5 px-1">
              {days.map((d, i) => (
                <div
                  key={d.key}
                  className={`rounded-md border px-1 py-1.5 text-center ${i === 0 ? 'border-infrared/50' : 'border-white/[0.06]'} ${d.available ? 'bg-[#43E97B]/10' : 'bg-white/[0.02]'}`}
                  title={d.key}
                >
                  <span className="block text-[9px] uppercase text-white/35">
                    {d.date.toLocaleDateString(locale, { weekday: 'narrow' })}
                  </span>
                  <span className="block text-[13px] font-medium text-white/90">{d.date.getDate()}</span>
                  <span className="mt-1 flex h-1.5 items-center justify-center gap-0.5">
                    {d.gig && <span className="h-1.5 w-1.5 rounded-full bg-infrared" />}
                    {d.travel && <span className="h-1.5 w-1.5 rounded-full bg-[#FFC107]" />}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 px-2 pb-1 text-[10.5px] text-white/45">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#43E97B]/40" />{td('legendAvailable')}</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-infrared" />{td('legendGig')}</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#FFC107]" />{td('legendTravel')}</span>
            </div>
          </Panel>

          <Panel title={td('recentThreads')} action={{ label: td('viewAll'), onClick: () => onSwitchTab('messages') }}>
            {threads.length === 0 ? <Empty text={td('noThreads')} /> : (
              <ul className="flex flex-col">
                {threads.map((conv) => (
                  <li key={conv.profile?.id}>
                    <button
                      onClick={() => onOpenChat(conv.profile)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <Avatar profile={conv.profile} size="h-8 w-8" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] ${conv.unreadCount > 0 ? 'font-semibold text-white' : 'text-white/85'}`}>{conv.profile?.name}</span>
                        <span className="block truncate text-[11.5px] text-white/45">{conv.lastMessage?.text}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] text-white/35">
                          {formatTimestamp(conv.lastMessage?.createdAt, locale, { year: undefined, hour: undefined, minute: undefined })}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-infrared px-1 text-[10px] font-semibold text-white">{conv.unreadCount}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ---- the feed, as one panel of the cockpit ---- */}
        <div className="d3-dash-span">
          <Panel title={td('feed')} action={{ label: td('viewAll'), onClick: () => onSwitchTab('news') }}>
            <div className="d3-feed-embed max-h-[760px] overflow-y-auto px-2 pb-2">
              <NewsScreen onOpenProfile={onOpenProfile} onOpenPremium={onOpenPremium} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
