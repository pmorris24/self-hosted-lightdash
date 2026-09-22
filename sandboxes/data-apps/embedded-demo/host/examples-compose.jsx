import React, { useMemo } from 'react';
import { createEmbedClient, LightdashProvider, query, useLightdash } from '@lightdash/query-sdk';
import { sdkStyles } from './useSdk.jsx';
import { ReviewNotes, BudgetDecision } from './ComposeIntro.jsx';

const FILTER_FIELDS = [['programs', 'program_name'], ['phases', 'phase'], ['statuses', 'study_status']];
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);
// Rows may carry short or table-qualified field names.
const pick = (row, name) => row[name] ?? row[`fct_fpa_${name}`] ?? row[Object.keys(row).find(key => key.endsWith(name))];
// The model has rows with no value for some dimensions. They carry no figures, so the examples leave them out.
const named = (rows, field) => (rows || []).filter(row => pick(row, field) != null);
const waiting = text => <span className="examples-state" role="status">{text}</span>;

function QueryScope({ connection, children }) {
  const client = useMemo(() => createEmbedClient(connection), [connection]);
  return <LightdashProvider client={client}>{children}</LightdashProvider>;
}
function useHostFilters(demo) {
  return useMemo(() => FILTER_FIELDS.filter(([key]) => demo.filters[key].length)
    .map(([key, field]) => ({ field, operator: 'equals', value: demo.filters[key] })), [demo.filters]);
}
function Result({ result, children }) {
  if (result.error) return <p className="notice error" role="alert">The query failed: {String(result.error.message || result.error)}</p>;
  if (result.loading && !result.data?.length) return waiting('Running the query…');
  // Old rows stay on screen during a refresh. Dim them so nobody reads them as the new result.
  return <div className="query-result" data-refreshing={result.loading || undefined} aria-busy={result.loading || undefined}>{children}</div>;
}

function QueryTable() {
  const result = useLightdash(query('fct_fpa').dimensions(['phase']).metrics(['eac', 'budget', 'actual_spend']).sorts([{ field: 'phase', direction: 'asc' }]));
  return <Result result={result}><table className="query-table"><thead><tr><th>Phase</th><th>EAC</th><th>Budget</th><th>Actual spend</th></tr></thead>
    <tbody>{named(result.data, 'phase').map((row, index) => <tr key={index}><th scope="row">{String(pick(row, 'phase'))}</th><td>{money(pick(row, 'eac'))}</td><td>{money(pick(row, 'budget'))}</td><td>{money(pick(row, 'actual_spend'))}</td></tr>)}</tbody></table></Result>;
}

