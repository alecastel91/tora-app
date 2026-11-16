import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoOrthographic, geoPath, geoGraticule10, geoContains, geoCentroid, geoDistance } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import { coordsForCity, normalizeCity, atlasCountryName, FEATURED_HUBS, CITY_COORDS } from '../../data/cityCoords';
import { countriesByZone } from '../../data/profiles';
import { getAvatarClass, ROLE_COLOR } from '../../utils/roles';
import { useLanguage } from '../../contexts/LanguageContext';
import LoadingGlobe from './LoadingGlobe';
import PhotoCard from './PhotoCard';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { formatEventDate } from '../../utils/dates';

// Country geometry is decoded once at module load (shared across mounts).
const LAND = feature(worldData, worldData.objects.countries);
const BORDERS = mesh(worldData, worldData.objects.countries, (a, b) => a !== b);
const GRATICULE = geoGraticule10();
// Close in, coastlines and islands come from the 1:50m atlas, fetched the
// first time someone zooms past DETAIL_ZOOM (the 1:110m one stays for the
// whole-globe view, where the extra detail is invisible and costs frames).
const DETAIL_ZOOM = 2.2;
let DETAIL = null; // { land, borders } once loaded
let detailLoading = false;
const loadDetail = () => {
  if (DETAIL || detailLoading) return;
  detailLoading = true;
  import('world-atlas/countries-50m.json').then(({ default: w }) => {
    DETAIL = { land: feature(w, w.objects.countries), borders: mesh(w, w.objects.countries, (a, b) => a !== b) };
  }).catch(() => { detailLoading = false; });
};
const SPHERE = { type: 'Sphere' };

const ROLES = ['ARTIST', 'AGENT', 'PROMOTER', 'VENUE'];

// Zoom staging (level-of-detail): far away only the main cities show, easing
// in the secondary ones as you approach a country — otherwise labels overlap.
const MAX_ZOOM = 18;
const PANEL_W = 400; // desktop members panel width — single source for the aside, offsets and focusOn
const SECONDARY_PINS_ZOOM = 2.6; // below this, only major cities get pins
const LABEL_MAJOR_ZOOM = 1.5;    // majors get labels from here
const LABEL_ALL_ZOOM = 4.0;      // country-level: every visible pin is labelled
const MAJOR_KEYS = new Set(FEATURED_HUBS.map((n) => normalizeCity(n)));

const cityNameOf = (p) => p.city || (p.location || '').split(',')[0].trim();
const countryOf = (p) => p.country || (p.location || '').split(',').slice(1).join(',').trim();

// The centre of a country on the atlas, for trips and tours that name no city.
const countryCentroid = (country) => {
  const name = atlasCountryName(country);
  const f = name && LAND.features.find((c) => (c.properties?.name || '').toLowerCase() === name);
  return f ? geoCentroid(f) : null;
};

