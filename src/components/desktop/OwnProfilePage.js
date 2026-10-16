import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDesktopStrings } from './strings';
import { getAvatarClass, roleLabel, roleChipClass, roleBloom, ROLES } from '../../utils/roles';
import { fmtStat, Section, Panel, Stat, Avatar, profileLinks } from './primitives';
import { UploadIcon, EditIcon, SwitchIcon, AddIcon, HandshakeIcon, ListIcon, LocationIcon, StarIcon, ShieldIcon } from '../../utils/icons';
import VerifiedBadge from '../common/VerifiedBadge';
import ProfileBadges from '../common/ProfileBadges';
import BioTranslate from '../common/BioTranslate';
import ArtistRosterGrid from '../common/ArtistRosterGrid';
import ProfileMiniGrid from '../common/ProfileMiniGrid';
import PhotoGallery from '../common/PhotoGallery';
import RoomsTechCard from '../common/RoomsTechCard';
import RepresentationSection from '../common/RepresentationSection';
import HighlightsList from '../common/HighlightsList';
import OnboardingChecklist from '../common/OnboardingChecklist';

/* Desktop v3 — your own profile, designed for the desk. ProfileScreen keeps
   every fetch, flow, sub-screen and modal and hands this component its state
   and handlers; the phone body is untouched.

   Structure mirrors the profile page people see of you (ProfilePage), with
   the difference that this one is a workbench: the identity band carries the
   things you DO (edit, manage, roster, switch profile), the main column
   carries what needs you (trial, verification, checklist) above your work,
   and the side column holds your network and your other profiles. */

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);
const Action = ({ icon, label, onClick, dot, primary }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors
                [&>svg]:h-4 [&>svg]:w-4 ${primary ? 'border-infrared/50 bg-infrared/10 text-white hover:bg-infrared/20' : 'border-white/12 bg-white/[0.03] text-white/85 hover:border-white/30 hover:text-white'}`}
  >
    <span className="text-infrared [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
    {label}
    {dot && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-infrared shadow-[0_0_6px_rgba(255,51,102,0.7)]" />}
  </button>
);

const OwnProfilePage = ({
  user, userProfiles, defaultProfileId, embeds, ownBadges, rosterArtists, artistActionsMap, ownHasActions,
  representedByProfiles, networkSections, likedProfilesList, likerProfilesList, connectionsList, trialInfo,
  fileInputRef, onPickAvatar, onEdit, onManage, onRoster, onFindAgent, onOpenSwitcher, onAddProfile, onSwitchProfile,
  onOpenLikes, onOpenLikers, onOpenConnections, onOpenAchievements, onOpenPremium, onVerify, onOpenProfile, onManageArtist,
}) => {
  const { t } = useLanguage();
  const td = useDesktopStrings();
  const role = user?.role;
  const roleTone = roleChipClass(role);
  const bloom = roleBloom(role);

  const links = profileLinks(user, t);

  const unverified = user?.verifyStatus !== 'VERIFIED';
  const inReview = user?.verifyStatus === 'PENDING_REVIEW';
  const hasHighlights = ['ARTIST', 'PROMOTER', 'VENUE'].includes(role) && Array.isArray(user?.pastHighlights) && user.pastHighlights.length > 0;

  return (
    <div className="d3-op">
      {/* ---- identity band: who you are, and what you do here ---- */}
      <header className="d3-op-head d3-panel">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]" style={{ background: `radial-gradient(60% 120% at 12% 0%, ${bloom}, transparent 70%)` }} />
        <div className="flex items-start gap-6">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={onPickAvatar}
              title={t('profile.editProfile')}
              className={`group flex h-[112px] w-[112px] cursor-pointer items-center justify-center overflow-hidden rounded-full text-4xl font-semibold text-white ring-1 ring-white/15 ${getAvatarClass(role)}`}
            >
              {user?.avatar ? <img src={user.avatar} alt={user?.name} className="h-full w-full object-cover" /> : (user?.name || '?').charAt(0).toUpperCase()}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 [&>svg]:h-6 [&>svg]:w-6"><UploadIcon /></span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => onPickAvatar(e)} style={{ display: 'none' }} />
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <h1 className="m-0 flex items-center gap-2 font-futuristic text-[28px] font-semibold leading-tight text-white">
              <span className="truncate">{user?.name || t('profile.yourName')}</span>
              {!unverified && <VerifiedBadge size={18} channel={user?.verifyChannel} />}
            </h1>
            <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-white/60">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${roleTone}`}>{roleLabel(role || 'ARTIST', t)}</span>
              <span className="inline-flex items-center gap-1 [&>svg]:h-3.5 [&>svg]:w-3.5"><LocationIcon />{user?.location || t('profile.addLocation')}</span>
            </p>
            {Array.isArray(user?.genres) && user.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.genres.map((g) => <span key={g} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.1em] text-white/65">{g}</span>)}
              </div>
            )}
          </div>

          <div className="d3-op-actions flex shrink-0 flex-wrap justify-end gap-2">
            <Action icon={<EditIcon />} label={t('profile.editProfile')} onClick={onEdit} primary />
            {role === 'AGENT'
              ? <Action icon={<ListIcon />} label={t('roster.title')} onClick={onRoster} />
              : <Action icon={<GridIcon />} label={t('profile.manageLabel')} onClick={onManage} dot={ownHasActions} />}
            {role === 'ARTIST' && <Action icon={<HandshakeIcon />} label={t('profile.findAgentLabel')} onClick={onFindAgent} />}
            <Action
              icon={userProfiles.length > 1 ? <SwitchIcon /> : <AddIcon />}
              label={userProfiles.length > 1 ? t('profile.switchProfileLabel') : t('profile.addProfileLabel')}
              onClick={onOpenSwitcher}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-white/[0.07] pt-3">
          <Stat value={fmtStat(likedProfilesList.length)} label={t('profile.likesGiven')} onClick={onOpenLikes} />
          <Stat value={fmtStat(likerProfilesList.length)} label={t('profile.likedByLabel')} onClick={onOpenLikers} />
          <Stat value={fmtStat(connectionsList.length)} label={t('profile.connections')} onClick={onOpenConnections} />
          <div className="ml-auto"><ProfileBadges badges={ownBadges} onOpenHub={onOpenAchievements} /></div>
        </div>
      </header>

      <div className="d3-op-body">
        {/* ---- main: what needs you, then your work ---- */}
        <main className="flex min-w-0 flex-col gap-6">
          {trialInfo && (
            <div className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${trialInfo.expired ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-emerald-500/30 bg-emerald-500/[0.06]'}`}>
              <div>
                <strong className={`block text-[13.5px] font-semibold ${trialInfo.expired ? 'text-amber-300' : 'text-emerald-300'}`}>{trialInfo.expired ? t('profile.trialExpired') : t('profile.trialActive')}</strong>
                <p className="m-0 mt-0.5 text-[12px] text-white/50">
                  {trialInfo.expired ? t('profile.trialExpiredDesc')
                    : trialInfo.days ? t(trialInfo.days === 1 ? 'profile.dayRemaining' : 'profile.daysRemaining', { n: trialInfo.days })
                    : t(trialInfo.hours === 1 ? 'profile.hourRemaining' : 'profile.hoursRemaining', { n: trialInfo.hours })}
                </p>
              </div>
              <button onClick={() => onOpenPremium && onOpenPremium()} className="btn btn-primary">{trialInfo.expired ? t('search.upgradeNow') : t('search.upgrade')}</button>
            </div>
          )}

          {unverified && (
            <button type="button" onClick={onVerify} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-infrared/30 bg-infrared/[0.06] p-4 text-left">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-infrared/30 text-infrared [&>svg]:h-4 [&>svg]:w-4"><ShieldIcon /></span>
                <span className="min-w-0">
                  <strong className="block text-[13.5px] font-semibold text-white">{inReview ? t('verify.inReviewTitle') : t('verify.verifyTitle')}</strong>
                  <span className="block text-[12px] text-white/50">{inReview ? t('verify.inReviewDesc') : role === 'AGENT' ? t('verify.verifyDescAgent') : t('verify.verifyDesc')}</span>
                </span>
              </span>
              <span className="btn btn-primary shrink-0">{inReview ? t('verify.statusButton') : t('verify.verifyButton')}</span>
            </button>
          )}

          <OnboardingChecklist key={user?.id || 'anon'} />

          {user?.bio ? (
            <div className="d3-panel px-5 py-4">
              <p className="m-0 whitespace-pre-line text-[14px] leading-relaxed text-white/75">{user.bio}</p>
              <div className="mt-1"><BioTranslate text={user.bio} /></div>
            </div>
          ) : (
            <button onClick={onEdit} className="d3-panel cursor-pointer px-5 py-4 text-left text-[13px] text-white/40 transition-colors hover:border-white/25">{t('editProfile.bio')} ›</button>
          )}

          {role === 'AGENT' && (
            <Section title={t('profile.artistsRepresenting')}>
              {rosterArtists.length > 0 ? (
                <ArtistRosterGrid
                  artists={rosterArtists}
                  onOpenArtist={onOpenProfile}
                  renderOverlay={(artist) => (
                    <button
                      onClick={(e) => { e.stopPropagation(); onManageArtist(artist); }}
                      className="absolute right-2 top-2 rounded-lg bg-infrared px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-infrared-dim"
                    >
                      {t('profile.manageLabel')}
                      {artistActionsMap[artist.profileId || artist.id] && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.7)]" />}
                    </button>
                  )}
                />
              ) : (
                <button onClick={onRoster} className="d3-panel w-full cursor-pointer border-dashed p-6 text-center text-[13px] text-white/45 hover:border-white/30">{t('roster.title')} ›</button>
              )}
            </Section>
          )}

          {(user?.mixtape || user?.spotify) && (
            <Section title={t('viewProfile.latestMix')}>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {user?.mixtape && (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
                    {embeds.soundcloud
                      ? <iframe src={embeds.soundcloud} frameBorder="0" className="block h-[166px] w-full" title={t('manageArtist.soundcloudMix')} />
                      : <button onClick={onEdit} className="block w-full cursor-pointer p-5 text-center text-[12.5px] text-white/50">{t('profile.useFullSoundcloudUrl')}</button>}
                  </div>
                )}
                {user?.spotify && (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
                    {embeds.spotify
                      ? <iframe src={embeds.spotify} frameBorder="0" allowTransparency="true" allow="encrypted-media" className="block h-[166px] w-full" title={t('manageArtist.spotifyArtistProfile')} />
                      : <button onClick={onEdit} className="block w-full cursor-pointer p-5 text-center text-[12.5px] text-white/50">{t('profile.useFullSpotifyUrl')}</button>}
                  </div>
                )}
              </div>
            </Section>
          )}

          {(role === 'VENUE' || role === 'PROMOTER') && (
            <div className="d3-vp-gallery"><PhotoGallery photos={user?.photos} title={role === 'VENUE' ? t('profile.venueGalleryTitle') : t('profile.pastEventsTitle')} /></div>
          )}
          {role === 'VENUE' && <RoomsTechCard rooms={user?.venueRoomsSpec} />}

          {hasHighlights && (
            <Section title={t('viewProfile.pastHighlights')}><HighlightsList highlights={user.pastHighlights} /></Section>
          )}

          <RepresentationSection profiles={representedByProfiles} fallbackEntries={user?.representedBy} onOpenProfile={onOpenProfile} />

          {networkSections.map(([key, items, titleKey]) => items.length > 0 && (
            <Section key={key} title={t(titleKey)}><ProfileMiniGrid profiles={items} onOpenProfile={onOpenProfile} cols={4} /></Section>
          ))}
        </main>

        {/* ---- aside: your network, your profiles, your links ---- */}
        <aside className="flex min-w-0 flex-col gap-4">
          <Panel
            title={td('profilesLabel')}
            action={<button onClick={onOpenSwitcher} className="cursor-pointer text-[11px] text-white/40 hover:text-white">{t('profile.switchProfileLabel')}</button>}
          >
            <ul className="m-0 flex list-none flex-col p-0">
              {userProfiles.map((p) => {
                const active = p.id === user?.id;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => !active && onSwitchProfile(p.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors ${active ? 'bg-white/[0.05]' : 'cursor-pointer hover:bg-white/[0.04]'}`}
                    >
                      <Avatar profile={p} className="h-7 w-7 text-[11px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-white/90">{p.name}</span>
                        <span className="block truncate text-[10.5px] text-white/40">{roleLabel(p.role, t)}</span>
                      </span>
                      {p.id === defaultProfileId && <span className="text-[#FFD700] [&>svg]:h-3 [&>svg]:w-3 [&>svg]:fill-current"><StarIcon /></span>}
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-infrared" />}
                    </button>
                  </li>
                );
              })}
              {userProfiles.length < ROLES.length && (
                <li>
                  <button onClick={onAddProfile} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-[12.5px] text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-white/25 [&>svg]:h-3.5 [&>svg]:w-3.5"><AddIcon /></span>
                    {t('profile.addNewProfile')}
                  </button>
                </li>
              )}
            </ul>
          </Panel>

          <Panel title={t('profile.links')} action={<button onClick={onEdit} className="cursor-pointer text-[11px] text-white/40 hover:text-white">{t('common.edit')}</button>}>
            {links.length === 0 ? <p className="m-0 py-2 text-[12px] text-white/30">—</p> : (
              <div className="flex flex-col gap-2">
                {links.map((l) => (
                  <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 no-underline transition-colors hover:border-white/25">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-infrared text-white [&>svg]:h-3.5 [&>svg]:w-3.5">{l.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{l.label}</span>
                    <span className="text-[11px] text-white/30">↗</span>
                  </a>
                ))}
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
};

export default OwnProfilePage;
