// ECharts option builders — port of embed-app/src/lib/chartOptions.ts with one
// structural change: THEME AWARENESS. Canvas charts can't read CSS variables,
// so every builder (and tooltip formatter) resolves a palette from the current
// light/dark theme at call time via chartTheme(). Components re-render on
// theme flips (useIsDark), which rebuilds the options.
import { computeIsDark } from '../lib/useIsDark';

// Vendored ECharts has no bundled types — options are structurally typed.
export type EChartsOption = Record<string, any>;

// Canonical category display order (short names).
export const CATEGORY_ORDER = ['Direct fees', 'Pass-throughs', 'Investigator', 'OCC'];

export type ComboData = {
  months: string[];
  categories: string[];
  histCount?: number;
  expense: Record<string, Record<string, { actual: number; forecast: number }>>;
  enrollment: Record<string, { actual: number; forecast: number }>;
};

// ---- theme ------------------------------------------------------------------ //
const LIGHT = {
  text: '#15161B', text2: '#3a3a48', muted2: '#5a5a68', muted: '#7a7a8c', axis: '#9a9aa8',
  grid: '#EEEDF4', axisLine: '#D9D9E3', tick: '#C9C9D4', yearRow: '#5a5a6c', yearFc: '#E11D48',
  card: '#fff', tipHeadBg: '#F6F5FB', tipBorder: '#ECEBF3', tipDivider: '#F1F0F7',
  shadow: 'rgba(20,22,40,0.16)', pointer: 'rgba(114,98,255,0.07)',
  zoomBorder: '#ECEBF3', handle: '#fff', moveHandle: '#C9C5D4',
  seam: '#B7B2D6', seamText: '#7a74a8', enroll: '#111111', enrollBand: 'rgba(114,98,255,0.20)',
  chipPastBg: '#15161B', chipPastFg: '#fff', chipFutBg: '#ECE9FC', chipFutFg: '#6E5BFF',
  chipProjBg: '#FCEFD8', chipProjFg: '#B45309', pastLine: '#9a97a8', projLine: '#E0A94F',
  good: '#138a5e', bad: '#c0392b', amber: '#C98A2D',
  gapUnder: 'rgba(19,138,94,0.09)', gapOver: 'rgba(192,57,43,0.09)',
  budgetBar: '#E3E1EA', catPrimary: '#3F2784',
  actual: {
    'Direct fees': '#3F2784', 'Pass-throughs': '#9BE8E8', 'Investigator': '#FCC17C', 'OCC': '#EC6E52',
  } as Record<string, string>,
  forecast: {
    'Direct fees': '#BDB6EC', 'Pass-throughs': '#DCF6F6', 'Investigator': '#FDE9CB', 'OCC': '#FAD3CA',
  } as Record<string, string>,
};
const DARK: typeof LIGHT = {
  // Neutral-gray surfaces and identical series hues, matching how native
  // Lightdash dark mode treats charts (its --chart-1..9 palette is the SAME in
  // both themes; only chrome adapts). The one exception: the brand's
  // near-black purple gets a modest lightness lift so it doesn't sink into the
  // dark card — same hue, muted, NOT the vivid app purple.
  text: '#ECECEF', text2: '#C9C9CE', muted2: '#A5A5AD', muted: '#8F8F98', axis: '#7C7C85',
  grid: '#2A2A2F', axisLine: '#3A3A41', tick: '#4A4A52', yearRow: '#A5A5AD', yearFc: '#FB7185',
  card: '#1F1F23', tipHeadBg: '#26262B', tipBorder: '#323238', tipDivider: '#2E2E33',
  shadow: 'rgba(0,0,0,0.5)', pointer: 'rgba(139,125,255,0.08)',
  zoomBorder: '#323238', handle: '#2A2A2F', moveHandle: '#4A4A52',
  // Enrollment gets its own hot-pink treatment on dark — the near-white line
  // disappeared against the light forecast tints, and nothing else in the
  // chart is pink, so both lines + the confidence band read instantly.
  seam: '#66627F', seamText: '#A29BC7', enroll: '#F97BC0', enrollBand: 'rgba(249,123,192,0.20)',
  chipPastBg: '#ECECEF', chipPastFg: '#15161B', chipFutBg: '#2B2842', chipFutFg: '#B7ABFF',
  chipProjBg: '#3A2F1A', chipProjFg: '#F0C070', pastLine: '#6A6A75', projLine: '#C89546',
  good: '#2FBF87', bad: '#FF7A68', amber: '#E8B265',
  gapUnder: 'rgba(47,191,135,0.13)', gapOver: 'rgba(255,122,104,0.12)',
  budgetBar: '#3A3A41', catPrimary: '#53409E',
  actual: {
    'Direct fees': '#53409E', 'Pass-throughs': '#9BE8E8', 'Investigator': '#FCC17C', 'OCC': '#EC6E52',
  } as Record<string, string>,
  forecast: {
    // Forecast = the actual hue mixed toward the dark card (dimmer, same hue).
    'Direct fees': '#37315E', 'Pass-throughs': '#3F5B5D', 'Investigator': '#5F5138', 'OCC': '#5C3D35',
  } as Record<string, string>,
};
export const chartTheme = () => (computeIsDark() ? DARK : LIGHT);

