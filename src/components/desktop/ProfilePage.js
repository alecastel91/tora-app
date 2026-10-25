import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { roleLabel, roleChipClass } from '../../utils/roles';
import { fmtStat, Section, Panel, Stat, Avatar, profileLinks } from './primitives';
import { formatEventDate } from '../../utils/dates';
import { networkSectionsForRole } from '../../utils/networkSections';
import { HeartIcon, LocationIcon } from '../../utils/icons';
import VerifiedBadge from '../common/VerifiedBadge';
import ProfileBadges from '../common/ProfileBadges';
import BioTranslate from '../common/BioTranslate';
import ArtistRosterGrid from '../common/ArtistRosterGrid';
import ProfileMiniGrid from '../common/ProfileMiniGrid';
import PhotoGallery from '../common/PhotoGallery';
import RoomsTechCard from '../common/RoomsTechCard';
import RepresentationSection from '../common/RepresentationSection';
import HighlightsList from '../common/HighlightsList';
import LockOverlay from '../common/LockOverlay';
import SafetyMenu from '../common/SafetyMenu';
import AgencyBadge from '../common/AgencyBadge';

/* Desktop v3 profile page — designed for a desk, not the phone page split
   into columns. ViewProfileScreen keeps every fetch, flow and modal and hands
   this component its state and handlers; the phone markup is untouched.

   Structure: an identity band across the top (who, where, what they do, and
   the actions), a stats strip, then the body — the person's WORK in the main
   column (bio, roster, tours, media, gallery, tech), and the reference
   material in the side column (links, badges, similar profiles, safety). */

