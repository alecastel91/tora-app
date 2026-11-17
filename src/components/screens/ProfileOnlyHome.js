import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import EditProfileScreen from './EditProfileScreen';
import VerificationModal from '../common/VerificationModal';
import PublicPageCard from '../common/PublicPageCard';

/* Pre-launch profile-only access: the whole app for these members until
   launch. Three steps that make their public page worth sharing — complete,
   verify, publish — and nothing that would show them other members (the
   server refuses those calls anyway, see tora-backend utils/access.js). */

const profileComplete = (p) => !!(p?.avatar && p?.bio && (p?.genres || []).length);

const Step = ({ n, done, title, body, action }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#101015] p-4">
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${done ? 'bg-[#00C875] text-black' : 'border border-white/20 text-white/70'}`}>
      {done ? '✓' : n}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[14px] font-semibold text-white">{title}</span>
      <span className="mt-0.5 block text-[12.5px] leading-relaxed text-white/55">{body}</span>
    </span>
    {action}
  </div>
);

const ProfileOnlyHome = ({ onSignOut }) => {
  const { user } = useAppContext();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [page, setPage] = useState(null);

  if (editing) return <EditProfileScreen onClose={() => setEditing(false)} />;

  const verified = user?.verifyStatus === 'VERIFIED';
  const inReview = user?.verifyStatus === 'PENDING_REVIEW';
  const linkButton = 'shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0 text-[12.5px] font-semibold text-infrared';

  return (
    <div className="min-h-[100dvh] bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <img src="/tora_logo_white.png" alt="TORA" className="block h-6 w-auto" />
        <button type="button" onClick={onSignOut} className="cursor-pointer border-0 bg-transparent text-[12.5px] text-white/55 hover:text-white">
          {t('settings.signOut')}
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-4 pb-16 pt-6">
        <p className="m-0 text-[11px] uppercase tracking-[0.16em] text-white/45">{user?.name}</p>
        <h1 className="m-0 text-[30px] font-bold leading-tight">{t('profileOnly.title')}</h1>
        <p className="m-0 mb-3 text-[14.5px] leading-relaxed text-white/70">{t('profileOnly.intro')}</p>

        <Step
          n={1}
          done={profileComplete(user)}
          title={t('profileOnly.step1Title')}
          body={t('profileOnly.step1Body')}
          action={<button type="button" className={linkButton} onClick={() => setEditing(true)}>{t('profileOnly.editProfile')}</button>}
        />
        <Step
          n={2}
          done={verified}
          title={t('profileOnly.step2Title')}
          body={inReview ? t('verify.inReviewTitle') : t(user?.role === 'AGENT' ? 'profileOnly.step2BodyAgent' : 'profileOnly.step2Body')}
          action={!verified && (
            <button type="button" className={linkButton} onClick={() => setVerifying(true)}>
              {inReview ? t('verify.statusButton') : t('verify.verifyButton')}
            </button>
          )}
        />
        <Step
          n={3}
          done={verified && !!page?.enabled}
          title={t('profileOnly.step3Title')}
          body={t('profileOnly.step3Body')}
        />
        {/* Once verified: page off (publish) or live (link, share sheet, Instagram step). */}
        {verified && <PublicPageCard profile={user} onState={setPage} onVerify={() => setVerifying(true)} onEdit={() => setEditing(true)} />}

        <p className="m-0 mt-4 text-[12.5px] leading-relaxed text-white/45">{t('profileOnly.launchNote')}</p>
      </main>

      {verifying && <VerificationModal onClose={() => setVerifying(false)} />}
    </div>
  );
};

export default ProfileOnlyHome;
