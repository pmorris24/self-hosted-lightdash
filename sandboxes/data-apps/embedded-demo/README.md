# Compose SDK for Lightdash Data Apps

Live demo: https://lightdash-portable-apps-demo.vercel.app

This standalone React page proposes a Compose SDK for Lightdash Data Apps.
It extends the existing React and query SDK direction with a shared component
model for Data Apps creation, publication, and composition in external React
products. Compose SDK is the proposed product capability, not a released package.
It has two top-level tabs. **Iframe** is the default and shows the actual
Lightdash-hosted app inside its document boundary. **Compose SDK** presents
one continuous proposal with working React examples woven into its arguments.

The customer-workflow chapter pairs study financials with a custom review form.
Developer control connects vendor variance to shared filters and follow-ups.
Reuse and governance connects the forecast and milestone components to the same
published source. Budget, spend, and site sections remain fully available.
The complete builder proposal follows the portfolio summary. An open SDK code
example follows the study workflow. Built/proposed scope sits after vendor
follow-ups, and the publication proposal follows forecast planning. Only the
final decision and scope disclosure close the page. There is no separate proposal
dialog or condensed proposal appendix.

Tab changes preserve mounted native workflows after the first visit. Filters,
review forms, saved actions, and scenario settings stay available when viewers
switch back. Both views share theme and refresh controls. Demo review actions
stay in browser-tab sessionStorage; they do not write to Lightdash.

## Native delivery

The viewer never compiles source. `api/native.js` checks the latest ready Lightdash version, then reads completed artifacts from Vercel Blob. Immutable JavaScript/CSS responses use browser and Vercel CDN caches. The viewer function does not import the compiler.

`api/publish.js` is a separate authenticated POST endpoint. It reads only the configured app's latest ready source, compiles with the pinned runtime, uploads JavaScript and CSS, then writes `ready.json` last. A failed build or upload cannot expose an incomplete release. A changed version during the source download aborts publication. Repeat calls skip a completed version. Concurrent calls within a function share the same job.

Production deployment calls the same publisher before the deployment can become ready. Thus the current app is prebuilt before the React host reaches viewers. Runtime hashes isolate artifacts from incompatible compiler releases.

**Remaining integration:** Lightdash Cloud does not currently call this demo publisher. Automatic publication after a Cloud edit needs an external scheduled job, a frequent Vercel cron on a suitable plan, or a product-side publish trigger. The Vercel Hobby plan only supports daily cron jobs. No scheduler is configured yet. If a new Lightdash version lacks its native artifact, the viewer shows an explicit publication-pending error; it does not build in the request or silently present an older version as current.

A publishing job calls:

```sh
DEMO_URL=https://lightdash-portable-apps-demo.vercel.app node scripts/publish.mjs
```

The job reads `NATIVE_PUBLISH_SECRET` from its server environment. Do not put it in the UI, browser storage, a URL, or a command argument. This credential permits native publication only; it is separate from Lightdash credentials.

## Source and build

- `host/App.jsx`: React page and product proposal.
- `host/useComparison.jsx`: lazy iframe bridge, prebuilt module loading, and shared state.
- `host/ComponentWorkspace.jsx`: component choices, direct study events, and a matching copyable React integration example.
- `host/host.css`: the host layout and shared light/dark theme tokens for the native components.
- `runtime/compiler.js`: trusted esbuild/Tailwind pipeline and scoped portals/CSS. It never executes downloaded build scripts or configuration on the server.
- `app-entry.jsx`: mount contract around the published app.
- `app-src/`: source fixture for compiler checks; not a runtime fallback.
- `public/bundles/`: historical packager output; not loaded by the React host.

```sh
npm run build
node --test tests/*.test.mjs
node scripts/audit-host.mjs
```

The build bundles React with esbuild, checks deployable text for embedded JWTs, and produces `dist/`. Dependencies are pinned; installation uses `npm ci --ignore-scripts`. Deploy this directory with `vercel deploy --prod`. There is no Git deployment connection.

## Server variables

Project: `patricks-projects-281a2b21/lightdash-portable-apps-demo`.

