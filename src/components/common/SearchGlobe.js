import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoOrthographic, geoPath, geoGraticule10, geoContains, geoCentroid, geoDistance } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import { coordsForCity, normalizeCity, FEATURED_HUBS, CITY_COORDS } from '../../data/cityCoords';
import { getAvatarClass, ROLE_COLOR } from '../../utils/roles';
import { useLanguage } from '../../contexts/LanguageContext';

// Country geometry is decoded once at module load (shared across mounts).
const LAND = feature(worldData, worldData.objects.countries);
const BORDERS = mesh(worldData, worldData.objects.countries, (a, b) => a !== b);
const GRATICULE = geoGraticule10();
const SPHERE = { type: 'Sphere' };

const ROLES = ['ARTIST', 'AGENT', 'PROMOTER', 'VENUE'];

// Zoom staging (level-of-detail): far away only the main cities show, easing
// in the secondary ones as you approach a country — otherwise labels overlap.
const MAX_ZOOM = 18;
const SECONDARY_PINS_ZOOM = 2.6; // below this, only major cities get pins
const LABEL_MAJOR_ZOOM = 1.5;    // majors get labels from here
const LABEL_ALL_ZOOM = 4.0;      // country-level: every visible pin is labelled
const MAJOR_KEYS = new Set(FEATURED_HUBS.map((n) => normalizeCity(n)));

const cityNameOf = (p) => p.city || (p.location || '').split(',')[0].trim();

// Group the (already server-filtered) profiles by mapped city.
function groupByCity(profiles) {
  const map = new Map();
  let unmapped = 0;
  for (const p of profiles || []) {
    const name = cityNameOf(p);
    const coord = coordsForCity(name);
    if (!coord) { unmapped += 1; continue; }
    const key = normalizeCity(name);
    if (!map.has(key)) {
      map.set(key, { key, name, country: p.country || (p.location || '').split(',').slice(1).join(',').trim(), coord, profiles: [] });
    }
    map.get(key).profiles.push(p);
  }
  return { list: [...map.values()], unmapped };
}

