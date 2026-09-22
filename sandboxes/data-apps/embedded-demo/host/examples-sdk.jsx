import React from 'react';
import { sdkStyles } from './useSdk.jsx';

const waiting = text => <span className="examples-state" role="status">{text}</span>;

export function sdkExamples(demo, sdk, filters, controls) {
  const connection = demo.connection, dashboard = connection?.dashboard;
  const chart = connection?.charts?.[0];
  const theme = demo.dark ? 'dark' : 'light';
  const ready = node => !connection ? waiting(demo.error || 'Connecting to Lightdash…') : !sdk ? waiting('Loading the React SDK…') : node();
  return [
    { id: 'dashboard', status: 'available', name: 'Dashboard', file: 'App.jsx', source: '@lightdash/sdk',
      summary: 'A saved dashboard as one React component. No frame.',
      code: `import Lightdash from '@lightdash/sdk';

export const App = ({ token }) => (
  <Lightdash.Dashboard
    instanceUrl="https://app.lightdash.cloud"
    token={token}
  />
);`,
      render: () => ready(() => <sdk.SdkDashboard instanceUrl={connection.baseUrl} token={dashboard.variants?.plain || dashboard.embedToken} theme={theme} styles={sdkStyles}/>) },
    { id: 'dashboard-filters', status: 'available', name: 'Dashboard with host filters and theme', file: 'App.jsx', source: '@lightdash/sdk',
      summary: 'The filter bar above the dashboard is host code. Its state reaches every tile through the filters prop. The theme follows the page.',
      code: `import Lightdash from '@lightdash/sdk';

export function App({ token, programs, theme }) {
  const filters = programs.length ? [{
    model: 'fct_fpa', field: 'program_name',
    operator: 'equals', value: programs,
  }] : [];

  return (
    <>
      <YourFilterBar />
      <Lightdash.Dashboard
        instanceUrl="https://app.lightdash.cloud"
        token={token}
        filters={filters}
        theme={theme}
        styles={{ fontFamily: 'Inter, sans-serif' }}
        onExplore={({ chart }) => openInYourRouter(chart)}
      />
    </>
  );
}`,
      render: () => ready(() => <><div className="examples-host-bar">{controls}</div><sdk.SdkDashboard instanceUrl={connection.baseUrl} token={dashboard.embedToken} theme={theme} filters={filters} styles={sdkStyles}/></>) },
    { id: 'chart', status: 'available', name: 'Single chart', file: 'App.jsx', source: '@lightdash/sdk',
      summary: 'One saved chart as one component. Its token reads that chart and nothing else.',
      code: `import Lightdash from '@lightdash/sdk';

export const App = ({ token }) => (
  <Lightdash.Chart
    instanceUrl="https://app.lightdash.cloud"
    token={token}
    id="eac-burn"
  />
);`,
      render: () => ready(() => chart ? <sdk.SdkChart instanceUrl={connection.baseUrl} token={chart.embedToken} id={chart.chartUuid} theme={theme} styles={sdkStyles}/> : waiting('No chart is configured for this example.')) },
    { id: 'two-charts', status: 'gap', name: 'Two charts on one page', file: 'App.jsx', source: '@lightdash/sdk',
      summary: 'The most common composition: two saved charts, each with its own token, in one page.',
      code: `import Lightdash from '@lightdash/sdk';

export const App = ({ tokens }) => (
  <>
    <Lightdash.Chart id="eac-burn" token={tokens.burn}
      instanceUrl="https://app.lightdash.cloud" />
    <Lightdash.Chart id="studies-over-budget" token={tokens.overBudget}
      instanceUrl="https://app.lightdash.cloud" />
  </>
);

// Result today:
// "Chart 27c7fec7… is not authorized by this token"`,
      why: 'The released SDK keeps one embed token for the whole page. Each component writes its token to the same place, so the last one to mount wins and the other charts send the wrong token. We ran this code while we built this page: two of three charts failed.',
      build: 'Keep the token with each component instance, not in one shared place. Then add a token that can read a named list of charts, so a page signs once.' },
  ];
}