const LD_FONT = 'Inter, system-ui, sans-serif';

// "2023-01" -> "Jan '23", "2024-Q1" -> "Q1 '24"
const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthTick(v: string): string {
  const q = /^(\d{4})-Q([1-4])/.exec(v);
  if (q) return `Q${q[2]} '${q[1].slice(2)}`;
  const m = /^(\d{4})-(\d{2})/.exec(v);
  if (!m) return v;
  return `${MONTHS3[+m[2] - 1]} '${m[1].slice(2)}`;
}

// Short label for the top axis row: "2023-01" -> "Jan", "2024-Q1" -> "Q1".
function shortTick(v: string): string {
  const q = /^(\d{4})-Q([1-4])/.exec(v);
  if (q) return `Q${q[2]}`;
  const m = /^(\d{4})-(\d{2})/.exec(v);
  if (m) return MONTHS3[+m[2] - 1];
  return v;
}
const isYearStart = (v: string) => /^\d{4}-(01|Q1)\b/.test(v) || /^\d{4}$/.test(v);
const yearTick = (v: string) => { const m = /^(\d{4})/.exec(v); return m ? `'${m[1].slice(2)}` : ''; };

const MONTH_ROTATE = -90;
const YEAR_ROW_OFFSET = 40;

// Second x-axis row: prints the year once, at each year boundary, bold.
// Forecast-year boundaries (in redSet) render in the alert hue.
function yearRowAxis(labels: string[], redSet?: Set<string>) {
  const T = chartTheme();
  return {
    type: 'category' as const,
    data: labels,
    position: 'bottom' as const,
    offset: YEAR_ROW_OFFSET,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      interval: 0,
      margin: 4,
      formatter: (v: string, i: number) =>
        i === 0 || isYearStart(v) ? (redSet?.has(v) ? `{fc|${yearTick(v)}}` : `{yr|${yearTick(v)}}`) : '',
      rich: {
        yr: { color: T.yearRow, fontWeight: 700, fontSize: 11 },
        fc: { color: T.yearFc, fontWeight: 700, fontSize: 11 },
      },
    },
  };
}

// Bottom time-scrubber (see embed chartOptions for the full design notes: the
// slider is transparent and a hidden mini-replica grid is the data shadow).
const ZOOM_H = 52;
const ZOOM_BOTTOM = 10;
const GRID_L = 92;
const GRID_R = 84;
const AXIS_LABEL_H = 72;
const GRID_BOTTOM = ZOOM_BOTTOM + ZOOM_H + AXIS_LABEL_H;

