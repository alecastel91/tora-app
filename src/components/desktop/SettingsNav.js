import React, { useEffect, useState } from 'react';

/* Desktop v3: a section index beside long content, the way desktop settings
   and editor pages are built. Reads the existing section headings from the
   DOM so the screen's markup stays exactly as it is; clicking scrolls, and
   the section in view is highlighted.

   root      — the screen container (where the sections live)
   sections  — selector for the section blocks, relative to root
   observeIn — the element that scrolls (IntersectionObserver root); omit
               to measure against the viewport, which clips through nested
               scrollers correctly */

const SettingsNav = ({
  root = '.settings-screen',
  sections = '.settings-content .settings-section',
  observeIn = root,
  className = 'd3-settings-nav',
}) => {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const screen = document.querySelector(root);
    if (!screen) return undefined;
    let io;

    const scan = () => {
      const blocks = Array.from(screen.querySelectorAll(sections));
      const found = blocks.map((el, i) => {
        if (!el.id) el.id = `${className}-sec-${i}`;
        return { id: el.id, label: el.querySelector('h3')?.textContent?.trim() || '', el };
      }).filter((s) => s.label);
      setItems((prev) => {
        const next = found.map(({ id, label }) => ({ id, label }));
        const same = prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.label === next[i].label);
        return same ? prev : next;
      });
      setActive((prev) => prev || found[0]?.id || null);
      return found;
    };

    const observeAll = (found) => {
      io?.disconnect();
      io = makeObserver();
      found.forEach((s) => io.observe(s.el));
    };

    // Sections can arrive after this mounts — AgencySection fetches its state
    // first, so a one-shot scan missed it entirely. Re-scan when the subtree
    // changes (childList only: assigning ids below must not retrigger it).
    const mo = new MutationObserver(() => observeAll(scan()));
    mo.observe(screen, { childList: true, subtree: true });
    observeAll(scan());
    return () => { mo.disconnect(); io?.disconnect(); };

    function makeObserver() {
      return new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      // Sections can nest (Agency inside Agent plan). A container is in view
      // whenever its child is, so highlight the innermost one instead.
      const inner = visible.filter((e) => !visible.some((o) => o !== e && e.target.contains(o.target)));
      const pick = inner[0] || visible[0];
      if (pick) setActive(pick.target.id);
    }, { root: observeIn ? document.querySelector(observeIn) : null, rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    }
  }, [root, sections, observeIn, className]);

  if (items.length === 0) return null;

  return (
    <nav className={className} aria-label="Sections">
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[13px] transition-colors
                          ${active === s.id ? 'bg-white/[0.07] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'}`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SettingsNav;