- `LIGHTDASH_URL`, `LIGHTDASH_PROJECT_UUID`, `LIGHTDASH_APP_UUID`
- `LIGHTDASH_EMBED_SECRET`: creates one-hour, fixed-app JWTs.
- `LIGHTDASH_SOURCE_TOKEN`: downloads the configured published source.
- `DEMO_CONNECTION_ENABLED=true`
- `BLOB_READ_WRITE_TOKEN`: Vercel-managed artifact storage credential.
- `NATIVE_PUBLISH_SECRET`: authenticates the independent publisher.

Patrick approved public demo access and the two Lightdash credential transfers into Vercel variables. No secret or query result enters the public artifact cache. Keep the stable host origin in Lightdash's CORS allowlist and the published app's message-bridge allowlist.

## Comparison contract

The iframe is the real Lightdash-hosted embed. Its nested sandbox has an opaque origin; the host verifies the exact WindowProxy before accepting messages. The bridge passes only shared controls, never credentials. Hosted-app failures retry twice and remain visible if retries fail.

The native module uses an embed-authenticated SDK, scoped CSS/portals, and direct lifecycle methods. It exports the whole app and twelve reusable components. The host composes those components in one shared React tree. Both routes support themes and filters. Native code shares the host JavaScript environment, so the customer must trust it.

The native reporting controls share the host page. The iframe retains its own reporting controls inside its document. Timing totals end at data-ready signals; native app delivery excludes compilation. Cache states are uncontrolled. No speed advantage is claimed.

## Design refinement

Applied Faraday's `brand-design-engineer` skill and Patrick's design layer from `gtm-project-glass`: retain the comparison, reduce stacked toolbar space, use Britti Sans and Inter, keep the primary purple, and use connected rules for the product case. The interactive host uses its own CSS rather than the print-document shell. No PDF was requested.

The HTML audit runs against a server-rendered copy of the React host. Browser checks must also cover live desktop and narrow layouts, filter retention, theme, lifecycle, and errors. Audit warnings for compact 12px UI text and deliberate embed viewport clipping require visual inspection.

## Verified deployment — September 11, 2026

Production deployment `dpl_9mNHuwUmu9G3di4EJ9PBqhoHVb9A` prebuilt app v28 before aliasing the host. Seven compiler/publisher tests pass. Live browser checks passed for both data-ready signals, matching Cortex program results, Lightdash dark theme in both routes, refresh retention in both routes, native unmount/remount, and rejection of unauthenticated publication. No page overflow occurred at 1440, 768, or 390px. The last browser run recorded zero JavaScript page errors.

The hosted iframe needed a retry in the final run; its 20.80s total includes that retry. Native was 2.98s total, with 0.65s delivery and 2.33s data/render. This is an observation, not a controlled benchmark. Cloud's preview-domain issue remains outside the deployed host; the host now waits for data readiness before ending startup retries.

Brand HTML audit: 0 errors, 15 warnings. Warnings cover the standalone host stylesheet, compact 12px UI labels, and intentional viewport clipping around scrollable embeds. The interactive app adapts Faraday's design guidance rather than using its print-document shell. Desktop and narrow renderings were inspected. The screenshots and check report for this session are in `/private/tmp/lightdash-react-host-audit/`.

A later verification run loaded native data but timed out waiting 60 seconds for the hosted iframe. The interactive browser also reached its iframe retry limit. One native network request recovered with Refresh both. These observed Cloud failures remain unresolved; the successful control checks above do not establish service reliability. Automatic builds after future Cloud publishes also remain unconnected pending the scheduler/product-trigger choice.

Focus-view correction: the FP&A app's `height: 100vh` resolved against the host browser, leaving unused space when scaled down and clipping the bottom in native-only mode. The host now sets the scoped app root to its mount container's height. Browser checks cover normal, focused, native-only, 100% zoom, leaving focus, and scrolling the dashboard. This is a scoped fix for this app; container-aware layout belongs in the proposed component contract for generated Data Apps.

