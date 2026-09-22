// Flat world bubble map of trial sites for the Lightdash data app.
//
// Replaces the earlier d3 orthographic "globe". A globe hides half the sites on
// the back hemisphere at any moment and leans on a low-res raster texture that
// never looks crisp — the wrong tool for a global scatter of a few dozen sites.
// This is a full-bleed equirectangular map: a plain rectangle that fills the
// whole widget edge to edge (ocean is a rect under the vector land), every site
// visible at once, crisp at any zoom, and it follows the app's light/dark theme.
// Country outlines come from the bundled 110m world GeoJSON; each governed site
// (useFpaData → fct_site_activity × dim_site) is a bubble at its lat/lon, sized
// by patients enrolled and coloured by status. Scroll to zoom, drag to pan,
// click a leaderboard row to zoom to that site; hover for FP&A detail.
import { useEffect, useMemo, useRef, useState } from 'react';
import { geoTransform, geoPath, geoGraticule10 } from 'd3';
import worldRaw from '../vendor/world-110m.geo.json';
import type { SiteRow } from '../data/useFpaData';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const world = worldRaw as any as { features: any[] };
const GRATICULE = geoGraticule10();

// Status palette matches the leaderboard dots so the two site widgets read as
// one system.
const STATUS_COLOR: Record<string, string> = {
  Active: '#3FBFA3', Enrolling: '#5B8DEF', Pending: '#B9B9C6', Closed: '#8A8A9A', Suspended: '#EC6E52',
};
const colorFor = (s: string) => STATUS_COLOR[s] ?? '#B9B9C6';

const usd = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
};

