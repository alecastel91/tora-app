import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { getAvatarClass } from '../../utils/roles';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { HeartIcon, MessageIcon, ShieldIcon, PlaneIcon, HandshakeIcon, ImageIcon, CloseIcon } from '../../utils/icons';
import { downscaleImageToDataUrl } from '../../utils/image';

const ROLE_LABEL_KEY = { ARTIST: 'editProfile.artist', AGENT: 'editProfile.agent', PROMOTER: 'editProfile.promoter', VENUE: 'editProfile.venue' };

const relativeTime = (iso, t) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('news.justNow');
  if (mins < 60) return t('news.minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('news.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('news.daysAgo', { n: days });
  return new Date(iso).toLocaleDateString();
};

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

// Split text into spans + anchors so pasted links are tappable.
const linkify = (text) => {
  if (!text) return null;
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
         className="break-all text-infrared underline decoration-infrared/40 underline-offset-2 hover:decoration-infrared"
         onClick={(e) => e.stopPropagation()}>
        {part}
      </a>
    ) : part
  );
};

const firstUrl = (text) => {
  if (!text) return null;
  const m = text.match(URL_RE);
  return m ? m[0] : null;
};

// Compact OpenGraph preview card under posts that contain a link
const LinkPreview = ({ url }) => {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    let cancelled = false;
    apiService.getLinkPreview(url)
      .then((data) => { if (!cancelled) setMeta(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);
  if (!meta || (!meta.title && !meta.image)) return null;
  let domain = '';
  try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep empty */ }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className="mt-3 flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] no-underline transition-colors hover:border-white/25"
       onClick={(e) => e.stopPropagation()}>
      {meta.image && (
        <img src={meta.image} alt="" loading="lazy"
             className="h-[74px] w-[74px] shrink-0 object-cover"
             onError={(e) => { e.target.style.display = 'none'; }} />
      )}
      <div className="min-w-0 flex-1 px-3 py-2">
        {meta.title && <div className="truncate text-xs font-semibold text-white">{meta.title}</div>}
        {meta.description && <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/50">{meta.description}</div>}
        <div className="mt-1 text-[10px] font-tech uppercase tracking-[0.12em] text-white/35">{meta.siteName || domain}</div>
      </div>
    </a>
  );
};

const Avatar = ({ profile, size = 'h-10 w-10', onClick }) => (
  profile?.avatar ? (
    <img src={profile.avatar} alt="" onClick={onClick}
         className={`${size} shrink-0 cursor-pointer rounded-full object-cover`} />
  ) : (
    <div onClick={onClick}
         className={`${size} ${getAvatarClass(profile?.role)} flex shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-bold text-white`}>
      {(profile?.name || '?').charAt(0).toUpperCase()}
    </div>
  )
);

// Global industry feed: member posts + automated milestones. Content is
// visible to every tier; FREE members hit an upgrade prompt when opening a
// profile outside their country (mirrors the search country-lock).
const NewsScreen = ({ onOpenProfile, onOpenPremium }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [posts, setPosts] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftImage, setDraftImage] = useState(null); // data URL, client-downscaled
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef(null);
  const [openComments, setOpenComments] = useState({}); // postId -> { comments, hasMore, nextCursor }
  const [commentDrafts, setCommentDrafts] = useState({});
  const [menuFor, setMenuFor] = useState(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await apiService.getFeed({ profileId: user.id });
      setPosts(data.posts);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      setPosts([]);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const data = await apiService.getFeed({ profileId: user.id, cursor });
      setPosts((prev) => [...(prev || []), ...data.posts]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const submitPost = async () => {
    const text = draft.trim();
    if ((!text && !draftImage) || posting) return;
    setPosting(true);
    try {
      const { post } = await apiService.createPost({ profileId: user.id, text, image: draftImage || undefined });
      setPosts((prev) => [post, ...(prev || [])]);
      setDraft('');
      setDraftImage(null);
    } catch (e) {
      if (e?.response?.data?.code !== 'VERIFICATION_REQUIRED') appAlert(e.message || t('news.postFailed'));
    } finally {
      setPosting(false);
    }
  };

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // Client-side downscale keeps uploads tiny (webp ~100-300KB) so the
      // feed stays fast; the server re-normalizes to 1280px webp.
      const dataUrl = await downscaleImageToDataUrl(file, { maxDimension: 1280, quality: 0.82 });
      setDraftImage(dataUrl);
    } catch (err) {
      console.error('Image pick failed:', err);
      appAlert(err?.message || t('news.postFailed'));
    }
  };

  const toggleLike = async (post) => {
    if (busyRef.current) return;
    busyRef.current = true;
    // optimistic
    setPosts((prev) => prev.map((p) => p.id === post.id
      ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likesCount + (p.likedByMe ? -1 : 1) }
      : p));
    try {
      const { liked, likesCount } = await apiService.togglePostLike(post.id, user.id);
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, likedByMe: liked, likesCount } : p));
    } catch {
      setPosts((prev) => prev.map((p) => p.id === post.id
        ? { ...p, likedByMe: post.likedByMe, likesCount: post.likesCount } : p));
    } finally {
      busyRef.current = false;
    }
  };

  const toggleComments = async (post) => {
    if (openComments[post.id]) {
      setOpenComments((prev) => { const next = { ...prev }; delete next[post.id]; return next; });
      return;
    }
    try {
      const data = await apiService.getPostComments(post.id);
      setOpenComments((prev) => ({ ...prev, [post.id]: data }));
    } catch { /* leave closed */ }
  };

  const submitComment = async (post) => {
    const text = (commentDrafts[post.id] || '').trim();
    if (!text) return;
    try {
      const { comment } = await apiService.createPostComment(post.id, { profileId: user.id, text });
      setOpenComments((prev) => ({
        ...prev,
        [post.id]: { ...prev[post.id], comments: [...(prev[post.id]?.comments || []), comment] },
      }));
      setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, commentsCount: p.commentsCount + 1 } : p));
    } catch (e) {
      if (e?.response?.data?.code !== 'VERIFICATION_REQUIRED') appAlert(e.message || t('news.commentFailed'));
    }
  };

  const reportPost = async (post) => {
    setMenuFor(null);
    const ok = await appConfirm(t('news.reportConfirm'), { confirmLabel: t('news.report'), danger: true });
    if (!ok) return;
    try {
      await apiService.reportPost(post.id, { profileId: user.id });
      appAlert(t('news.reportThanks'));
    } catch (e) {
      appAlert(e.message || t('news.postFailed'));
    }
  };

  const deletePost = async (post) => {
    setMenuFor(null);
    const ok = await appConfirm(t('news.deleteConfirm'), { confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      await apiService.deletePost(post.id, user.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      appAlert(e.message || t('news.postFailed'));
    }
  };

  // FREE members read the global feed but can't open foreign profiles —
  // same boundary as the search country-lock.
  const openAuthor = (author) => {
    if (!author) return;
    if (author.isOfficial) { onOpenProfile && onOpenProfile(author); return; }
    const isFree = (user?.subscriptionTier || 'FREE') === 'FREE';
    if (isFree && author.country && user?.country && author.country !== user.country && author.id !== user.id) {
      appConfirm(t('news.upgradeToView'), { confirmLabel: t('search.upgradeNow') })
        .then((go) => { if (go && onOpenPremium) onOpenPremium(); });
      return;
    }
    onOpenProfile && onOpenProfile(author);
  };

  const milestone = (post) => {
    const d = post.data || {};
    switch (post.type) {
      case 'REPRESENTATION':
        return { icon: <HandshakeIcon />, text: t('news.milestoneRepresentation', { agent: d.agentName, artist: d.artistName }) };
      case 'MEMBER_VERIFIED':
        return { icon: <ShieldIcon />, text: t('news.milestoneVerified', { name: d.name, role: t(ROLE_LABEL_KEY[d.role] || 'editProfile.artist'), city: d.city }) };
      case 'TOUR_COMPLETED':
        return { icon: <PlaneIcon />, text: t('news.milestoneTour', { artist: d.artistName, zone: d.country || d.zone, n: d.confirmedGigs }) };
      default:
        return null;
    }
  };

  return (
    <div className="screen active news-screen px-5 pt-6 pb-24" onClick={() => menuFor && setMenuFor(null)}>
      {/* composer */}
      <div className="mb-5 rounded-2xl border border-white/10 bg-[#0c0c11] p-4">
        <div className="flex gap-3">
          <Avatar profile={user} />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('news.composerPlaceholder')}
            rows={2}
            maxLength={2000}
            className="form-input min-h-[52px] w-full resize-y !border-0 !bg-transparent !p-0 text-sm leading-relaxed"
          />
        </div>
        {draftImage && (
          <div className="relative mt-3 inline-block">
            <img src={draftImage} alt="" className="max-h-40 rounded-xl border border-white/10 object-cover" />
            <button
              className="absolute -right-2 -top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black text-white/80 [&_svg]:h-3 [&_svg]:w-3"
              onClick={() => setDraftImage(null)}
              aria-label={t('common.close')}
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-end gap-3">
          {draft.length > 1800 && (
            <span className="text-[10px] text-white/35">{draft.length} / 2000</span>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
          <button
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-transparent text-white/60 transition-colors hover:border-white/35 hover:text-white [&_svg]:h-4 [&_svg]:w-4"
            onClick={() => fileInputRef.current?.click()}
            aria-label={t('news.addImage')}
          >
            <ImageIcon />
          </button>
          <button className="btn btn-primary !px-6 !py-2" disabled={posting || (!draft.trim() && !draftImage)} onClick={submitPost}>
            {posting ? '...' : t('news.postCta')}
          </button>
        </div>
      </div>

      {posts === null && (
        <p className="py-10 text-center text-sm text-white/40">{t('common.loading')}</p>
      )}
      {posts && posts.length === 0 && (
        <p className="py-10 text-center text-sm text-white/40">{t('news.empty')}</p>
      )}

      {(posts || []).map((post) => {
        const m = milestone(post);
        const isOwn = post.author?.id === user?.id;
        const official = !!post.author?.isOfficial;
        const thread = openComments[post.id];
        return (
          <div key={post.id} className={`mb-3 rounded-2xl border bg-[#0c0c11] p-4 ${official ? 'border-infrared/40' : 'border-white/10'}`}>
            {/* header */}
            <div className="flex items-start gap-3">
              <Avatar profile={post.author} onClick={() => openAuthor(post.author)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <button
                    className="cursor-pointer truncate border-0 bg-transparent p-0 text-sm font-semibold text-white hover:underline"
                    onClick={() => openAuthor(post.author)}
                  >
                    {post.author?.name}
                  </button>
                  {official ? (
                    <span className="shrink-0 rounded-full border border-infrared/60 bg-infrared/10 px-2 py-0.5 text-[9px] font-tech uppercase tracking-[0.15em] text-infrared">
                      {t('news.official')}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-tech uppercase tracking-[0.12em]"
                          style={{ color: `var(--color-role-${(post.author?.role || 'artist').toLowerCase()}, #fff)` }}>
                      {t(ROLE_LABEL_KEY[post.author?.role] || 'editProfile.artist')}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/35">
                  {official
                    ? relativeTime(post.createdAt, t)
                    : `${[post.author?.city, post.author?.country].filter(Boolean).join(', ')} · ${relativeTime(post.createdAt, t)}`}
                </div>
              </div>
              {/* menu */}
              <div className="relative">
                <button
                  className="cursor-pointer rounded-full border-0 bg-transparent px-2 py-1 text-white/40 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === post.id ? null : post.id); }}
                >
                  ···
                </button>
                {menuFor === post.id && (
                  <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#16161c] py-1"
                       onClick={(e) => e.stopPropagation()}>
                    {isOwn && post.type === 'TEXT' && (
                      <button className="block w-full cursor-pointer border-0 bg-transparent px-4 py-2.5 text-left text-xs text-white/80 hover:bg-white/5"
                              onClick={() => deletePost(post)}>
                        {t('common.delete')}
                      </button>
                    )}
                    {!isOwn && (
                      <button className="block w-full cursor-pointer border-0 bg-transparent px-4 py-2.5 text-left text-xs text-infrared hover:bg-white/5"
                              onClick={() => reportPost(post)}>
                        {t('news.report')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* body */}
            {m ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-infrared/40 text-infrared [&_svg]:h-4 [&_svg]:w-4">
                  {m.icon}
                </span>
                <p className="m-0 text-sm leading-relaxed text-white/80">{m.text}</p>
              </div>
            ) : (
              <>
                {post.text && (
                  <p className="m-0 mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{linkify(post.text)}</p>
                )}
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" loading="lazy"
                       className="mt-3 max-h-[420px] w-full rounded-xl border border-white/[0.07] object-cover" />
                )}
                {!post.imageUrl && firstUrl(post.text) && <LinkPreview url={firstUrl(post.text)} />}
              </>
            )}

            {/* actions */}
            <div className="mt-3 flex items-center gap-5 border-t border-white/[0.06] pt-2.5">
              <button
                className={`flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs ${post.likedByMe ? 'text-infrared' : 'text-white/45 hover:text-white/80'} [&_svg]:h-4 [&_svg]:w-4`}
                onClick={() => toggleLike(post)}
              >
                <HeartIcon filled={post.likedByMe} />
                {post.likesCount > 0 && <span>{post.likesCount}</span>}
              </button>
              <button
                className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-white/45 hover:text-white/80 [&_svg]:h-4 [&_svg]:w-4"
                onClick={() => toggleComments(post)}
              >
                <MessageIcon />
                {post.commentsCount > 0 && <span>{post.commentsCount}</span>}
              </button>
            </div>

            {/* comments */}
            {thread && (
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                {thread.comments.map((c) => (
                  <div key={c.id} className="mb-2.5 flex items-start gap-2.5">
                    <Avatar profile={c.author} size="h-7 w-7" onClick={() => openAuthor(c.author)} />
                    <div className="min-w-0 flex-1 rounded-xl bg-white/[0.04] px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-xs font-semibold text-white">{c.author?.name}</span>
                        <span className="shrink-0 text-[10px] text-white/30">{relativeTime(c.createdAt, t)}</span>
                      </div>
                      <p className="m-0 mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-white/75">{linkify(c.text)}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentDrafts[post.id] || ''}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitComment(post); }}
                    placeholder={t('news.commentPlaceholder')}
                    maxLength={600}
                    className="form-input min-w-0 flex-1 !py-2 text-xs"
                  />
                  <button className="btn btn-outline !px-4 !py-2 text-xs" onClick={() => submitComment(post)}>
                    {t('news.commentCta')}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {hasMore && (
        <button className="btn btn-outline mx-auto mt-2 block" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? '...' : t('news.loadMore')}
        </button>
      )}
    </div>
  );
};

export default NewsScreen;