The proposal now includes adapting the Data Apps builder to generate with the supported React SDK from the start. Publishing would produce both the Lightdash view and native React exports, with whole-app and individual-component consumption. This is proposed product work, not an implemented change to the Cloud Data Apps builder.

## Full FP&A component workspace

The published FP&A source now includes `src/data-app.tsx`. Its contract exports
`Provider`, `App`, and twelve components: reporting controls, portfolio KPIs,
attention items, forecast scenarios, milestone forecast, budget/actual/forecast,
spend pivot, budget by status, vendor variance, program financials, sites, and
study directory. They reuse the existing query SDK and the full
app's governed data hook and chart implementations. This is an experimental
Data Apps contract, not a new published SDK or an alternative to `@lightdash/sdk`.
The existing Chart/Dashboard SDK uses its own embed-token contract; app JWTs do
not gain saved-chart permissions through this change.

The native module exports `DataAppProvider`, `AppComponent`, `components`, and
`contract`, as well as the existing imperative `mount` adapter. The host and
native module resolve React through one import map and one shared vendor build.
The native compiler externalizes React and ReactDOM. It requires an explicit
Data App component entry instead of extracting DOM from a complete app.

The native application:

- Renders independently exported components in the host's React tree.
- Organizes the full FP&A tools into Overview, Forecast Lab, Budget & spend, Portfolio, and Sites.
- Retains scenario and pivot state when moving between pages.
- Keeps reporting close, lookback, horizon, and vendor filters in host state across Refresh views.
- Receives controlled program, phase, status, vendor, reporting period, and theme settings.
- Sends a selected study through `onStudySelect` into a host-owned review panel.
- Keeps the review action in page state only; it does not write to Lightdash.
- Defers its queries until the workspace approaches the viewport.

The repository's Data Apps starter now declares the same contract through
`src/lib/dataApp.ts` and `src/data-app.tsx`. Its generation guide describes
shared providers, container sizing, exports, and typed events. This template
change is local to the branch; it has not been rolled out to Lightdash Cloud.
An automatic source-publication trigger is still pending the hosting choice
noted above. The current production deployment prebuilds v29.

Validation: nine compiler/contract/publisher tests, plus browser checks for
component rendering, study events, filter propagation, theme, and page width at
1440, 768, and 390px. A live check after deployment verifies the deployed assets.

The host now uses the experimental `DataApp` and `DataAppComponent` adapter
implemented in `packages/frontend/sdk/DataApp.tsx`. The SDK build exports it
through both the main entry and `@lightdash/sdk/data-app`, with ESM, CJS, and
TypeScript declarations. `node scripts/sync-sdk.mjs` copies that exact source
into the demo's vendored runtime before deployment; no npm release is implied.
Four focused adapter tests, the frontend SDK typecheck, and the lightweight
SDK subpath build pass.

Final component deployment: `dpl_5eSkMDKknEs79dnUufJfpsKEMtTt`, serving FP&A v29
at the stable demo alias. Live checks passed for the SDK adapter, component
switching, study events, filter propagation and selection reset, dark theme,
refresh retention, and no page overflow at 1440/768/390px. The run reported zero
JavaScript page errors. The current template and SDK changes remain on this
branch; neither an npm release nor a Lightdash Cloud platform rollout occurred.


## Composition-first presentation

The previous side-by-side whole-app panels are replaced by two full-width tabs.
Composable React is the default. Its chart selector and summary/study toggles
change the real React tree; the code excerpt updates to match and can be copied.
The iframe tab demonstrates whole-app delivery and explains its message boundary.
Both support the same filters and theme. The comparison makes no claim that
iframes cannot support events, or that React requires fewer lines for a whole app.

Browser checks cover lazy iframe loading, removal of the legacy native mount,
component toggles, matching copied code, study events, shared filters and theme,
tab/refresh retention, and page width at 1440, 768, and 390px.

Deployed as `dpl_56PxVbs8tQsF3EGzXWctoC44mjXS`. The final live browser run passed
all composition, clipboard, iframe, retention, and responsive-width checks with
zero JavaScript page errors. FP&A source remains v29.


