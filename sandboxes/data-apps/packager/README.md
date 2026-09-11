# Data App packager

Packages a Data App built on `template/` as an importable ES module. The same build runs in the Lightdash app viewer (postMessage transport) and in a customer's own frontend (embed JWT transport).

## Usage

From `sandboxes/data-apps`:

```bash
node packager/package-app.ts \
    --app packager/sample-app \
    --out /tmp/inference-usage-sample \
    --name inference-usage-sample
```

| Option             | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `--app`            | Directory containing the app's `src/` (what Claude Code writes)             |
| `--out`            | Output package directory                                                    |
| `--name`           | npm package name; the unscoped part names the output files                 |
| `--version`        | Package version (default `0.1.0`)                                           |
| `--external-react` | Leave `react` and `react-dom` as imports and declare them as peers          |
| `--work-dir`       | Reusable staging directory (default: a new temp directory)                  |
| `--fresh`          | Rebuild the staging directory, required after changing `packages/query-sdk` |

Requires Node with TypeScript type stripping (22.18+), `pnpm`, `sfw` on `PATH`, and network access to the npm registry and `ui.shadcn.com`.

## What it does

1. Stages the template the way `e2b.Dockerfile` does: packs `packages/query-sdk`, points `workspace:*` at the tarball, installs, runs shadcn `init`/`add`, and restores `tailwind.config.js`.
2. Copies `template/src`, then the app's `src/`, then `entry.jsx`, which replaces `main.jsx` as the build entry.
3. Builds with `vite.lib.config.js`, which extends the template's `vite.config.js` and loads no env vars, so a local API key can't be inlined.
4. Writes `package.json`, `dist/index.d.ts`, and `dist/index.html` + `dist/boot.js` for serving the build in the app viewer.

The shadcn CLI runs outside `sfw` because its registry fetch fails behind the firewall's TLS proxy. The CLI download and the package installs it spawns still go through `sfw`.

## Output

```
<out>/package.json
<out>/dist/<name>.js     exports mount(el, embedOptions?)
<out>/dist/<name>.css    loaded by mount() from beside the module
<out>/dist/index.d.ts
<out>/dist/index.html    app viewer entry
<out>/dist/boot.js
```

```js
import { mount } from 'inference-usage-sample';

const unmount = mount(document.getElementById('analytics'), {
    embedToken, // minted by the customer's backend
    baseUrl: 'https://app.lightdash.cloud',
    projectUuid,
});
```

## Host differences

|                                            | App viewer (`mount(el)`)          | Customer frontend (`mount(el, embedOptions)`) |
| ------------------------------------------ | --------------------------------- | --------------------------------------------- |
| Client                                     | `createClient()`, postMessage     | `createEmbedClient()`, embed JWT              |
| Global error handler, screenshot handler   | On                                | Off: both act on the whole page               |
| Inspector, lineage, host colour scheme     | On                                | Off                                           |

## Open decisions

- **CSS is global.** Tailwind preflight and the template's `:root`, `*`, `html, body` and Radix rules restyle the host page. Shadow DOM would isolate it but breaks Radix portals to `document.body`.
- **React bundled or external.** Bundling works on any page; `--external-react` saves roughly 64 kB gzip but the host must provide React 19 through its bundler or an import map.
- **URL state.** `useUrlState` and the template's global filters write to the host page's URL outside the viewer.
- **Viewer-only SDK features.** `externalFetch`, `exportToSheets`, delivery renders and viz context need the postMessage host.
- **Staging reuse.** A reused `--work-dir` keeps files left in `src/` by previously packaged apps.
