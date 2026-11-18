import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Globe from 'globe.gl';
import { MeshPhongMaterial, Color } from 'three';
import { feature } from 'topojson-client';
import { polygonToCells } from 'h3-js';
import worldData from 'world-atlas/countries-110m.json';
import { coordsForCity, normalizeCity } from '../../data/cityCoords';

/**
 * The search globe drawn in WebGL (test: ?globe=3d). It only draws and reports
 * clicks: SearchGlobe keeps every state, panel and control, and calls the
 * handle below to fly or zoom. TORA's look, not a copy: land as a fine dot
 * grid, crimson member pins standing off the surface by how many members a
 * city has, and in Travelling an arc from each member's home to where they go.
 */
// A shape h3 cannot fill (North Korea's 4-point sliver at 1:110m) throws, and
// three-globe then stops drawing every country after it: drop such fragments.
const fillable = (poly) => { try { polygonToCells(poly, 3, true); return true; } catch { return false; } };
const LAND = feature(worldData, worldData.objects.countries).features.map((f) => {
  if (f.geometry.type !== 'MultiPolygon') return fillable(f.geometry.coordinates) ? f : null;
  const polys = f.geometry.coordinates.filter(fillable);
  return polys.length ? { ...f, geometry: { ...f.geometry, coordinates: polys } } : null;
}).filter(Boolean);
const CRIMSON = '#ff3366';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WORLD_ALT = 2.3; // camera distance for the whole globe (globe radii)
const pinAlt = (count) => 0.003 + Math.min(count, 20) * 0.0015;