Full FP&A workspace validation (source v30): nine compiler/release tests pass.
Browser checks cover all five pages, scenario retention, reporting-close and
lookback changes, budget row expansion, pivot field removal and retention,
study selection/review, site selection/map reset, vendor/program filtering,
Refresh views retaining reporting settings, component removal/code updates,
and layout at 1440, 768, and 390 pixels. The review action remains demo-only.

Production verification: native interactions passed on the deployed v30 app.
The hosted iframe returned an intermittent Lightdash 404 during one check and
loaded successfully on retry. This remains a hosted-app reliability limitation.
Deployment: dpl_GD5CxvrFpeSW8uE115CkAsVx93NT.

The native presentation is one continuous scrollable page under the Lightdash
proposal header. Overview, Forecast Lab, Budget & spend, Portfolio, and Sites
are visible together, without section tabs or a fictional host brand. Custom
review workflows remain beside the data. The iframe remains a separate comparison.

Host workflows: study selection opens an owner/notes form; vendor filters drive a
vendor follow-up form; saved actions appear in the Overview review queue with
complete/reopen/remove controls. These demo actions persist in sessionStorage in
the current browser tab and do not send messages or write to Lightdash.
Browser checks cover both workflows, component controls, shared theme, all five
pages, and overflow at 1440, 768, and 390 pixels.

Single-page verification: all five native sections render together; study review,
vendor follow-up, and responsive layouts at 1440/768/390 pixels passed with no
browser errors.


Product case redesign verification: compiler/release tests pass (9). Browser
checks cover native study search/sort/expansion, owner/notes review creation,
vendor follow-up, complete/reopen, reporting changes retaining forecast drivers,
budget row expansion, site selection/reset, comparison and proposal dialogs,
and all sections at 1440/768/390 pixels without page overflow. Native and host
surfaces share light/dark tokens. Study selection clears when its data changes,
matching the review panel. New source files: components/NativePortfolio.tsx and
native-workspace.css. Host workflow styles are isolated in host/workflow.css.

Production verification of source v31 passed with no browser errors, including
consistent table/review selection after filter changes. The product case and
live workflows share the same scrollable surface; the iframe is optional in a
dialog, and the full implementation detail is available from the proposal action.

## Design engineering refinement — September 11, 2026

Applied Faraday’s Brand Design Engineer skill and Patrick’s design layer to the
existing interactive React app. The opening now pairs the Lightdash statement
with links to working native workflows. Component/state/workflow rails connect
the proposal to the study, vendor, and forecast examples. The index scrolls
through the continuous page; it does not change or hide sections.

Host controls and helper text use a 12px floor. The attention strip and study
review use connected surfaces. Both themes share the same layout. The native proposal header uses the original Faraday `Purple-Bar.png` banner,
bundled unchanged and displayed at its 2304:320 aspect ratio. This replaces the
rejected corner graphic; it does not cover the proposal text.

Build and browser checks passed at 1920, 1440, 768, and 390px. Checks cover the
section index, study selection and reviews, vendor context and follow-ups,
expanded React examples, metric grouping, and both themes. Brand HTML audit:
0 errors, 92 warnings. Warnings concern app theme colors, compact 12–13px UI
text, intentional internal overflow, and the standalone bundled stylesheet.
Renders were inspected. Code braces are encoded as HTML text in the audit
export so the document placeholder checker can read the literal JSX sample.

## Iframe and Native React tabs — September 11, 2026

The demo starts on the real iframe. The second tab contains the full product
proposal, with live study reviews, vendor follow-ups, forecast, budget, spend,
and site components woven into the argument. The native proposal ends with
the proposed builder workflow, delivery architecture, built/proposed scope,
and the SDK decision. The proposal no longer opens in a dialog.

Browser checks covered the default tab, the live iframe data-ready signal,
keyboard tab navigation, preserved review and scenario state, vendor filters,
three responsive widths, both themes, and the complete proposal layout.
A separate layout check confirmed heading breaks and sticky navigation spacing.
Brand audit: 0 errors, 104 warnings across theme tokens, compact operational
labels, bundled CSS, and intentional internal overflow. The renders were
inspected in light and dark mode. Native source remains v31.
