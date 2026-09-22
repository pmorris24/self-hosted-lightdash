import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { compileSource, validateSource } from '../runtime/compiler.js';

const file = (path, text) => ({ path, contentBase64: Buffer.from(text).toString('base64') });
test('source paths cannot escape the app or overwrite server files', () => {
  for (const path of ['src/../../api/native.js', '/tmp/App.jsx', 'src/../App.jsx', 'src\\App.jsx']) {
    assert.throws(() => validateSource({ manifest: { version: 1 }, files: [file(path, '')] }));
  }
});
test('compiler packages changes from source without changing the host', async () => {
  const files = [];
  async function collect(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await collect(url, prefix + entry.name + '/');
      else files.push({ path: prefix + entry.name, contentBase64: (await readFile(url)).toString('base64') });
    }
  }
  await collect(new URL('../app-src/', import.meta.url), 'src/');
  const source = { manifest: { version: 26 }, files };
  const app = source.files.find(f => f.path === 'src/App.tsx');
  const first = await compileSource(source);
  source.manifest.version += 1;
  app.contentBase64 = Buffer.from(Buffer.from(app.contentBase64, 'base64').toString().replace('Clinical Trial FP&amp;A</h1>', 'Published revision proof</h1>')).toString('base64');
  const next = await compileSource(source);
  assert.notEqual(first.js, next.js);
  assert.match(next.js, /Published revision proof/);
  assert.match(next.js, new RegExp('version=' + source.manifest.version));
  assert.match(next.css, /ld-app-clinical-trial-fp-a/);
  assert.doesNotMatch(next.js, /LIGHTDASH_SOURCE_TOKEN/);
  assert.match(next.js, /DataAppProvider/);
  assert.match(next.js, /PortfolioSummary/);
  assert.match(next.js, /StudyList/);
  assert.match(next.js, /from"react"/);
  assert.doesNotMatch(next.js, /react\.production\.js|react-dom-client\.production\.js/);
});

test('native publication requires an explicit component contract', () => {
  assert.throws(() => validateSource({ manifest: { version: 1 }, files: [file('src/App.jsx', 'export default function App() {}')] }), /component publication requires/);
});

test('component definitions retain stable names and reject unsupported contracts', async () => {
  const { build } = await import('esbuild');
  const output = await build({ entryPoints: [new URL('../app-src/lib/dataApp.ts', import.meta.url).pathname], bundle: true, format: 'esm', write: false });
  const { defineDataApp } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  const View = () => null;
  const definition = defineDataApp({ contractVersion: 1, id: 'trial-app', Provider: View, App: View, components: { Forecast: View } });
  assert.equal(definition.components.Forecast, View);
  assert.ok(Object.isFrozen(definition.components));
  assert.throws(() => defineDataApp({ ...definition, contractVersion: 2 }), /Unsupported/);
  assert.throws(() => defineDataApp({ ...definition, components: {} }), /at least one/);
  assert.throws(() => defineDataApp({ ...definition, components: { 'chart-name': View } }), /Invalid/);
});
