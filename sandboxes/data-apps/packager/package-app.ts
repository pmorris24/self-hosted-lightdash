/**
 * Packages a Data App built on template/ as an importable ES module with a
 * single `mount(el, embedOptions?)` export. The same build runs in the
 * Lightdash app viewer (postMessage transport) and in a customer's own
 * frontend (embed JWT transport).
 *
 * Usage (from sandboxes/data-apps):
 *   node packager/package-app.ts --app <dir containing src/> --out <dir> --name <package-name>
 *     [--version 0.1.0] [--work-dir <dir>] [--fresh]
 */
import { spawnSync } from 'node:child_process';
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

const PACKAGER_DIR = dirname(fileURLToPath(import.meta.url));
const DATA_APPS_DIR = resolve(PACKAGER_DIR, '..');
const TEMPLATE_DIR = join(DATA_APPS_DIR, 'template');
const ENTRY_FILE = '__lightdash_packager_entry.jsx';
const RUNTIME_DIR = '__lightdash_packager';
const BUILD_HELPERS = [
    'vite.lib.config.js',
    'postcss-scope.js',
    'vite-scoped-portals.js',
];
const SETUP_MARKER = '.packager-setup-complete';
const PACKAGE_NAME_PATTERN =
    /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

// Keep in sync with e2b.Dockerfile.
const SHADCN_VERSION = '2.3.0';
const SHADCN_COMPONENTS = [
    'button',
    'badge',
    'card',
    'table',
    'dialog',
    'tabs',
    'select',
    'input',
    'label',
    'popover',
    'tooltip',
    'separator',
    'skeleton',
    'dropdown-menu',
    'sheet',
    'scroll-area',
    'switch',
    'checkbox',
    'avatar',
    'alert',
    'progress',
    'resizable',
];

const USAGE =
    'Usage: node packager/package-app.ts --app <dir containing src/> --out <dir> --name <package-name> ' +
    '[--version 0.1.0] [--work-dir <dir>] [--fresh]';

type PackagerOptions = {
    appDir: string;
    outDir: string;
    packageName: string;
    version: string;
    workDir: string;
    fresh: boolean;
};

type LibraryBuild = {
    fileName: string;
    externalReact: boolean;
};

function run(
    command: string,
    args: string[],
    cwd: string,
    env: Record<string, string | undefined> = process.env,
): void {
    console.log(`\n$ ${[command, ...args].join(' ')}`);
    const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
    if (result.status !== 0) {
        throw new Error(`${command} exited with status ${result.status}`);
    }
}

function resolveBinary(name: string): string {
    const result = spawnSync('sh', ['-c', `command -v ${name}`], {
        encoding: 'utf8',
    });
    const path = result.stdout.trim();
    if (result.status !== 0 || path === '') {
        throw new Error(`${name} is required on PATH`);
    }
    return path;
}

// Package downloads must go through Socket Firewall (sandboxes/CLAUDE.md).
function runInstall(command: string, args: string[], cwd: string): void {
    run(resolveBinary('sfw'), [command, ...args], cwd);
}

/**
 * shadcn's registry fetch fails behind sfw's TLS-inspecting proxy, so the CLI
 * is installed through sfw and run directly. PATH shims route the dependency
 * installs it spawns back through sfw.
 */
function runShadcn(stageDir: string, args: string[]): void {
    const toolsDir = join(stageDir, '.packager-tools');
    const shimDir = join(toolsDir, 'bin');
    const shadcnBin = join(toolsDir, 'node_modules', '.bin', 'shadcn');
    if (!existsSync(shadcnBin)) {
        runInstall(
            'npm',
            [
                'install',
                '--prefix',
                toolsDir,
                '--ignore-scripts',
                '--no-audit',
                '--no-fund',
                `shadcn@${SHADCN_VERSION}`,
            ],
            stageDir,
        );
        mkdirSync(shimDir, { recursive: true });
        const sfw = resolveBinary('sfw');
        for (const manager of ['npm', 'pnpm']) {
            writeFileSync(
                join(shimDir, manager),
                `#!/bin/sh\nexec "${sfw}" "${resolveBinary(manager)}" "$@"\n`,
                { mode: 0o755 },
            );
        }
    }
    run(shadcnBin, args, stageDir, {
        ...process.env,
        PATH: `${shimDir}:${process.env.PATH}`,
    });
}