function timeZoom(): NonNullable<EChartsOption['dataZoom']> {
  const T = chartTheme();
  return [
    {
      type: 'slider', xAxisIndex: [0, 1], filterMode: 'none',
      left: GRID_L, right: GRID_R, bottom: ZOOM_BOTTOM, height: ZOOM_H,
      brushSelect: false, showDetail: false, showDataShadow: false,
      backgroundColor: 'rgba(0,0,0,0)', borderColor: T.zoomBorder,
      fillerColor: 'rgba(114,98,255,0.10)',
      handleStyle: { color: T.handle, borderColor: '#7262FF', borderWidth: 1.5 },
      moveHandleStyle: { color: T.moveHandle },
    },
  ];
}

function miniGrid() {
  return { left: GRID_L, right: GRID_R, bottom: ZOOM_BOTTOM, height: ZOOM_H };
}
function miniXAxis(labels: string[]) {
  return {
    type: 'category' as const, gridIndex: 1, data: labels, silent: true,
    axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
    splitLine: { show: false }, axisPointer: { show: false },
  };
}
function miniYAxes(spendMin: number, spendMax: number, patMin: number, patMax: number) {
  const hidden = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } };
  return [
    { type: 'value' as const, gridIndex: 1, min: spendMin, max: spendMax, ...hidden },
    { type: 'value' as const, gridIndex: 1, min: patMin, max: patMax, ...hidden },
  ];
}

function miniSeriesOf(series: any[]): any[] {
  return series.map((s: any) => ({
    ...s,
    name: undefined,
    xAxisIndex: 2,
    yAxisIndex: s.yAxisIndex === 1 ? 3 : 2,
    stack: s.stack ? `mini:${s.stack}` : undefined,
    silent: true,
    animation: false,
    legendHoverLink: false,
    z: 1,
    ...(s.type === 'line'
      ? { lineStyle: { ...s.lineStyle, width: 1 } }
      : { itemStyle: { ...s.itemStyle, borderRadius: 0 } }),
  }));
}

const usdAxis = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}k`;
  return `${sign}$${a}`;
};
const usdFull = (v: number) => `${v < 0 ? '-' : ''}$${Math.round(Math.abs(v)).toLocaleString()}`;

// Shared tooltip chrome + row builders (theme-resolved at render time). Also
// used by Bvaf's tooltip.
export function tipShellStyle() {
  const T = chartTheme();
  return {
    backgroundColor: T.card, borderColor: T.tipBorder, borderWidth: 1, padding: 0,
    extraCssText: `border-radius:10px;box-shadow:0 10px 30px ${T.shadow};overflow:hidden`,
    textStyle: { color: T.text, fontFamily: LD_FONT, fontSize: 12 },
  };
}
export function tipHeader(text: string) {
  const T = chartTheme();
  return `<div style="padding:8px 12px;font-weight:700;font-size:12.5px;color:${T.text};background:${T.tipHeadBg};border-bottom:1px solid ${T.tipBorder}">${text}</div>`;
}
export function tipRow(mark: string, name: string, val: string, valColor?: string, strong = false) {
  const T = chartTheme();
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;padding:3px 12px">
     <span style="display:flex;align-items:center;gap:8px;color:${T.text2}">${mark}${name}</span>
     <span style="font-weight:${strong ? 700 : 600};font-variant-numeric:tabular-nums;color:${valColor ?? T.text}">${val}</span>
   </div>`;
}
export const tipDivider = () => `<div style="height:1px;background:${chartTheme().tipDivider};margin:5px 12px"></div>`;

