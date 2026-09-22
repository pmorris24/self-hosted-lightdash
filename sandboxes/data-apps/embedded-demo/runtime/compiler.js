import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import scopeCss from './packager/postcss-scope.js';
import { redirectBodyPortals } from './packager/vite-scoped-portals.js';
import tailwindConfig from './tailwind.config.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const dependencies = new Set(Object.keys(packageJson.dependencies));

export function validateSource(source) {
  if (!Number.isSafeInteger(source?.manifest?.version) || source.manifest.version < 1 || !Array.isArray(source.files) || source.files.length > 500) throw new Error('Invalid published source');
  let bytes = 0;
  const paths = new Set();
  for (const file of source.files) {
    if (typeof file.path !== 'string' || !file.path.startsWith('src/') || file.path.includes('\\') || file.path.split('/').some(p => !p || p === '.' || p === '..') || paths.has(file.path) || typeof file.contentBase64 !== 'string') throw new Error('Invalid source path');
    paths.add(file.path);
    bytes += Buffer.byteLength(file.contentBase64, 'base64');
    if (bytes > 25 * 1024 * 1024) throw new Error('Published source is too large');
  }
  if (!paths.has('src/App.jsx') && !paths.has('src/App.tsx')) throw new Error('Published source has no app entry');
  if (!paths.has('src/data-app.tsx') && !paths.has('src/data-app.jsx')) throw new Error('Native component publication requires src/data-app.tsx or src/data-app.jsx');
}

// Compile source as browser code. Never load the downloaded package.json,
// build configuration, plugins, or scripts into this server process.
export async function compileSource(source, { runtimeId = 'local' } = {}) {
  validateSource(source);
  const stage = await realpath(await mkdtemp(path.join(tmpdir(), 'lightdash-native-')));
  const src = path.join(stage, 'src');
  const runtime = path.join(src, '__lightdash_packager');
  try {
    for (const file of source.files) {
      const target = path.join(stage, file.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(file.contentBase64, 'base64'));
    }
    await mkdir(runtime, { recursive: true });
    for (const name of ['scope.js', 'radixPortal.js']) await cp(path.join(root, 'runtime/packager', name), path.join(runtime, name));
    // The template's own useIsDark reads the host page's root class, which a scoped embed never sets.
    await mkdir(path.join(src, 'lib'), { recursive: true });
    await cp(path.join(root, 'runtime/packager/useIsDark.ts'), path.join(src, 'lib/useIsDark.ts'));
    let entry = await readFile(path.join(root, 'app-entry.jsx'), 'utf8');
    entry = entry.replace(/const SERVED_AS_BUILT =[\s\S]*?;/, 'const SERVED_AS_BUILT = true;')
      .replace(/const STYLESHEET_URL = .*?;/, `const STYLESHEET_URL = new URL('/api/native?asset=css&version=${source.manifest.version}&runtime=${runtimeId}', import.meta.url).href;`);
    const entryPath = path.join(src, '__native_entry.jsx');
    await writeFile(entryPath, entry);
    const radix = require.resolve('@radix-ui/react-portal').replace(/index\.js$/, 'index.mjs');
    const result = await build({
      entryPoints: [entryPath], outfile: path.join(stage, 'native.js'), write: false,
      bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic',
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
      minify: true, legalComments: 'none', logLevel: 'silent',
      nodePaths: [path.join(root, 'node_modules')],
      loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl' },
      define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"', __LIGHTDASH_APP_SCOPE__: '"ld-app-clinical-trial-fp-a"', __LIGHTDASH_APP_FILE_BASE__: '"clinical-trial-fp-a"' },
      plugins: [{ name: 'trusted-native-runtime', setup(api) {
        api.onResolve({ filter: /^@lightdash-packager\/scope$/ }, () => ({ path: path.join(runtime, 'scope.js') }));
        api.onResolve({ filter: /^@lightdash-packager\/radix-portal$/ }, () => ({ path: radix }));
        api.onResolve({ filter: /^@radix-ui\/react-portal$/ }, () => ({ path: path.join(runtime, 'radixPortal.js') }));
        api.onResolve({ filter: /.*/ }, args => {
          if (!args.importer.startsWith(src + path.sep)) return;
          const request = args.path;
          if (request.startsWith('@/')) {
            const target = path.resolve(src, request.slice(2));
            if (!target.startsWith(src + path.sep)) throw new Error('Source alias escapes app directory');
            return { path: target, namespace: 'source-alias' };
          }
          if (request.startsWith('.')) {
            const resolved = path.resolve(args.resolveDir, request);
            if (!resolved.startsWith(src + path.sep)) throw new Error('Source import escapes app directory');
            return;
          }
          if (request.split('/').includes('..') || request.startsWith('/') || request.includes(':') || !dependencies.has(request.startsWith('@') ? request.split('/').slice(0,2).join('/') : request.split('/')[0])) throw new Error('Unsupported app dependency');
        });
        api.onLoad({ filter: /.*/, namespace: 'source-alias' }, async args => {
          for (const suffix of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.js']) {
            try { const filename = args.path + suffix; const contents = await readFile(filename, 'utf8'); return { contents: redirectBodyPortals(contents, filename, '@lightdash-packager/scope') ?? contents, loader: filename.endsWith('.tsx') ? 'tsx' : filename.endsWith('.ts') ? 'ts' : 'jsx', resolveDir: path.dirname(filename) }; } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error; }
          }
          throw new Error('App import could not be resolved');
        });
        api.onLoad({ filter: /\.[jt]sx?$/ }, async args => {
          if (!args.path.startsWith(src + path.sep)) return;
          const contents = await readFile(args.path, 'utf8');
          return { contents: redirectBodyPortals(contents, args.path, '@lightdash-packager/scope') ?? contents, loader: args.path.endsWith('.tsx') ? 'tsx' : args.path.endsWith('.ts') ? 'ts' : 'jsx', resolveDir: path.dirname(args.path) };
        });
      }}],
    });
    const js = result.outputFiles.find(f => f.path.endsWith('.js'))?.text;
    const rawCss = result.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? '';
    const content = source.files.filter(f => /\.[jt]sx?$/.test(f.path)).map(f => ({ raw: Buffer.from(f.contentBase64, 'base64').toString(), extension: f.path.split('.').pop() }));
    const css = (await postcss([tailwind({ ...tailwindConfig, content }), autoprefixer(), scopeCss({ scope: '.ld-app-clinical-trial-fp-a' })]).process(rawCss, { from: undefined })).css;
    if (!js) throw new Error('Compiler produced no module');
    return { js, css, version: source.manifest.version };
  } finally { await rm(stage, { recursive: true, force: true }); }
}
