# Native React Data Apps

Use the existing query SDK for governed queries and React state for composition.
This is an experimental Data Apps contract, not a new published SDK package.

Keep `src/data-app.tsx` as the entry for native consumers. Export `dataApp` through
`defineDataApp` from `@/lib/dataApp`, with `contractVersion: 1`, a stable kebab-case
id, a `Provider`, a complete `App`, and a named `components` map.

- Put queries in the shared provider or focused hooks using `useLightdash`.
- Give the provider typed filter props and callbacks such as `onStudySelect`.
- Keep authentication in the surrounding `LightdashProvider`. Do not read tokens
  from page URLs, create a second root, or attach a global client in a component.
- Assemble the complete App from the exported components. The viewer and native
  host must use the same components and governed metric definitions.
- Components must fit their container. Use `width: 100%`, flex/grid, and
  ResizeObserver where needed. Do not size them against the host's `100vh`.
- Put changes to filters and selections through typed props or context callbacks.
  Customer actions belong to the host. Do not require window message listeners
  for native composition.
- Keep exports stable during edits. Removing an export or changing required props
  needs a contract migration. Publish source and native artifacts as one release.
- Keep the SDK's supported theme behavior. CSS scoping is not code isolation.

The native packager consumes this file without rewriting the application's
component structure. React must be a peer dependency in a distributable package;
a standalone ESM host must resolve app and host imports to the same React runtime.

`@lightdash/sdk` already supplies React Chart, Dashboard and Explore components.
Use those for saved Lightdash content when the host supplies their supported embed
token. Do not pass an app-scoped embed JWT to a saved-chart component and assume
the permissions are interchangeable. App queries use the query SDK transport.

The FP&A reference in `sandboxes/data-apps/embedded-demo/app-src/data-app.tsx`
demonstrates this contract with live data, shared filters, and selection events.
