import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import { subscribeToDeals } from '../../services/realtime';
import BookingsScreen, { getDealDisplayStatus, DEAL_DISPLAY_STATUSES } from '../screens/BookingsScreen';
import { OFF_STATUSES } from '../../utils/dealStatus';
import { formatEventDate } from '../../utils/dates';
import { Avatar } from './primitives';
import LoadingGlobe from '../common/LoadingGlobe';
import { SearchIcon } from '../../utils/icons';
import {
  statusLabel, statusChipClass, counterpartFor, bookedArtistName,
  statusLineFor, feeText, tabFor,
} from './dealRow';

/* Desktop v3 Bookings: a pipeline table on the left, the deal on the right.
   The inspector IS the existing BookingsScreen in focus mode — every action
   (accept, counter, sign, share documents, payments) is the shipped code,
   not a rebuild. The table only decides which deal that is. */

const TABS = ['upcoming', 'past', 'declined'];
const TAB_KEY = { upcoming: 'bookings.tabUpcoming', past: 'bookings.tabPast', declined: 'bookings.tabDeclined' };

const BookingsBoard = ({ onOpenChat, onNavigateToMessages, onActionCountChange, isActive = true }) => {
  const { user } = useAppContext();
  const { t } = useLanguage();
  const locale = t('dateFormat.locale');

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const pendingOpen = useRef(null); // a deal deep-linked before it was loaded
  const [mineOnly, setMineOnly] = useState(false);
  const [sort, setSort] = useState({ key: 'date', dir: 1 }); // date asc by default; past flips below

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await apiService.getDeals({ profileId: user.id });
      setDeals(r.deals || []);
    } catch (e) {
      console.error('Error loading bookings board:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { setLoading(true); setSelectedId(null); load(); }, [load]);
  useEffect(() => (user?.id ? subscribeToDeals(user.id, load) : undefined), [user?.id, load]);

  // The bell and the dashboard ask for one deal: select it and show its tab.
  useEffect(() => {
    const onOpen = (e) => {
      const id = e.detail?.dealId;
      if (!id) return;
      setSelectedId(id);
      const deal = deals.find((d) => d.id === id);
      if (deal) setTab(tabFor(deal));
      else { pendingOpen.current = id; load(); }
    };
    window.addEventListener('tora:open-deal', onOpen);
    return () => window.removeEventListener('tora:open-deal', onOpen);
  }, [deals, load]);

  // ...and move to its tab once the refetch brings it in.
  useEffect(() => {
    const id = pendingOpen.current;
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (deal) { setTab(tabFor(deal)); pendingOpen.current = null; }
  }, [deals]);

  // Consent-only and venue-redacted deals stay in the pipeline: they carry no
  // fee, but a tagged venue approves or declines them here and the inspector
  // renders the consent card for them.
  const visibleDeals = deals;
  const byTab = useMemo(() => TABS.reduce((acc, k) => ({ ...acc, [k]: visibleDeals.filter((d) => tabFor(d) === k) }), {}), [visibleDeals]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = byTab[tab].filter((d) => {
      if (status !== 'all' && getDealDisplayStatus(d) !== status) return false;
      if (mineOnly && !statusLineFor(d, user, t)?.mine) return false;
      if (!q) return true;
      const other = counterpartFor(d, user);
      return [other?.name, d.eventName, d.city, d.country, bookedArtistName(d, user)]
        .some((s) => s && String(s).toLowerCase().includes(q));
    });
    // Past reads newest-first by default; an explicit header click wins.
    const dir = sort.key === 'date' && tab === 'past' ? -sort.dir : sort.dir;
    const val = (d) => (sort.key === 'fee' ? Number(d.currentFee) || 0 : new Date(d.date).getTime());
    return list.sort((a, b) => dir * (val(a) - val(b)));
  }, [byTab, tab, status, query, user, mineOnly, sort, t]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  const SortHead = ({ k, children }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex cursor-pointer items-center gap-1 truncate text-left uppercase tracking-[0.12em] hover:text-white ${sort.key === k ? 'text-white/70' : ''}`}
    >
      {children}{sort.key === k && <span className="text-[9px]">{sort.dir === 1 ? '▲' : '▼'}</span>}
    </button>
  );

  const statuses = DEAL_DISPLAY_STATUSES.filter((s) => OFF_STATUSES.includes(s) === (tab === 'declined'));
  const myMoveCount = (list) => list.filter((d) => statusLineFor(d, user, t)?.mine).length;

  return (
    <div className="screen active d3-screen">
      <div className="d3-board d3-fill">
        {/* ---------------- pipeline ---------------- */}
        <div className="d3-panel flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] px-3 py-2.5">
            <div className="d3-seg flex rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
              {TABS.map((k) => {
                const n = myMoveCount(byTab[k]);
                return (
                  <button
                    key={k}
                    onClick={() => { setTab(k); setStatus('all'); }}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors
                                ${tab === k ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:text-white'}`}
                  >
                    {t(TAB_KEY[k])}
                    {n > 0 && <span className="rounded-full bg-infrared px-1.5 text-[10px] font-semibold text-white">{n}</span>}
                  </button>
                );
              })}
            </div>
            <label className="relative min-w-[180px] flex-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35 [&>svg]:h-3.5 [&>svg]:w-3.5"><SearchIcon /></span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('desktop.searchBookings')}
                className="h-8 w-full rounded-lg border border-white/10 bg-white/[0.02] pl-8 pr-3 text-[12.5px] text-white placeholder-white/35 outline-none focus:border-white/25"
              />
            </label>
            <button
              onClick={() => setMineOnly((v) => !v)}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors
                          ${mineOnly ? 'border-infrared/50 bg-infrared/10 text-white' : 'border-white/10 bg-white/[0.02] text-white/55 hover:text-white'}`}
            >
              {t('desktop.yourMove')}
              {myMoveCount(byTab[tab]) > 0 && <span className="rounded-full bg-infrared px-1.5 text-[10px] font-semibold text-white">{myMoveCount(byTab[tab])}</span>}
            </button>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-white/10 bg-[#0b0b0e] px-2.5 text-[12px] text-white/80 outline-none"
            >
              <option value="all">{t('bookings.filterStatus')}: {t('bookings.filterAllStatuses')}</option>
              {statuses.map((s) => <option key={s} value={s}>{statusLabel(s, t)}</option>)}
            </select>
          </div>

          <div className="d3-row px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
            <SortHead k="date">{t('desktop.colDate')}</SortHead><span className="truncate">{t('desktop.colCounterpart')}</span>
            <span className="truncate">{t('desktop.colEvent')}</span><SortHead k="fee">{t('desktop.colFee')}</SortHead>
            <span className="truncate">{t('desktop.colStatus')} · {t('desktop.colNext')}</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {loading ? <LoadingGlobe label={t('bookings.loadingBookings')} /> : rows.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-white/35">{t('desktop.noBookings')}</p>
            ) : rows.map((deal) => {
              const other = counterpartFor(deal, user);
              const forName = bookedArtistName(deal, user);
              const st = getDealDisplayStatus(deal);
              const line = statusLineFor(deal, user, t);
              const selected = deal.id === selectedId;
              return (
                <button
                  key={deal.id}
                  onClick={() => setSelectedId(deal.id)}
                  className={`d3-row w-full cursor-pointer rounded-lg border px-1.5 py-2 text-left transition-colors
                              ${selected ? 'border-infrared/40 bg-infrared/[0.06]' : 'border-transparent hover:bg-white/[0.035]'}`}
                >
                  <span className="text-center">
                    <span className="block text-[9.5px] uppercase tracking-[0.12em] text-white/40">
                      {formatEventDate(deal.date, locale, { month: 'short', day: undefined, year: undefined })}
                    </span>
                    <span className="block font-futuristic text-[16px] font-semibold leading-tight text-white">
                      {formatEventDate(deal.date, locale, { day: 'numeric', month: undefined, year: undefined })}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar profile={other} className="h-8 w-8 text-[12px]" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-white">{other?.name || t('bookings.theOtherParty')}</span>
                      {forName && <span className="block truncate text-[11px] text-white/45">{t('bookings.forArtist', { name: forName })}</span>}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] text-white/85">{deal.eventName || '—'}</span>
                    <span className="block truncate text-[11px] text-white/45">{[deal.city, deal.country].filter(Boolean).join(', ')}</span>
                  </span>
                  <span className="text-[12.5px] tabular-nums text-white/75">{feeText(deal)}</span>
                  <span className="min-w-0">
                    <span className={statusChipClass(st)}>{statusLabel(st, t)}</span>
                    <span className={`mt-1 block truncate text-[11.5px] ${line?.mine ? 'text-infrared' : 'text-white/50'}`}>{line?.text || '—'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------- inspector ---------------- */}
        <div className="d3-panel relative p-3">
          {!selectedId && (
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-8 text-center text-[13px] text-white/35">{t('desktop.selectBooking')}</p>
          )}
          {/* Always mounted (deals ready before the first click); focus mode
              renders nothing until a deal is chosen. */}
          <BookingsScreen
            focusDealId={selectedId}
            onOpenChat={onOpenChat}
            onNavigateToMessages={onNavigateToMessages}
            onActionCountChange={onActionCountChange}
            isActive={isActive}
          />
        </div>
      </div>
    </div>
  );
};

export default BookingsBoard;
