import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * The written guide — what the help icon opens.
 *
 * Deliberately the FIRST thing a member sees when they need help, with the
 * Assistant offered underneath rather than instead. A chat box as the only
 * entry point invites people to ask it things it should not be asked, costs a
 * model call for questions a paragraph answers better, and leaves nothing to
 * read when they would rather just look something up.
 *
 * Content lives in the translation files under `guide` (chapters → entries), so
 * it translates like everything else and a locale that lacks a chapter falls
 * back to English rather than showing an empty screen.
 */
const ChevronDown = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round"
       className={`w-4 h-4 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
       aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const SearchGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/** One question/answer row. Hoisted: a component defined inside the parent's
 *  body gets a new identity on every render, which remounted every row on each
 *  keystroke in the search box. */
const Entry = ({ entry, open, onToggle }) => (
  <div className="rounded-xl border border-white/10 bg-[#0a0a0e] overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer
                 transition-colors hover:bg-white/[0.03]"
    >
      <span className="text-sm text-white">{entry.q}</span>
      <ChevronDown open={open} />
    </button>
    {open && (
      <p className="m-0 px-4 pb-4 text-[13px] leading-relaxed text-white/60">{entry.a}</p>
    )}
  </div>
);

const AssistantBanner = ({ t, onAsk }) => (
  <div className="mt-6 rounded-2xl border border-infrared/30 bg-infrared/[0.06] p-4">
    <p className="m-0 text-sm font-semibold text-white font-space-grotesk">{t('guide.assistant.title')}</p>
    <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-white/55">{t('guide.assistant.body')}</p>
    <button
      type="button"
      onClick={onAsk}
      className="btn btn-primary mt-3.5 px-5 inline-flex items-center gap-2"
    >
      {t('guide.assistant.cta')}
      {/* the chat glyph makes it read as "opens a conversation" rather than
          "opens another page of text" */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </button>
  </div>
);

const SupportNote = ({ t }) => (
  <div className="mt-3 rounded-2xl border border-white/10 bg-[#0a0a0e] p-4">
    <p className="m-0 text-sm font-semibold text-white/80">{t('guide.support.title')}</p>
    <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-white/50">{t('guide.support.body')}</p>
  </div>
);

const GuideScreen = ({ onClose }) => {
  const { t, language } = useLanguage();
  const [openChapter, setOpenChapter] = useState(null);
  const [openSection, setOpenSection] = useState(null);
  const [query, setQuery] = useState('');
  const [openEntry, setOpenEntry] = useState(null);

  // t() returns whatever the key holds, so an array of chapters comes back
  // whole. Re-read when the language chunk arrives.
  const chapters = useMemo(() => {
    const c = t('guide.chapters');
    return Array.isArray(c) ? c : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Macro groups over those chapters. If a locale ever lacks them, every
  // chapter still reaches the reader as its own group rather than vanishing.
  const sections = useMemo(() => {
    const s = t('guide.sections');
    if (Array.isArray(s) && s.length) return s;
    return chapters.map((c) => ({ id: c.id, title: c.title, chapters: [c.id] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, chapters]);

  // Escape mirrors the back button: out of a chapter first, then out of the
  // guide — rather than dumping you to the app from three levels in.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (openChapter) setOpenChapter(null);
      else if (onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, openChapter]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    const out = [];
    for (const ch of chapters) {
      for (const e of ch.entries || []) {
        if (`${e.q} ${e.a}`.toLowerCase().includes(q)) out.push({ ...e, chapter: ch.title });
      }
    }
    return out;
  }, [q, chapters]);

  const openAssistant = () => {
    onClose && onClose();
    // Let the screen unmount before the chat opens, so the two overlays never
    // fight over the same space.
    setTimeout(() => window.dispatchEvent(new CustomEvent('tora:open-assistant')), 0);
  };

    const chapter = chapters.find((c) => c.id === openChapter);

  return createPortal(
    // Deliberately NOT `.screen`: that class sets `background: transparent`
    // and App.css loads after Tailwind, so it would beat the bg utility and
    // leave the app showing through. This is a portaled full-screen overlay —
    // it needs its own opaque ground, not the ambient one.
    <div
      className="guide-screen fixed inset-0 z-[10040] overflow-y-auto"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* The app's own sub-screen header (Settings, Achievements): sticky bar,
          circular back button, centred uppercase title. An invented class name
          was silently unstyled here, which left the title colliding with the
          back arrow. */}
      <div className="settings-header">
        <button
          type="button"
          className="back-button"
          onClick={() => (chapter ? setOpenChapter(null) : onClose && onClose())}
          aria-label={t('common.back')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>{chapter ? chapter.title : t('guide.title')}</h1>
        <div style={{ width: '24px' }} />
      </div>

      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-2">
        {!chapter && (
          <>
            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#0a0a0e] px-3.5 py-2.5">
              <span className="text-white/35"><SearchGlyph /></span>
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpenEntry(null); }}
                placeholder={t('guide.searchPlaceholder')}
                className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none border-0"
              />
            </label>

            {matches ? (
              <div className="mt-4 flex flex-col gap-2">
                {matches.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/40">{t('guide.noResults')}</p>
                ) : (
                  <>
                    <p className="m-0 mb-1 text-[10px] uppercase tracking-[0.2em] text-white/35 font-tech">
                      {t('guide.resultsFor', { n: matches.length })}
                    </p>
                    {matches.map((e, i) => (
                      <div key={`${e.q}-${i}`}>
                        <p className="m-0 mb-1 text-[10px] uppercase tracking-[0.15em] text-white/30 font-tech">
                          {e.chapter}
                        </p>
                        <Entry entry={e} open={openEntry === `search-${i}`} onToggle={() => setOpenEntry(openEntry === `search-${i}` ? null : `search-${i}`)} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              // Four groups, collapsed, so the whole index plus the Assistant
              // fits one screen. Tapping one opens it in place rather than
              // navigating — the point of the index is seeing the shape of the
              // thing without leaving it.
              <div className="mt-4 flex flex-col gap-2">
                {sections.map((s, i) => {
                  const open = openSection === s.id;
                  const inGroup = s.chapters
                    .map((id) => chapters.find((c) => c.id === id))
                    .filter(Boolean);
                  return (
                    <div key={s.id} className="rounded-xl border border-white/10 bg-[#0a0a0e] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenSection(open ? null : s.id)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left cursor-pointer
                                   transition-colors hover:bg-white/[0.03]"
                      >
                        <span className="w-6 shrink-0 text-[11px] font-tech text-infrared/70 tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-white">{s.title}</span>
                          <span className="block text-[10px] uppercase tracking-[0.15em] text-white/35 font-tech">
                            {t('guide.entryCount', {
                              n: inGroup.reduce((n, c) => n + (c.entries || []).length, 0),
                            })}
                          </span>
                        </span>
                        <ChevronDown open={open} />
                      </button>

                      {open && (
                        <div className="border-t border-white/10">
                          {inGroup.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setOpenChapter(c.id); setOpenEntry(null); }}
                              className="flex w-full items-center gap-3 px-4 py-3 pl-13 text-left cursor-pointer
                                         border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/[0.03]"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] text-white/85">{c.title}</span>
                                <span className="block text-[10px] uppercase tracking-[0.15em] text-white/30 font-tech">
                                  {t('guide.entryCount', { n: (c.entries || []).length })}
                                </span>
                              </span>
                              <span className="shrink-0 text-white/25" aria-hidden="true">›</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <AssistantBanner t={t} onAsk={openAssistant} />
            <SupportNote t={t} />
          </>
        )}

        {chapter && (
          <>
            <button
              type="button"
              onClick={() => setOpenChapter(null)}
              className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/40 font-tech
                         bg-transparent border-0 p-0 cursor-pointer hover:text-white/70"
            >
              ‹ {t('guide.backToIndex')}
            </button>
            <div className="flex flex-col gap-2">
              {(chapter.entries || []).map((e, i) => (
                <Entry
                  key={`${chapter.id}-${i}`}
                  entry={e}
                  open={openEntry === `${chapter.id}-${i}`}
                  onToggle={() => setOpenEntry(openEntry === `${chapter.id}-${i}` ? null : `${chapter.id}-${i}`)}
                />
              ))}
            </div>
            <AssistantBanner t={t} onAsk={openAssistant} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default GuideScreen;
