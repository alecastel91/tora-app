import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { roomGearByCategory, gearLine, roomsHaveContent } from '../../utils/venueRooms';

/** "Rooms and tech" — one block per room, gear grouped by category. Used on the own profile and the public one. */
const RoomsTechCard = ({ rooms }) => {
  const { t } = useLanguage();
  if (!roomsHaveContent(rooms)) return null;
  return (
    <div className="mb-5 rounded-2xl border border-white/10 bg-[#0a0a0e] p-4 text-left">
      <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/40 font-tech">{t('profile.techSpecs')}</div>
      {rooms.map((room, i) => (
        <div key={i} className={i ? 'mt-3 border-t border-white/10 pt-3' : ''}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-white">{room.name}</span>
            {room.capacity ? <span className="text-xs text-white/50">{Number(room.capacity).toLocaleString()} {t('profile.capacityShort')}</span> : null}
          </div>
          {roomGearByCategory(room).map((g) => (
            <div key={g.key} className="mt-1 text-sm text-white/70">
              <span className="text-white/40">{t(`gear.${g.key}`)}: </span>
              {g.items.map(gearLine).join(', ')}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default RoomsTechCard;
