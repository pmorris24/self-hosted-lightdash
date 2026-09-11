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

| Option       | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| `--app`      | Directory containing the app's `src/` (what Claude Code writes)             |
| `--out`      | Output package directory                                                    |
| `--name`     | npm package name; the unscoped part names the output files and CSS scope   |
| `--version`  | Package version (default `0.1.0`)                                           |
| `--work-dir` | Reusable staging directory (default: a new temp directory)                  |
| `--fresh`    | Rebuild the staging directory, required after changing `packages/query-sdk` |

Requires Node with TypeScript type stripping (22.18+), `pnpm`, `sfw` on `PATH`, and network access to the npm registry and `ui.shadcn.com`.

## What it does

1. Stages the template the way `e2b.Dockerfile` does: packs `packages/query-sdk`, points `workspace:*` at the tarball, installs, runs shadcn `init`/`add`, and restores `tailwind.config.js`.
2. Copies `template/src`, then the app's `src/`, then `entry.jsx` (which replaces `main.jsx` as the build entry) and the `runtime/` helpers.
3. Builds twice with `vite.lib.config.js`, which extends the template's `vite.config.js`:
    - `<name>.js` leaves `react` and `react-dom` as imports, for bundlers.
    - `<name>.standalone.js` bundles React, for any page and for the app viewer.
4. Writes `package.json`, `dist/index.d.ts`, and `dist/index.html` + `dist/boot.js` for serving the build in the app viewer.

The shadcn CLI runs outside `sfw` because its registry fetch fails behind the firewall's TLS proxy. The CLI download and the package installs it spawns still go through `sfw`.

## Keeping the app inside its element

A native import has no iframe, so the build isolates the app instead:

- **CSS.** `postcss-scope.js` scopes every rule to `.ld-app-<name>`. `:root`, `html` and `body` rules move onto the scope element, `.dark` rules apply when the scope element or an ancestor such as `<html>` has `dark`, everything else only matches inside the scope, and `:where()` keeps specificity unchanged. Tailwind's preflight, the theme tokens and the Radix `!important` rules no longer reach the host page.
- **Import order.** The generated entry keeps the order of the app's `main.jsx`: stylesheets imported before or after `App` decide which theme tokens win.
- **Portals.** `@radix-ui/react-portal` is aliased to `runtime/radixPortal.js`, and `createPortal(…, document.body)` in app code is rewritten (`vite-scoped-portals.js`), so menus, selects, dialogs and custom floating menus render into a scoped portal root.
- **Page-level behaviour.** `mount(el, embedOptions)` uses `createEmbedClient`, which puts the SDK in embedded mode: URL state stays in memory, the colour scheme is applied to the app's root instead of `<html>`, and nothing is posted to `window.parent`. The template's global error handler and screenshot handler only run in the viewer.

In the app viewer the page belongs to the app, so `<body>` carries the scope class and portals render into it, matching the sandbox build.

## Output

```
<out>/package.json
<out>/dist/<name>.js             default export; react and react-dom are peers
<out>/dist/<name>.standalone.js  React bundled
<out>/dist/<name>.css            loaded by mount() from beside the module
<out>/dist/index.d.ts
<out>/dist/index.html            app viewer entry
<out>/dist/boot.js
```

Served as built (a CDN or static host), `mount()` loads the stylesheet beside the module. A host app that bundles the package imports the stylesheet itself:

```js
import { mount } from 'inference-usage-sample'; // or 'inference-usage-sample/standalone'
import 'inference-usage-sample/style.css';

const app = mount(document.getElementById('analytics'), {
    embedToken, // minted by the customer's backend
    baseUrl: 'https://app.lightdash.cloud',
    projectUuid,
    appUuid,
    colorScheme: 'light',
});
app.setColorScheme('dark');
app.unmount();
```

## Limits

- **Backend.** Standalone data app embed tokens can run metric queries and external fetches. They are refused for saved charts (`savedChart`), underlying data and custom SQL fields. The project's embed settings must allow the app, and the host origin must be in the instance's CORS allowlist.
- **Inbound CSS.** Host rules more specific than the app's can still reach inside the app; only shadow DOM would stop that, and it breaks Radix portals.
- **App code.** Code that touches `document.body` or `window` directly, other than `createPortal`, still acts on the host page.
- **React.** The default build expects React 19 from the host.
- **Staging reuse.** A reused `--work-dir` keeps files left in `src/` by previously packaged apps.