function ComboChart({ rows, category }) {
  const width = 640, height = 340, pad = { top: 24, right: 20, bottom: 56, left: 64 };
  const max = Math.max(1, ...rows.flatMap(row => [Number(pick(row, 'eac')) || 0, Number(pick(row, 'budget')) || 0]));
  const band = (width - pad.left - pad.right) / Math.max(1, rows.length);
  const y = value => pad.top + (height - pad.top - pad.bottom) * (1 - (Number(value) || 0) / max);
  const line = rows.map((row, index) => `${index ? 'L' : 'M'}${pad.left + band * (index + .5)},${y(pick(row, 'eac'))}`).join(' ');
  return <svg className="query-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Budget bars and EAC line by ${category}`}>
    {[0, .25, .5, .75, 1].map(step => <g key={step}><line x1={pad.left} x2={width - pad.right} y1={y(max * step)} y2={y(max * step)} className="query-grid"/><text x={pad.left - 8} y={y(max * step) + 4} textAnchor="end">{money(max * step)}</text></g>)}
    {rows.map((row, index) => <g key={index}><rect x={pad.left + band * index + band * .2} width={band * .6} y={y(pick(row, 'budget'))} height={height - pad.bottom - y(pick(row, 'budget'))} className="query-bar"/>
      <text x={pad.left + band * (index + .5)} y={height - pad.bottom + 18} textAnchor="middle">{String(pick(row, category)).slice(0, 18)}</text></g>)}
    <path d={line} className="query-line"/>{rows.map((row, index) => <circle key={index} cx={pad.left + band * (index + .5)} cy={y(pick(row, 'eac'))} r="4" className="query-dot"/>)}
    <g transform={`translate(${pad.left},${height - 14})`}><rect width="10" height="10" className="query-bar"/><text x="16" y="9">Budget</text><circle cx="86" cy="5" r="4" className="query-dot"/><text x="96" y="9">Estimate at completion</text></g>
  </svg>;
}
function ExternalChart() {
  const result = useLightdash(query('fct_fpa').dimensions(['phase']).metrics(['eac', 'budget']).sorts([{ field: 'phase', direction: 'asc' }]));
  return <Result result={result}><ComboChart rows={named(result.data, 'phase')} category="phase"/></Result>;
}
function FilteredWorkspace({ demo }) {
  const filters = useHostFilters(demo);
  const totals = useLightdash(query('fct_fpa').metrics(['eac', 'budget', 'eac_variance']).filters(filters));
  const byProgram = useLightdash(query('fct_fpa').dimensions(['program_name']).metrics(['eac', 'budget']).filters(filters).sorts([{ field: 'program_name', direction: 'asc' }]));
  const total = totals.data?.[0] || {};
  return <Result result={totals}><div className="query-kpis">{[['Estimate at completion', 'eac'], ['Current budget', 'budget'], ['EAC variance', 'eac_variance']].map(([label, key]) => <div key={key}><span>{label}</span><strong>{money(pick(total, key))}</strong></div>)}</div>
    <Result result={byProgram}><ComboChart rows={named(byProgram.data, 'program_name')} category="program_name"/></Result></Result>;
}

