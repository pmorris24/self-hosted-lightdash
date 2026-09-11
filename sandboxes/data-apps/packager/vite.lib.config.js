import { defineConfig } from 'vite';
import templateConfig from './vite.config.js';

// Library build of a template Data App, driven by packager/package-app.ts.
export default defineConfig((env) => {
    const template = templateConfig(env);
    const fileBase = process.env.PACKAGER_FILE_BASE;
    const externalReact = process.env.PACKAGER_EXTERNAL_REACT === 'true';

    return {
        plugins: template.plugins,
        resolve: template.resolve,
        // Loads no env vars, so a local VITE_LIGHTDASH_API_KEY can't be inlined by the SDK.
        envPrefix: 'LIGHTDASH_PACKAGER_NO_ENV_',
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        build: {
            outDir: process.env.PACKAGER_OUT_DIR,
            emptyOutDir: true,
            lib: {
                entry: process.env.PACKAGER_ENTRY,
                formats: ['es'],
                fileName: () => `${fileBase}.js`,
                cssFileName: fileBase,
            },
            rolldownOptions: {
                external: externalReact ? [/^react(-dom)?(\/.*)?$/] : [],
                output: { codeSplitting: false },
            },
        },
    };
});