// Fills its positioned parent. The parent (SearchScreen) overlays the search
// bar on top and the List/Globe toggle at the bottom; topInset/bottomInset
// tell this component how much of its own chrome those overlays cover.
const SearchGlobe = ({ profiles, onSelectProfile, locked = false, userCity = '', userCountry = '', onLockedCity, topInset = 68, bottomInset = 52 }) => {
  const { t } = useLanguage();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  const { list: cities, unmapped } = useMemo(() => groupByCity(profiles), [profiles]);

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
    const dataKeys = new Set(cities.map((c) => c.key));
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
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const isDesktopRef = useRef(isDesktop);
  useEffect(() => { isDesktopRef.current = isDesktop; }, [isDesktop]);
  const PANEL_W = 400;

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
      c._major = c._cnt >= 3 || MAJOR_KEYS.has(c.key);
    }
    citiesRef.current = [...cities].sort((a, b) => (b._cnt || 0) - (a._cnt || 0));
  }, [cities, roleOn]);
  useEffect(() => {
    selectedKey.current = selectedCity?.key || selectedCountry?.name || null;
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

      // land — soft top-left light, luminous coastlines
      ctx.beginPath(); path(LAND);
      const lg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      lg.addColorStop(0, '#262633');
      lg.addColorStop(0.5, '#1d1d29');
      lg.addColorStop(1, '#15151f');
      ctx.fillStyle = lg; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 0.6; ctx.stroke();

      // country borders
      ctx.beginPath(); path(BORDERS);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.5; ctx.stroke();

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

  // hit-test: member pins first, then locked hubs (uses _xy from the last frame)
  const hit = (mx, my) => {
    let best = null, bd = 1e9;
    for (const c of citiesRef.current) {
      if (!c._xy) continue;
      const d = Math.hypot(mx - c._xy[0], my - c._xy[1]);
      if (d < 16 && d < bd) { bd = d; best = { kind: 'city', ref: c }; }
    }
    if (!best) {
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
    if (px < H * 0.25) { setSelectedCity(null); setSelectedCountry(null); setSheetPx(0); }
    else if (px < H * 0.8) setSheetPx(Math.round(H * 0.62));
    else setSheetPx(H);
  };

  // Rotate a place to the front, offset so it stays visible next to the open
  // panel: north of the 62% bottom sheet on mobile, west of the right-docked
  // panel on desktop.
  const focusOn = (lon, lat) => {
    const r = Math.max(viewRef.current.r, 1);
    if (isDesktopRef.current) {
      const offsetPx = PANEL_W / 2; // canvas center → center of the un-covered area
      const delta = Math.min(35, (Math.asin(Math.min(0.95, offsetPx / r)) * 180) / Math.PI);
      focusing.current = true;
      targetRot.current = [-(lon + delta), -lat];
      return;
    }
    const offsetPx = dimsRef.current.h * 0.27; // canvas center → visible-strip center
    const delta = Math.min(35, (Math.asin(Math.min(0.95, offsetPx / r)) * 180) / Math.PI);
    focusing.current = true;
    targetRot.current = [-lon, Math.max(-90, Math.min(90, -lat + delta))];
  };

  const openCity = (c) => {
    setSelectedCity(c);
    setSelectedCountry(null);
    focusOn(c.coord[0], c.coord[1]);
    setTip(null);
    sheetAnimating.current = true;
    setSheetPx(Math.round(dimsRef.current.h * 0.62));
  };
  const openCountry = (f) => {
    const name = f.properties?.name || '';
    // geoContains + name fallback: small islands (e.g. Ibiza) are missing from
    // the 110m geometry, but those profiles still carry country = "Spain".
    const fname = name.toLowerCase();
    const inCountry = citiesRef.current.filter(
      (c) => geoContains(f, c.coord) || (c.country && c.country.toLowerCase() === fname)
    );
    if (locked) {
      // FREE members may open their own country (their whole discovery
      // scope). Data pins inside prove ownership; own-city coords and the
      // profile's country name cover empty/unmapped cases.
      const own = coordsForCity(userCity);
      const allowed = inCountry.length > 0
        || (own && geoContains(f, own))
        || (userCountry && fname === userCountry.toLowerCase());
      if (!allowed) { onLockedCity?.(name); return; }
    }
    setSelectedCountry({
      name,
      feature: f,
      cities: inCountry,
      profiles: inCountry.flatMap((c) => c.profiles),
    });
    setSelectedCity(null);
    const center = geoCentroid(f);
    focusOn(center[0], center[1]);
    setTip(null);
    sheetAnimating.current = true;
    setSheetPx(Math.round(dimsRef.current.h * 0.62));
  };
  const closeCity = () => { setSelectedCity(null); setSelectedCountry(null); setSheetPx(0); focusing.current = false; };

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
  const endTap = (e) => {
    if (movedRef.current >= 6) { pausedRef.current = true; return; }
    const mx = e.nativeEvent.offsetX, my = e.nativeEvent.offsetY;
    const h = hit(mx, my);
    if (h?.kind === 'city') { openCity(h.ref); return; }
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
  const sheetOpen = !!(selectedCity || selectedCountry);
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

  const place = selectedCountry || selectedCity;
  const panelProfiles = place ? place.profiles.filter((p) => roleOn[p.role]) : [];

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-[#040407]">
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
        <div className="absolute right-3 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-tech uppercase tracking-[0.12em] text-white/40 backdrop-blur-sm"
             style={{ top: topInset + 8 }}>
          {t('search.globeUnmapped', { count: unmapped })}
        </div>
      )}

      {/* Zoom controls — right edge, above the bottom chrome (shift left of the desktop panel) */}
      <div className="absolute flex flex-col gap-1.5" style={{ bottom: bottomInset + 64, right: 12 + (isDesktop && sheetOpen ? PANEL_W : 0) }}>
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
           style={{ bottom: bottomInset + 8, right: isDesktop && sheetOpen ? PANEL_W : 0 }}>
        {!sheetOpen && cities.length > 0 && (
          <div className="text-center text-[10px] font-tech uppercase tracking-[0.15em] text-white/25">
            {t('search.globeHint')}
          </div>
        )}
        <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5 px-4">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRoleOn((s) => ({ ...s, [r]: !s[r] }))}
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
      {cities.length === 0 && !locked && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-sm text-white/50">{t('search.globeNoCities')}</p>
        </div>
      )}

      {/* Members panel — bottom sheet on mobile (expands to cover the page),
          right-docked side panel on desktop */}
      {sheetOpen && (
        <>
          {!isDesktop && <div className="absolute inset-0 z-30 bg-black/40" onClick={closeCity} />}
          <aside
            className={isDesktop
              ? 'absolute right-0 top-0 bottom-0 z-40 flex w-[400px] flex-col border-l border-white/10 bg-[#070709]/95 backdrop-blur-md'
              : 'absolute inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl border-t border-white/10 bg-[#070709]'}
            style={isDesktop ? undefined : { height: sheetPx, transition: sheetAnimating.current ? 'height 0.22s ease' : 'none' }}
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
                <div className="text-[10px] font-tech uppercase tracking-[0.2em] text-infrared">{t('search.globeOnNetwork')}</div>
                <h2 className="mt-0.5 text-xl font-semibold text-white">{place.name}</h2>
                <div className="mt-0.5 text-xs text-white/45">
                  {t(panelProfiles.length === 1 ? 'search.globeMember' : 'search.globeMembers', { count: panelProfiles.length })}
                  {selectedCountry
                    ? ` · ${t(selectedCountry.cities.length === 1 ? 'search.globeCity' : 'search.globeCities', { count: selectedCountry.cities.length })}`
                    : (selectedCity?.country ? ` · ${selectedCity.country}` : '')}
                </div>
              </div>
              <button onClick={closeCity} aria-label="Close" className="text-2xl leading-none text-white/40 hover:text-white/70">×</button>
            </div>
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {panelProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProfile(p)}
                  className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0a0e] px-3 py-2.5 text-left active:scale-[0.99]"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white ${getAvatarClass(p.role)}`}>
                    {p.avatar ? <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" /> : (p.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{p.name}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: ROLE_COLOR[p.role] || 'rgba(255,255,255,0.5)' }}>
                      {t(`editProfile.${(p.role || '').toLowerCase()}`)}
                      {selectedCountry
                        ? (cityNameOf(p) ? <span className="text-white/35"> · {cityNameOf(p)}</span> : null)
                        : (p.genres?.length ? <span className="text-white/35"> · {p.genres.slice(0, 2).join(', ')}</span> : null)}
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
