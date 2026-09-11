import { createRequire } from 'node:module';
import path from 'node:path';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import scopeCss from './postcss-scope.js';
import { scopedPortalsPlugin } from './vite-scoped-portals.js';
import templateConfig from './vite.config.js';

const REACT_PACKAGE = /^react(-dom)?(\/.*)?$/;
const REACT_PROXY_PREFIX = '\0lightdash-packager-react:';

/**
 * Leaves React to the host. Marking it `external` isn't enough: bundled CJS
 * dependencies `require('react')`, which becomes a runtime `require` browsers
 * lack. Routing every React import through an internal ESM proxy turns those
 * into one external `import` per React entry point.
 */
function externalReactPlugin(requireFromStage) {
    return {
        name: 'lightdash-packager-external-react',
        enforce: 'pre',
        resolveId(source, importer) {
            if (!REACT_PACKAGE.test(source)) return null;
            if (importer?.startsWith(REACT_PROXY_PREFIX)) {
                return { id: source, external: true };
            }
            return `${REACT_PROXY_PREFIX}${source}`;
        },
        load(id) {
            if (!id.startsWith(REACT_PROXY_PREFIX)) return null;
            const source = id.slice(REACT_PROXY_PREFIX.length);
            const names = Object.keys(requireFromStage(source)).filter(
                (name) => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name),
            );
            return [
                `import * as external from ${JSON.stringify(source)};`,
                'const resolved = external.default ?? external;',
                'export default resolved;',
                ...names.map((name) => `export const ${name} = resolved.${name};`),
            ].join('\n');
        },
    };
}

// Library build of a template Data App, driven by packager/package-app.ts.
export default defineConfig((env) => {
    const template = templateConfig(env);
    const scopeClass = process.env.PACKAGER_SCOPE_CLASS;
    const externalReact = process.env.PACKAGER_EXTERNAL_REACT === 'true';
    const srcDir = path.resolve('src');
    const runtimeDir = path.join(srcDir, '__lightdash_packager');
    const require = createRequire(path.resolve('package.json'));
    const radixPortalModule = require
        .resolve('@radix-ui/react-portal')
        .replace(/index\.js$/, 'index.mjs');

    return {
        plugins: [
            ...(externalReact ? [externalReactPlugin(require)] : []),
            scopedPortalsPlugin({
                templatePlugins: template.plugins,
                srcDir,
                portalRootModule: path.join(runtimeDir, 'scope.js'),
            }),
            ...template.plugins,
        ],
        resolve: {
            alias: [
                // Every Radix portal renders into the app's scoped portal root.
                {
                    find: /^@radix-ui\/react-portal$/,
                    replacement: path.join(runtimeDir, 'radixPortal.js'),
                },
                {
                    find: /^@lightdash-packager\/radix-portal$/,
                    replacement: radixPortalModule,
                },
                ...Object.entries(template.resolve.alias).map(
                    ([find, replacement]) => ({ find, replacement }),
                ),
            ],
        },
        css: {
            postcss: {
                plugins: [
                    tailwindcss(),
                    autoprefixer(),
                    scopeCss({ scope: `.${scopeClass}` }),
                ],
            },
        },
        // Loads no env vars, so a local VITE_LIGHTDASH_API_KEY can't be inlined by the SDK.
        envPrefix: 'LIGHTDASH_PACKAGER_NO_ENV_',
        define: {
            'process.env.NODE_ENV': JSON.stringify('production'),
            __LIGHTDASH_APP_SCOPE__: JSON.stringify(scopeClass),
            __LIGHTDASH_APP_FILE_BASE__: JSON.stringify(
                process.env.PACKAGER_CSS_FILE_BASE,
            ),
        },
        build: {
            outDir: process.env.PACKAGER_OUT_DIR,
            emptyOutDir: process.env.PACKAGER_EMPTY_OUT_DIR === 'true',
            lib: {
                entry: process.env.PACKAGER_ENTRY,
                formats: ['es'],
                fileName: () => process.env.PACKAGER_FILE_NAME,
                cssFileName: process.env.PACKAGER_CSS_FILE_BASE,
            },
            rolldownOptions: {
                output: { codeSplitting: false },
            },
        },
    };
});
