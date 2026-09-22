import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { chartTheme, tipShellStyle, tipHeader, tipRow, tipDivider, type EChartsOption } from '../charts/chartOptions';
import { useIsDark } from '../lib/useIsDark';
import { EChart } from './EChart';
import type { BvafBundle } from '../data/useFpaData';

// Budget vs Actual vs Forecast — a chart/pivot hybrid. The bar chart and the
// table live in ONE fixed-layout table inside one scroll container, so each
// month's bars sit exactly over that month's Budget/Actual/Var columns and
// they scroll together. The label column is sticky — programs at the root,
// trials and cost categories nested beneath by indentation; the chart's
// y-axis labels render in the sticky area too.
const COL_W = 74;                 // one value column ("Forecast" header must fit)
const GROUP_W = COL_W * 3;        // Budget | Actual/Forecast | Var
const LABEL_W = 280;              // sticky Program / Trial column
const CHART_H = 200;
const CHART_TOP = 10;             // ECharts grid top — used to place y labels

// Budget takes the theme's primary category hue (near-black purple in light,
// bright purple in dark); Actual/Forecast hues carry across both themes.
const seriesC = () => ({ budget: chartTheme().catPrimary, actual: '#9BE8E8', forecast: '#FCC17C' });
const LD_FONT = 'Inter, sans-serif';
const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMonth = (m: string) => { const [y, mo] = m.split('-'); return `${MONTHS3[Number(mo) - 1]} ${y}`; };
// Dollar-compact: $580K / $1.2M / $437 / $0 — every figure in the grid is money.
const fmtUsdK = (v: number) => {
  const a = Math.abs(v);
  if (a < 0.5) return '$0';
  const s = a < 995 ? `${Math.round(a)}` : a >= 995_000 ? `${(a / 1e6).toFixed(1)}M` : `${Math.round(a / 1e3)}K`;
  return `${v < 0 ? '-' : ''}$${s}`;
};
const usdFull = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString()}`;
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

// Nice round axis ceiling: 4 gridlines, step from the usual money ladder.
const STEPS = [50_000, 100_000, 200_000, 250_000, 400_000, 500_000, 800_000, 1_000_000, 2_000_000, 4_000_000, 8_000_000];
const axisStep = (peak: number) => STEPS.find((s) => s * 4 >= peak) ?? STEPS[STEPS.length - 1];

// House tooltip (same card styling as chartOptions.comboTooltip): month band
// header, swatch rows with full dollars, variance footer colored by direction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bvafTooltip(params: any): string {
  const ps = (Array.isArray(params) ? params : [params]).filter((p) => p.value != null);
  if (!ps.length) return '';
  const T = chartTheme();
  const sw = (c: string) => `<i style="width:9px;height:9px;border-radius:3px;background:${c};display:inline-block;flex:0 0 auto"></i>`;

  let html = `<div style="font-family:${LD_FONT};font-size:12px;min-width:208px">`;
  html += tipHeader(fmtMonth(String(ps[0].axisValue)));
  html += `<div style="padding:6px 0">`;
  for (const p of ps) html += tipRow(sw(p.color), p.seriesName, usdFull(p.value));
  const budget = ps.find((p) => p.seriesName === 'Budget')?.value;
  const spent = (ps.find((p) => p.seriesName === 'Actual') ?? ps.find((p) => p.seriesName === 'Forecast'))?.value;
  if (budget != null && spent != null) {
    const v = spent - budget;
    // same accounting convention as the grid: +$X over (red), ($X) under (green)
    html += tipDivider();
    html += tipRow('', 'Variance', v > 0 ? `+${usdFull(v)}` : `(${usdFull(-v)})`, v > 0 ? T.bad : T.good, true);
  }
  html += `</div></div>`;
  return html;
}

function chartOption(b: BvafBundle, yMax: number): EChartsOption {
  const T = chartTheme();
  const C = seriesC();
  const bar = { type: 'bar' as const, barWidth: Math.round(GROUP_W / 7), itemStyle: { borderRadius: [3, 3, 0, 0] as [number, number, number, number] } };
  return {
    backgroundColor: 'transparent',
    animationDuration: 600,
    textStyle: { fontFamily: LD_FONT },
    grid: { left: 0, right: 0, top: CHART_TOP, bottom: 0 },
    tooltip: {
      trigger: 'axis',
      // escape the scroll container's clipping — the chart row is short and
      // the tooltip would otherwise be cut off at the top of the canvas
      appendToBody: true,
      axisPointer: { type: 'shadow', shadowStyle: { color: T.pointer } },
      ...tipShellStyle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: bvafTooltip as any,
    },
    xAxis: {
      type: 'category', data: b.months,
      axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false },
      splitLine: { show: true, lineStyle: { color: T.tipBorder } },
    },
    yAxis: {
      type: 'value', min: 0, max: yMax, interval: yMax / 4,
      axisLabel: { show: false }, splitLine: { lineStyle: { color: T.grid } },
    },
    series: [
      { ...bar, name: 'Budget', data: b.totals.budget, itemStyle: { ...bar.itemStyle, color: C.budget } },
      // Actual (history) and Forecast (future) never coexist in a month, so
      // stacking them renders one bar per month next to Budget — no gaps.
      { ...bar, name: 'Actual', stack: 'af', data: b.totals.actual, itemStyle: { ...bar.itemStyle, color: C.actual } },
      { ...bar, name: 'Forecast', stack: 'af', data: b.totals.forecast, itemStyle: { ...bar.itemStyle, color: C.forecast } },
    ],
  };
}

export function Bvaf({ data }: { data: BvafBundle }) {
  // Three-level tree: programs start EXPANDED (their trial rows are visible,
  // each carrying a subtotal) and trials start COLLAPSED — category detail is
  // one click away without the grid opening 40+ rows tall. Resets when
  // filters swap the portfolio.
  const [closedProgs, setClosedProgs] = useState<Set<string>>(new Set());
  const [openTrials, setOpenTrials] = useState<Set<string>>(new Set());
  const treeKey = data.programs.map((p) => `${p.program}:${p.studies.map((s) => s.study).join(',')}`).join('|');
  useEffect(() => {
    setClosedProgs(new Set());
    setOpenTrials(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeKey]);
  const M = data.months.length;

  // Open with the actual→forecast seam in view (3 actual months of runway,
  // then the forecast) — that boundary is the story; don't hide it off-screen.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, (data.histCount - 3) * GROUP_W);
  }, [data.histCount]);

  const dark = useIsDark();
  const yMax = useMemo(() => {
    const peak = Math.max(1, ...data.totals.budget, ...data.totals.actual.map((v) => v ?? 0), ...data.totals.forecast.map((v) => v ?? 0));
    return axisStep(peak) * 4;
  }, [data]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const option = useMemo(() => chartOption(data, yMax), [data, yMax, dark]);

  // Subtotals: per trial (sum of categories) and per program (sum of trials).
  const { trialSub, progSub } = useMemo(() => {
    const trialSub = new Map<string, { budget: number[]; spend: number[] }>();
    const progSub = new Map<string, { budget: number[]; spend: number[] }>();
    for (const p of data.programs) {
      const pb = data.months.map(() => 0), ps = data.months.map(() => 0);
      for (const s of p.studies) {
        const budget = data.months.map((_, i) => s.cats.reduce((a, ct) => a + ct.budget[i], 0));
        const spend = data.months.map((_, i) => s.cats.reduce((a, ct) => a + ct.spend[i], 0));
        trialSub.set(s.study, { budget, spend });
        budget.forEach((v, i) => { pb[i] += v; });
        spend.forEach((v, i) => { ps[i] += v; });
      }
      progSub.set(p.program, { budget: pb, spend: ps });
    }
    return { trialSub, progSub };
  }, [data]);

  if (!data.programs.length) return <div className="fc-empty">No studies match these filters.</div>;

  const flip = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    apply(next);
  };

  // y-axis gridline labels, absolutely positioned in the sticky cell to match
  // the chart's plot area (linear from yMax at grid top to 0 at the bottom).
  const plotH = CHART_H - CHART_TOP;
  const yLabels = [4, 3, 2, 1].map((k) => ({
    v: (yMax / 4) * k,
    top: CHART_TOP + (1 - k / 4) * plotH,
  }));

  // One month = one 3-cell group; the group's first cell carries the divider.
  const mStart = (i: number) => (i === data.histCount ? 'bvaf-seam' : 'bvaf-mstart');
  const varTxt = (v: number) => (Math.abs(v) < 0.5 ? '$0' : v > 0 ? `+${fmtUsdK(v)}` : `(${fmtUsdK(-v)})`);
  const varCls = (v: number) => (Math.abs(v) < 0.5 ? '' : v > 0 ? 'is-over' : 'is-under');
  const cells = (budget: number, spend: number, i: number, blankWhenIdle = true) => {
    const idle = blankWhenIdle && Math.abs(budget) < 0.5 && Math.abs(spend) < 0.5;
    const v = spend - budget;
    return (
      <Fragment>
        <td className={mStart(i)} style={num}>{idle ? '–' : fmtUsdK(budget)}</td>
        <td style={num}>{idle ? '–' : fmtUsdK(spend)}</td>
        <td className={`bvaf-var ${idle ? '' : varCls(v)}`} style={num}>{idle ? '–' : varTxt(v)}</td>
      </Fragment>
    );
  };

  return (
    <div className="bvaf-wrap">
      <div className="bvaf-legend">
        <span><i style={{ background: seriesC().budget }} />Budget</span>
        <span><i style={{ background: seriesC().actual }} />Actual</span>
        <span><i style={{ background: seriesC().forecast }} />Forecast</span>
      </div>
      <div className="bvaf-scroll" ref={scrollRef}>
        <table className="bvaf" style={{ width: LABEL_W + M * GROUP_W }}>
          <colgroup>
            <col style={{ width: LABEL_W }} />
            {data.months.map((m) => (
              <Fragment key={m}>
                <col style={{ width: COL_W }} /><col style={{ width: COL_W }} /><col style={{ width: COL_W }} />
              </Fragment>
            ))}
          </colgroup>
          <tbody>
            <tr className="bvaf-chartrow">
              <td className="bvaf-sticky bvaf-axis">
                <span className="bvaf-axis__name">Spend ($)</span>
                {yLabels.map((l) => (
                  <span key={l.v} className="bvaf-axis__tick" style={{ ...num, top: l.top }}>{l.v.toLocaleString()}</span>
                ))}
              </td>
              <td className="bvaf-chartcell" colSpan={3 * M}>
                <div style={{ width: M * GROUP_W, height: CHART_H }}><EChart option={option} height={CHART_H} /></div>
              </td>
            </tr>
            <tr className="bvaf-months">
              <td className="bvaf-sticky" />
              {data.months.map((m, i) => (
                <th key={m} colSpan={3} className={mStart(i)}>{fmtMonth(m)}</th>
              ))}
            </tr>
            <tr className="bvaf-cols">
              <th className="bvaf-sticky">Program / Trial</th>
              {data.months.map((m, i) => (
                <Fragment key={m}>
                  <th className={mStart(i)}>Budget</th>
                  <th>{i < data.histCount ? 'Actual' : 'Forecast'}</th>
                  <th>Var</th>
                </Fragment>
              ))}
            </tr>
            {data.programs.map((p) => {
              const ps = progSub.get(p.program)!;
              return (
                <Fragment key={p.program}>
                  <tr className="bvaf-prog">
                    <td className="bvaf-sticky">
                      <button className="bvaf-toggle" title={closedProgs.has(p.program) ? 'Expand program' : 'Collapse program'} onClick={() => flip(closedProgs, p.program, setClosedProgs)}>
                        <span className={`bvaf-mark bvaf-mark--prog${closedProgs.has(p.program) ? ' is-closed' : ''}`} />{p.program}
                      </button>
                    </td>
                    {data.months.map((_, i) => <Fragment key={i}>{cells(ps.budget[i], ps.spend[i], i)}</Fragment>)}
                  </tr>
                  {!closedProgs.has(p.program) && p.studies.map((s) => {
                    const sub = trialSub.get(s.study)!;
                    return (
                      <Fragment key={s.study}>
                        <tr className="bvaf-group">
                          <td className="bvaf-sticky bvaf-trial">
                            <button className="bvaf-toggle bvaf-toggle--trial" title={openTrials.has(s.study) ? 'Collapse trial' : 'Expand trial'} onClick={() => flip(openTrials, s.study, setOpenTrials)}>
                              <span className={`bvaf-mark bvaf-mark--trial${openTrials.has(s.study) ? '' : ' is-closed'}`} />{s.study}
                            </button>
                          </td>
                          {data.months.map((_, i) => <Fragment key={i}>{cells(sub.budget[i], sub.spend[i], i)}</Fragment>)}
                        </tr>
                        {openTrials.has(s.study) && s.cats.map((ct) => (
                          <tr key={ct.cat} className="bvaf-row">
                            <td className="bvaf-sticky bvaf-cat">{ct.cat}</td>
                            {data.months.map((_, i) => <Fragment key={i}>{cells(ct.budget[i], ct.spend[i], i)}</Fragment>)}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
            <tr className="bvaf-grand">
              <td className="bvaf-sticky">Portfolio total</td>
              {data.months.map((_, i) => (
                <Fragment key={i}>
                  {cells(data.totals.budget[i], (data.totals.actual[i] ?? data.totals.forecast[i]) ?? 0, i, false)}
                </Fragment>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
