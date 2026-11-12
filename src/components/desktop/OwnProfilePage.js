import React, { useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { fmtStat, Section, Panel, Stat, profileLinks } from './primitives';
import { UploadIcon, EditIcon, SwitchIcon, AddIcon, HandshakeIcon, ListIcon, ShieldIcon } from '../../utils/icons';
import PosterBanner from '../common/PosterBanner';
import BubbleStrip from '../common/BubbleStrip';
import ProfileBadges from '../common/ProfileBadges';
import BioTranslate from '../common/BioTranslate';
import ArtistRosterGrid from '../common/ArtistRosterGrid';
import ProfileMiniGrid from '../common/ProfileMiniGrid';
import PhotoGallery from '../common/PhotoGallery';
import RoomsTechCard from '../common/RoomsTechCard';
import RepresentationSection from '../common/RepresentationSection';
import HighlightsList from '../common/HighlightsList';
import OnboardingChecklist from '../common/OnboardingChecklist';
import AgencyJoinPrompt from '../common/AgencyJoinPrompt';
import AgencyBadge from '../common/AgencyBadge';
import PublicPageCard from '../common/PublicPageCard';
import { FocusIcon } from '../common/PhotoFocusModal';
import { ArtistMediaTop, ArtistMediaBottom, PlayLine, NightsList, MiniPlayer, usePlayer } from '../common/ArtistMedia';

/* Desktop v3 — your own profile, designed for the desk. ProfileScreen keeps
   every fetch, flow, sub-screen and modal and hands this component its state
   and handlers; the phone body is untouched.

   Structure mirrors the profile page people see of you (ProfilePage), with
   the difference that this one is a workbench: the identity band carries the
   things you DO (edit, manage, roster, switch profile), the main column
   carries what needs you (trial, verification, checklist) above your work,
   and the side column holds your links. Switching profile lives in the
   sidebar chip and the band's Switch button. */

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
                [&>svg]:h-4 [&>svg]:w-4 ${primary ? 'border-transparent bg-[var(--color-crimson-action)] text-white hover:bg-[var(--color-crimson-action-hover)]' : 'border-white/12 bg-white/[0.03] text-white/85 hover:border-white/30 hover:text-white'}`}
  >
    <span className={`${primary ? 'text-white' : 'text-infrared'} [&>svg]:h-4 [&>svg]:w-4`}>{icon}</span>
    {label}
    {dot && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-infrared shadow-[0_0_6px_rgba(255,51,102,0.7)]" />}
  </button>
);

const OwnProfilePage = ({
  user, userProfiles, defaultProfileId, embeds, ownBadges, rosterArtists, artistActionsMap, ownHasActions,
  representedByProfiles, networkSections, likedProfilesList, likerProfilesList, connectionsList, trialInfo,
  fileInputRef, onPickAvatar, onPositionPhoto, onEdit, onEditAt, onManage, onRoster, onFindAgent, onOpenSwitcher, onAddProfile, onSwitchProfile,
  onOpenLikes, onOpenLikers, onOpenConnections, onOpenAchievements, onOpenPremium, onVerify, onOpenProfile, onManageArtist,
}) => {
  const pageRef = useRef(null);
  const player = usePlayer();
  const { t } = useLanguage();
  const role = user?.role;

  const links = profileLinks(user, t);

  const unverified = user?.verifyStatus !== 'VERIFIED';
  const inReview = user?.verifyStatus === 'PENDING_REVIEW';
  const hasHighlights = ['ARTIST', 'PROMOTER', 'VENUE', 'AGENT'].includes(role) && Array.isArray(user?.pastHighlights) && user.pastHighlights.length > 0;

  return (
    <div className="d3-op poster-page" ref={pageRef}>
      {/* ---- identity band: who you are, and what you do here ---- */}
      <header className="d3-op-head d3-panel">
        <PosterBanner
          own
          wide
          profile={user}
          top={(
            <>
              <span className="flex gap-2">
                <button type="button" className="poster-text-btn" onClick={onPickAvatar}><UploadIcon /> {t('profile.changePhoto')}</button>
                {(user?.avatarLarge || user?.avatar) && <button type="button" className="poster-text-btn" onClick={onPositionPhoto}><FocusIcon /> {t('profile.positionPhoto')}</button>}
              </span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => onPickAvatar(e)} style={{ display: 'none' }} />
            </>
          )}
          actions={(
            <div className="d3-op-actions flex shrink-0 flex-wrap justify-end gap-2">
              <Action icon={<EditIcon />} label={t('profile.editProfile')} onClick={onEdit} primary />
              <Action icon={<GridIcon />} label={t('profile.manageLabel')} onClick={onManage} dot={ownHasActions} />
              {role === 'AGENT' && <Action icon={<ListIcon />} label={t('roster.title')} onClick={onRoster} />}
              {role === 'ARTIST' && <Action icon={<HandshakeIcon />} label={t('profile.findAgentLabel')} onClick={onFindAgent} />}
              <Action
                icon={userProfiles.length > 1 ? <SwitchIcon /> : <AddIcon />}
                label={userProfiles.length > 1 ? t('profile.switchProfileLabel') : t('profile.addProfileLabel')}
                onClick={onOpenSwitcher}
              />
            </div>
          )}
        >
          {role === 'AGENT' && <AgencyBadge profileId={user?.id} align="left" onOpenProfile={onOpenProfile} />}
          {(user?.pronouns || user?.genres?.length > 0) && (
            <p className="poster-line">{[user.pronouns, user.genres?.length ? user.genres.join(', ') : null].filter(Boolean).join(' · ')}</p>
          )}
        </PosterBanner>

        <div className="d3-poster-stats flex flex-wrap items-center gap-1">
          <Stat value={fmtStat(likedProfilesList.length)} label={t('profile.likesGiven')} onClick={onOpenLikes} />
          <Stat value={fmtStat(likerProfilesList.length)} label={t('profile.likedByLabel')} onClick={onOpenLikers} />
          <Stat value={fmtStat(connectionsList.length)} label={t('profile.connections')} onClick={onOpenConnections} />
          <div className="ml-auto flex items-center gap-3"><ProfileBadges badges={ownBadges} onOpenHub={onOpenAchievements} /></div>
        </div>
      </header>

      <div className="d3-op-body">
        {/* ---- main: what needs you, then your work ---- */}
        <main className="flex min-w-0 flex-col gap-6">
          {role === 'ARTIST' && <PublicPageCard compact profile={user} onVerify={onVerify} onEdit={onEdit} />}

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

          {/* The only discovery path for agency pricing. The phone shows it in
              ProfileScreen's body, which desktop returns before reaching. */}
          {user?.role === 'AGENT' && <AgencyJoinPrompt userId={user?.id} />}

          <OnboardingChecklist key={user?.id || 'anon'} />

          {user?.bio ? (
            <div className="d3-panel px-5 py-4">
              <h2 className="poster-h2">{t('profile.about')}</h2>
              <p className="poster-bio whitespace-pre-line">{user.bio}</p>
              <div className="mt-1"><BioTranslate text={user.bio} /></div>
              <PlayLine profile={user} />
            </div>
          ) : (
            <button onClick={onEdit} className="d3-panel cursor-pointer px-5 py-4 text-left text-[13px] text-white/40 transition-colors hover:border-white/25">{t('editProfile.bio')} ›</button>
          )}

          <RepresentationSection profiles={representedByProfiles} fallbackEntries={user?.representedBy} onOpenProfile={onOpenProfile} />

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

          {role === 'ARTIST' && <ArtistMediaTop profile={user} onPlay={player.play} onAdd={onEditAt} />}

          {role !== 'ARTIST' && (user?.mixtape || user?.spotify) && (
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
            <div className="d3-vp-gallery"><PhotoGallery cols={4} photos={user?.photos} title={role === 'VENUE' ? t('profile.venueGalleryTitle') : t('profile.pastEventsTitle')} /></div>
          )}
          {role === 'VENUE' && <RoomsTechCard rooms={user?.venueRoomsSpec} />}

          {hasHighlights && (
            <Section title={t('viewProfile.pastHighlights')} onAdd={() => onEditAt('highlights')}><HighlightsList highlights={user.pastHighlights} /></Section>
          )}

          <NightsList profile={user} onOpenProfile={onOpenProfile} />

          {networkSections.map(([key, items, titleKey]) => items.length > 0 && (
            <Section key={key} title={t(titleKey)}>
              {role === 'ARTIST'
                ? <BubbleStrip profiles={items} onOpenProfile={onOpenProfile} />
                : <ProfileMiniGrid profiles={items} onOpenProfile={onOpenProfile} cols={4} />}
            </Section>
          ))}

          {role === 'ARTIST' && <ArtistMediaBottom profile={user} onAdd={onEditAt} />}
        </main>

        {/* ---- aside: your network, your profiles, your links ---- */}
        <aside className="flex min-w-0 flex-col gap-4">
          <Panel title={t('profile.links')} action={<button onClick={() => onEditAt('links')} className="cursor-pointer text-[11px] text-white/40 hover:text-white">{t('common.edit')}</button>}>
            {links.length === 0 ? <p className="m-0 py-2 text-[12px] text-white/30">—</p> : (
              <div className="flex flex-col gap-2">
                {links.map((l) => (
                  <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" className="poster-link no-underline">
                    <span className="poster-link-icon">{l.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{l.label}</span>
                    <span className="text-[11px] text-white/30">↗</span>
                  </a>
                ))}
              </div>
            )}
          </Panel>
        </aside>
      </div>
      <MiniPlayer item={player.playing} onClose={player.stop} />
    </div>
  );
};

export default OwnProfilePage;
