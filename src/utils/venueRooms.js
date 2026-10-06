import catalog from '../data/gearCatalog.json';

// Mirror of tora-backend/src/config/gearCatalog.json — keep both in step.
export const GEAR_CATEGORIES = catalog.categories.map((c) => c.key);
export const GEAR_ITEMS = catalog.categories.flatMap((c) => c.items.map((i) => ({ ...i, category: c.key, label: [i.brand, i.model].filter(Boolean).join(' ') })));
export const gearItemsFor = (category) => GEAR_ITEMS.filter((i) => i.category === category);
export const gearLabel = (item) => (item.catalogId && GEAR_ITEMS.find((i) => i.id === item.catalogId)?.label) || item.label || '';

/** "4× Pioneer DJ CDJ-3000 · Pioneer DJ DJM-A9 · Funktion-One" — one line per room, category order preserved. */
export const roomGearLine = (room) => (room?.equipment || [])
  .map((e) => `${e.quantity > 1 ? `${e.quantity}× ` : ''}${gearLabel(e)}`)
  .join(' · ');

/** Equipment grouped by category, in catalog order, empty categories dropped. */
export const roomGearByCategory = (room) => GEAR_CATEGORIES
  .map((key) => ({ key, items: (room?.equipment || []).filter((e) => e.category === key) }))
  .filter((g) => g.items.length > 0);

export const roomsHaveGear = (rooms) => Array.isArray(rooms) && rooms.some((r) => (r.equipment || []).length > 0);

/** Seed N empty rooms from the legacy room count the first time a venue opens the editor. */
export const roomsFromCount = (count) => Array.from({ length: Math.min(12, Math.max(0, Number(count) || 0)) }, (_, i) => ({ name: `Room ${i + 1}`, capacity: null, equipment: [] }));
