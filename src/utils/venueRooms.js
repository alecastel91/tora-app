import catalog from '../data/gearCatalog.json';

// Mirror of tora-backend/src/config/gearCatalog.json — keep both in step.
export const GEAR_CATEGORIES = catalog.categories.map((c) => c.key);
export const GEAR_ITEMS = catalog.categories.flatMap((c) => c.items.map((i) => ({ ...i, category: c.key, label: [i.brand, i.model].filter(Boolean).join(' ') })));
export const OTHER = '__other';

/** Brands listed for a category (lighting has none: it is typed, not branded). */
export const brandsFor = (category) => [...new Set(GEAR_ITEMS.filter((i) => i.category === category && i.brand).map((i) => i.brand))];
/** Models (or types) listed for a category, narrowed to a brand when one is chosen. */
export const modelsFor = (category, brand) => GEAR_ITEMS
  .filter((i) => i.category === category && i.model && (!brand || brand === OTHER || i.brand === brand))
  .map((i) => i.model);
/** The catalog entry matching a brand + model pair, if any. */
export const catalogIdFor = (category, brand, model) => GEAR_ITEMS
  .find((i) => i.category === category && (i.brand || '') === (brand || '') && (i.model || '') === (model || ''))?.id || null;

export const gearLabel = (item) => [item.brand, item.model].filter(Boolean).join(' ') || item.label || '';
const qtyPrefix = (e) => (e.quantity > 1 ? `${e.quantity}× ` : '');
export const gearLine = (e) => `${qtyPrefix(e)}${gearLabel(e)}`;

/** Equipment grouped by category, in catalog order, empty categories dropped. */
export const roomGearByCategory = (room) => GEAR_CATEGORIES
  .map((key) => ({ key, items: (room?.equipment || []).filter((e) => e.category === key) }))
  .filter((g) => g.items.length > 0);

export const roomsHaveGear = (rooms) => Array.isArray(rooms) && rooms.some((r) => (r.equipment || []).length > 0);
export const roomsHaveContent = (rooms) => Array.isArray(rooms) && rooms.some((r) => r.capacity || (r.equipment || []).length > 0);

/** Seed N empty rooms from the legacy room count the first time a venue opens the editor. */
export const roomsFromCount = (count) => Array.from({ length: Math.min(12, Math.max(0, Number(count) || 0)) }, (_, i) => ({ name: `Room ${i + 1}`, capacity: null, equipment: [] }));
