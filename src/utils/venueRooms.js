import catalog from '../data/gearCatalog.json';

// Mirror of tora-backend/src/config/gearCatalog.json — refresh with `npm run sync-gear-catalog`.
export const MAX_ROOMS = 12;
export const OTHER = '__other';
export const GEAR_CATEGORIES = catalog.categories.map((c) => c.key);
export const GEAR_ITEMS = catalog.categories.flatMap((c) => c.items.map((i) => ({ ...i, category: c.key })));

const inBrand = (item, brand) => !brand || brand === OTHER || item.brand === brand;
/** Brands listed for a category (lighting has none: it is typed, not branded). */
export const brandsFor = (category) => [...new Set(GEAR_ITEMS.filter((i) => i.category === category && i.brand).map((i) => i.brand))];
/** Models (or types) listed for a category, narrowed to a brand when one is chosen. */
export const modelsFor = (category, brand) => GEAR_ITEMS.filter((i) => i.category === category && i.model && inBrand(i, brand)).map((i) => i.model);
/** The catalog entry matching a brand + model pair, if any. */
export const catalogIdFor = (category, brand, model) => GEAR_ITEMS
  .find((i) => i.category === category && (i.brand || '') === (brand || '') && (i.model || '') === (model || ''))?.id || null;
/** Picking a model fills in its brand (the list is category-wide until a brand narrows it). */
export const brandForModel = (category, model, currentBrand) => {
  if (!model || model === OTHER) return {};
  const hit = GEAR_ITEMS.find((i) => i.category === category && i.model === model && inBrand(i, currentBrand));
  return hit?.brand && hit.brand !== currentBrand ? { brand: hit.brand, brandOther: '' } : {};
};

/** Sheet form state for a saved item: catalog values go in the selects, anything else in the free-text fields. */
export const sheetStateFromItem = (e) => {
  const brandListed = !!e.brand && brandsFor(e.category).includes(e.brand);
  const modelListed = !!e.model && modelsFor(e.category, brandListed ? e.brand : OTHER).includes(e.model);
  return {
    category: e.category,
    brand: brandListed ? e.brand : (e.brand ? OTHER : ''),
    brandOther: brandListed ? '' : (e.brand || ''),
    model: modelListed ? e.model : (e.model ? OTHER : ''),
    modelOther: modelListed ? '' : (e.model || ''),
    quantity: e.quantity || 1,
    note: e.note || '',
  };
};

export const gearLabel = (item) => [item.brand, item.model].filter(Boolean).join(' ') || item.label || '';
export const gearLine = (e) => `${e.quantity > 1 ? `${e.quantity}× ` : ''}${gearLabel(e)}`;

/** Equipment grouped by category, in catalog order, empty categories dropped. */
export const roomGearByCategory = (room) => GEAR_CATEGORIES
  .map((key) => ({ key, items: (room?.equipment || []).filter((e) => e.category === key) }))
  .filter((g) => g.items.length > 0);

export const roomsHaveGear = (rooms) => Array.isArray(rooms) && rooms.some((r) => (r.equipment || []).length > 0);
export const roomsHaveContent = (rooms) => Array.isArray(rooms) && rooms.some((r) => r.capacity || (r.equipment || []).length > 0);

/** Seed N empty rooms from the legacy room count the first time a venue opens the editor. */
export const roomsFromCount = (count, name) => Array.from(
  { length: Math.min(MAX_ROOMS, Math.max(0, Number(count) || 0)) },
  (_, i) => ({ name: `${name} ${i + 1}`, capacity: null, equipment: [] }),
);
