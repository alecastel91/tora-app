import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { cityLabel } from '../../data/placeNames';
import Globe from 'globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { geoDistance, geoCentroid } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import { coordsForCity, normalizeCity } from '../../data/cityCoords';

/**
 * The search globe drawn in WebGL (test: ?globe=3d). It only draws and reports
 * clicks: SearchGlobe keeps every state, panel and control, and calls the
 * handle below to fly or zoom. TORA's look, not a copy: solid countries with
 * fine borders (hover lifts one, the selection turns crimson), low crimson
 * member pins sized by how many members a city has, and in Travelling an arc
 * from each member's home to where they go.
 *
 * Like the 2D globe it only draws while something moves: idle, the render
 * loop pauses (phones keep their battery and their touch responsiveness).
 *
 * Cities are flat HTML dots, the same size on screen at any zoom (a 3D disc
 * the size of a city covered half of Japan close up). Cities closer together
 * than the zoom can separate merge into one dot with their total, and split
 * as you approach. Borders are one line layer just above the land (outlines
 * drawn at the land's own height fought it for pixels and shimmered), and
 * close in both switch to the 1:50m atlas.
 */
const CRIMSON = '#ff3366';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WORLD_ALT = 2.3; // camera distance for the whole globe (globe radii)
const IDLE_MS = 1500; // still this long (no spin, no arcs) → stop rendering
const FACING = (70 * Math.PI) / 180; // a city name shows within ~70° of the view centre
const LAND_ALT = 0.006;
const LINE_ALT = 0.0075; // borders sit just above the land, never in it
const DOT_ALT = 0.009;
// OrbitControls turns 2π × rotateSpeed per screen height; a screen height
// shows 2 × alt × tan(fov/2) radians of surface, so this keeps it 1:1 (fov 50°).
const GRAB = Math.tan((25 * Math.PI) / 180) / Math.PI;
const MIN_ALT = 0.035; // closest camera: ~200 km across, so neighbouring cities separate
const DETAIL_ALT = 0.6; // closer than this, the 1:50m atlas
const DETAIL_REACH = (35 * Math.PI) / 180; // …for the countries within this of the view centre
const LABELS = 14; // names shown for the biggest dots…
const ALL_NAMES_ALT = 0.35; // …and for every dot once this close
const dotSize = (count) => Math.round(8 + Math.min(count, 30) * 0.25);
// Two cities merge when nearer than this many degrees at the current zoom.
const mergeDeg = (alt) => Math.max(0.05, alt * 2.2);

// Greedy clustering, biggest first: each city joins the first dot within reach.
function cluster(items, alt) {
  const reach = (mergeDeg(alt) * Math.PI) / 180;
  const out = [];
  for (const it of [...items].sort((a, b) => b.count - a.count)) {
    const hit = out.find((c) => c.locked === !!it.locked && geoDistance(c.coord, it.coord) < reach);
    if (hit) { hit.members.push(it); hit.count += it.count; } else out.push({ coord: it.coord, members: [it], count: it.count, locked: !!it.locked });
  }
  return out;
}

// A tap that opens the members sheet on pointerup is followed by the
// browser's synthetic click at the same spot, which lands on the sheet's dim
// backdrop and closes it at once (the phone "list never comes out" bug).
// Swallow exactly that one click, as the 2D globe does.
const swallowNextClick = () => {
  const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400);
};

let detailAtlas = null; // { land, lines } once the 1:50m atlas is in
const loadDetailAtlas = () => (detailAtlas ? Promise.resolve(detailAtlas)
  : import('world-atlas/countries-50m.json').then(({ default: w }) => {
    const land = feature(w, w.objects.countries).features;
    detailAtlas = { byName: new Map(land.map((f) => [f.properties?.name, f])), lines: mesh(w, w.objects.countries).coordinates };
    return detailAtlas;
  }));