export function composeExamples(demo, sdk, controls) {
  const connection = demo.connection, chart = connection?.charts?.[0], theme = demo.dark ? 'dark' : 'light';
  const scoped = node => () => connection ? <QueryScope connection={connection}>{node}</QueryScope> : waiting(demo.error || 'Connecting to Lightdash…');
  return [
    { id: 'chart-layout', status: 'available', name: 'A chart in your own layout', file: 'BudgetReviewPage.jsx', source: '@lightdash/sdk',
      summary: 'One saved chart beside two host components. The layout, the notes, and the decision state are ordinary product code.',
      code: `import Lightdash from '@lightdash/sdk';

export function BudgetReviewPage({ token, theme }) {
  return (
    <main className="budget-review">
      <Lightdash.Chart id="eac-burn" token={token}
        instanceUrl={url} theme={theme} />
      <aside>
        <ReviewNotes />        {/* your component */}
        <BudgetDecision />     {/* your state */}
      </aside>
    </main>
  );
}`,
      render: () => !connection || !sdk ? waiting('Loading the chart…') : <div className="compose-layout compose-layout-example">
        <figure className="compose-slot"><figcaption><span>EAC burn: actual and to-go against budget</span><code>Lightdash.Chart</code></figcaption>
          <div className="compose-slot-surface">{chart ? <sdk.SdkChart instanceUrl={connection.baseUrl} token={chart.embedToken} id={chart.chartUuid} theme={theme} styles={sdkStyles}/> : waiting('No chart is configured.')}</div></figure>
        <div className="compose-side"><ReviewNotes/><BudgetDecision/></div></div> },
    { id: 'query', status: 'available', name: 'Run a governed query', file: 'App.jsx', source: '@lightdash/query-sdk',
      summary: 'Ask the semantic layer for metrics by name. The rows come back to your code, and you render them as you like. Here: a plain HTML table.',
      code: `import { query, useLightdash } from '@lightdash/query-sdk';

export function PhaseTable() {
  const { data, loading } = useLightdash(
    query('fct_fpa')
      .dimensions(['phase'])
      .metrics(['eac', 'budget', 'actual_spend'])
      .sorts([{ field: 'phase', direction: 'asc' }]),
  );
  if (loading) return <Spinner />;

  return (
    <table>
      {data.map(row => (
        <tr key={row.phase}>
          <th>{row.phase}</th>
          <td>{row.eac}</td><td>{row.budget}</td>
        </tr>
      ))}
    </table>
  );
}`, render: scoped(<QueryTable/>) },
    { id: 'external-chart', status: 'available', name: 'Your own chart library', file: 'App.jsx', source: '@lightdash/query-sdk',
      summary: 'The same query feeds any chart code: Plotly, D3, Highcharts, or your design system. This example draws a combo chart in plain SVG.',
      code: `import { query, useLightdash } from '@lightdash/query-sdk';
import Plot from 'react-plotly.js';        // or any chart library

export function BudgetCombo() {
  const { data } = useLightdash(
    query('fct_fpa').dimensions(['phase']).metrics(['eac', 'budget']),
  );
  const phases = data.map(row => row.phase);

  return (
    <Plot
      data={[
        { type: 'bar', name: 'Budget', x: phases, y: data.map(r => r.budget) },
        { type: 'scatter', name: 'EAC', x: phases, y: data.map(r => r.eac) },
      ]}
      layout={{ title: 'EAC against budget by phase' }}
    />
  );
}`, render: scoped(<ExternalChart/>) },
    { id: 'shared-filters', status: 'available', name: 'Host filter bar, shared across pieces', file: 'App.jsx', source: '@lightdash/query-sdk',
      summary: 'Your own filter bar on top, and every piece below follows it. It works because your code owns the filter state and passes it to each query.',
      code: `import { query, useLightdash } from '@lightdash/query-sdk';

export function Portfolio() {
  const [programs, setPrograms] = useState([]);
  const filters = programs.length
    ? [{ field: 'program_name', operator: 'equals', value: programs }]
    : [];

  const totals = useLightdash(
    query('fct_fpa').metrics(['eac', 'budget', 'eac_variance']).filters(filters),
  );
  const byProgram = useLightdash(
    query('fct_fpa').dimensions(['program_name'])
      .metrics(['eac', 'budget']).filters(filters),
  );

  return (
    <>
      <YourFilterBar value={programs} onChange={setPrograms} />
      <KpiRow row={totals.data[0]} />
      <YourChart rows={byProgram.data} />
    </>
  );
}`, render: scoped(<><div className="examples-host-bar">{controls}</div><FilteredWorkspace demo={demo}/></>) },
    { id: 'saved-chart-model', status: 'gap', name: 'Custom widget from a saved chart', file: 'App.jsx', source: '@lightdash/query-sdk',
      summary: 'Take the query that an analyst saved as a chart, and draw it with your own component. The analyst keeps the definition. Your product keeps the look.',
      code: `import { savedChart, useLightdash } from '@lightdash/query-sdk';
import { Heatmap } from './your-design-system';

export function StudyHeatmap() {
  // The query, the filters, and the field labels come from the saved chart.
  const { data, columns } = useLightdash(savedChart('studies-over-budget'));
  return <Heatmap rows={data} columns={columns} />;
}`,
      why: 'The query SDK has savedChart(), but an embed token for a Data App cannot run it. The SDK documents this limit. A host page has no supported way to read the query of a saved chart with an embed token.',
      build: 'Let an embed token that may read a chart also run the query of that chart through the query SDK. Then a product can restyle governed charts without copying their definitions.' },
    { id: 'data-chart', status: 'gap', name: 'Lightdash chart fed by your data', file: 'App.jsx', source: '@lightdash/sdk',
      summary: 'Use the Lightdash chart renderer with rows that your code fetched, so a composed page looks like Lightdash without a saved chart for every view.',
      code: `import { Chart, Table } from '@lightdash/sdk';
import { query, useLightdash } from '@lightdash/query-sdk';

export function PhaseView() {
  const { data } = useLightdash(
    query('fct_fpa').dimensions(['phase']).metrics(['eac', 'budget']),
  );
  return (
    <>
      <Table dataSet={data} />
      <Chart dataSet={data} chartType="bar"
        dataOptions={{ category: ['phase'], value: ['eac', 'budget'] }} />
    </>
  );
}`,
      why: 'The React SDK renders saved content only. It has no Chart or Table component that takes rows. The query SDK returns rows, but it has no chart components for a host page.',
      build: 'Publish the chart and table renderers as components that take a data set and chart options. The Data App template already has such a component kit, so this is packaging work.' },
  ];
}
