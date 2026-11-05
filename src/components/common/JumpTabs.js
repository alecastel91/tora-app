import React, { useEffect, useState } from 'react';

/* Jump links for a long profile page. It reads the section headings already on
   the page, so a section only appears here when that section is really shown
   for this role and viewer. One long scroll stays the real layout. */
const HEADINGS = '.poster-h2, .profile-embeds h4';

const JumpTabs = ({ scope }) => {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = scope?.current;
    if (!root) return undefined;
    const read = () => {
      const next = [...root.querySelectorAll(HEADINGS)].map((el) => el.textContent.trim()).filter(Boolean);
      setItems((prev) => (prev.join('|') === next.join('|') ? prev : next));
    };
    read();
    // Sections arrive after their fetches finish.
    const observer = new MutationObserver(read);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scope]);

  if (items.length < 2) return null;

  const go = (index) => {
    setActive(index);
    const el = scope.current?.querySelectorAll(HEADINGS)[index];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="jump-tabs">
      {items.map((label, i) => (
        <button key={`${label}-${i}`} type="button" className={`jump-tab ${i === active ? 'is-active' : ''}`} onClick={() => go(i)}>
          {label}
        </button>
      ))}
    </div>
  );
};

export default JumpTabs;
