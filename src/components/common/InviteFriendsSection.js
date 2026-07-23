import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';

const ROLES = ['ARTIST', 'AGENT', 'PROMOTER', 'VENUE'];

// Settings section: personal referral invitations. Verified members get 3
// pending slots; redeemed invites free the slot (and count toward the
// Ambassador badge / future premium-month rewards).
const InviteFriendsSection = () => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [data, setData] = useState(null); // { invitations, redeemedCount, pendingCount, cap }
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ARTIST');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const isVerified = user?.verifyStatus === 'VERIFIED';

  const load = () => {
    apiService.getMyInvitations()
      .then(setData)
      .catch(() => setData({ invitations: [], redeemedCount: 0, pendingCount: 0, cap: 3 }));
  };

  useEffect(() => {
    if (isVerified) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified]);

  const handleInvite = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError('');
    setSent(false);
    try {
      await apiService.createMyInvitation({ email: email.trim(), role, currentProfileId: user?.id });
      setEmail('');
      setSent(true);
      load();
    } catch (e) {
      setError(e.message || t('referrals.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const slotsFree = data ? Math.max(0, data.cap - data.pendingCount) : 0;

  const statusStyle = {
    PENDING: 'border-white/15 text-white/60',
    REDEEMED: 'border-[#43E97B]/50 text-[#43E97B]',
    EXPIRED: 'border-white/10 text-white/30',
  };

  return (
    <div className="settings-section">
      <h3>{t('referrals.title')}</h3>

      {!isVerified && (
        <p className="m-0 py-2 text-sm leading-relaxed text-white/50">
          {t('referrals.verifyToUnlock')}
        </p>
      )}

      {isVerified && (
        <>
          <p className="m-0 mb-3 text-sm leading-relaxed text-white/50">
            {t('referrals.intro', { cap: data?.cap ?? 3 })}
          </p>
          <p className="m-0 mb-3 text-xs font-semibold leading-relaxed text-[#FF7A9C]">
            {t('referrals.rewardNote')}
          </p>

          {/* slot indicators */}
          <div className="mb-3 flex items-center gap-2">
            {Array.from({ length: data?.cap ?? 3 }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < (data?.pendingCount ?? 0) ? 'bg-infrared/70' : 'bg-white/10'}`}
              />
            ))}
            <span className="shrink-0 text-[10px] font-tech uppercase tracking-[0.12em] text-white/40">
              {t('referrals.slotsFree', { n: slotsFree })}
            </span>
          </div>

          <div className="mb-2 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('referrals.emailPlaceholder')}
              className="form-input min-w-0 flex-1"
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="form-input w-[130px] shrink-0">
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`editProfile.${r.toLowerCase()}`)}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary w-full"
            disabled={busy || slotsFree === 0}
            onClick={handleInvite}
          >
            {busy ? '...' : t('referrals.sendInvite')}
          </button>
          {error && <p className="m-0 mt-2 text-xs text-infrared">{error}</p>}
          {sent && !error && <p className="m-0 mt-2 text-xs text-[#43E97B]">{t('referrals.sentConfirm')}</p>}

          {data && data.redeemedCount > 0 && (
            <p className="m-0 mt-3 text-xs text-white/50">
              {t('referrals.joinedCount', { n: data.redeemedCount })}
            </p>
          )}

          {data && data.invitations.length > 0 && (
            <div className="mt-3">
              {data.invitations.map((inv) => (
                <div key={inv.id} className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c0c11] px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{inv.email}</div>
                    <div className="text-[10px] font-tech uppercase tracking-[0.12em] text-white/35">
                      {t(`editProfile.${(inv.role || '').toLowerCase()}`)}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-tech uppercase tracking-[0.12em] ${statusStyle[inv.status] || statusStyle.PENDING}`}>
                    {t(`referrals.status${inv.status.charAt(0)}${inv.status.slice(1).toLowerCase()}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InviteFriendsSection;