const LinkRow = ({ href, icon, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 no-underline transition-colors hover:border-white/25"
  >
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-infrared text-white [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{label}</span>
    <span className="text-[11px] text-white/30">↗</span>
  </a>
);

const ProfilePage = ({
  profile, currentUser, embeds, artistTours = [], similarProfiles = [], likers, likedProfiles,
  isLiked, isConnected, hasPendingRequest, actionBusy, premiumViewer,
  onClose, onLike, onMessage, onConnect, onRemove, onOpenGigs, onOpenList, onOpenNested,
  onToggleTourInterest, onTourOffer, onOpenTourKickstart, onOpenPremium,
}) => {
  const { t } = useLanguage();
  const locale = t('dateFormat.locale');
  const role = profile.role;
  const isBooker = currentUser?.role === 'PROMOTER' || currentUser?.role === 'VENUE';
  const isOwn = profile.id === currentUser?.id;

  const links = profileLinks(profile, t);

  const memberSince = profile.memberSince
    ? t('viewProfile.memberSince', { date: new Date(profile.memberSince).toLocaleDateString(locale, { month: 'short', year: 'numeric' }) })
    : null;

  const hasRoster = role === 'AGENT' && Array.isArray(profile.representingArtists) && profile.representingArtists.length > 0;
  const hasHighlights = ['ARTIST', 'PROMOTER', 'VENUE'].includes(role) && Array.isArray(profile.pastHighlights) && profile.pastHighlights.length > 0;
  const networkStrips = networkSectionsForRole(role, profile.network).filter(([, items]) => items.length > 0);

  return (
    <div className="d3-vp">
      <div className="d3-vp-inner">
        {/* ---- identity band ---- */}
        <header className="d3-vp-head d3-panel">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
            style={{
              background: `radial-gradient(60% 120% at 12% 0%, ${
                { ARTIST: 'rgba(102,126,234,0.22)', VENUE: 'rgba(245,87,108,0.18)', PROMOTER: 'rgba(255,193,7,0.14)', AGENT: 'rgba(67,233,123,0.14)' }[role]
                || 'rgba(255,255,255,0.08)'}, transparent 70%)`,
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.back')}
            className="absolute left-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white transition-colors hover:border-white/40 [&>svg]:h-4 [&>svg]:w-4"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>

          <div className="flex items-start gap-6">
            <Avatar profile={profile} alt={profile.name} className="h-[112px] w-[112px] text-4xl ring-1 ring-white/15" />
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="m-0 flex items-center gap-2 font-futuristic text-[28px] font-semibold leading-tight tracking-tight text-white">
                <span className="truncate">{profile.name}</span>
                {profile.verifyStatus === 'VERIFIED' && <VerifiedBadge size={18} channel={profile.verifyChannel} />}
              </h1>
              {role === 'AGENT' && (
                <AgencyBadge
                  profileId={profile.id}
                  align="left"
                  fallback={profile.agencyName ? <p className="m-0 mt-0.5 text-[13px] text-white/50">{profile.agencyName}</p> : null}
                />
              )}
              <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-white/60">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${roleChipClass(role)}`}>
                  {roleLabel(role, t)}
                </span>
                {profile.location && <span className="inline-flex items-center gap-1 [&>svg]:h-3.5 [&>svg]:w-3.5"><LocationIcon />{profile.location}</span>}
                {memberSince && <span className="text-white/35">· {memberSince}</span>}
              </p>
              {Array.isArray(profile.genres) && profile.genres.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.genres.map((g) => (
                    <span key={g} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.1em] text-white/65">{g}</span>
                  ))}
                </div>
              )}
            </div>

            {!isOwn && (
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button className={`btn ${isLiked ? 'btn-primary' : 'btn-outline'}`} onClick={onLike}>
                    <HeartIcon filled={isLiked} /> {isLiked ? t('search.liked') : t('search.like')}
                  </button>
                  {isConnected ? (
                    <button className="btn btn-message" onClick={onMessage}>{t('search.message')}</button>
                  ) : (
                    <button className={`btn ${hasPendingRequest ? 'btn-disabled' : 'btn-primary'}`} onClick={onConnect} disabled={hasPendingRequest || actionBusy}>
                      {hasPendingRequest ? t('search.pending') : (actionBusy ? '...' : t('search.connect'))}
                    </button>
                  )}
                </div>
                {isConnected && (
                  <button onClick={onRemove} className="cursor-pointer bg-transparent text-[11px] text-white/35 hover:text-white/70">{t('viewProfile.removeConnection')}</button>
                )}
              </div>
            )}
          </div>

          {/* ---- stats strip ---- */}
          <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-white/[0.07] pt-3">
            <Stat value={fmtStat(profile.likesGiven)} label={t('profile.likesGiven')} />
            <Stat value={fmtStat(profile.likesReceived)} label={t('profile.likedByLabel')} onClick={isOwn ? () => onOpenList('likes') : undefined} />
            <Stat value={fmtStat(profile.connectionsCount)} label={t('profile.connections')} onClick={() => onOpenList('connections')} />
            {role === 'ARTIST' && profile.gigsCompleted > 0 && (
              <Stat value={fmtStat(profile.gigsCompleted)} label={t('viewProfile.gigsViaTora', { n: '' }).trim()} onClick={onOpenGigs} />
            )}
            {role === 'VENUE' && profile.venueCapacity && <Stat value={Number(profile.venueCapacity).toLocaleString()} label={t('profile.capacity')} />}
            {role === 'VENUE' && profile.venueRooms && <Stat value={profile.venueRooms} label={t('profile.rooms')} />}
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="ml-auto"><ProfileBadges badges={profile.badges} /></div>
            )}
          </div>

          {/* Social proof, as on the phone: only the likers this viewer also
              likes. Inert for now on both surfaces — GET /connections/likers/:id
              is owner-only (F2-09), so `likers` is [] for anyone else. It needs a
              server endpoint that returns just the likers the viewer already likes. */}
          {(() => {
            if (isOwn || !Array.isArray(likers) || likers.length === 0 || !likedProfiles) return null;
            const familiar = likers.filter((l) => likedProfiles.has(l.id)).slice(0, 2);
            if (familiar.length === 0) return null;
            const others = (profile.likesReceived ?? likers.length) - familiar.length;
            return (
              <button
                type="button"
                onClick={() => onOpenList('likes')}
                className="mt-2 cursor-pointer bg-transparent p-0 text-left text-[12.5px] text-white/50 hover:text-white/70"
              >
                {t('viewProfile.likedBy')}{' '}
                <span className="font-medium text-white/85">{familiar.map((l) => l.name).join(', ')}</span>
                {others > 0 && <> {t('viewProfile.andOthers', { n: others })}</>}
              </button>
            );
          })()}
        </header>

        {/* ---- body ---- */}
        <div className="d3-vp-body">
          <main className="flex min-w-0 flex-col gap-7">
            {profile.bio && (
              <Section title={t('viewProfile.about') === 'viewProfile.about' ? null : t('viewProfile.about')}>
                <div className="d3-panel px-5 py-4">
                  <p className="m-0 whitespace-pre-line text-[14px] leading-relaxed text-white/75">{profile.bio}</p>
                  <div className="mt-1"><BioTranslate text={profile.bio} /></div>
                </div>
              </Section>
            )}

            {hasRoster && (
              <Section title={t('profile.artistsRepresenting')}>
                <ArtistRosterGrid
                  artists={profile.representingArtists}
                  onOpenArtist={(artist) => onOpenNested({ ...artist, id: artist.profileId || artist.id, role: 'ARTIST' })}
                />
              </Section>
            )}

            {role === 'ARTIST' && isBooker && !premiumViewer && (
              <Section title={t('viewProfile.activeTours')}>
                <button type="button" onClick={() => onOpenPremium && onOpenPremium()} className="relative block w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e] text-left transition-colors hover:border-infrared/40">
                  <div className="select-none p-4 blur-[7px]" aria-hidden>
                    <div className="mb-2 h-3.5 w-36 rounded bg-white/25" /><div className="h-2.5 w-52 rounded bg-white/15" />
                  </div>
                  <LockOverlay message={t('viewProfile.toursLockedMsg')} />
                </button>
              </Section>
            )}

            {role === 'ARTIST' && isBooker && premiumViewer && artistTours.length > 0 && (
              <Section title={t('viewProfile.activeTours')}>
                <div className="flex flex-col gap-2">
                  {artistTours.map((tour) => {
                    const meta = [
                      `${formatEventDate(tour.startDate, locale, { month: 'short', day: 'numeric' })} — ${formatEventDate(tour.endDate, locale, { month: 'short', day: 'numeric', year: 'numeric' })}`,
                      (tour.feeExpectation || tour.priceOnRequest) ? (tour.priceOnRequest ? t('tour.priceOnRequest') : tour.feeExpectation) : null,
                      (tour.interestsCount || 0) > 0 ? t('tour.interestedCountPublic', { n: tour.interestsCount }) : null,
                    ].filter(Boolean);
                    return (
                      <div
                        key={tour.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenTourKickstart(tour)}
                        className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-white/10 bg-[#0a0a0e] px-4 py-3 transition-colors hover:border-infrared/40"
                      >
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                          <p className="m-0 text-[13.5px] font-medium text-white">{t('tour.tourTitle', { location: tour.country || tour.zone })}</p>
                          <p className="m-0 flex flex-wrap gap-x-2 text-[10.5px] uppercase tracking-[0.12em] text-white/40">
                            {meta.map((m, i) => <span key={i}>{i > 0 && <span className="mr-2 text-white/25">·</span>}{m}</span>)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button type="button" className={`btn btn-small ${tour.myInterest ? 'btn-liked' : 'btn-outline'}`} onClick={(e) => { e.stopPropagation(); onToggleTourInterest(tour); }}>
                            <HeartIcon filled={!!tour.myInterest} />
                          </button>
                          <button type="button" className="btn btn-primary btn-small" onClick={(e) => { e.stopPropagation(); onTourOffer(); }}>{t('tour.makeAnOffer')}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {(embeds.soundcloud || embeds.spotify) && (
              <Section title={t('viewProfile.latestMix')}>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {embeds.soundcloud && (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
                      <iframe src={embeds.soundcloud} frameBorder="0" className="block h-[166px] w-full" title={t('manageArtist.soundcloudMix')} allow="autoplay" />
                    </div>
                  )}
                  {embeds.spotify && (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
                      <iframe src={embeds.spotify} frameBorder="0" allowTransparency="true" allow="encrypted-media" className="block h-[166px] w-full" title={t('manageArtist.spotifyArtistProfile')} />
                    </div>
                  )}
                </div>
              </Section>
            )}

            {(role === 'VENUE' || role === 'PROMOTER') && (
              <div className="d3-vp-gallery">
                <PhotoGallery cols={4} photos={profile.photos} title={role === 'VENUE' ? t('profile.venueGalleryTitle') : t('profile.pastEventsTitle')} />
              </div>
            )}

            {role === 'VENUE' && <RoomsTechCard rooms={profile.venueRoomsSpec} />}

            {hasHighlights && (
              <Section title={t('viewProfile.pastHighlights')}>
                <HighlightsList highlights={profile.pastHighlights} />
              </Section>
            )}

            <RepresentationSection
              profiles={profile.representedByProfiles}
              fallbackEntries={profile.representedBy}
              onOpenProfile={(p) => onOpenNested({ id: p.id, name: p.name, role: p.role || 'AGENT' })}
            />

            {networkStrips.map(([key, items, titleKey]) => (
              <Section key={key} title={t(titleKey)}>
                <ProfileMiniGrid profiles={items} onOpenProfile={onOpenNested} cols={4} />
              </Section>
            ))}
          </main>

          <aside className="flex min-w-0 flex-col gap-4">
            {links.length > 0 && (
              <Panel title={t('profile.links')}>
                <div className="flex flex-col gap-2">
                  {links.map((l) => <LinkRow key={l.key} href={l.href} icon={l.icon} label={l.label} />)}
                </div>
              </Panel>
            )}
            {similarProfiles.length >= 2 && (
              <Panel title={t('viewProfile.similarProfiles')}>
                <ProfileMiniGrid profiles={similarProfiles.slice(0, 6)} onOpenProfile={onOpenNested} cols={3} />
              </Panel>
            )}
            {!isOwn && (
              <div className="d3-vp-safety">
                <SafetyMenu variant="footer" profile={profile} onBlocked={onClose} />
              </div>
            )}

          </aside>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
