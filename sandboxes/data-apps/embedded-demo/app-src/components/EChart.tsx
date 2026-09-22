import { useEffect, useRef } from 'react';
// ECharts isn't in the data-app template's dependency set, so the ESM bundle
// is vendored under src/vendor/ and bundled like any other source file. This
// is the same rendering engine as the embed app (and Lightdash itself), so
// the charts match those pixel-for-pixel.
import * as echarts from '../vendor/echarts';
import type { EChartsOption } from '../charts/chartOptions';

// Thin React wrapper around an ECharts instance — handles init, option
// updates, resize, and an optional click handler.
export function EChart({ option, height = 340, onClick }: {
  option: EChartsOption;
  height?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (params: any) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chart = useRef<any>(null);
  const seriesSig = useRef('');
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chart.current = c;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.on('click', (p: any) => clickRef.current?.(p));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; };
  }, []);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    // Merge when only the data changed so ECharts morphs bars/lines smoothly
    // (respecting animationDurationUpdate); do a full reset when the series
    // SHAPE changes — count or types. Count alone isn't enough: bar→pie keeps
    // one series, and merging would leave the old cartesian axes behind.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (option as any).series;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sig = Array.isArray(s) ? s.map((x: any) => x?.type ?? '?').join(',') : '';
    const structural = sig !== seriesSig.current;
    seriesSig.current = sig;
    c.setOption(option, { notMerge: structural, lazyUpdate: true });
    if (ref.current) ref.current.style.cursor = onClick ? 'pointer' : 'default';
    // The container can be measured as 0×0 at init (e.g. mounted inside a
    // just-opened popup or a message that just appeared); re-measure after the
    // browser lays it out so the chart isn't stuck blank.
    const raf = requestAnimationFrame(() => chart.current?.resize());
    return () => cancelAnimationFrame(raf);
  }, [option, onClick]);

  return <div ref={ref} style={{ width: '100%', height }} />;
}