const Globe3DStage = forwardRef(({ cities, zones, lockedHubs, travelling, selectedKey, selectedFeature, initialCoord, onCity, onCountry, onZone, onLocked }, ref) => {
  const elRef = useRef(null);
  const gRef = useRef(null);
  const labelCull = useRef(() => {});
  const handlers = useRef({});
  handlers.current = { onCity, onCountry, onZone, onLocked };

  useImperativeHandle(ref, () => ({
    // Mobile: aim a little south so the place sits above the bottom sheet.
    flyTo(lng, lat, sheetBelow) {
      const g = gRef.current; if (!g) return;
      g.controls().autoRotate = false;
      const alt = Math.min(g.pointOfView().altitude, 1.1);
      g.pointOfView({ lat: sheetBelow ? lat - 12 * alt : lat, lng, altitude: alt }, 900);
    },
    zoomBy(f) {
      const g = gRef.current; if (!g) return;
      const pov = g.pointOfView();
      g.pointOfView({ ...pov, altitude: Math.max(0.12, Math.min(4, pov.altitude * f)) }, 300);
    },
    resume() { const g = gRef.current; if (g) g.controls().autoRotate = true; },
  }), []);

  // Build once.
  useEffect(() => {
    const el = elRef.current;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const g = Globe({ rendererConfig: { antialias: !coarse, alpha: true, powerPreference: 'high-performance' } })(el)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(false)
      .showGraticules(false)
      .globeMaterial(new MeshPhongMaterial({ color: new Color('#0c0c15'), emissive: new Color('#05050a'), shininess: 6 }))
      .hexPolygonsData(LAND)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.45)
      .hexPolygonUseDots(true)
      .hexPolygonAltitude(0.002)
      .onHexPolygonClick((f) => handlers.current.onCountry?.(f))
      .pointResolution(10)
      .pointLat((p) => p.coord[1]).pointLng((p) => p.coord[0])
      .onPointClick((p) => (p.locked ? handlers.current.onLocked?.(p.name) : handlers.current.onCity?.(p.ref)))
      .pointLabel((p) => `<div style="padding:3px 8px;border-radius:8px;background:rgba(0,0,0,.8);border:1px solid rgba(255,255,255,.12);font:600 11px Inter,sans-serif;color:#fff">${esc(p.name)} <span style="color:rgba(255,255,255,.5)">· ${p.locked ? 'Premium' : p.count}</span></div>`)
      // Names are HTML, not 3D text: crisp and the same size at any zoom.
      .htmlLat((l) => l.coord[1]).htmlLng((l) => l.coord[0]).htmlAltitude((l) => l.alt)
      .htmlElement((l) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.textContent = l.text;
        el.style.cssText = l.zone
          ? 'pointer-events:auto;cursor:pointer;transform:translate(-50%,-50%);padding:4px 11px;border-radius:12px;border:1px solid rgba(255,51,102,.85);background:rgba(7,7,9,.88);color:#fff;font:700 11px Inter,sans-serif;white-space:nowrap'
          : 'pointer-events:auto;cursor:pointer;transform:translate(8px,-50%);padding:0;border:0;background:none;color:rgba(255,255,255,.88);font:600 12px Inter,sans-serif;white-space:nowrap;text-shadow:0 0 3px #040409,0 0 3px #040409';
        el.onclick = (e) => { e.stopPropagation(); if (l.zone) handlers.current.onZone?.(l.ref); else handlers.current.onCity?.(l.ref); };
        el.__coord = l.coord;
        return el;
      })
      .htmlTransitionDuration(0)
      .arcStartLat((a) => a.from[1]).arcStartLng((a) => a.from[0])
      .arcEndLat((a) => a.to[1]).arcEndLng((a) => a.to[0])
      .arcColor(() => ['rgba(255,51,102,0.08)', 'rgba(255,51,102,0.9)'])
      .arcStroke(0.32)
      .arcAltitudeAutoScale(0.38)
      .arcDashLength(0.45).arcDashGap(0.2).arcDashInitialGap(() => Math.random())
      .arcDashAnimateTime(2600);
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    const c = g.controls();
    c.autoRotate = true; c.autoRotateSpeed = 0.35; c.enableDamping = true; c.dampingFactor = 0.08;
    c.addEventListener('start', () => { c.autoRotate = false; });
    // Narrow phone screens need the camera further back to show the sphere's edge.
    const near = el.clientWidth < 600 ? 2.2 : 1.5;
    g.pointOfView(initialCoord ? { lat: initialCoord[1], lng: initialCoord[0], altitude: near } : { lat: 30, lng: 15, altitude: WORLD_ALT }, 0);
    if (initialCoord) c.autoRotate = false;
    gRef.current = g;

    // A name shows only while its city faces the camera: far-side and
    // horizon names would otherwise pile up along the edge of the sphere.
    let raf = 0;
    const cullLabels = () => {
      raf = 0;
      const { lat, lng } = g.pointOfView();
      const toRad = Math.PI / 180;
      for (const el of el_labels()) {
        const [clng, clat] = el.__coord || [0, 0];
        const cos = Math.sin(lat * toRad) * Math.sin(clat * toRad) + Math.cos(lat * toRad) * Math.cos(clat * toRad) * Math.cos((clng - lng) * toRad);
        el.style.visibility = cos > 0.34 ? 'visible' : 'hidden'; // within ~70° of the centre
      }
    };
    const el_labels = () => el.querySelectorAll('button');
    c.addEventListener('change', () => { if (!raf) raf = requestAnimationFrame(cullLabels); });
    labelCull.current = () => { if (!raf) raf = requestAnimationFrame(cullLabels); };

    // Size to the stage; a hidden keep-mounted tab stops rendering entirely.
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) { g.pauseAnimation(); return; }
      g.width(width).height(height); g.resumeAnimation();
    });
    ro.observe(el);
    return () => { ro.disconnect(); g.pauseAnimation(); g._destructor?.(); g.renderer().dispose(); el.innerHTML = ''; gRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins + labels: member cities (with this view's role counts) and, for FREE
  // members, dim Premium hubs. Pins stand off the surface by member count.
  useEffect(() => {
    const g = gRef.current; if (!g) return;
    const live = cities.filter((ct) => ct._cnt > 0);
    const pins = [
      ...live.map((ct) => ({ ref: ct, name: ct.name, coord: ct.coord, count: ct._cnt, sel: ct.key === selectedKey })),
      ...lockedHubs.map((h) => ({ ref: h, name: h.name, coord: h.coord, locked: true })),
    ];
    g.pointsData(pins)
      // Low discs, not towers: close up, tall pins read as sticks lying on the map.
      .pointAltitude((p) => (p.locked ? 0.002 : pinAlt(p.count)))
      .pointRadius((p) => (p.locked ? 0.16 : 0.2 + Math.min(p.count, 20) * 0.012))
      .pointColor((p) => (p.locked ? 'rgba(255,255,255,0.28)' : p.sel ? '#ffffff' : CRIMSON));
    const top = [...live].sort((a, b) => b._cnt - a._cnt).slice(0, 14);
    const labels = [
      ...top.map((ct) => ({ ref: ct, coord: ct.coord, text: ct.name, alt: pinAlt(ct._cnt) + 0.004 })),
      ...zones.filter((z) => z._cnt > 0).map((z) => ({ ref: z, zone: true, coord: z.coord, text: `${z.name} · ${z._cnt}`, alt: 0.02 })),
    ];
    g.htmlElementsData(labels);
    labelCull.current();
  }, [cities, zones, lockedHubs, selectedKey]);

  // Travelling: an arc from each member's home city to their destination.
  useEffect(() => {
    const g = gRef.current; if (!g) return;
    if (!travelling) { g.arcsData([]); return; }
    const arcs = [];
    for (const ct of cities) {
      if (!ct._cnt) continue;
      for (const p of ct.profiles) {
        const home = p._trip?.home && coordsForCity(p._trip.home);
        if (home && normalizeCity(p._trip.home) !== ct.cityKey) arcs.push({ from: home, to: ct.coord });
      }
    }
    g.arcsData(arcs.slice(0, 400));
  }, [cities, travelling]);

  // The selected country (or a zone's countries) lights up in crimson dots.
  useEffect(() => {
    const g = gRef.current; if (!g) return;
    // Matched by name: the panel's country comes from its own copy of the atlas.
    const name = (f) => (f.properties?.name || '').toLowerCase();
    const list = selectedFeature?.features || (selectedFeature ? [selectedFeature] : []);
    const sel = new Set(list.map(name));
    g.hexPolygonColor((f) => (sel.has(name(f)) ? 'rgba(255,51,102,0.85)' : 'rgba(255,255,255,0.20)'));
  }, [selectedFeature]);

  return <div ref={elRef} className="absolute inset-0" style={{ cursor: 'grab' }} />;
});

Globe3DStage.displayName = 'Globe3DStage';
export default Globe3DStage;
