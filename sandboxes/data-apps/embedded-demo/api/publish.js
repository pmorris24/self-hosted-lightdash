import { timingSafeEqual } from 'node:crypto';
import { publishLatest } from '../runtime/publisher.js';

export function createPublishHandler({ publish = publishLatest } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.NATIVE_PUBLISH_SECRET;
    const actual = Buffer.from(req.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${secret}`);
    if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Unauthorized' });
    if (process.env.DEMO_CONNECTION_ENABLED !== 'true') return res.status(503).json({ error: 'Demo disabled' });
    try { return res.status(200).json(await publish()); }
    catch { return res.status(502).json({ error: 'Native publication failed. The previous artifacts remain intact.' }); }
  };
}
export default createPublishHandler();
