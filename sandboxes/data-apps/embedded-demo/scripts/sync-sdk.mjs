import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Deploy the exact experimental SDK adapter without publishing an npm release.
await build({
    entryPoints: [fileURLToPath(new URL('../../../../packages/frontend/sdk/DataApp.tsx', import.meta.url))],
    outfile: fileURLToPath(new URL('../runtime/vendor/lightdash-sdk-data-app.js', import.meta.url)),
    bundle: true,
    format: 'esm',
    external: ['react'],
    banner: { js: '// Generated from packages/frontend/sdk/DataApp.tsx by scripts/sync-sdk.mjs.' },
});