function readJson(path: string): Record<string, unknown> {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        throw new Error(`Could not read JSON from ${path}: ${error}`);
    }
}

/** Mirrors the e2b.Dockerfile install so apps build against the same toolchain. */
function setUpStage(stageDir: string): void {
    run('bash', [join(DATA_APPS_DIR, 'pack-query-sdk.sh'), stageDir], DATA_APPS_DIR);
    cpSync(TEMPLATE_DIR, stageDir, {
        recursive: true,
        filter: (source) => !/[/\\](node_modules|dist)([/\\]|$)/.test(source),
    });

    const packageJsonPath = join(stageDir, 'package.json');
    writeFileSync(
        packageJsonPath,
        readFileSync(packageJsonPath, 'utf8').replace(
            /"workspace:\*"/g,
            '"file:lightdash-query-sdk.tgz"',
        ),
    );
    runInstall('pnpm', ['install', '--no-frozen-lockfile'], stageDir);
    runShadcn(stageDir, ['init', '--defaults', '--force']);
    runShadcn(stageDir, ['add', '--overwrite', '--yes', ...SHADCN_COMPONENTS]);
    // shadcn init rewrites tailwind.config.js; restore the template's copy.
    cpSync(join(TEMPLATE_DIR, 'tailwind.config.js'), join(stageDir, 'tailwind.config.js'));
    writeFileSync(join(stageDir, SETUP_MARKER), new Date().toISOString());
}

function describeFile(path: string): string {
    const bytes = readFileSync(path);
    const kb = (size: number) => `${(size / 1024).toFixed(1)} kB`;
    return `${basename(path)}  ${kb(bytes.length)} (gzip ${kb(gzipSync(bytes).length)})`;
}

function writePackageFiles({
    options,
    distDir,
    fileBase,
    scopeClass,
    sdkVersion,
}: {
    options: PackagerOptions;
    distDir: string;
    fileBase: string;
    scopeClass: string;
    sdkVersion: string;
}): void {
    writeFileSync(
        join(distDir, 'index.d.ts'),
        `export type EmbedOptions = {
    embedToken: string;
    baseUrl: string;
    projectUuid: string;
    appUuid: string;
    useProxy?: boolean;
    colorScheme?: 'light' | 'dark';
};

export type MountedApp = {
    unmount: () => void;
    setColorScheme: (colorScheme: 'light' | 'dark') => void;
};

/**
 * Render the app into \`el\`. Omit \`embedOptions\` inside the Lightdash app
 * viewer; pass them when importing the app into your own frontend.
 */
export declare function mount(
    el: HTMLElement,
    embedOptions?: EmbedOptions,
): MountedApp;
`,
    );

    // Drop-in replacement for the sandbox build's dist/ in the app viewer.
    writeFileSync(
        join(distDir, 'boot.js'),
        `import { mount } from './${fileBase}.standalone.js';\n\nmount(document.getElementById('root'));\n`,
    );
    writeFileSync(
        join(distDir, 'index.html'),
        `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Lightdash Data App</title>
        <script type="module" src="./boot.js"></script>
    </head>
    <body>
        <div id="root"></div>
    </body>
</html>
`,
    );

    const types = './dist/index.d.ts';
    const packageJson = {
        name: options.packageName,
        version: options.version,
        private: true,
        type: 'module',
        main: `./dist/${fileBase}.js`,
        types,
        exports: {
            '.': { types, import: `./dist/${fileBase}.js` },
            './standalone': { types, import: `./dist/${fileBase}.standalone.js` },
            './style.css': `./dist/${fileBase}.css`,
        },
        files: ['dist'],
        sideEffects: ['*.css'],
        peerDependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
        // Only the default build imports React; the standalone build bundles it.
        peerDependenciesMeta: {
            react: { optional: true },
            'react-dom': { optional: true },
        },
        lightdash: { querySdkVersion: sdkVersion, scopeClass },
    };
    writeFileSync(
        join(options.outDir, 'package.json'),
        `${JSON.stringify(packageJson, null, 4)}\n`,
    );
}