// Organized tooltip: month header, non-zero spend categories + total, then
// enrollment counts.
function comboTooltip(params: any[]): string {
  if (!params?.length) return '';
  const T = chartTheme();
  const header = monthTick(String(params[0].axisValue));
  const skip = (n: string) => n === 'lo' || n === 'CI band' || n === 'loE' || n === 'EnrCI band';
  const bars = params.filter((p) => p.seriesType === 'bar' && Math.abs(p.value ?? 0) > 0.5);
  const lines = params.filter((p) => p.seriesType === 'line' && p.value != null && !skip(p.seriesName));
  const total = bars.reduce((s, p) => s + (p.value ?? 0), 0);

  const sw = (c: string) => `<i style="width:9px;height:9px;border-radius:3px;background:${c};display:inline-block;flex:0 0 auto"></i>`;
  const dash = (c: string, dotted: boolean) =>
    `<i style="width:13px;height:0;border-top:2px ${dotted ? 'dotted' : 'solid'} ${c};display:inline-block;flex:0 0 auto"></i>`;

  let html = `<div style="font-family:${LD_FONT};font-size:12px;min-width:208px">`;
  html += tipHeader(header);
  html += `<div style="padding:6px 0">`;
  if (bars.length) {
    for (const p of bars) html += tipRow(sw(p.color), p.seriesName.replace(/ – [AF]$/, (m: string) => `<span style="color:${T.axis}"> ${m.slice(2)}</span>`), usdFull(p.value));
    html += tipDivider();
    html += tipRow('', 'Total spend', usdFull(total), undefined, true);
  }
  if (lines.length) {
    if (bars.length) html += tipDivider();
    for (const p of lines) {
      const dotted = /forecast/i.test(p.seriesName);
      html += tipRow(dash(p.color, dotted), p.seriesName, `${Math.round(p.value)}`);
    }
  }
  html += `</div></div>`;
  return html;
}
const niceUp = (x: number, step: number) => Math.max(step, Math.ceil(x / step) * step);

export const catColor = (cat: string) => chartTheme().actual[cat] ?? '#C9C5D4';

// Forecast lab combo: Actuals-only history with the model's projection —
// per-category stacked bars + a model enrolment line + total-spend CI band.
export type ForecastComboInput = {
  cats: string[];
  histLabels: string[];
  futureLabels: string[];
  actualByCat: Record<string, number[]>;
  forecastByCat: Record<string, number[]>;
  enrollActual: number[];
  enrollForecast: number[];
  enrollBand: { lower: number[]; upper: number[] };
  spendMaxFixed?: number;
  patMaxFixed?: number;
};

