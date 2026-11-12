import React from 'react';
import { getAvatarClass } from '../../utils/roles';

/* An artist's "Played at": round photos close together with the name
   underneath, one scrolling row. */
const BubbleStrip = ({ profiles, onOpenProfile }) => {
  const list = Array.isArray(profiles) ? profiles : [];
  if (!list.length) return null;
  return (
    <div className="bubble-strip">
      {list.map((p) => (
        <button key={p.id} type="button" className="bubble" onClick={() => onOpenProfile && onOpenProfile(p)}>
          <span className={`bubble-avatar ${p.avatar ? '' : getAvatarClass(p.role)}`}>
            {p.avatar ? <img src={p.avatar} alt="" loading="lazy" /> : (p.name || '?').charAt(0).toUpperCase()}
          </span>
          <span className="bubble-name">{p.name}</span>
        </button>
      ))}
    </div>
  );
};

export default BubbleStrip;
