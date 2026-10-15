import React, { useEffect, useState } from 'react';

/* Desktop v3 Settings: a section index on the left, the way desktop settings
   pages are built. Reads the existing section headings from the DOM so the
   settings markup in App.js stays exactly as it is; clicking scrolls, and the
   section in view is highlighted. */

const SettingsNav = ({ root = '.settings-screen' }) => {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const screen = document.querySelector(root);
    if (!screen) return undefined;
    const sections = Array.from(screen.querySelectorAll('.settings-content > .settings-section'));
    const found = sections.map((el, i) => {
      if (!el.id) el.id = `settings-sec-${i}`;
      return { id: el.id, label: el.querySelector('h3')?.textContent?.trim() || '', el };
    }).filter((s) => s.label);
    setItems(found.map(({ id, label }) => ({ id, label })));
    setActive(found[0]?.id || null);

    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { root: screen, rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    found.forEach((s) => io.observe(s.el));
    return () => io.disconnect();
  }, [root]);

  if (items.length === 0) return null;

  return (
    <nav className="d3-settings-nav" aria-label="Sections">
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