export function forecastComboOption(p: ForecastComboInput): EChartsOption {
  const T = chartTheme();
  const labels = [...p.histLabels, ...p.futureLabels];
  const futureSet = new Set(p.futureLabels);
  const H = p.histLabels.length, F = p.futureLabels.length;
  const nulls = (n: number) => new Array(n).fill(null) as (number | null)[];
  const seamEnroll = p.enrollActual[H - 1] ?? 0;

  const spendMax = p.spendMaxFixed ?? 2_200_000;
  const spendMin = -Math.round(spendMax / 5);
  const zeroFrac = (0 - spendMin) / (spendMax - spendMin);

  const patPeak = Math.max(1, ...p.enrollActual, ...p.enrollForecast, ...p.enrollBand.upper);
  const patMax = p.patMaxFixed ?? Math.max(10, Math.ceil((patPeak * 1.12) / 5) * 5);
  const patMin = -Math.round((patMax * zeroFrac) / (1 - zeroFrac));
  const clampP = (v: number) => Math.max(patMin, Math.min(patMax, v));

  const barSeries = [
    ...p.cats.map((cat) => ({
      name: `${cat} – A`, type: 'bar' as const, stack: 'expense', z: 2,
      itemStyle: { color: T.actual[cat], borderColor: 'transparent', borderWidth: 1, borderRadius: 2 },
      data: [...p.actualByCat[cat], ...nulls(F)],
    })),
    ...p.cats.map((cat) => ({
      name: `${cat} – F`, type: 'bar' as const, stack: 'expense', z: 2,
      itemStyle: { color: T.forecast[cat], borderColor: 'transparent', borderWidth: 1, borderRadius: 2 },
      data: [...nulls(H), ...p.forecastByCat[cat]],
    })),
  ];

  // Enrolment confidence band wraps the dotted enrolment forecast line.
  const bandSeries = [
    { name: 'lo', type: 'line' as const, smooth: true, yAxisIndex: 1, stack: 'ci', z: 3, silent: true, symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, data: [...nulls(H - 1), seamEnroll, ...p.enrollBand.lower.map(clampP)] },
    { name: 'CI band', type: 'line' as const, smooth: true, yAxisIndex: 1, stack: 'ci', z: 3, silent: true, symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: T.enrollBand }, data: [...nulls(H - 1), 0, ...p.enrollBand.upper.map((u, i) => clampP(u) - clampP(p.enrollBand.lower[i]))] },
  ];

  const zone = {
    name: 'zone', type: 'line' as const, data: nulls(labels.length), silent: true, symbol: 'none', lineStyle: { opacity: 0 }, z: 0,
    markLine: {
      symbol: 'none', silent: true,
      lineStyle: { color: T.seam, type: 'dashed' as const, width: 1.5 },
      label: { show: true, formatter: 'Forecast →', position: 'insideEndTop' as const, color: T.seamText, fontSize: 10, fontWeight: 700 },
      data: [{ xAxis: p.futureLabels[0] }] as any,
    },
  };

  const lineSeries = [
    { name: 'Enrolled patients', type: 'line' as const, smooth: true, yAxisIndex: 1, z: 4, symbol: 'none', connectNulls: true, lineStyle: { width: 2, color: T.enroll }, itemStyle: { color: T.enroll }, data: [...p.enrollActual.map((v) => (v == null ? null : v)), ...nulls(F)] },
    { name: 'Enrolled patients (forecast)', type: 'line' as const, smooth: true, yAxisIndex: 1, z: 4, symbol: 'none', connectNulls: true, lineStyle: { width: 2, color: T.enroll, type: 'dotted' as const }, itemStyle: { color: T.enroll }, data: [...nulls(H - 1), seamEnroll, ...p.enrollForecast] },
  ];

  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: LD_FONT },
    animationDuration: 900,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 18,
    animationDurationUpdate: 550,
    animationEasingUpdate: 'cubicInOut',
    animationDelayUpdate: (idx: number) => idx * 6,
    grid: [
      { left: GRID_L, right: GRID_R, top: 64, bottom: GRID_BOTTOM, containLabel: false },
      miniGrid(),
    ],
    dataZoom: timeZoom(),
    legend: {
      top: 6, left: 8, right: 8,
      data: [
        ...p.cats.map((c) => ({ name: `${c} – A`, icon: 'roundRect' })),
        { name: 'Enrolled patients' }, { name: 'Enrolled patients (forecast)' },
      ],
      formatter: (name: string) => name.replace(/ – A$/, ''),
      selectedMode: false,
      textStyle: { fontFamily: LD_FONT, fontSize: 11, color: T.muted2 },
      itemWidth: 14, itemHeight: 9, itemGap: 14,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: T.pointer } },
      ...tipShellStyle(),
      formatter: comboTooltip as any,
    },
    xAxis: [
      {
        type: 'category', data: labels,
        axisLabel: { fontSize: 11, fontWeight: 500, fontFamily: LD_FONT, color: T.muted, formatter: shortTick, margin: 8, rotate: MONTH_ROTATE, hideOverlap: true },
        axisTick: { show: true, alignWithLabel: true, length: 4, lineStyle: { color: T.tick, width: 1 } },
        axisLine: { onZero: false, lineStyle: { color: T.axisLine, width: 1 } },
      },
      yearRowAxis(labels, futureSet),
      miniXAxis(labels),
    ],
    yAxis: [
      {
        type: 'value', name: 'Monthly spend ($)', min: spendMin, max: spendMax, interval: spendMax / 10,
        nameLocation: 'middle', nameGap: 66, nameTextStyle: { fontSize: 11, color: T.muted },
        axisLabel: { fontSize: 10, color: T.axis, formatter: usdAxis }, splitLine: { lineStyle: { color: T.grid } },
      },
      {
        type: 'value', name: 'Patient count', min: patMin, max: patMax, interval: (patMax - patMin) / 12,
        nameLocation: 'middle', nameGap: 52, nameTextStyle: { fontSize: 11, color: T.muted },
        axisLabel: { fontSize: 10, color: T.axis, formatter: (v: number) => `${Math.round(v)}` }, splitLine: { show: false },
      },
      ...miniYAxes(spendMin, spendMax, patMin, patMax),
    ],
    series: [zone, ...bandSeries, ...barSeries, ...lineSeries, ...miniSeriesOf([...bandSeries, ...barSeries, ...lineSeries])],
  };
}

