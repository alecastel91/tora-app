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
  sections = '.settings-content > .settings-section',
  observeIn = root,
  className = 'd3-settings-nav',
}) => {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const screen = document.querySelector(root);
    if (!screen) return undefined;
    const blocks = Array.from(screen.querySelectorAll(sections));
    const found = blocks.map((el, i) => {
      if (!el.id) el.id = `${className}-sec-${i}`;
      return { id: el.id, label: el.querySelector('h3')?.textContent?.trim() || '', el };
    }).filter((s) => s.label);
    setItems(found.map(({ id, label }) => ({ id, label })));
    setActive(found[0]?.id || null);

    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { root: observeIn ? document.querySelector(observeIn) : null, rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    found.forEach((s) => io.observe(s.el));
    return () => io.disconnect();
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
