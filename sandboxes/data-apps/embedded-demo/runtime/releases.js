import { BlobNotFoundError, head, put } from '@vercel/blob';

export function releasePath(version, runtime) {
  return `native/${process.env.LIGHTDASH_PROJECT_UUID}/${process.env.LIGHTDASH_APP_UUID}/${runtime}/v${version}`;
}
export function createArtifactReader({headImpl = head, fetchImpl = fetch} = {}) {
 return async function read(path) {
  let blob;
  try { blob = await headImpl(path); }
  catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
  const response = await fetchImpl(blob.url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Artifact download failed');
  return response.text();
 };
}
export const readArtifact = createArtifactReader();
export async function writeArtifact(path, body, contentType) {
  // A release path belongs to one published version and compiler runtime.
  // Concurrent publishers produce the same output. The ready marker goes last.
  return put(path, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 31536000 });
}
export async function readPublished(path, fetchImpl = fetch) {
  const response = await fetchImpl(new URL(path, process.env.LIGHTDASH_URL), {
    headers: { Authorization: `ApiKey ${process.env.LIGHTDASH_SOURCE_TOKEN}` },
    redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Lightdash request failed');
  return (await response.json()).results;
}
export function appPath() {
  return `/api/v1/ee/projects/${process.env.LIGHTDASH_PROJECT_UUID}/apps/${process.env.LIGHTDASH_APP_UUID}`;
}