// ---- Milestone forecast ----------------------------------------------------
export type MilestoneInput = {
  labels: string[];
  histIdx: number;
  actual: (number | null)[];
  forecast: (number | null)[];
  budget: (number | null)[];
  milestones: { label: string; x: string; past: boolean; proj?: boolean }[];
  eac?: number;
  budgetTotal?: number;
  yearRow?: boolean;
};

const MF_ACTUAL = '#7262FF';
const MF_FORECAST = '#2FD3C5';
const MF_BUDGET = '#FCC17C';

const mUsd = (v: number) => (v === 0 ? '0' : Math.abs(v) >= 1e6 ? `$${+(v / 1e6).toFixed(1)}M` : usdAxis(v));

function milestoneTooltip(params: any[]): string {
  if (!params?.length) return '';
  const T = chartTheme();
  const header = monthTick(String(params[0].axisValue));
  const dash = (c: string, dotted: boolean) =>
    `<i style="width:14px;height:0;border-top:2.5px ${dotted ? 'dashed' : 'solid'} ${c};display:inline-block;flex:0 0 auto"></i>`;
  let html = `<div style="font-family:${LD_FONT};font-size:12px;min-width:190px">`;
  html += tipHeader(header);
  html += `<div style="padding:6px 0">`;
  for (const p of params) {
    if (p.value == null || String(p.seriesName).startsWith('gap')) continue;
    html += tipRow(dash(p.color, p.seriesName === 'Forecasted'), p.seriesName, usdFull(p.value));
  }
  const bud = params.find((q) => q.seriesName === 'Budgeted')?.value;
  const spd = (params.find((q) => q.seriesName === 'Actual') ?? params.find((q) => q.seriesName === 'Forecasted'))?.value;
  if (bud != null && spd != null) {
    const v = spd - bud;
    html += tipDivider();
    html += tipRow('', 'vs budget', v > 0 ? '+' + usdFull(v) : '(' + usdFull(-v) + ')', v > 0 ? T.bad : T.good, true);
  }
  html += `</div></div>`;
  return html;
}