function packageApp(options: PackagerOptions): void {
    const stageDir = options.workDir;
    if (options.fresh) rmSync(stageDir, { recursive: true, force: true });
    mkdirSync(stageDir, { recursive: true });
    if (existsSync(join(stageDir, SETUP_MARKER))) {
        console.log(`Reusing staged template in ${stageDir} (pass --fresh after SDK changes)`);
    } else {
        setUpStage(stageDir);
    }

    // Reset template-owned sources, then lay the app's src/ over them.
    cpSync(join(TEMPLATE_DIR, 'src'), join(stageDir, 'src'), { recursive: true });
    cpSync(join(options.appDir, 'src'), join(stageDir, 'src'), { recursive: true });
    cpSync(join(PACKAGER_DIR, 'entry.jsx'), join(stageDir, 'src', ENTRY_FILE));
    cpSync(join(PACKAGER_DIR, 'runtime'), join(stageDir, 'src', RUNTIME_DIR), {
        recursive: true,
    });
    for (const helper of BUILD_HELPERS) {
        cpSync(join(PACKAGER_DIR, helper), join(stageDir, helper));
    }

    const fileBase = options.packageName.replace(/^@[^/]+\//, '');
    const scopeClass = `ld-app-${fileBase.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const distDir = join(options.outDir, 'dist');
    // Bundlers import the default build and share the host's React; the
    // standalone build runs on any page.
    const builds: LibraryBuild[] = [
        { fileName: `${fileBase}.js`, externalReact: true },
        { fileName: `${fileBase}.standalone.js`, externalReact: false },
    ];
    mkdirSync(options.outDir, { recursive: true });
    builds.forEach((build, index) => {
        run('pnpm', ['exec', 'vite', 'build', '--config', 'vite.lib.config.js'], stageDir, {
            ...process.env,
            PACKAGER_ENTRY: `src/${ENTRY_FILE}`,
            PACKAGER_FILE_NAME: build.fileName,
            PACKAGER_CSS_FILE_BASE: fileBase,
            PACKAGER_SCOPE_CLASS: scopeClass,
            PACKAGER_OUT_DIR: distDir,
            PACKAGER_EXTERNAL_REACT: String(build.externalReact),
            PACKAGER_EMPTY_OUT_DIR: String(index === 0),
        });
    });

    const sdkPackageJson = readJson(
        join(stageDir, 'node_modules', '@lightdash', 'query-sdk', 'package.json'),
    );
    writePackageFiles({
        options,
        distDir,
        fileBase,
        scopeClass,
        sdkVersion: String(sdkPackageJson.version),
    });

    console.log(`\nPackaged ${options.packageName}@${options.version} → ${options.outDir}`);
    for (const file of [
        `${fileBase}.js`,
        `${fileBase}.standalone.js`,
        `${fileBase}.css`,
    ]) {
        const path = join(distDir, file);
        if (existsSync(path)) console.log(`  ${describeFile(path)}`);
    }
}

function parseOptions(): PackagerOptions | null {
    const { values } = parseArgs({
        options: {
            app: { type: 'string' },
            out: { type: 'string' },
            name: { type: 'string' },
            version: { type: 'string', default: '0.1.0' },
            'work-dir': { type: 'string' },
            fresh: { type: 'boolean', default: false },
        },
    });
    if (!values.app || !values.out || !values.name) return null;
    if (!PACKAGE_NAME_PATTERN.test(values.name)) {
        throw new Error(`Invalid package name: ${values.name}`);
    }
    const appDir = resolve(values.app);
    if (!existsSync(join(appDir, 'src'))) {
        throw new Error(`${appDir} has no src/ directory`);
    }
    return {
        appDir,
        outDir: resolve(values.out),
        packageName: values.name,
        version: values.version,
        workDir: values['work-dir']
            ? resolve(values['work-dir'])
            : mkdtempSync(join(tmpdir(), 'lightdash-app-packager-')),
        fresh: values.fresh,
    };
}

const options = parseOptions();
if (options) {
    packageApp(options);
} else {
    console.error(USAGE);
    process.exitCode = 1;
}
