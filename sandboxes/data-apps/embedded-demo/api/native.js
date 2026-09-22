import { runtimeId } from '../runtime/build-id.js';
import { releasePath, readArtifact, readPublished, appPath } from '../runtime/releases.js';

// This function has no compiler dependency. Missing releases never build on a viewer request.
export function createNativeHandler({ read = readArtifact, published = readPublished } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (process.env.DEMO_CONNECTION_ENABLED !== 'true') return res.status(503).json({ error: 'Demo disabled' });
    const { version, asset, runtime } = req.query;
    if ((version !== undefined && (typeof version !== 'string' || !/^[1-9]\d{0,6}$/.test(version))) || (asset !== undefined && !['js', 'css'].includes(asset))) return res.status(400).json({ error: 'Invalid asset request' });
    if (asset && (!version || runtime !== runtimeId)) return res.status(409).json({ error: 'Refresh both to load the current app runtime.' });
    try {
      const requested = asset ? Number(version) : (await published(`${appPath()}?limit=1`)).latestReadyVersion;
      if (!Number.isSafeInteger(requested) || requested < 1) return res.status(503).json({ error: 'No published app version is ready yet.' });
      const path = releasePath(requested, runtimeId);
      if (!await read(`${path}/ready.json`)) return res.status(503).json({ error: `Native v${requested} has not finished publication. Retry after the publisher completes.`, version: requested });
      if (!asset) return res.status(200).json({ version: requested,
        moduleUrl: `/api/native?asset=js&version=${requested}&runtime=${runtimeId}`,
        stylesheetUrl: `/api/native?asset=css&version=${requested}&runtime=${runtimeId}` });
      const body = await read(`${path}/app.${asset}`);
      if (body === null) return res.status(503).json({ error: 'The published artifact is unavailable.' });
      res.setHeader('X-Lightdash-App-Version', String(requested));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=31536000');
      res.setHeader('Content-Type', asset === 'js' ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8');
      return res.status(200).send(body);
    } catch {
      return res.status(502).json({ error: 'The published app could not load. Refresh both to retry.' });
    }
  };
}
export default createNativeHandler();