export function milestoneOption(p: MilestoneInput): EChartsOption {
  const T = chartTheme();
  const futureSet = new Set(p.labels.slice(p.histIdx + 1));

  // Divergence shading between Budgeted and Forecasted in the forecast region.
  const both = (i: number) => p.budget[i] != null && p.forecast[i] != null && i >= p.histIdx;
  const gapBase = p.labels.map((_, i) => (both(i) ? Math.min(p.budget[i]!, p.forecast[i]!) : null));
  const gapUnder = p.labels.map((_, i) => (both(i) ? (p.budget[i]! >= p.forecast[i]! ? p.budget[i]! - p.forecast[i]! : 0) : null));
  const gapOver = p.labels.map((_, i) => (both(i) ? (p.forecast[i]! > p.budget[i]! ? p.forecast[i]! - p.budget[i]! : 0) : null));
  const gapSeries = (name: string, data: (number | null)[], color?: string) => ({
    name, type: 'line' as const, stack: 'gap', silent: true, symbol: 'none', z: 1,
    lineStyle: { opacity: 0 }, areaStyle: { color: color ?? 'rgba(0,0,0,0)', opacity: color ? 1 : 0 },
    emphasis: { disabled: true }, data,
  });

  const delta = (p.eac ?? 0) - (p.budgetTotal ?? 0);
  const endLabel = (text: string, color: string, dy = 0) => ({
    show: true, formatter: text, distance: 8, fontFamily: LD_FONT, fontSize: 11,
    fontWeight: 700 as const, color, lineHeight: 16, offset: [0, dy] as [number, number],
  });
  const line = (name: string, color: string, data: (number | null)[], opts: { dashed?: boolean; width?: number } = {}) => ({
    name, type: 'line' as const, symbol: 'none', connectNulls: false, z: 4,
    lineStyle: { width: opts.width ?? 2.5, color, type: (opts.dashed ? 'dashed' : 'solid') as 'dashed' | 'solid' },
    itemStyle: { color },
    emphasis: { focus: 'series' as const },
    data,
  });

  const marks = {
    name: 'ms', type: 'line' as const, data: p.labels.map(() => null), silent: true,
    symbol: 'none', lineStyle: { opacity: 0 }, z: 2, tooltip: { show: false },
    markLine: {
      symbol: 'none', silent: true,
      data: p.milestones.map((m) => ({
        xAxis: m.x,
        lineStyle: { color: m.proj ? T.projLine : m.past ? T.pastLine : MF_ACTUAL, type: 'dashed' as const, width: 1.2 },
        label: {
          show: true, position: 'end' as const, distance: 7, formatter: m.label,
          backgroundColor: m.proj ? T.chipProjBg : m.past ? T.chipPastBg : T.chipFutBg,
          color: m.proj ? T.chipProjFg : m.past ? T.chipPastFg : T.chipFutFg,
          fontWeight: 700, fontSize: 11, fontFamily: LD_FONT,
          padding: [4, 8] as [number, number], borderRadius: 5,
        },
      })),
    },
  };

  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: LD_FONT },
    animationDuration: 700,
    animationEasing: 'cubicOut',
    grid: { left: 70, right: 128, top: 78, bottom: p.yearRow === false ? 40 : 72, containLabel: false },
    legend: {
      top: 6, left: 8,
      data: ['Actual', 'Forecasted', 'Budgeted'],
      selectedMode: false,
      textStyle: { fontFamily: LD_FONT, fontSize: 11.5, color: T.muted2 },
      itemWidth: 18, itemHeight: 10, itemGap: 18,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(114,98,255,0.35)' } },
      ...tipShellStyle(),
      formatter: milestoneTooltip as any,
    },
    xAxis: (() => {
      const yearly = p.yearRow === false;
      const yr = yearRowAxis(p.labels, futureSet);
      return [
        {
          type: 'category' as const, data: p.labels, boundaryGap: false,
          axisLabel: {
            fontSize: 11, fontWeight: (yearly ? 600 : 500) as 600 | 500, fontFamily: LD_FONT,
            color: yearly ? T.yearRow : T.muted,
            formatter: yearly ? (v: string) => v : shortTick,
            margin: yearly ? 12 : 8, rotate: yearly ? 0 : MONTH_ROTATE, hideOverlap: true,
          },
          axisTick: { show: !yearly, alignWithLabel: true, length: 4, lineStyle: { color: T.tick, width: 1 } },
          axisLine: { onZero: false, lineStyle: { color: T.axisLine, width: 1 } },
        },
        { ...yr, axisLabel: { ...yr.axisLabel, show: !yearly } },
      ];
    })(),
    yAxis: {
      type: 'value', min: 0,
      axisLabel: { fontSize: 11, color: T.muted, formatter: mUsd },
      splitLine: { lineStyle: { color: T.grid } },
      splitNumber: 4,
    },
    series: [
      marks,
      gapSeries('gapBase', gapBase),
      gapSeries('gapUnder', gapUnder, T.gapUnder),
      gapSeries('gapOver', gapOver, T.gapOver),
      {
        ...line('Budgeted', MF_BUDGET, p.budget),
        ...(p.budgetTotal ? { endLabel: endLabel(`Budget ${mUsd(p.budgetTotal)}`, T.amber, -12) } : {}),
      },
      {
        ...line('Forecasted', MF_FORECAST, p.forecast, { dashed: true }),
        ...(p.eac ? {
          endLabel: endLabel(
            `EAC ${mUsd(p.eac)}\n${delta > 0 ? '+' : '−'}${mUsd(Math.abs(delta))} vs budget`,
            delta > 0 ? T.bad : T.good,
            16,
          ),
        } : {}),
      },
      line('Actual', MF_ACTUAL, p.actual, { width: 3 }),
    ],
  };
}

