import { cp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = join(root, 'public');

for (const file of ['index.html']) {
  if (!(await stat(join(publicDir, file))).isFile()) throw new Error(`Missing deployment asset: ${file}`);
}
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(js|html|css|json)$/.test(entry.name)) {
      const source = await readFile(path, 'utf8');
      if (/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(source)) {
        throw new Error(`Possible embedded JWT in ${entry.name}. Do not deploy credentials.`);
      }
    }
  }
}
await scan(publicDir);
const runtimeHash = createHash('sha256');
async function hashTree(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'build-id.js') continue;
    const path = join(directory, entry.name);
    runtimeHash.update(path.slice(root.length));
    if (entry.isDirectory()) await hashTree(path);
    else runtimeHash.update(await readFile(path));
  }
}
await hashTree(join(root, 'runtime'));
for (const file of ['app-entry.jsx', 'package-lock.json', 'api/native.js']) runtimeHash.update(await readFile(join(root, file)));
await writeFile(join(root, 'runtime/build-id.js'), `export const runtimeId = '${runtimeHash.digest('hex').slice(0,16)}';\n`);
await rm(join(root, 'dist'), { recursive: true, force: true });
await cp(publicDir, join(root, 'dist'), { recursive: true });
await build({ entryPoints: ['react','react-dom','react-dom-client','react-jsx-runtime'].map(name => join(root, `host/vendor/${name}.js`)), outdir: join(root, 'dist/vendor'), bundle: true, splitting: true, minify: true, format: 'esm', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' } });
await build({ entryPoints: [join(root, 'host/App.jsx')], outfile: join(root, 'dist/host.js'), bundle: true, minify: true, format: 'esm', target: 'es2022', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, external: ['/assets/*','/sdk-dashboard.js','react','react-dom','react-dom/client','react/jsx-runtime'] });
// The released SDK is large, so it is a separate file that only the React SDK tab imports.
await build({ entryPoints: [join(root, 'host/sdk-dashboard.jsx')], outfile: join(root, 'dist/sdk-dashboard.js'), bundle: true, minify: true, format: 'esm', target: 'es2022', jsx: 'automatic', legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' }, external: ['react','react-dom','react-dom/client','react/jsx-runtime'] });
await scan(join(root, 'dist'));
console.log('Built React host. Deployment asset checks passed.');

// Seed this runtime's release before production becomes visible to viewers.
if (process.env.VERCEL_ENV === 'production') {
  const { publishLatest } = await import('../runtime/publisher.js');
  const release = await publishLatest();
  console.log(`Native v${release.version} is prebuilt and ready.`);
}