export type Focus = { id: string; n: number } | null;
type Hover = { row: SiteRow; x: number; y: number } | null;
// Pan/zoom of the map: transform = translate(x,y) scale(k), applied to the map
// group. k=1 is the whole world filling the widget.
type View = { k: number; x: number; y: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

const MAX_K = 8;     // deepest zoom
const FOCUS_K = 3.4; // zoom level a leaderboard fly settles at

// Keep the map from being panned off the container: at scale k the world spans
// k×(w,h), so x/y stay within [dim(1-k), 0].
const clampView = (v: View, w: number, h: number): View => {
  const k = clamp(v.k, 1, MAX_K);
  return { k, x: clamp(v.x, w - k * w, 0), y: clamp(v.y, h - k * h, 0) };
};

// Equirectangular fill, cropped to a populated latitude band so there are no
// squished polar caps (Antarctica / the empty Arctic where no site ever sits).
// Longitude spans the whole globe; latitude is clipped to [LAT_S, LAT_N], and the
// card's aspect is set to that band so the visible world fills the widget edge to
// edge with no vertical stretch. Anything outside the band is clipped by the svg.
const LAT_N = 84;   // top edge — keeps northern Greenland/Siberia, drops the Arctic smear
const LAT_S = -58;  // bottom edge — keeps Tierra del Fuego / NZ, drops Antarctica
const LAT_SPAN = LAT_N - LAT_S;
const MAP_ASPECT = 360 / LAT_SPAN; // width : height for an undistorted band
const lonToX = (lon: number, w: number) => ((lon + 180) / 360) * w;
const latToY = (lat: number, h: number) => ((LAT_N - lat) / LAT_SPAN) * h;

export default function SiteMap({ rows, focus = null }: { rows: SiteRow[]; focus?: Focus }) {
  const sites = useMemo(
    () => rows.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && !(r.lat === 0 && r.lon === 0)),
    [rows],
  );
  const maxEnroll = useMemo(() => Math.max(1, ...sites.map((s) => s.enrolled)), [sites]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const { w, h } = size;
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<Hover>(null);
  const [pulse, setPulse] = useState<{ id: string; n: number } | null>(null);

  const viewRef = useRef(view); viewRef.current = view;
  const rafRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  // Track the container box; the map fills whatever w×h the widget gives it.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Vector geometry (land + graticule) projected to fill the container.
  const { gratPath, countryPaths } = useMemo(() => {
    const proj = geoTransform({
      point(lon: number, lat: number) {
        (this as { stream: { point(x: number, y: number): void } }).stream.point(lonToX(lon, w), latToY(lat, h));
      },
    });
    const path = geoPath(proj);
    return { gratPath: path(GRATICULE) ?? '', countryPaths: world.features.map((f) => path(f) ?? '') };
  }, [w, h]);

  // Site bubbles: same linear projection, drawn as circles. Big first so small
  // ones land on top and stay hoverable.
  const markers = useMemo(() => {
    return sites
      .map((s) => ({ s, x: lonToX(s.lon, w), y: latToY(s.lat, h), r: 3.5 + 9 * Math.sqrt(s.enrolled / maxEnroll) }))
      .sort((a, b) => b.r - a.r);
  }, [sites, w, h, maxEnroll]);

  const animateTo = (target: View) => {
    cancelAnimationFrame(rafRef.current);
    const start = viewRef.current;
    const dk = target.k - start.k, dx = target.x - start.x, dy = target.y - start.y;
    const dur = 720;
    let t0 = 0;
    const step = (ts: number) => {
      if (!t0) t0 = ts;
      const e = easeOutCubic(Math.min(1, (ts - t0) / dur));
      setView({ k: start.k + dk * e, x: start.x + dx * e, y: start.y + dy * e });
      if (ts - t0 < dur) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // Fly + zoom to the site the leaderboard selected, and pulse it. Re-runs on
  // every focus (the nonce bumps) so re-clicking the same row re-flies.
  useEffect(() => {
    if (!focus) return;
    const m = markers.find((mm) => mm.s.id === focus.id);
    if (!m) return;
    const k = FOCUS_K;
    animateTo(clampView({ k, x: w / 2 - k * m.x, y: h / 2 - k * m.y }, w, h));
    setPulse({ id: focus.id, n: focus.n });
    const to = window.setTimeout(() => setPulse(null), 1600);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(to); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Scroll to zoom toward the cursor. Native non-passive listener so we can
  // preventDefault and not scroll the page while pointing at the map.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      const box = el.getBoundingClientRect();
      const cx = e.clientX - box.left, cy = e.clientY - box.top;
      setView((v) => {
        const k2 = clamp(v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, MAX_K);
        const bx = (cx - v.x) / v.k, by = (cy - v.y) / v.k; // world point under the cursor
        return clampView({ k: k2, x: cx - k2 * bx, y: cy - k2 * by }, w, h);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [w, h]);

  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(rafRef.current);
    dragRef.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setHover(null);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setView(clampView({ k: viewRef.current.k, x: d.vx + dx, y: d.vy + dy }, w, h));
  };
  const onUp = () => { dragRef.current = null; };
  const resetView = () => animateTo({ k: 1, x: 0, y: 0 });

  if (!sites.length) return <div className="sitemap sitemap--empty">No geocoded sites for these filters.</div>;

  const k = view.k;
  const groupTransform = `translate(${view.x},${view.y}) scale(${k})`;
  const pulseMarker = pulse ? markers.find((m) => m.s.id === pulse.id) : null;

  return (
    <div className="sitemap" ref={wrapRef} style={{ aspectRatio: MAP_ASPECT }}>
      <svg
        className="sitemap__svg" width={w} height={h}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        onDoubleClick={resetView}
      >
        {/* Ocean fills the whole widget; land + sites ride on top and pan/zoom. */}
        <rect className="sitemap__ocean" x={0} y={0} width={w} height={h} />
        <g transform={groupTransform}>
          <path className="sitemap__grat" d={gratPath} vectorEffect="non-scaling-stroke" />
          {countryPaths.map((d, i) => (
            <path key={i} className="sitemap__land" d={d} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}

          {pulseMarker && (
            <circle
              key={pulse!.n} className="sitemap__pulse"
              cx={pulseMarker.x} cy={pulseMarker.y} r={pulseMarker.r / k}
              stroke={colorFor(pulseMarker.s.status)} vectorEffect="non-scaling-stroke"
            />
          )}

          {markers.map((m) => (
            <circle
              key={m.s.id} className="sitemap__dot"
              cx={m.x} cy={m.y} r={m.r / k}
              fill={colorFor(m.s.status)} strokeWidth={1.2 / k}
              onPointerEnter={(e) => {
                if (dragRef.current) return;
                const box = wrapRef.current!.getBoundingClientRect();
                setHover({ row: m.s, x: e.clientX - box.left, y: e.clientY - box.top });
              }}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </g>
      </svg>

      {hover && (
        <div
          className="sitemap__tip"
          style={{
            left: Math.min(Math.max(8, hover.x + 16), Math.max(8, w - 238)),
            top: Math.min(Math.max(8, hover.y + 16), Math.max(8, h - 150)),
          }}
        >
          <div className="sitemap__tip-name">{hover.row.site}</div>
          <div className="sitemap__tip-sub">{hover.row.pi} · {hover.row.city}, {hover.row.country}</div>
          <div className="sitemap__tip-study">{hover.row.study}</div>
          <div className="sitemap__tip-grid">
            <span>Status</span><b><i style={{ background: colorFor(hover.row.status) }} />{hover.row.status}</b>
            <span>Enrolled</span><b>{hover.row.enrolled.toLocaleString()}</b>
            <span>Visits</span><b>{hover.row.visits.toLocaleString()}</b>
            <span>Payments</span><b>{usd(hover.row.payments)}</b>
          </div>
        </div>
      )}

      <div className="sitemap__hint">Scroll to zoom · drag to pan · click a site below to fly to it</div>
      {k > 1.01 && (
        <button type="button" className="sitemap__reset" onClick={resetView}>Reset view</button>
      )}
      <div className="sitemap__legend">
        {Object.keys(STATUS_COLOR).map((key) => (
          <span key={key}><i style={{ background: STATUS_COLOR[key] }} />{key}</span>
        ))}
        <span className="sitemap__legend-note">○ size = patients enrolled</span>
      </div>
    </div>
  );
}