// Doughnut: expense by category, with the total in the centre.
export function donutOption(
  series: { category: string; value: number }[],
  subtext = 'Total expense',
): EChartsOption {
  const T = chartTheme();
  const total = series.reduce((s, d) => s + d.value, 0);
  const totalLabel = total >= 1e6 ? `$${(total / 1e6).toFixed(1)}M` : `$${Math.round(total / 1e3)}k`;
  return {
    textStyle: { fontFamily: LD_FONT },
    tooltip: {
      trigger: 'item',
      textStyle: { fontFamily: LD_FONT, fontSize: 12 },
      formatter: (p: any) => `${p.name}<br/><b>$${Math.round(p.value).toLocaleString()}</b> (${p.percent}%)`,
    },
    title: {
      text: totalLabel,
      subtext,
      left: 'center',
      top: '42%',
      itemGap: 4,
      textStyle: { fontFamily: LD_FONT, fontSize: 26, fontWeight: 700, color: T.text },
      subtextStyle: { fontFamily: LD_FONT, fontSize: 11, color: T.axis },
    },
    series: [{
      type: 'pie',
      radius: ['60%', '84%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      padAngle: 1.5,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: { borderColor: T.card, borderWidth: 2, borderRadius: 4 },
      emphasis: { scale: true, scaleSize: 6, itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.15)' } },
      data: series.map((d) => ({
        name: d.category,
        value: d.value,
        itemStyle: { color: catColor(d.category) },
      })),
    }],
  };
}

const usdShort = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M`
    : Math.abs(v) >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`;

// Horizontal grouped bars — reused for the CRO-variance and EAC-vs-budget
// cards so they share the combo chart's palette, fonts and gridlines.
// House tooltip for the horizontal bar cards — same chrome and row layout as
// the combo / milestone / BVAF tooltips (header band, swatch rows, tabular
// full-dollar values; signed variance colored by direction).
function hbarTooltip(signed: boolean) {
  return (params: any): string => {
    const ps = (Array.isArray(params) ? params : [params]).filter((p) => p.value != null);
    if (!ps.length) return '';
    const T = chartTheme();
    const sw = (c: string) => `<i style="width:9px;height:9px;border-radius:3px;background:${c};display:inline-block;flex:0 0 auto"></i>`;
    let html = `<div style="font-family:${LD_FONT};font-size:12px;min-width:180px">`;
    html += tipHeader(String(ps[0].name ?? ps[0].axisValue ?? ''));
    html += `<div style="padding:6px 0">`;
    for (const p of ps) {
      const v = Number(p.value ?? 0);
      html += signed
        ? tipRow(sw(p.color), p.seriesName, v >= 0 ? `+${usdFull(v)}` : `−${usdFull(-v)}`, v > 0 ? T.bad : T.good, true)
        : tipRow(sw(p.color), p.seriesName, usdFull(v));
    }
    html += `</div></div>`;
    return html;
  };
}

export function hbarOption(
  categories: string[],
  series: { name: string; color: string; data: number[]; barWidth?: number }[],
  opts: { valueFmt?: (v: number) => string; signed?: boolean } = {},
): EChartsOption {
  const T = chartTheme();
  const fmt = opts.valueFmt ?? usdShort;
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: LD_FONT },
    grid: { left: 8, right: 56, top: 30, bottom: 24, containLabel: true },
    legend: series.length > 1
      ? { top: 4, icon: 'roundRect', itemWidth: 12, itemHeight: 10, textStyle: { fontFamily: LD_FONT, fontSize: 11, color: T.text2 } }
      : { show: false },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: T.pointer } },
      ...tipShellStyle(),
      formatter: hbarTooltip(!!opts.signed) as any,
    },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: T.axis, formatter: (v: number) => fmt(v) },
      splitLine: { lineStyle: { color: T.grid } },
    },
    yAxis: {
      type: 'category', data: categories, inverse: true,
      axisLabel: { fontFamily: LD_FONT, fontSize: 11, color: T.text2 },
      axisLine: { lineStyle: { color: T.tick } }, axisTick: { show: false },
    },
    series: series.map((s) => ({
      name: s.name, type: 'bar' as const, barWidth: s.barWidth ?? 16,
      itemStyle: { color: s.color, borderRadius: 3 },
      data: s.data,
    })),
  };
}
