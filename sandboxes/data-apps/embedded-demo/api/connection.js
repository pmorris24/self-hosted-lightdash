import { createHmac } from 'node:crypto';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Enable only after the project's viewer access policy has been selected.
  if (process.env.DEMO_CONNECTION_ENABLED !== 'true') {
    return res.status(503).json({ error: 'Automatic connection is not enabled yet.' });
  }
  const { LIGHTDASH_URL: baseUrl, LIGHTDASH_PROJECT_UUID: projectUuid,
    LIGHTDASH_APP_UUID: appUuid, LIGHTDASH_EMBED_SECRET: secret,
    LIGHTDASH_DASHBOARD_UUID: dashboardUuid, LIGHTDASH_CHART_UUIDS: chartUuids } = process.env;
  if (!baseUrl || !projectUuid || !appUuid || !secret) {
    return res.status(503).json({ error: 'The server connection is incomplete.' });
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  // The caller cannot select a project, app, identity, or token lifetime.
  const sign = (content) => {
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      content, userAttributes: {}, iat: now, exp: expiresAt,
    })}`;
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  };
  // The React SDK example reads one server-selected dashboard. Viewers may filter it, nothing else.
  const dashboardToken = (options) => sign({ type: 'dashboard', projectUuid, dashboardUuid, ...options });
  const withFilters = { dashboardFiltersInteractivity: { enabled: 'all' } };
  // Each variant is a fixed set of viewer permissions. The caller picks a variant, never the permissions.
  const dashboard = dashboardUuid ? { dashboardUuid, embedToken: dashboardToken(withFilters), variants: {
    plain: dashboardToken({}),
    filters: dashboardToken(withFilters),
    toolbar: dashboardToken({ ...withFilters, canExportCsv: true, canExportImages: true, canExportPagePdf: true, canDateZoom: true }),
  } } : null;
  // Single saved charts for the composition example. One token reads one chart.
  const charts = (chartUuids || '').split(',').map(value => value.trim()).filter(value => /^[0-9a-f-]{36}$/.test(value)).slice(0, 6)
    .map(chartUuid => ({ chartUuid, embedToken: sign({ type: 'chart', projectUuid, contentId: chartUuid }) }));
  return res.status(200).json({ baseUrl, projectUuid, appUuid,
    embedToken: sign({ type: 'dataApp', projectUuid, appUuid }), dashboard, charts, expiresAt: expiresAt * 1000 });
}