const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const Globe3DStage = forwardRef(({ land, lines, cities, zones, lockedHubs, travelling, selectedKey, selectedFeature, initialCoord, onCity, onCountry, onZone, onLocked }, ref) => {
  const { language } = useLanguage();
  const elRef = useRef(null);
  const gRef = useRef(null);
  const hoverRef = useRef(null);
  // Selected countries by name: the same country is a different shape object
  // in the coarse and the detailed atlas.
  const selRef = useRef({ key: selectedKey, names: new Set() });
  const povRef = useRef({ lat: 0, lng: 0 });
  const arcsOnRef = useRef(false);
  const itemsRef = useRef([]); // cities + locked hubs, before clustering
  const altRef = useRef(null); // altitude the dots were last clustered at
  const reclusterRef = useRef(() => {});
  const wakeRef = useRef(() => {});
  const repaintRef = useRef(() => {});
  const handlers = useRef({});
  handlers.current = { onCity, onCountry, onZone, onLocked };

  useImperativeHandle(ref, () => ({
    // Mobile: aim a little south so the place sits above the bottom sheet.
    flyTo(lng, lat, sheetBelow) {
      const g = gRef.current; if (!g) return;
      g.controls().autoRotate = false;
      const alt = Math.min(g.pointOfView().altitude, 1.1);
      wakeRef.current(900);
      g.pointOfView({ lat: sheetBelow ? lat - 12 * alt : lat, lng, altitude: alt }, 900);
      setTimeout(() => reclusterRef.current(), 920);
    },
    zoomBy(f) {
      const g = gRef.current; if (!g) return;
      const pov = g.pointOfView();
      wakeRef.current(300);
      g.pointOfView({ ...pov, altitude: Math.max(MIN_ALT, Math.min(4, pov.altitude * f)) }, 300);
      setTimeout(() => reclusterRef.current(), 320);
    },
  }), []);

  // Build once.
  useEffect(() => {
    const el = elRef.current;
    const isSel = (f) => selRef.current.names.has(f.properties?.name);
    const g = Globe({ rendererConfig: { antialias: true, alpha: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' } })(el)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(false)
      .showGraticules(false)
      .globeMaterial(new MeshPhongMaterial({ color: new Color('#0c0c15'), emissive: new Color('#05050a'), shininess: 6 }))
      // Countries as solid, slightly raised shapes with hairline borders: each
      // one readable at a glance. Hover lifts it; the selection turns crimson.
      .polygonsData(land)
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => false)
      .polygonsTransitionDuration(180)
      // Borders and coasts once each, as their own layer just above the land.
      .pathsData(lines || [])
      .pathPoints((l) => l)
      .pathPointLat((p) => p[1]).pathPointLng((p) => p[0]).pathPointAlt(LINE_ALT)
      .pathColor(() => 'rgba(255,255,255,0.2)')
      .pathStroke(null)
      .pathTransitionDuration(0)
      .onPolygonHover((f) => {
        if ((f || null) === hoverRef.current) return;
        hoverRef.current = f || null;
        el.style.cursor = f ? 'pointer' : 'grab';
        paintLand();
      })
      .onPolygonClick((f) => { swallowNextClick(); handlers.current.onCountry?.(f); })
      // Names are HTML, not 3D text: crisp and the same size at any zoom.
      .htmlLat((l) => l.coord[1]).htmlLng((l) => l.coord[0]).htmlAltitude((l) => l.alt)
      .htmlElement((l) => {
        const b = document.createElement('button');
        b.type = 'button';
        if (l.zone) {
          b.textContent = l.text;
          b.style.cssText = 'pointer-events:auto;cursor:pointer;transform:translate(-50%,-50%);padding:4px 11px;border-radius:12px;border:1px solid rgba(255,51,102,.85);background:rgba(7,7,9,.88);color:#fff;font:700 11px Inter,sans-serif;white-space:nowrap';
          b.onclick = (e) => { e.stopPropagation(); handlers.current.onZone?.(l.ref); };
        } else {
          const size = dotSize(l.count);
          // The button is a finger-sized target around a small dot.
          const hit = Math.max(size, COARSE ? 36 : 24);
          b.title = l.locked ? `${l.text} · Premium` : l.text;
          b.style.cssText = `pointer-events:auto;cursor:pointer;position:relative;width:${hit}px;height:${hit}px;padding:0;border:0;background:none;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent`;
          b.dataset.dot = '1';
          const dot = document.createElement('span');
          dot.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 10px Inter,sans-serif;color:#fff;border:1.5px solid rgba(4,4,9,.85);box-shadow:0 0 0 3px rgba(255,51,102,.18);pointer-events:none`;
          b.appendChild(dot);
          if (l.showName) {
            const n = document.createElement('span');
            n.textContent = l.text;
            n.style.cssText = `position:absolute;left:${hit / 2 + size / 2 + 4}px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,.9);font:600 12px Inter,sans-serif;white-space:nowrap;pointer-events:none;text-shadow:0 0 3px #040409,0 0 3px #040409`;
            b.appendChild(n);
          }
          b.onclick = (e) => {
            e.stopPropagation();
            // A tap always opens a list: a merged dot opens its biggest city
            // (the flight to it brings the camera close enough to split the rest).
            if (l.locked) handlers.current.onLocked?.(l.members[0].name);
            else handlers.current.onCity?.(l.members[0].ref);
          };
          l.paint = () => {
            const sel = l.members.some((m) => m.ref?.key && m.ref.key === selRef.current.key);
            dot.style.background = l.locked ? 'rgba(255,255,255,0.28)' : sel ? '#ffffff' : CRIMSON;
            dot.style.color = sel ? '#040409' : '#fff';
          };
          l.paint();
        }
        // The library picks countries from pointer events on its whole
        // container; a press on a dot or a zone badge must end here, or on a
        // phone the country under it wins the tap.
        for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
          b.addEventListener(type, (e) => e.stopPropagation());
        }
        // Phones never get a click from a tap here (the library cancels it), so
        // a press that ends where it started opens the dot; the click handler
        // stays for mouse and keyboard, once per press.
        let down = null; let tappedAt = 0;
        const open = b.onclick; b.onclick = null;
        b.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
        b.addEventListener('pointerup', (e) => {
          if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) { tappedAt = Date.now(); swallowNextClick(); open?.(e); }
          down = null;
        });
        b.addEventListener('click', (e) => { if (Date.now() - tappedAt > 600) open?.(e); else e.stopPropagation(); });
        b.__coord = l.coord;
        return b;
      })
      // The library hides names behind the globe; names near the horizon would
      // still pile up along the edge, so they also need to face the camera.
      .htmlElementVisibilityModifier((b, inFront) => {
        const { lat, lng } = povRef.current;
        b.style.visibility = inFront && geoDistance(b.__coord, [lng, lat]) < FACING ? 'visible' : 'hidden';
      })
      .htmlTransitionDuration(0)
      .arcStartLat((a) => a.from[1]).arcStartLng((a) => a.from[0])
      .arcEndLat((a) => a.to[1]).arcEndLng((a) => a.to[0])
      .arcColor(() => ['rgba(255,51,102,0.08)', 'rgba(255,51,102,0.9)'])
      .arcStroke(0.32)
      .arcAltitudeAutoScale(0.38)
      .arcDashLength(0.45).arcDashGap(0.2).arcDashInitialGap(() => Math.random())
      .arcDashAnimateTime(2600);
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2));

    // Land colours: graphite, a lighter hover, crimson for the selection.
    // New accessor functions each time: the library only re-colours on a new function.
    function paintLand() {
      g.polygonCapColor((f) => (isSel(f) ? 'rgba(255,51,102,0.55)' : f === hoverRef.current ? '#34344a' : '#23232f'))
        .polygonAltitude((f) => (f === hoverRef.current || isSel(f) ? 0.012 : LAND_ALT));
    }
    const paintPins = () => { for (const l of g.htmlElementsData()) l.paint?.(); };
    paintLand(); paintPins();

    // Dots regroup when the zoom has changed enough to matter; close in, the
    // detailed atlas replaces the coarse one (once, loaded on first need).
    // Detailed shapes only for the countries near the view: all 240 at 1:50m
    // stalled the render loop, a handful rebuild in a blink. Swapped back to the
    // coarse ones far out, where the detail is invisible anyway.
    let landKey = '';
    const centroids = new Map(land.map((f) => [f, geoCentroid(f)]));
    const refreshLand = (alt) => {
      const { lat, lng } = g.pointOfView();
      const near = alt < DETAIL_ALT && detailAtlas
        ? land.filter((f) => geoDistance(centroids.get(f), [lng, lat]) < DETAIL_REACH && detailAtlas.byName.has(f.properties?.name))
        : [];
      const key = near.map((f) => f.properties?.name).join('|');
      if (key === landKey) return;
      landKey = key;
      const swap = new Set(near);
      hoverRef.current = null;
      g.polygonsData(land.map((f) => (swap.has(f) ? detailAtlas.byName.get(f.properties?.name) : f)))
        .pathsData(near.length ? detailAtlas.lines : (lines || []));
      paintLand(); wake(600);
    };
    reclusterRef.current = () => {
      const alt = g.pointOfView().altitude;
      if (alt < DETAIL_ALT && !detailAtlas) loadDetailAtlas().then(() => gRef.current && refreshLand(g.pointOfView().altitude)).catch(() => {});
      else refreshLand(alt);
      const prev = altRef.current;
      if (prev && Math.abs(Math.log(alt / prev)) < 0.2) return;
      altRef.current = alt;
      buildDots();
    };
    repaintRef.current = () => { paintLand(); paintPins(); };

    // Render only while something moves: spinning, arcs, a drag or a flight.
    let hidden = false;
    let idleTimer = 0;
    const c = g.controls();
    const wake = (ms = 0) => {
      if (hidden) return;
      g.resumeAnimation();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { if (!c.autoRotate && !arcsOnRef.current) g.pauseAnimation(); }, ms + IDLE_MS);
    };
    wakeRef.current = wake;
    c.autoRotate = !initialCoord; c.autoRotateSpeed = 0.35;
    // Move like the 2D globe: the place under the finger follows the finger
    // and the globe stops when it's let go (no fling).
    c.enableDamping = false;
    c.minDistance = g.getGlobeRadius() * (1 + MIN_ALT);
    c.maxDistance = g.getGlobeRadius() * (1 + 4);
    const calibrate = () => {
      const alt = g.pointOfView().altitude;
      c.rotateSpeed = alt * GRAB; // the library sets alt × 0.3, about twice too fast
      c.zoomSpeed = Math.min(1, Math.sqrt(alt) * 0.6);
    };
    calibrate();
    c.addEventListener('start', () => { c.autoRotate = false; wake(); });
    c.addEventListener('end', () => { wake(); reclusterRef.current(); });
    c.addEventListener('change', () => { calibrate(); povRef.current = g.pointOfView(); });
    el.addEventListener('pointermove', () => wake()); // hover highlights need frames

    // Narrow phone screens need the camera further back to show the sphere's edge.
    const near = el.clientWidth < 600 ? 2.2 : 1.5;
    g.pointOfView(initialCoord ? { lat: initialCoord[1], lng: initialCoord[0], altitude: near } : { lat: 30, lng: 15, altitude: WORLD_ALT }, 0);
    povRef.current = g.pointOfView();
    gRef.current = g;
    wake();

    // Size to the stage; a hidden keep-mounted tab stops rendering entirely.
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      hidden = width < 10 || height < 10;
      if (hidden) { g.pauseAnimation(); return; }
      g.width(width).height(height); wake();
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(idleTimer); g.pauseAnimation(); g._destructor?.(); g.renderer().dispose(); el.innerHTML = ''; gRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dots + names: member cities (with this view's role counts) and, for FREE
  // members, dim Premium hubs; zone badges on top.
  const zonesRef = useRef([]);
  const buildDots = () => {
    const g = gRef.current; if (!g) return;
    const alt = g.pointOfView().altitude;
    const groups = cluster(itemsRef.current, alt);
    // Names for the biggest dots, each kept clear of the names already placed.
    const sep = (mergeDeg(alt) * 3 * Math.PI) / 180;
    const named = new Set();
    for (const c of groups) {
      if (c.locked || named.size >= LABELS) continue;
      if ([...named].every((n) => geoDistance(n.coord, c.coord) > sep)) named.add(c);
    }
    g.htmlElementsData([
      ...groups.map((c) => ({
        ...c,
        text: c.members.length > 1 ? `${c.members[0].label} +${c.members.length - 1}` : c.members[0].label,
        showName: named.has(c) || (alt < ALL_NAMES_ALT && !c.locked && [...named].every((n) => n === c || geoDistance(n.coord, c.coord) > sep / 3)),
        alt: DOT_ALT,
      })),
      ...zonesRef.current,
    ]);
    wakeRef.current();
  };
  useEffect(() => {
    const g = gRef.current; if (!g) return;
    itemsRef.current = [
      ...cities.filter((ct) => ct._cnt > 0).map((ct) => ({ ref: ct, name: ct.name, label: cityLabel(ct.name, language), coord: ct.coord, count: ct._cnt })),
      ...lockedHubs.map((h) => ({ ref: h, name: h.name, label: cityLabel(h.name, language), coord: h.coord, count: 0, locked: true })),
    ];
    zonesRef.current = zones.filter((z) => z._cnt > 0).map((z) => ({ ref: z, zone: true, coord: z.coord, text: `${z.name} · ${z._cnt}`, alt: 0.02 }));
    altRef.current = g.pointOfView().altitude;
    buildDots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, zones, lockedHubs, language]);

  // Travelling: an arc from each member's home city to their destination.
  useEffect(() => {
    const g = gRef.current; if (!g) return;
    const arcs = [];
    if (travelling) {
      for (const ct of cities) {
        if (!ct._cnt) continue;
        for (const p of ct.profiles) {
          const home = p._trip?.home && coordsForCity(p._trip.home);
          if (home && normalizeCity(p._trip.home) !== ct.cityKey) arcs.push({ from: home, to: ct.coord });
        }
      }
    }
    g.arcsData(arcs.slice(0, 400));
    arcsOnRef.current = arcs.length > 0; // animated dashes keep the loop running
    wakeRef.current();
  }, [cities, travelling]);

  // Selection: the city's pin turns white, the country (or a zone's countries)
  // crimson. Only the colours are refreshed, not the pins or names.
  useEffect(() => {
    const g = gRef.current; if (!g) return;
    const list = selectedFeature?.features || (selectedFeature ? [selectedFeature] : []);
    selRef.current = { key: selectedKey, names: new Set(list.map((f) => f.properties?.name)) };
    repaintRef.current();
    wakeRef.current();
  }, [selectedKey, selectedFeature]);

  return <div ref={elRef} className="absolute inset-0" style={{ cursor: 'grab' }} />;
});

Globe3DStage.displayName = 'Globe3DStage';
export default Globe3DStage;