// Group the (already server-filtered) profiles by place. The server sends
// each row's real coordinates (any city a member can pick); the hub table is
// only the fallback for rows without them. Keyed by city AND country, so two
// cities sharing a name stay two pins.
function groupByCity(profiles) {
  const map = new Map();
  let unmapped = 0;
  for (const p of profiles || []) {
    const name = cityNameOf(p);
    const coord = p.coord || coordsForCity(name);
    if (!coord) { unmapped += 1; continue; }
    const country = countryOf(p);
    const cityKey = normalizeCity(name);
    const key = `${cityKey}|${country.toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, cityKey, name, country, coord, profiles: [] });
    map.get(key).profiles.push(p);
  }
  return { list: [...map.values()], unmapped };
}

// "Travelling" view: one entry per trip, placed at its destination, carrying
// the trip itself (dates, home city, tour or travel) for the panel rows.
// A trip that names only a zone has no place to pin: it carries `_zone`
// instead and is drawn as the zone's tint (zoneGroups).
const tripItems = (rows) => rows.map((r, i) => {
  const coord = r.destCountry ? (r.coord || countryCentroid(r.destCountry)) : null;
  return {
    ...r.profile,
    _profile: r.profile, // what opens: the member as they are, not the trip
    _key: `${r.profile.id}-${i}`,
    city: r.destCity || r.destCountry,
    country: r.destCountry,
    coord,
    _zone: r.destCountry ? null : r.zone,
    _trip: { kind: r.kind, from: r.startDate, to: r.endDate, home: r.profile.city, country: r.destCountry || r.zone },
  };
});

// Where a zone's label sits: its visual middle, not the geometric centroid
// (Europe's list includes all of Russia, the Americas span both continents).
const ZONE_ANCHORS = {
  Europe: [15, 50], Asia: [100, 32], 'Middle East': [45, 27], Africa: [20, 4], Americas: [-82, 12], Oceania: [140, -22],
};
// A zone's countries on a given atlas (the 1:50m one close in), built once each.
const zoneFeatureCache = new Map();
const zoneFeatures = (zone, land) => {
  const key = `${zone}|${land === LAND ? 110 : 50}`;
  if (!zoneFeatureCache.has(key)) {
    const names = new Set((countriesByZone[zone] || []).map((c) => atlasCountryName(c)));
    if (zone === 'Europe') names.delete('russia'); // the tint would cover Siberia and read as Asia
    zoneFeatureCache.set(key, { type: 'FeatureCollection', features: land.features.filter((f) => names.has((f.properties?.name || '').toLowerCase())) });
  }
  return zoneFeatureCache.get(key);
};

const isoDay = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const TRAVEL_RANGES = { today: 0, week: 6, month: 30 };

// Fills its positioned parent. The parent (SearchScreen) overlays the search
// bar on top and the List/Globe toggle at the bottom; topInset/bottomInset
// tell this component how much of its own chrome those overlays cover.
const SearchGlobe = ({ profiles, onSelectProfile, locked = false, userCity = '', userCountry = '', onLockedCity, onLockedTravel, controlsLeft = 12, loading = false, onSelectionChange, onRolesChange, topInset = 68, bottomInset = 52, listTakesOver = false }) => {
  const { t } = useLanguage();
  // Read by the draw loop, which outlives renders: a ref keeps the language current.
  const zoneCountText = useRef(null);
  zoneCountText.current = (n) => t('globe.zoneCount', { count: n });
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  // Based here (where members live) | Travelling (where they will be, from
  // the trips and tours they share on TORA — Premium, like the travel feed).
  const { user } = useAppContext();
  const [mode, setMode] = useState('based');
  const [range, setRange] = useState('today');
  const [trips, setTrips] = useState(null); // null = loading
  useEffect(() => {
    if (mode !== 'travel' || locked || !user?.id) return undefined;
    let cancelled = false;
    setTrips(null);
    apiService.getOnTheRoad(user.id, isoDay(0), isoDay(TRAVEL_RANGES[range]))
      .then((res) => { if (!cancelled) setTrips(tripItems(res.rows || [])); })
      .catch(() => { if (!cancelled) setTrips([]); });
    return () => { cancelled = true; };
  }, [mode, range, locked, user?.id]);
  const travelling = mode === 'travel' && !locked;

  const { list: cities, unmapped } = useMemo(
    () => groupByCity(travelling ? (trips || []).filter((p) => !p._zone) : profiles),
    [travelling, trips, profiles],
  );
  // Trips that name only a zone ("Asia, dates set, country not decided"):
  // one tinted region + label per zone, opening the same panel as a city.
  const zoneGroups = useMemo(() => {
    if (!travelling || !trips) return [];
    const map = new Map();
    for (const p of trips) {
      if (!p._zone || !ZONE_ANCHORS[p._zone]) continue;
      if (!map.has(p._zone)) map.set(p._zone, { key: `zone:${p._zone}`, zone: p._zone, name: p._zone, coord: ZONE_ANCHORS[p._zone], profiles: [] });
      map.get(p._zone).profiles.push(p);
    }
    return [...map.values()];
  }, [travelling, trips]);

  // The FREE member's own country feature — their whole discovery scope.
  const ownCountryFeature = useMemo(() => {
    if (!locked) return null;
    const own = coordsForCity(userCity);
    if (own) {
      const f = LAND.features.find((c) => geoContains(c, own));
      if (f) return f;
    }
    const cn = (userCountry || '').toLowerCase();
    return cn ? LAND.features.find((c) => (c.properties?.name || '').toLowerCase() === cn) || null : null;
  }, [locked, userCity, userCountry]);

  // For FREE members: dim "Premium" pins on the big hubs they can't open yet.
  // Hubs inside their own country are excluded — that's their discovery scope,
  // handled by real data pins and the country sheet.
  const lockedHubs = useMemo(() => {
    if (!locked) return [];
    const ownKey = normalizeCity(userCity);
    const dataKeys = new Set(cities.map((c) => c.cityKey));
    return FEATURED_HUBS
      .map((name) => ({ key: normalizeCity(name), name, coord: CITY_COORDS[normalizeCity(name)] }))
      .filter((h) => h.coord && h.key !== ownKey && !dataKeys.has(h.key)
        && !(ownCountryFeature && geoContains(ownCountryFeature, h.coord)));
  }, [locked, userCity, cities, ownCountryFeature]);

  const [roleOn, setRoleOn] = useState({ ARTIST: true, AGENT: true, PROMOTER: true, VENUE: true });
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null); // { name, feature, cities, profiles }
  const [tip, setTip] = useState(null); // { x, y, name, count, locked }
  const [dims, setDims] = useState({ w: 0, h: 0 });
  // Desktop docks the members panel on the right instead of the bottom sheet
  // 1024px matches responsive.css's desktop breakpoint / Tailwind lg
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsDesktop(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange); // Safari < 14
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // Mutable animation/interaction state kept in refs so the RAF loop never
  // triggers React re-renders.
  const rot = useRef([-13, -30, 0]);
  const zoomRef = useRef(1);
  const focusing = useRef(false);
  const targetRot = useRef(null);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(0);
  const lastRef = useRef({ x: 0, y: 0 });
  const ptrs = useRef(new Map());
  const pinchDist = useRef(0);
  const hoveredKey = useRef(null);
  const selectedKey = useRef(null);
  const selectedCityKey = useRef(null); // city selection only (pin highlight)
  const selectedCountryRef = useRef(null);
  const roleOnRef = useRef(roleOn);
  const citiesRef = useRef(cities);
  const zonesRef = useRef(zoneGroups);
  const lockedHubsRef = useRef(lockedHubs);
  const dimsRef = useRef({ w: 0, h: 0, dpr: 1 });
  const hiddenRef = useRef(false); // keep-mounted tab panel is display:none
  const viewRef = useRef({ cx: 0, cy: 0, r: 1 }); // current sphere placement (for hit-tests)
  const starsRef = useRef([]);

  useEffect(() => { roleOnRef.current = roleOn; }, [roleOn]);
  useEffect(() => { lockedHubsRef.current = lockedHubs; }, [lockedHubs]);
  // Visible-member counts change only when the data or the role toggles do —
  // precompute them here instead of reducing per pin per animation frame.
  // Cities are sorted by count so bigger cities win the label space, and
  // flagged major (hub or 3+ members) for the zoom staging.
  useEffect(() => {
    for (const c of cities) {
      c._cnt = c.profiles.reduce((n, p) => n + (roleOn[p.role] ? 1 : 0), 0);
      c._major = c._cnt >= 3 || MAJOR_KEYS.has(c.cityKey);
    }
    citiesRef.current = [...cities].sort((a, b) => (b._cnt || 0) - (a._cnt || 0));
    for (const z of zoneGroups) z._cnt = z.profiles.reduce((n, p) => n + (roleOn[p.role] ? 1 : 0), 0);
    zonesRef.current = zoneGroups;
  }, [cities, zoneGroups, roleOn]);
  useEffect(() => {
    selectedKey.current = selectedCity?.key || selectedCountry?.key || selectedCountry?.name || null;
    selectedCityKey.current = selectedCity?.key || null;
    selectedCountryRef.current = selectedCountry;
  }, [selectedCity, selectedCountry]);

  const projection = useRef(geoOrthographic().clipAngle(90).precision(0.5)).current;

  // Start the map zoomed in on the member's own city (map-app feel). Starts
  // paused — auto-rotation at this zoom would sweep the view away instantly;
  // zooming out and tapping empty space resumes the ambient spin.
  // Keyed on the city value so switching to another own profile (different
  // city) re-centers instead of staying parked on the previous one.
  const initCityRef = useRef(null);
  useEffect(() => {
    if (!userCity || initCityRef.current === userCity) return;
    initCityRef.current = userCity;
    const own = coordsForCity(userCity);
    if (own) {
      rot.current = [-own[0], -own[1], 0];
      zoomRef.current = 4.2;
      pausedRef.current = true;
      focusing.current = false;
    }
  }, [userCity]);

  // Track the rendered size for the canvas backing store (also fires when the
  // keep-mounted tab flips from display:none to visible).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) { hiddenRef.current = true; return; } // hidden tab panel
      hiddenRef.current = false;
      setDims({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // The draw loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dims.w || !dims.h) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dimsRef.current = { w: dims.w, h: dims.h, dpr };

    // Starfield: regenerated per canvas size, drifts gently via per-star twinkle.
    const starCount = Math.round((dims.w * dims.h) / 8500);
    starsRef.current = Array.from({ length: starCount }, () => ({
      x: Math.random() * dims.w,
      y: Math.random() * dims.h,
      r: 0.4 + Math.random() * 0.8,
      a: 0.10 + Math.random() * 0.35,
      tw: 0.0008 + Math.random() * 0.0022,
      ph: Math.random() * Math.PI * 2,
      crimson: Math.random() < 0.12,
    }));

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const path = geoPath(projection, ctx);
    // JS % is negative for negative operands — double-mod keeps the delta in
    // [-180, 180) even after the ambient spin has drifted many revolutions.
    const shortArc = (d) => ((d % 360) + 540) % 360 - 180;
    const font = getComputedStyle(document.body).fontFamily; // stable — don't re-read per frame
    let raf = 0;

    const cx = dims.w / 2;
    const cy = dims.h * 0.46; // slightly above center — bottom chrome overlays the lower band
    const baseR = Math.min(dims.w, dims.h) * 0.44;

    function frame() {
      // Keep-mounted tab hidden (display:none): skip all drawing — rAF is
      // document-scoped and would otherwise redraw an invisible canvas at
      // 60fps for the whole session.
      if (hiddenRef.current) { raf = requestAnimationFrame(frame); return; }
      const W = dims.w, H = dims.h;
      const r = baseR * zoomRef.current;
      viewRef.current = { cx, cy, r };

      if (focusing.current && targetRot.current) {
        for (let i = 0; i < 2; i++) {
          let d = targetRot.current[i] - rot.current[i];
          if (i === 0) d = shortArc(d);
          rot.current[i] += d * 0.12;
        }
        if (Math.abs(shortArc(targetRot.current[0] - rot.current[0])) < 0.2 &&
            Math.abs(targetRot.current[1] - rot.current[1]) < 0.2) {
          rot.current[0] = targetRot.current[0];
          rot.current[1] = targetRot.current[1];
          focusing.current = false;
        }
      } else if (!draggingRef.current && !selectedKey.current && !reduce && !pausedRef.current) {
        rot.current[0] += 0.12;
      }
      projection.rotate(rot.current).scale(r).translate([cx, cy]);
      ctx.clearRect(0, 0, W, H);

      const now = performance.now();

      // starfield behind the sphere
      for (const s of starsRef.current) {
        const a = s.a * (0.7 + 0.3 * Math.sin(now * s.tw + s.ph));
        ctx.fillStyle = s.crimson ? `rgba(255,80,120,${a})` : `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      }

      // atmosphere: one soft crimson wash (kept gentle on purpose)
      const halo = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.16);
      halo.addColorStop(0, 'rgba(255,51,102,0.20)');
      halo.addColorStop(1, 'rgba(255,51,102,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.16, 0, 7); ctx.fill();

      // ocean sphere — deep, lit from the upper left
      ctx.beginPath(); path(SPHERE);
      const oc = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.08, cx, cy, r * 1.05);
      oc.addColorStop(0, '#151523');
      oc.addColorStop(0.55, '#0b0b14');
      oc.addColorStop(1, '#040409');
      ctx.fillStyle = oc; ctx.fill();

      // graticule — barely-there technical texture
      ctx.beginPath(); path(GRATICULE);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.6; ctx.stroke();

      // land — soft top-left light, luminous coastlines (1:50m when close)
      const close = zoomRef.current >= DETAIL_ZOOM;
      if (close) loadDetail();
      const land = close && DETAIL ? DETAIL.land : LAND;
      ctx.beginPath(); path(land);
      const lg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      lg.addColorStop(0, '#262633');
      lg.addColorStop(0.5, '#1d1d29');
      lg.addColorStop(1, '#15151f');
      ctx.fillStyle = lg; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 0.6; ctx.stroke();

      // country borders
      ctx.beginPath(); path(close && DETAIL ? DETAIL.borders : BORDERS);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.5; ctx.stroke();

      // zones with trips that name no country — a soft tint over their countries
      for (const z of zonesRef.current) {
        if (!z._cnt) continue;
        ctx.beginPath(); path(zoneFeatures(z.zone, land));
        ctx.fillStyle = 'rgba(255,51,102,0.09)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,51,102,0.28)'; ctx.lineWidth = 0.6; ctx.stroke();
      }

      // selected country — crimson tint + glowing outline
      if (selectedCountryRef.current) {
        ctx.beginPath(); path(selectedCountryRef.current.feature);
        ctx.fillStyle = 'rgba(255,51,102,0.16)'; ctx.fill();
        ctx.save();
        ctx.shadowColor = 'rgba(255,51,102,0.8)'; ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(255,51,102,0.75)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
      }

      // spherical shading
      ctx.save(); ctx.beginPath(); path(SPHERE); ctx.clip();
      const sh = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.46, r * 0.1, cx, cy, r * 1.18);
      sh.addColorStop(0, 'rgba(255,255,255,0.07)');
      sh.addColorStop(0.45, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H); ctx.restore();

      // rim
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
      ctx.strokeStyle = 'rgba(255,51,102,0.35)'; ctx.lineWidth = 1; ctx.stroke();

      const zoom = zoomRef.current;
      const showSecondary = zoom >= SECONDARY_PINS_ZOOM;
      const labelMajors = zoom > LABEL_MAJOR_ZOOM;
      const labelAll = zoom >= LABEL_ALL_ZOOM;
      // d3's forward projection never culls the far hemisphere (clipAngle
      // only clips streams) — without this check, far-side pins render as
      // tappable ghosts inside the visible disc.
      const viewCenter = [-rot.current[0], -rot.current[1]];
      const onFront = (coord) => geoDistance(coord, viewCenter) <= Math.PI / 2;

      // Label decluttering: labels claim rectangles in priority order
      // (selection > hover > bigger cities > hubs); overlapping ones are
      // skipped instead of stacking on top of each other.
      const labelBoxes = [];
      const claimLabel = (x, y, text, force = false) => {
        const w = ctx.measureText(text).width;
        const box = { x: x - 2, y: y - 12, w: w + 6, h: 16 };
        if (!force) {
          for (const b of labelBoxes) {
            if (box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) return false;
          }
        }
        labelBoxes.push(box);
        return true;
      };

      // locked hub pins (FREE tier) — dim, tappable, upsell on tap
      for (const hub of lockedHubsRef.current) {
        const xy = onFront(hub.coord) ? projection(hub.coord) : null;
        hub._xy = xy;
        if (!xy) continue;
        const isHov = hoveredKey.current === hub.key;
        ctx.fillStyle = isHov ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.26)';
        ctx.beginPath(); ctx.arc(xy[0], xy[1], 2.8, 0, 7); ctx.fill();
      }

      // member pins — glowing crimson with a hot white core. Far away only
      // the majors (hubs / 3+ members) show; secondary cities ease in as the
      // view closes on their country.
      for (const c of citiesRef.current) {
        const count = c._cnt || 0; // precomputed on data/role-toggle changes
        const isSel = selectedCityKey.current === c.key;
        const visible = count > 0 && (c._major || showSecondary || isSel);
        const xy = visible && onFront(c.coord) ? projection(c.coord) : null;
        c._xy = xy; c._count = count;
        if (!xy) continue;
        const isHov = hoveredKey.current === c.key;
        const rad = 3 + Math.min(count, 8) * 0.7;
        ctx.save();
        ctx.shadowColor = 'rgba(255,51,102,0.95)';
        ctx.shadowBlur = isSel ? 20 : (isHov ? 16 : 10);
        ctx.fillStyle = '#ff3366';
        ctx.beginPath(); ctx.arc(xy[0], xy[1], rad, 0, 7); ctx.fill();
        ctx.restore();
        ctx.fillStyle = isSel ? '#fff' : 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(xy[0], xy[1], Math.max(1, rad * 0.36), 0, 7); ctx.fill();
        if (isSel) {
          const pr = rad + 6 + Math.sin(now * 0.005) * 3;
          ctx.strokeStyle = 'rgba(255,51,102,0.85)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(xy[0], xy[1], pr, 0, 7); ctx.stroke();
        }
      }

      // label pass — member cities first (sorted by count, so the big ones
      // win the space), hubs last; selection/hover always label.
      ctx.font = `600 12px ${font}`; ctx.textAlign = 'left';
      for (const c of citiesRef.current) {
        if (!c._xy) continue;
        const isSel = selectedCityKey.current === c.key;
        const isHov = hoveredKey.current === c.key;
        const wanted = isSel || isHov || labelAll || (c._major && labelMajors);
        if (!wanted) continue;
        const lx = c._xy[0] + (3 + Math.min(c._count, 8) * 0.7) + 6, ly = c._xy[1] + 4;
        if (!claimLabel(lx, ly, c.name, isSel || isHov)) continue;
        ctx.fillStyle = isSel ? '#fff' : 'rgba(255,255,255,0.82)';
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
        ctx.fillText(c.name, lx, ly); ctx.shadowBlur = 0;
      }
      // zone labels — a pill at the zone's middle: "Asia · 3 travelling"
      for (const z of zonesRef.current) {
        z._box = null;
        if (!z._cnt || !onFront(z.coord)) continue;
        const [zx, zy] = projection(z.coord);
        const isSel = selectedKey.current === z.key;
        const text = `${z.name} · ${zoneCountText.current(z._cnt)}`;
        ctx.font = `700 11px ${font}`;
        const tw = ctx.measureText(text).width, pw = tw + 22, ph = 24;
        const box = { x: zx - pw / 2, y: zy - ph / 2, w: pw, h: ph };
        labelBoxes.push(box);
        z._box = box;
        ctx.beginPath(); ctx.roundRect(box.x, box.y, pw, ph, 12);
        ctx.fillStyle = isSel ? 'rgba(255,51,102,0.9)' : 'rgba(7,7,9,0.88)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,51,102,0.85)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(text, zx - tw / 2, zy + 4);
      }
      ctx.font = `500 11px ${font}`;
      for (const hub of lockedHubsRef.current) {
        if (!hub._xy) continue;
        const isHov = hoveredKey.current === hub.key;
        if (!(labelMajors || isHov)) continue;
        const lx = hub._xy[0] + 8, ly = hub._xy[1] + 4;
        if (!claimLabel(lx, ly, hub.name, isHov)) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
        ctx.fillText(hub.name, lx, ly); ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // selection is read via refs — keeping it out of the deps avoids tearing
    // down the loop (and regenerating the starfield) on every sheet open/close
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, projection]);

  // hit-test: member pins first, then locked hubs (uses _xy from the last
  // frame). NEAREST pin wins; the member count only breaks near-ties (two
  // pins within ~6px of the same distance — i.e. genuinely overlapping), so
  // a hub can't be shadowed by a 1-member neighbor drawn on top of it while
  // a lone small city elsewhere stays tappable.
  const hit = (mx, my) => {
    const candidates = [];
    for (const c of citiesRef.current) {
      if (!c._xy) continue;
      const d = Math.hypot(mx - c._xy[0], my - c._xy[1]);
      if (d < 16) candidates.push({ c, d });
    }
    let best = null;
    if (candidates.length) {
      candidates.sort((a, b) => a.d - b.d);
      let pick = candidates[0];
      for (let i = 1; i < candidates.length; i++) {
        const cand = candidates[i];
        if (cand.d - pick.d <= 6 && (cand.c._count || 0) > (pick.c._count || 0)) pick = cand;
      }
      best = { kind: 'city', ref: pick.c };
    }
    if (!best) {
      for (const z of zonesRef.current) {
        const b = z._box;
        if (b && mx >= b.x - 4 && mx <= b.x + b.w + 4 && my >= b.y - 4 && my <= b.y + b.h + 4) return { kind: 'zone', ref: z };
      }
    }
    if (!best) {
      let bd = 1e9;
      for (const hub of lockedHubsRef.current) {
        if (!hub._xy) continue;
        const d = Math.hypot(mx - hub._xy[0], my - hub._xy[1]);
        if (d < 14 && d < bd) { bd = d; best = { kind: 'locked', ref: hub }; }
      }
    }
    return best;
  };

  // country under a canvas point (null when the tap is off the sphere)
  const countryAt = (mx, my) => {
    const { cx, cy, r } = viewRef.current;
    if (Math.hypot(mx - cx, my - cy) > r) return null;
    const geo = projection.invert([mx, my]);
    if (!geo || !isFinite(geo[0]) || !isFinite(geo[1])) return null;
    return LAND.features.find((f) => geoContains(f, geo)) || null;
  };

  // ---- city sheet state ----
  const [sheetPx, setSheetPx] = useState(0);
  const sheetPxRef = useRef(0);
  const sheetAnimating = useRef(false); // false during drags → no height transition
  const listRef = useRef(null);
  useEffect(() => { sheetPxRef.current = sheetPx; }, [sheetPx]);

  const snapSheet = (px) => {
    sheetAnimating.current = true;
    const H = dimsRef.current.h;
    if (px < H * 0.25) { setSelectedCity(null); setSelectedCountry(null); setSheetPx(0); onSelectionChange?.(null); }
    else if (px < H * 0.8) setSheetPx(Math.round(H * 0.62));
    else setSheetPx(H);
  };

  // Rotate a place to the front. On desktop the stage itself shrinks beside
  // the docked panel (flex sibling), so the canvas center is already the
  // visible center; on mobile, offset north of the 62% bottom sheet.
  const focusOn = (lon, lat) => {
    const r = Math.max(viewRef.current.r, 1);
    if (isDesktop) {
      focusing.current = true;
      targetRot.current = [-lon, -lat];
      return;
    }
    const offsetPx = dimsRef.current.h * 0.27; // canvas center → visible-strip center
    const delta = Math.min(35, (Math.asin(Math.min(0.95, offsetPx / r)) * 180) / Math.PI);
    focusing.current = true;
    targetRot.current = [-lon, Math.max(-90, Math.min(90, -lat + delta))];
  };

  // Crossing desktop -> mobile with a place selected: the sheet height was
  // never meaningful on desktop, so re-snap it for the current stage.
  useEffect(() => {
    if (!isDesktop && (selectedCity || selectedCountry)) {
      sheetAnimating.current = true;
      setSheetPx(Math.round(dimsRef.current.h * 0.62));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  const openCity = (c) => {
    setSelectedCity(c);
    setSelectedCountry(null);
    // the list can take over this selection — not a trip: the list knows where people live
    if (!travelling) onSelectionChange?.({ city: c.name });
    focusOn(c.coord[0], c.coord[1]);
    setTip(null);
    sheetAnimating.current = true;
    setSheetPx(Math.round(dimsRef.current.h * 0.62));
    // Beta T11: opened a city on the globe and saw who is there.
    if (import.meta.env.VITE_TORA_ENV === 'beta') {
      window.dispatchEvent(new CustomEvent('tora:beta-task', { detail: { code: 'T11' } }));
    }
  };
  const openCountry = (f) => {
    const name = f.properties?.name || '';
    // geoContains + name fallback: small islands (e.g. Ibiza) are missing from
    // the 110m geometry, but those profiles still carry country = "Spain".
    const fname = name.toLowerCase();
    const inCountry = citiesRef.current.filter(
      (c) => geoContains(f, c.coord) || (c.country && atlasCountryName(c.country) === fname)
    );
    if (locked) {
      // FREE members may open their own country (their whole discovery
      // scope). Data pins inside prove ownership; own-city coords and the
      // profile's country name cover empty/unmapped cases.
      const own = coordsForCity(userCity);
      const allowed = inCountry.length > 0
        || (own && geoContains(f, own))
        || (userCountry && fname === atlasCountryName(userCountry));
      if (!allowed) { onLockedCity?.(name); return; }
    }
    setSelectedCountry({
      name,
      feature: f,
      cities: inCountry,
      profiles: inCountry.flatMap((c) => c.profiles),
    });
    setSelectedCity(null);
    // The app's country name comes from a member in it; an atlas-only name
    // ("Czechia") would not match the filters, so an empty country carries nothing.
    // A country with nobody in it still IS a selection — reported separately so
    // callers that turn the selection into a server query keep ignoring it.
    if (!travelling) onSelectionChange?.(inCountry[0]?.country ? { country: inCountry[0].country } : null, { country: name, empty: !inCountry.length });
    const center = geoCentroid(f);
    focusOn(center[0], center[1]);
    setTip(null);
    sheetAnimating.current = true;
    setSheetPx(Math.round(dimsRef.current.h * 0.62));
  };
  const openZone = (z) => {
    setSelectedCountry({ key: z.key, name: z.name, zone: z.zone, feature: zoneFeatures(z.zone, LAND), cities: [], profiles: z.profiles });
    setSelectedCity(null);
    focusOn(z.coord[0], z.coord[1]);
    setTip(null);
    sheetAnimating.current = true;
    setSheetPx(Math.round(dimsRef.current.h * 0.62));
  };
  const closeCity = () => { setSelectedCity(null); setSelectedCountry(null); setSheetPx(0); focusing.current = false; onSelectionChange?.(null); };

  // ---- pointer interaction on the canvas ----
  const onPointerDown = (e) => {
    const canvas = canvasRef.current;
    ptrs.current.set(e.pointerId, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, cx: e.clientX, cy: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (ptrs.current.size === 1) {
      draggingRef.current = true; movedRef.current = 0;
      lastRef.current = { x: e.clientX, y: e.clientY };
      focusing.current = false;
    } else if (ptrs.current.size === 2) {
      draggingRef.current = false;
      const p = [...ptrs.current.values()];
      pinchDist.current = Math.hypot(p[0].cx - p[1].cx, p[0].cy - p[1].cy);
    }
  };
  const onPointerMove = (e) => {
    if (ptrs.current.has(e.pointerId)) {
      ptrs.current.set(e.pointerId, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, cx: e.clientX, cy: e.clientY });
    }
    if (ptrs.current.size >= 2) {
      const p = [...ptrs.current.values()];
      const d = Math.hypot(p[0].cx - p[1].cx, p[0].cy - p[1].cy);
      if (pinchDist.current > 0) {
        zoomRef.current = Math.max(1, Math.min(MAX_ZOOM, zoomRef.current * (d / pinchDist.current)));
      }
      pinchDist.current = d; pausedRef.current = true;
      return;
    }
    if (draggingRef.current) {
      if (!dimsRef.current.w) return; // before first layout — avoid Infinity/NaN poisoning rot
      const dx = e.clientX - lastRef.current.x, dy = e.clientY - lastRef.current.y;
      lastRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current += Math.abs(dx) + Math.abs(dy);
      const k = 75 / (Math.min(dimsRef.current.w, dimsRef.current.h) * 0.44 * zoomRef.current);
      rot.current[0] += dx * k;
      rot.current[1] = Math.max(-90, Math.min(90, rot.current[1] - dy * k));
    } else {
      const h = hit(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      const key = h?.ref.key || null;
      if (key === hoveredKey.current) return; // same target — skip the re-render
      hoveredKey.current = key;
      if (h && h.ref._xy) {
        setTip({
          x: h.ref._xy[0], y: h.ref._xy[1], name: h.ref.name,
          count: h.kind === 'city' ? h.ref._count : null,
          locked: h.kind === 'locked',
        });
      } else setTip(null);
    }
  };
  // The tap's pointerup may open the sheet; the browser then fires one
  // synthetic click at the same coordinates, which would land on whichever
  // sheet row renders under the finger. Swallow exactly that click with a
  // one-shot capture-phase listener (self-removing; timeout covers taps
  // that produce no click at all).
  const swallowNextClick = () => {
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400);
  };

  const endTap = (e) => {
    if (movedRef.current >= 6) { pausedRef.current = true; return; }
    swallowNextClick();
    const mx = e.nativeEvent.offsetX, my = e.nativeEvent.offsetY;
    const h = hit(mx, my);
    if (h?.kind === 'city') { openCity(h.ref); return; }
    if (h?.kind === 'zone') { openZone(h.ref); return; }
    if (h?.kind === 'locked') { onLockedCity?.(h.ref.name); return; }
    const country = countryAt(mx, my);
    if (country) { openCountry(country); return; }
    if (selectedKey.current) closeCity();
    else pausedRef.current = !pausedRef.current;
  };
  const onPointerUp = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const wasTwo = ptrs.current.size >= 2;
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size === 1) {
      const p = [...ptrs.current.values()][0];
      lastRef.current = { x: p.cx, y: p.cy }; movedRef.current = 999;
      draggingRef.current = true; pinchDist.current = 0;
    } else if (ptrs.current.size === 0) {
      draggingRef.current = false;
      if (!wasTwo) endTap(e);
    }
  };
  // A browser-cancelled gesture (palm rejection, notification swipe) is NOT a
  // tap — clean up the pointer state without running endTap.
  const onPointerCancelH = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.delete(e.pointerId);
    pinchDist.current = 0;
    if (ptrs.current.size === 1) {
      const p = [...ptrs.current.values()][0];
      lastRef.current = { x: p.cx, y: p.cy }; movedRef.current = 999;
      draggingRef.current = true;
    } else if (ptrs.current.size === 0) {
      draggingRef.current = false;
    }
  };
  const onWheel = (e) => {
    zoomRef.current = Math.max(1, Math.min(MAX_ZOOM, zoomRef.current * (1 - e.deltaY * 0.0012)));
  };

  // ---- grabber drag (pointer, works on desktop too) ----
  const grabDrag = useRef(null);
  const onGrabDown = (e) => {
    grabDrag.current = { y: e.clientY, h: sheetPxRef.current };
    sheetAnimating.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGrabMove = (e) => {
    if (!grabDrag.current) return;
    const h = grabDrag.current.h - (e.clientY - grabDrag.current.y);
    setSheetPx(Math.max(0, Math.min(dimsRef.current.h, h)));
  };
  const onGrabUp = () => {
    if (!grabDrag.current) return;
    grabDrag.current = null;
    snapSheet(sheetPxRef.current);
  };

  // ---- coordinated list scroll (touch): swipe up → expand to full page;
  //      pull down at the top → collapse toward the globe / close.
  //      Native listeners because React touch events are passive at the root.
  // listTakesOver: the host's own list shows the selection (desktop workspace), so no panel here
  // …except in Travelling: the trips live only here, so the globe keeps its panel.
  const sheetOpen = !!(selectedCity || selectedCountry) && !(isDesktop && listTakesOver && !travelling);
  useEffect(() => {
    const el = listRef.current;
    if (!el || !sheetOpen || isDesktop) return undefined; // desktop panel is fixed, no sheet gestures
    let ls = null;
    const onStart = (e) => { ls = { y: e.touches[0].clientY, h: sheetPxRef.current }; };
    const onMove = (e) => {
      if (!ls) return;
      const dy = e.touches[0].clientY - ls.y;
      const H = dimsRef.current.h;
      const down = dy > 0;
      if (sheetPxRef.current < H - 2 && !down) {
        e.preventDefault();
        sheetAnimating.current = false;
        setSheetPx(Math.min(H, ls.h - dy));
      } else if (el.scrollTop <= 0 && down) {
        e.preventDefault();
        sheetAnimating.current = false;
        setSheetPx(Math.max(0, ls.h - dy));
      }
    };
    const onEnd = () => {
      if (!ls) return;
      ls = null;
      if (!sheetAnimating.current) snapSheet(sheetPxRef.current);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, isDesktop]);

  // A new view or window is a new map: whatever was open belongs to the old one.
  useEffect(() => { closeCity(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode, range]);

  const place = selectedCountry || selectedCity;
  const panelProfiles = place ? place.profiles.filter((p) => roleOn[p.role]) : [];
  const locale = t('dateFormat.locale');
  const tripDates = (trip) => {
    const a = formatEventDate(trip.from, locale, { year: undefined });
    const b = formatEventDate(trip.to, locale, { year: undefined });
    return a === b ? a : `${a} – ${b}`;
  };
  // The line under a name: on a trip, when and from where (or the tour);
  // otherwise the city (country panel) or the sound (city panel).
  const rowDetail = (p) => {
    if (p._trip) {
      return `${tripDates(p._trip)} · ${p._trip.kind === 'tour'
        ? t('globe.touring', { country: p._trip.country })
        : (p._trip.home ? t('globe.fromCity', { city: p._trip.home }) : '')}`.replace(/ · $/, '');
    }
    if (selectedCountry) return cityNameOf(p);
    return p.genres?.length ? p.genres.slice(0, 2).join(', ') : '';
  };
  const pickMode = (next) => {
    if (next === 'travel' && locked) { (onLockedTravel || (() => onLockedCity?.(t('globe.travelling'))))(); return; }
    setMode(next);
  };

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-[#040407]">
      {/* Stage — wrapRef's ResizeObserver resizes the canvas when the panel
          opens/closes, so the globe shrinks instead of being covered. */}
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden">
      {loading && (!profiles || profiles.length === 0) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#040407]/70">
          <LoadingGlobe label={t('search.loadingProfiles')} />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancelH}
        onWheel={onWheel}
      />

      {/* Un-mapped count — sits below the parent's search-bar overlay */}
      {unmapped > 0 && (
        <div className="absolute rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-tech uppercase tracking-[0.12em] text-white/40 backdrop-blur-sm"
             style={{ top: topInset + 8, right: 12 }}>
          {t('search.globeUnmapped', { count: unmapped })}
        </div>
      )}

      {/* Based here | Travelling, and the window for Travelling. A stage
          squeezed beside the open panel has no room for them; closing the
          panel brings them back. */}
      {!(sheetOpen && isDesktop && dims.w < 380) && (
      <div className="absolute z-20 flex flex-col items-start gap-1.5" style={{ top: topInset + 8, left: controlsLeft }}>
        <div className="flex rounded-full border border-white/10 bg-black/55 p-0.5 backdrop-blur-md" role="tablist">
          {[['based', 'globe.basedHere'], ['travel', 'globe.travelling']].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => pickMode(key)}
              className={`cursor-pointer whitespace-nowrap rounded-full border-0 px-3 py-1 text-[10px] font-tech uppercase tracking-[0.12em] transition ${mode === key ? 'bg-white/90 text-black' : 'bg-transparent text-white/60'}`}>
              {t(label)}{key === 'travel' && locked ? ' · Premium' : ''}
            </button>
          ))}
        </div>
        {travelling && (
          <div className="flex gap-1">
            {Object.keys(TRAVEL_RANGES).map((key) => (
              <button key={key} type="button" onClick={() => setRange(key)}
                className={`cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] backdrop-blur-md ${range === key ? 'border-infrared bg-infrared/20 text-white' : 'border-white/10 bg-black/45 text-white/55'}`}>
                {t(`globe.${key}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {travelling && trips === null && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <LoadingGlobe label={t('common.loading')} />
        </div>
      )}

      {/* Zoom controls — right edge, above the bottom chrome (shift left of the desktop panel) */}
      <div className="absolute flex flex-col gap-1.5" style={{ bottom: bottomInset + 64, right: 12 }}>
        {['+', '−'].map((sym, i) => (
          <button
            key={sym}
            aria-label={i === 0 ? 'Zoom in' : 'Zoom out'}
            onClick={() => { zoomRef.current = i === 0 ? Math.min(MAX_ZOOM, zoomRef.current * 1.3) : Math.max(1, zoomRef.current / 1.3); }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-lg text-white/70 backdrop-blur-md active:scale-95"
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Hover tooltip */}
      {tip && !sheetOpen && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-[11px] text-white/90 backdrop-blur-sm"
          style={{ left: tip.x, top: tip.y }}
        >
          <b>{tip.name}</b>{' '}
          <span className="text-white/50">· {tip.locked ? 'Premium' : tip.count}</span>
        </div>
      )}

      {/* Role legend — bottom chrome, above the parent's view toggle */}
      <div className="pointer-events-none absolute left-0 z-20 flex flex-col items-center gap-2"
           style={{ bottom: bottomInset + 8, right: 0 }}>
        {!sheetOpen && cities.length > 0 && (
          <div className="text-center text-[10px] font-tech uppercase tracking-[0.15em] text-white/25">
            {t('search.globeHint')}
          </div>
        )}
        <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5 px-4">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => {
                // The host's list follows the role legend too (desktop workspace).
                const next = { ...roleOn, [r]: !roleOn[r] };
                setRoleOn(next);
                onRolesChange?.(next);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-tech uppercase tracking-[0.12em] backdrop-blur-md transition
                ${roleOn[r] ? 'border-white/15 bg-black/45 text-white/80' : 'border-white/5 bg-black/30 text-white/30'}`}
            >
              <i className="h-1.5 w-1.5 rounded-full" style={{ background: roleOn[r] ? ROLE_COLOR[r] : 'rgba(255,255,255,0.2)' }} />
              {t(`editProfile.${r.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state (premium only — FREE members always see the locked hubs) */}
      {cities.length === 0 && zoneGroups.length === 0 && !locked && !(travelling && trips === null) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-sm text-white/50">{t(travelling ? 'globe.travelEmpty' : 'search.globeNoCities')}</p>
        </div>
      )}

      </div>

      {/* Members panel — bottom sheet on mobile (expands to cover the page),
          right-docked flex sibling on desktop (the stage shrinks beside it) */}
      {sheetOpen && (
        <>
          {!isDesktop && <div className="absolute inset-0 z-30 bg-black/40" onClick={closeCity} />}
          <aside
            className={isDesktop
              ? 'relative z-40 flex shrink-0 flex-col rounded-tl-2xl border-l border-t border-white/10 bg-[#070709]'
              : 'absolute inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl border-t border-white/10 bg-[#070709]'}
            style={isDesktop
              ? { width: PANEL_W, marginTop: topInset } /* below the floating search chrome, which stays clickable */
              : { height: sheetPx, transition: sheetAnimating.current ? 'height 0.22s ease' : 'none' }}
          >
            {!isDesktop && (
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1"
              onPointerDown={onGrabDown}
              onPointerMove={onGrabMove}
              onPointerUp={onGrabUp}
              onPointerCancel={onGrabUp}
            >
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            )}
            {isDesktop && <div className="pt-4" />}
            <div className="flex shrink-0 items-start justify-between px-5 pb-3">
              <div>
                <div className="text-[10px] font-tech uppercase tracking-[0.2em] text-infrared">{t(travelling ? 'globe.travellingHere' : 'search.globeOnNetwork')}</div>
                <h2 className="mt-0.5 text-xl font-semibold text-white">{place.name}</h2>
                <div className="mt-0.5 text-xs text-white/45">
                  {t(panelProfiles.length === 1 ? 'search.globeMember' : 'search.globeMembers', { count: panelProfiles.length })}
                  {selectedCountry?.zone
                    ? ` · ${t('globe.zoneUndecided')}`
                    : selectedCountry
                    ? ` · ${t(selectedCountry.cities.length === 1 ? 'search.globeCity' : 'search.globeCities', { count: selectedCountry.cities.length })}`
                    : (selectedCity?.country ? ` · ${selectedCity.country}` : '')}
                </div>
              </div>
              <button onClick={closeCity} aria-label="Close" className="text-2xl leading-none text-white/40 hover:text-white/70">×</button>
            </div>
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {/* Desktop: the people as photos, like the roster; the phone keeps compact rows. */}
              {isDesktop && panelProfiles.length > 0 && (
                <div className="globe-panel-tiles grid grid-cols-2 gap-2.5">
                  {panelProfiles.map((p) => (
                    <PhotoCard key={p._key || p.id} profile={p} variant="tile" place={p._trip ? rowDetail(p) : cityNameOf(p)} onOpen={() => onSelectProfile(p._profile || p)} />
                  ))}
                </div>
              )}
              {!isDesktop && panelProfiles.map((p) => (
                <button
                  key={p._key || p.id}
                  onClick={() => onSelectProfile(p._profile || p)}
                  className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0a0e] px-3 py-2.5 text-left active:scale-[0.99]"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white ${getAvatarClass(p.role)}`}>
                    {p.avatar ? <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" /> : (p.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{p.name}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: ROLE_COLOR[p.role] || 'rgba(255,255,255,0.5)' }}>
                      {t(`editProfile.${(p.role || '').toLowerCase()}`)}
                      {rowDetail(p) ? <span className="text-white/35"> · {rowDetail(p)}</span> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-white/25">›</span>
                </button>
              ))}
              {panelProfiles.length === 0 && (
                <p className="py-8 text-center text-sm text-white/40">
                  {selectedCountry && selectedCountry.profiles.length === 0
                    ? t('search.globeCountryEmpty', { country: selectedCountry.name })
                    : t('search.globeNoMatchingRoles')}
                </p>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default SearchGlobe;
