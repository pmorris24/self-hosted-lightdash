import { releasePath, readArtifact, writeArtifact, readPublished, appPath } from './releases.js';
import { runtimeId } from './build-id.js';

export function createPublisher({ read = readArtifact, write = writeArtifact, published = readPublished,
  compile = async source => (await import('./compiler.js')).compileSource(source, { runtimeId }) } = {}) {
  let pending;
  async function publish() {
    const metadata = await published(`${appPath()}?limit=1`);
    const version = metadata.latestReadyVersion;
    if (!Number.isSafeInteger(version) || version < 1) throw new Error('No published version');
    const path = releasePath(version, runtimeId);
    if (await read(`${path}/ready.json`)) return { version, runtime: runtimeId, built: false };
    const source = await published(`${appPath()}/download`);
    if (source?.manifest?.version !== version) throw new Error('Published version changed; retry');
    const built = await compile(source);
    if (built.version !== version) throw new Error('Compiler version mismatch');
    for (const body of [built.js, built.css]) {
      if (/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(body)) throw new Error('Possible embedded credential');
    }
    await Promise.all([
      write(`${path}/app.js`, built.js, 'text/javascript'),
      write(`${path}/app.css`, built.css, 'text/css'),
    ]);
    // Only complete releases become visible to viewers, even after a failed build/upload.
    const release = { version, runtime: runtimeId, publishedAt: new Date().toISOString() };
    await write(`${path}/ready.json`, JSON.stringify(release), 'application/json');
    return { ...release, built: true };
  }
  return () => {
    if (!pending) pending = publish().finally(() => { pending = undefined; });
    return pending;
  };
}
export const publishLatest = createPublisher();
