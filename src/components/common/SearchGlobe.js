import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import { coordsForCity, normalizeCity } from '../../data/cityCoords';
import { getAvatarClass } from '../../utils/roles';
import { useLanguage } from '../../contexts/LanguageContext';

// Country geometry is decoded once at module load (shared across mounts).
const LAND = feature(worldData, worldData.objects.countries);
const BORDERS = mesh(worldData, worldData.objects.countries, (a, b) => a !== b);
const GRATICULE = geoGraticule10();
const SPHERE = { type: 'Sphere' };

const ROLES = ['ARTIST', 'AGENT', 'PROMOTER', 'VENUE'];
const ROLE_COLOR = { ARTIST: '#6B5FFF', AGENT: '#00C875', PROMOTER: '#FFB800', VENUE: '#FF5757' };

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

const SearchGlobe = ({ profiles, onSelectProfile }) => {
  const { t } = useLanguage();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  const { list: cities, unmapped } = useMemo(() => groupByCity(profiles), [profiles]);

  const [roleOn, setRoleOn] = useState({ ARTIST: true, AGENT: true, PROMOTER: true, VENUE: true });
  const [selectedCity, setSelectedCity] = useState(null);
  const [tip, setTip] = useState(null); // { x, y, name, count }
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [boxH, setBoxH] = useState(0); // fits the globe between the header and the tab bar

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
  const roleOnRef = useRef(roleOn);
  const citiesRef = useRef(cities);
  const dimsRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => { roleOnRef.current = roleOn; }, [roleOn]);
  useEffect(() => { citiesRef.current = cities; }, [cities]);
  useEffect(() => { selectedKey.current = selectedCity?.key || null; }, [selectedCity]);

  const projection = useRef(geoOrthographic().clipAngle(90).precision(0.5)).current;

  // Fit the globe box between its top (below the search header) and the tab bar,
  // so the zoom controls and hint never hide under the bottom nav.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const TAB_BAR = 84; // bottom nav + gap
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      setBoxH(Math.max(340, Math.round(window.innerHeight - top - TAB_BAR)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Track the actual rendered size for the canvas backing store.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDims({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setDims({ w: Math.round(r.width), h: Math.round(r.height) });
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

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const path = geoPath(projection, ctx);
    let raf = 0;

    const CX = () => dims.w / 2;
    const CY = () => dims.h / 2 + Math.min(dims.h * 0.03, 20);
    const baseR = () => Math.min(dims.w, dims.h) * 0.44;

    function frame() {
      const W = dims.w, H = dims.h;
      const cx = CX(), cy = CY();
      const r = baseR() * zoomRef.current;

      if (focusing.current && targetRot.current) {
        for (let i = 0; i < 2; i++) {
          let d = targetRot.current[i] - rot.current[i];
          if (i === 0) d = ((d + 540) % 360) - 180;
          rot.current[i] += d * 0.12;
        }
        if (Math.abs(((targetRot.current[0] - rot.current[0] + 540) % 360) - 180) < 0.2 &&
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

      // atmosphere halo (infrared)
      const halo = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.16);
      halo.addColorStop(0, 'rgba(255,51,102,0.20)');
      halo.addColorStop(1, 'rgba(255,51,102,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.16, 0, 7); ctx.fill();

      // ocean sphere
      ctx.beginPath(); path(SPHERE);
      const oc = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
      oc.addColorStop(0, '#12121c'); oc.addColorStop(1, '#050507');
      ctx.fillStyle = oc; ctx.fill();

      // graticule
      ctx.beginPath(); path(GRATICULE);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.6; ctx.stroke();

      // land + borders
      ctx.beginPath(); path(LAND); ctx.fillStyle = '#1d1d27'; ctx.fill();
      ctx.beginPath(); path(BORDERS); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 0.5; ctx.stroke();

      // spherical shading
      ctx.save(); ctx.beginPath(); path(SPHERE); ctx.clip();
      const sh = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.46, r * 0.1, cx, cy, r * 1.18);
      sh.addColorStop(0, 'rgba(255,255,255,0.06)');
      sh.addColorStop(0.45, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H); ctx.restore();

      // rim
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
      ctx.strokeStyle = 'rgba(255,51,102,0.35)'; ctx.lineWidth = 1; ctx.stroke();

      // pins
      const now = performance.now();
      const showLabels = zoomRef.current > 1.5;
      const font = getComputedStyle(document.body).fontFamily;
      for (const c of citiesRef.current) {
        const count = c.profiles.reduce((n, p) => n + (roleOnRef.current[p.role] ? 1 : 0), 0);
        const xy = count > 0 ? projection(c.coord) : null;
        c._xy = xy; c._count = count;
        if (!xy) continue;
        const isSel = selectedKey.current === c.key;
        const isHov = hoveredKey.current === c.key;
        const rad = 3 + Math.min(count, 8) * 0.7;
        ctx.save();
        ctx.shadowColor = 'rgba(255,51,102,0.9)';
        ctx.shadowBlur = isSel ? 18 : (isHov ? 14 : 8);
        ctx.fillStyle = isSel ? '#fff' : '#ff3366';
        ctx.beginPath(); ctx.arc(xy[0], xy[1], rad, 0, 7); ctx.fill();
        ctx.restore();
        if (isSel) {
          const pr = rad + 6 + Math.sin(now * 0.005) * 3;
          ctx.strokeStyle = 'rgba(255,51,102,0.85)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(xy[0], xy[1], pr, 0, 7); ctx.stroke();
        }
        if (showLabels || isSel || isHov) {
          ctx.font = `600 12px ${font}`; ctx.textAlign = 'left';
          ctx.fillStyle = isSel ? '#fff' : 'rgba(255,255,255,0.82)';
          ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
          ctx.fillText(c.name, xy[0] + rad + 6, xy[1] + 4); ctx.shadowBlur = 0;
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [dims, projection]);

  // hit-test against pins (uses the _xy stamped by the last frame)
  const hit = (mx, my) => {
    let best = null, bd = 1e9;
    for (const c of citiesRef.current) {
      if (!c._xy) continue;
      const d = Math.hypot(mx - c._xy[0], my - c._xy[1]);
      if (d < 16 && d < bd) { bd = d; best = c; }
    }
    return best;
  };

  const openCity = (c) => {
    setSelectedCity(c);
    focusing.current = true;
    targetRot.current = [-c.coord[0], -c.coord[1]];
    setTip(null);
    setSheetPx(Math.round(dimsRef.current.h * 0.62));
  };
  const closeCity = () => { setSelectedCity(null); focusing.current = false; };

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
        zoomRef.current = Math.max(1, Math.min(6, zoomRef.current * (d / pinchDist.current)));
      }
      pinchDist.current = d; pausedRef.current = true;
      return;
    }
    if (draggingRef.current) {
      const dx = e.clientX - lastRef.current.x, dy = e.clientY - lastRef.current.y;
      lastRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current += Math.abs(dx) + Math.abs(dy);
      const k = 75 / (Math.min(dimsRef.current.w, dimsRef.current.h) * 0.44 * zoomRef.current);
      rot.current[0] += dx * k;
      rot.current[1] = Math.max(-90, Math.min(90, rot.current[1] - dy * k));
    } else {
      const h = hit(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      hoveredKey.current = h?.key || null;
      if (h && h._xy) setTip({ x: h._xy[0], y: h._xy[1], name: h.name, count: h._count });
      else setTip(null);
    }
  };
  const endTap = (e) => {
    if (movedRef.current >= 6) { pausedRef.current = true; return; }
    const h = hit(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (h) openCity(h);
    else if (selectedKey.current) closeCity();
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
  const onWheel = (e) => {
    zoomRef.current = Math.max(1, Math.min(6, zoomRef.current * (1 - e.deltaY * 0.0012)));
  };

  // ---- bottom-sheet drag ----
  const [sheetPx, setSheetPx] = useState(0);
  const sheetDrag = useRef(null);
  const onGrabDown = (e) => {
    sheetDrag.current = { y: e.clientY, h: sheetPx };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGrabMove = (e) => {
    if (!sheetDrag.current) return;
    const h = sheetDrag.current.h - (e.clientY - sheetDrag.current.y);
    setSheetPx(Math.max(0, Math.min(dimsRef.current.h, h)));
  };
  const onGrabUp = () => {
    if (!sheetDrag.current) return;
    sheetDrag.current = null;
    const H = dimsRef.current.h;
    if (sheetPx < H * 0.25) closeCity();
    else if (sheetPx < H * 0.8) setSheetPx(Math.round(H * 0.62));
    else setSheetPx(H);
  };

  const panelProfiles = selectedCity
    ? selectedCity.profiles.filter((p) => roleOn[p.role])
    : [];

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#060608]"
         style={{ height: boxH || 'calc(100dvh - 260px)', minHeight: 340, touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />

      {/* Role legend (top-left) */}
      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRoleOn((s) => ({ ...s, [r]: !s[r] }))}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-tech uppercase tracking-[0.12em] transition
              ${roleOn[r] ? 'border-white/15 bg-black/50 text-white/80' : 'border-white/5 bg-black/30 text-white/30'}`}
          >
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: roleOn[r] ? ROLE_COLOR[r] : 'rgba(255,255,255,0.2)' }} />
            {t(`editProfile.${r.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {/* Un-mapped count (top-right) */}
      {unmapped > 0 && (
        <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-tech uppercase tracking-[0.12em] text-white/40">
          {t('search.globeUnmapped', { count: unmapped })}
        </div>
      )}

      {/* Zoom controls (bottom-right) */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        {['+', '−'].map((sym, i) => (
          <button
            key={sym}
            aria-label={i === 0 ? 'Zoom in' : 'Zoom out'}
            onClick={() => { zoomRef.current = i === 0 ? Math.min(6, zoomRef.current * 1.3) : Math.max(1, zoomRef.current / 1.3); }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 text-lg text-white/70 backdrop-blur-sm active:scale-95"
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Hover tooltip */}
      {tip && !selectedCity && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] whitespace-nowrap rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-[11px] text-white/90 backdrop-blur-sm"
          style={{ left: tip.x, top: tip.y }}
        >
          <b>{tip.name}</b> <span className="text-white/50">· {tip.count}</span>
        </div>
      )}

      {/* Hint */}
      {!selectedCity && cities.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-[10px] font-tech uppercase tracking-[0.15em] text-white/25">
          {t('search.globeHint')}
        </div>
      )}

      {/* Empty state */}
      {cities.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-sm text-white/50">{t('search.globeNoCities')}</p>
        </div>
      )}

      {/* City bottom sheet */}
      {selectedCity && (
        <>
          <div className="absolute inset-0 z-20 bg-black/40" onClick={closeCity} />
          <aside
            className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl border-t border-white/10 bg-[#0c0c10]"
            style={{ height: sheetPx || Math.round(dims.h * 0.62), transition: sheetDrag.current ? 'none' : 'height 0.22s ease' }}
          >
            <div
              className="flex shrink-0 cursor-grab justify-center pt-2.5 pb-1"
              onPointerDown={onGrabDown}
              onPointerMove={onGrabMove}
              onPointerUp={onGrabUp}
              onPointerCancel={onGrabUp}
            >
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex shrink-0 items-start justify-between px-5 pb-3">
              <div>
                <div className="text-[10px] font-tech uppercase tracking-[0.2em] text-[#FF3366]">{t('search.globeOnNetwork')}</div>
                <h2 className="mt-0.5 text-xl font-semibold text-white">{selectedCity.name}</h2>
                <div className="mt-0.5 text-xs text-white/45">
                  {t(panelProfiles.length === 1 ? 'search.globeMember' : 'search.globeMembers', { count: panelProfiles.length })}
                  {selectedCity.country ? ` · ${selectedCity.country}` : ''}
                </div>
              </div>
              <button onClick={closeCity} aria-label="Close" className="text-2xl leading-none text-white/40 hover:text-white/70">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {panelProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProfile(p)}
                  className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#101015] px-3 py-2.5 text-left active:scale-[0.99]"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white ${getAvatarClass(p.role)}`}>
                    {p.avatar ? <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" /> : (p.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{p.name}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: ROLE_COLOR[p.role] || 'rgba(255,255,255,0.5)' }}>
                      {t(`editProfile.${(p.role || '').toLowerCase()}`)}
                      {p.genres?.length ? <span className="text-white/35"> · {p.genres.slice(0, 2).join(', ')}</span> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-white/25">›</span>
                </button>
              ))}
              {panelProfiles.length === 0 && (
                <p className="py-8 text-center text-sm text-white/40">{t('search.globeNoMatchingRoles')}</p>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default SearchGlobe;
