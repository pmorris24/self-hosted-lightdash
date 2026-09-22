import React, { useMemo } from 'react';
import { DataApp } from '../runtime/vendor/lightdash-sdk-data-app.js';
import { DataAppsStep, Status } from './ladder.jsx';
import { SdkBoundary, useSdk } from './useSdk.jsx';
import { Examples } from './Examples.jsx';
import { sdkExamples } from './examples-sdk.jsx';
import './sdk-tab.css';

// The app's provider calls these without a guard. The whole-app example has no host panel to update.
const ignore = () => {};
const FILTER_FIELDS = [['programs', 'program_name'], ['phases', 'phase'], ['statuses', 'study_status']];

const dataAppCode = `import { DataApp } from '@lightdash/sdk/data-app';

// publishedApp is the Data App's built module, loaded by your page.
export function PortfolioPage({ connection, filters, theme }) {
  return (
    <DataApp
      module={publishedApp}
      providerProps={{ connection, filters, colorScheme: theme }}
    />
  );
}`;

const comparison = [
  ['Boundary', 'Separate document', 'Your document and React tree', 'Your document and React tree'],
  ['Unit you place', 'A whole page of content', 'A saved dashboard, chart, or explore', 'Single pieces, in your layout'],
  ['Who owns the layout', 'Lightdash', 'Lightdash, inside each dashboard', 'Your product'],
  ['Host state into content', 'URL and postMessage', 'filters, theme, styles props', 'Props on each piece'],
  ['Content events to host', 'postMessage you define', 'onExplore', 'Callbacks on each piece'],
  ['For Data Apps today', 'Released', 'Proposed, on a branch', 'Proposed, on a branch'],
];

export function SdkTab({ demo, controls, Icon, onNext, active }) {
  const { sdk, error: loadError } = useSdk();
  const filters = useMemo(() => FILTER_FIELDS.filter(([key]) => demo.filters[key].length)
    .map(([key, field]) => ({ model: 'fct_fpa', field, operator: 'equals', value: demo.filters[key] })), [demo.filters]);
  const release = demo.reactApp;
  return <>
    <header className="iframe-intro"><div><p className="section-kicker">The React SDK approach</p><h1>Lightdash content in your React tree.</h1><Status released>Released today</Status></div><p>The released <code>@lightdash/sdk</code> renders a saved dashboard, chart, or explore as React components. There is no frame. Your product passes filters, theme, and styles as props.</p></header>
    {loadError && <p className="notice error" role="alert">{loadError}</p>}
    <Examples label="React SDK examples" examples={sdkExamples(demo, sdk, filters, controls)} active={active}/>

    <section className="sdk-argument" aria-labelledby="sdk-argument-title">
      <div><p className="section-kicker">A real step forward</p><h2 id="sdk-argument-title">What you gain over the iframe</h2>
        <ul>
          <li><b>One document.</b> The dashboard is part of your page: your scroll, your fonts, your theme, no frame to size.</li>
          <li><b>Props, not messages.</b> Change the filters above. The host state reaches every tile through one prop.</li>
          <li><b>Callbacks and overrides.</b> <code>onExplore</code>, content overrides, and UI string overrides are supported today.</li>
          <li><b>Your server keeps control.</b> It signs a token for one dashboard. The browser never holds the secret.</li>
        </ul>
      </div>
      <div><p className="section-kicker sdk-gap-kicker">Where it stops</p><h2>The unit is saved Lightdash content</h2>
        <ul>
          <li><b>Dashboards, charts, explores.</b> Those are the things the SDK can render. A Data App is not one of them.</li>
          <li><b>Layout stays in Lightdash.</b> Inside a dashboard, the tile grid is the one made in Lightdash.</li>
          <li><b>It carries the Lightdash frontend.</b> The SDK is 19 MB of JavaScript, about 5 MB compressed. This page loads it on demand for that reason.</li>
        </ul>
      </div>
    </section>

    <DataAppsStep title="The same component model, for a whole Data App." status={<Status>Proposed · runs from a branch</Status>}>
      <p>A dashboard holds charts. A <b>Data App</b> holds what a dashboard cannot: custom components, forms, scenario controls, and its own layout. Customers build those in Lightdash today, and the only way to ship them is the frame.</p>
      <p>The natural next step is one more SDK component. <code>DataApp</code> renders the published app as native React, with the same props model as the dashboard above. It is not in the released SDK. The example below runs the experimental adapter from this branch.</p>
    </DataAppsStep>
    <div className="iframe-host-shell sdk-host-shell">
      <div className="iframe-host-bar"><span>Clinical finance <span>/</span> Portfolio</span><span className="iframe-boundary-label">DataApp · proposed SDK component</span></div>
      <section className="sdk-panel" aria-label="Live native Data App example">
        <div className="sdk-surface sdk-app-surface">
          {release && <SdkBoundary label="The native Data App"><DataApp module={release.module} providerProps={{ connection: release.connection,
            filters: demo.appFilters, colorScheme: demo.dark ? 'dark' : 'light', onFiltersChange: demo.updateAnalysisFilters,
            onStudySelect: ignore, onState: ignore }}/></SdkBoundary>}
        </div>
        <footer><span className="panel-state" role="status">{release ? `Live Data App v${release.version} · native React, no frame` : demo.error || 'Loading the published app…'}</span></footer>
      </section>
      <div className="iframe-host-note"><span>Same document</span><span>App-owned layout</span><span>Custom components included</span></div>
    </div>
    <section className="sdk-code-row" aria-label="Data App SDK code">
      <div><p className="section-kicker">What changes in your code</p><h2>One component. The whole app.</h2><p>The study review form, the scenario controls, and every chart arrive together, because they are one published app. Your page still owns the theme, the filters, and the token.</p></div>
      <div className="code-example"><div className="code-heading"><span>PortfolioPage.jsx</span><span>@lightdash/sdk/data-app · proposed</span></div><pre aria-label="Data App SDK code">{dataAppCode}</pre></div>
    </section>

    <section className="sdk-compare" aria-labelledby="sdk-compare-title">
      <p className="section-kicker">Three integration models</p><h2 id="sdk-compare-title">Each model works for Lightdash content. Each has a Data Apps step.</h2>
      <div className="sdk-compare-scroll"><table>
        <thead><tr><th scope="col"><span className="sr-only">Property</span></th><th scope="col">Iframe</th><th scope="col" aria-current="true">React SDK</th><th scope="col">Compose SDK</th></tr></thead>
        <tbody>{comparison.map(([label, ...cells]) => <tr key={label}><th scope="row">{label}</th>{cells.map((cell, index) => <td key={index} data-current={index === 1 || undefined}>{cell}</td>)}</tr>)}</tbody>
      </table></div>
    </section>

    <div className="iframe-next"><div><p className="section-kicker">Now change the unit of reuse</p><h2>What if your product chose<br/>the pieces and the layout?</h2></div><button className="button primary" onClick={onNext}>Explore the Compose SDK <Icon name="arrow" size={20}/></button></div>
  </>;
}
