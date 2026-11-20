import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { cityLabel } from '../../data/placeNames';
import Globe from 'globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { geoDistance } from 'd3-geo';
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
 */
const CRIMSON = '#ff3366';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WORLD_ALT = 2.3; // camera distance for the whole globe (globe radii)
const IDLE_MS = 1500; // still this long (no spin, no arcs) → stop rendering
const FACING = (70 * Math.PI) / 180; // a city name shows within ~70° of the view centre
const pinAlt = (count) => 0.003 + Math.min(count, 20) * 0.0015;
const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const Globe3DStage = forwardRef(({ land, cities, zones, lockedHubs, travelling, selectedKey, selectedFeature, initialCoord, onCity, onCountry, onZone, onLocked }, ref) => {
  const { language } = useLanguage();
  const elRef = useRef(null);
  const gRef = useRef(null);
  const hoverRef = useRef(null);
  const selRef = useRef({ key: selectedKey, features: new Set() });
  const povRef = useRef({ lat: 0, lng: 0 });
  const arcsOnRef = useRef(false);
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
    },
    zoomBy(f) {
      const g = gRef.current; if (!g) return;
      const pov = g.pointOfView();
      wakeRef.current(300);
      g.pointOfView({ ...pov, altitude: Math.max(0.12, Math.min(4, pov.altitude * f)) }, 300);
    },
  }), []);

  // Build once.
  useEffect(() => {
    const el = elRef.current;
    const isSel = (f) => selRef.current.features.has(f);
    const g = Globe({ rendererConfig: { antialias: !COARSE, alpha: true, powerPreference: 'high-performance' } })(el)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(false)
      .showGraticules(false)
      .globeMaterial(new MeshPhongMaterial({ color: new Color('#0c0c15'), emissive: new Color('#05050a'), shininess: 6 }))
      // Countries as solid, slightly raised shapes with hairline borders: each
      // one readable at a glance. Hover lifts it; the selection turns crimson.
      .polygonsData(land)
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => 'rgba(255,255,255,0.16)')
      .polygonsTransitionDuration(180)
      .onPolygonHover((f) => {
        if ((f || null) === hoverRef.current) return;
        hoverRef.current = f || null;
        el.style.cursor = f ? 'pointer' : 'grab';
        paintLand();
      })
      .onPolygonClick((f) => handlers.current.onCountry?.(f))
      .pointResolution(10)
      .pointLat((p) => p.coord[1]).pointLng((p) => p.coord[0])
      // Low discs, not towers: close up, tall pins read as sticks lying on the map.
      .pointAltitude((p) => (p.locked ? 0.002 : pinAlt(p.count)))
      .pointRadius((p) => (p.locked ? 0.2 : 0.3 + Math.min(p.count, 20) * 0.015))
      .onPointClick((p) => (p.locked ? handlers.current.onLocked?.(p.name) : handlers.current.onCity?.(p.ref)))
      .pointLabel((p) => `<div style="padding:3px 8px;border-radius:8px;background:rgba(0,0,0,.8);border:1px solid rgba(255,255,255,.12);font:600 11px Inter,sans-serif;color:#fff">${esc(p.label)} <span style="color:rgba(255,255,255,.5)">· ${p.locked ? 'Premium' : p.count}</span></div>`)
      // Names are HTML, not 3D text: crisp and the same size at any zoom.
      .htmlLat((l) => l.coord[1]).htmlLng((l) => l.coord[0]).htmlAltitude((l) => l.alt)
      .htmlElement((l) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = l.text;
        b.style.cssText = l.zone
          ? 'pointer-events:auto;cursor:pointer;transform:translate(-50%,-50%);padding:4px 11px;border-radius:12px;border:1px solid rgba(255,51,102,.85);background:rgba(7,7,9,.88);color:#fff;font:700 11px Inter,sans-serif;white-space:nowrap'
          : 'pointer-events:auto;cursor:pointer;transform:translate(8px,-50%);padding:0;border:0;background:none;color:rgba(255,255,255,.88);font:600 12px Inter,sans-serif;white-space:nowrap;text-shadow:0 0 3px #040409,0 0 3px #040409';
        b.onclick = (e) => { e.stopPropagation(); if (l.zone) handlers.current.onZone?.(l.ref); else handlers.current.onCity?.(l.ref); };
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
    function paintLand() {
      g.polygonCapColor((f) => (isSel(f) ? 'rgba(255,51,102,0.55)' : f === hoverRef.current ? '#34344a' : '#23232f'))
        .polygonAltitude((f) => (f === hoverRef.current || isSel(f) ? 0.012 : 0.006));
    }
    // New accessor functions each time: the library only re-colours on a new function.
    const paintPins = () => g.pointColor((p) => (p.locked ? 'rgba(255,255,255,0.28)' : p.ref?.key === selRef.current.key ? '#ffffff' : CRIMSON));
    paintLand(); paintPins();
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
    c.autoRotate = !initialCoord; c.autoRotateSpeed = 0.35; c.enableDamping = true; c.dampingFactor = 0.08;
    c.addEventListener('start', () => { c.autoRotate = false; wake(); });
    c.addEventListener('end', () => wake());
    c.addEventListener('change', () => { povRef.current = g.pointOfView(); });
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

  // Pins + names: member cities (with this view's role counts) and, for FREE
  // members, dim Premium hubs.
  useEffect(() => {
    const g = gRef.current; if (!g) return;
    const live = cities.filter((ct) => ct._cnt > 0);
    g.pointsData([
      ...live.map((ct) => ({ ref: ct, name: ct.name, label: cityLabel(ct.name, language), coord: ct.coord, count: ct._cnt })),
      ...lockedHubs.map((h) => ({ ref: h, name: h.name, label: cityLabel(h.name, language), coord: h.coord, locked: true })),
    ]);
    const top = [...live].sort((a, b) => b._cnt - a._cnt).slice(0, 14);
    g.htmlElementsData([
      ...top.map((ct) => ({ ref: ct, coord: ct.coord, text: cityLabel(ct.name, language), alt: pinAlt(ct._cnt) + 0.004 })),
      ...zones.filter((z) => z._cnt > 0).map((z) => ({ ref: z, zone: true, coord: z.coord, text: `${z.name} · ${z._cnt}`, alt: 0.02 })),
    ]);
    wakeRef.current();
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
    selRef.current = { key: selectedKey, features: new Set(list) };
    repaintRef.current();
    wakeRef.current();
  }, [selectedKey, selectedFeature]);

  return <div ref={elRef} className="absolute inset-0" style={{ cursor: 'grab' }} />;
});

Globe3DStage.displayName = 'Globe3DStage';
export default Globe3DStage;
