// Spend pivot — a dynamic pivot table over the governed FP&A facts. Unlike
// the fixed Budget vs Actual vs Forecast grid above it, the viewer chooses
// which fields group the rows, which pivot the columns, and which measures
// show as values (drag fields between shelves in PivotFieldControls). Opens
// on the same layout as the reusable "Spend pivot" viz this widget replaces:
// Program → Cost category rows, Month columns, all three measures.
import { Fragment, useMemo, useState } from 'react';
import { PivotFieldControls } from './PivotFieldControls';
import {
  buildPivot, cellAt, rowTotalAt, DEFAULT_LAYOUT, DIM_LABEL, VAL_LABEL, dimLabelOf,
  type PivotLayout, type PivotNode,
} from '../data/pivot';
import type { PivotFact } from '../data/useFpaData';

const fmtUsdK = (v: number) => {
  const a = Math.abs(v);
  if (a < 0.5) return '$0';
  const s = a < 995 ? `${Math.round(a)}` : a >= 995_000 ? `${(a / 1e6).toFixed(1)}M` : `${Math.round(a / 1e3)}K`;
  return `${v < 0 ? '-' : ''}$${s}`;
};
const usdFull = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString()}`;
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export function PivotTable({ facts }: { facts: PivotFact[] }) {
  const [layout, setLayout] = useState<PivotLayout>(DEFAULT_LAYOUT);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const result = useMemo(() => buildPivot(facts, layout), [facts, layout]);
  const toggle = (key: string) => setClosed((s) => {
    const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n;
  });

  if (!facts.length) return <div className="fc-empty">No spend data matches these filters.</div>;

  const { tree, colTuples, colKeys, grand } = result;
  const { values, cols, rows } = layout;
  const headerRows = values.length > 1 ? 2 : 1;
  const cornerLabel = rows.map((r) => DIM_LABEL[r]).join(' / ') || 'Total';
  const colLabel = (t: string[]) => (t.length ? t.map((v, i) => dimLabelOf(cols[i], v)).join(' / ') : 'All');

  const renderRows = (nodes: PivotNode[]): React.ReactNode => nodes.map((n) => {
    const hasKids = n.children.length > 0;
    const open = !closed.has(n.key);
    return (
      <Fragment key={n.key}>
        <tr className={`pv-row pv-row--d${n.depth}${hasKids ? ' pv-row--group' : ''}`}>
          <td className="pv-sticky" style={{ paddingLeft: 12 + n.depth * 18 }}>
            {hasKids ? (
              <button type="button" className="pv-toggle" onClick={() => toggle(n.key)}>
                <span className={`pv-mark${open ? '' : ' is-closed'}`} />{dimLabelOf(rows[n.depth], n.value)}
              </button>
            ) : (
              <span className="pv-leaf-label">{n.depth < rows.length ? dimLabelOf(rows[n.depth], n.value) : n.value}</span>
            )}
          </td>
          {colTuples.map((_, ci) => (
            <Fragment key={colKeys[ci]}>
              {values.map((v) => {
                const val = cellAt(n.totals, colKeys[ci], v);
                return (
                  <td key={v} className="pv-cell" style={num} title={usdFull(val)}>
                    {Math.abs(val) < 0.5 ? '–' : fmtUsdK(val)}
                  </td>
                );
              })}
            </Fragment>
          ))}
          {values.map((v) => {
            const val = rowTotalAt(n.totals, colKeys, v);
            return (
              <td key={`total-${v}`} className="pv-cell pv-cell--total" style={num} title={usdFull(val)}>
                {Math.abs(val) < 0.5 ? '–' : fmtUsdK(val)}
              </td>
            );
          })}
        </tr>
        {hasKids && open && renderRows(n.children)}
      </Fragment>
    );
  });

  return (
    <div className="pv-wrap">
      <PivotFieldControls layout={layout} onChange={setLayout} />
      {values.length === 0 ? (
        <div className="fc-empty">Drop a measure into Values to see numbers.</div>
      ) : (
        <div className="pv-scroll">
          <table className="pv-table">
            <thead>
              <tr className="pv-head-row">
                <th className="pv-sticky" rowSpan={headerRows}>{cornerLabel}</th>
                {colTuples.map((t, ci) => <th key={colKeys[ci]} colSpan={values.length}>{colLabel(t)}</th>)}
                <th className="pv-head-total" colSpan={values.length} rowSpan={1}>Total</th>
              </tr>
              {headerRows > 1 && (
                <tr className="pv-head-row pv-head-row--vals">
                  {colTuples.map((_, ci) => (
                    <Fragment key={colKeys[ci]}>
                      {values.map((v) => <th key={v}>{VAL_LABEL[v]}</th>)}
                    </Fragment>
                  ))}
                  {values.map((v) => <th key={`t-${v}`} className="pv-head-total">{VAL_LABEL[v]}</th>)}
                </tr>
              )}
            </thead>
            <tbody>
              {renderRows(tree)}
              <tr className="pv-grand">
                <td className="pv-sticky">Grand total</td>
                {colTuples.map((_, ci) => (
                  <Fragment key={colKeys[ci]}>
                    {values.map((v) => {
                      const val = cellAt(grand, colKeys[ci], v);
                      return <td key={v} style={num} title={usdFull(val)}>{fmtUsdK(val)}</td>;
                    })}
                  </Fragment>
                ))}
                {values.map((v) => {
                  const val = rowTotalAt(grand, colKeys, v);
                  return <td key={`t-${v}`} className="pv-cell--total" style={num} title={usdFull(val)}>{fmtUsdK(val)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
