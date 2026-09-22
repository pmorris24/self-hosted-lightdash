import React from 'react';

const serverCode = options => `// server: sign a token for one dashboard
const token = jwt.sign({
  content: {
    type: 'dashboard',
    dashboardUuid,${options ? '\n' + options : ''}
  },
}, LIGHTDASH_EMBED_SECRET, { expiresIn: '1h' });

<!-- page -->
<iframe
  src="https://app.lightdash.cloud/embed/\${projectUuid}#\${token}"
  width="100%" height="545" style="border: none"
></iframe>`;

export function iframeExamples(demo) {
  const connection = demo.connection, dashboard = connection?.dashboard;
  const frame = (variant, title) => () => dashboard
    ? <iframe title={title} src={`${connection.baseUrl}/embed/${connection.projectUuid}#${dashboard.variants?.[variant] || dashboard.embedToken}`}/>
    : <span className="examples-state" role="status">{demo.error || 'Connecting to Lightdash…'}</span>;
  return [
    { id: 'simple', status: 'available', name: 'Simple iframe', file: 'index.html', source: 'signed embed URL',
      summary: 'One signed URL shows a dashboard. The viewer can read it and nothing else.',
      code: serverCode(''), render: frame('plain', 'Dashboard in a frame') },
    { id: 'filters', status: 'available', name: 'Iframe with filters', file: 'index.html', source: 'signed embed URL',
      summary: 'The token turns on the dashboard filter bar. You choose which filters a viewer may change.',
      code: serverCode("    dashboardFiltersInteractivity: {\n      enabled: 'all',          // or 'some' + allowedFilters\n    },"), render: frame('filters', 'Dashboard in a frame, with filters') },
    { id: 'toolbar', status: 'available', name: 'Iframe with toolbar', file: 'index.html', source: 'signed embed URL',
      summary: 'The token adds viewer actions: CSV, image and PDF export, and date zoom.',
      code: serverCode("    dashboardFiltersInteractivity: { enabled: 'all' },\n    canExportCsv: true,\n    canExportImages: true,\n    canExportPagePdf: true,\n    canDateZoom: true,"), render: frame('toolbar', 'Dashboard in a frame, with viewer actions') },
    { id: 'frame-sdk', status: 'gap', name: 'Frame SDK: control the frame from the page', file: 'index.html', source: 'not available',
      summary: 'A small script that wraps the frame, so a page can set filters, change the dashboard, and listen for events without hand-written messages.',
      code: `<script src="https://app.lightdash.cloud/js/frame.js"></script>
<iframe id="lightdash-frame"></iframe>

<script>
  const frame = new LightdashFrame({
    url: 'https://app.lightdash.cloud',
    dashboard: dashboardUuid,
    token,
    element: document.getElementById('lightdash-frame'),
    settings: { showFilters: true, showExports: false },
  });

  await frame.render();
  frame.filters.set([{ field: 'program_name', values: ['Cortex Neurology'] }]);
  frame.on('filterschanged', ({ filters }) => saveToYourState(filters));
</script>`,
      why: 'Lightdash has no script that wraps the frame. A page can only change the URL, or send postMessage events that it defines itself. The Data App frame below does that with a custom message, and the app must contain code that listens for it.',
      build: 'A small frame script with a stable message contract: set filters, set theme, switch content, and events for ready, filters changed, and errors.' },
  ];
}
