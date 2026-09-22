# Experimental native Data Apps

This branch extends `@lightdash/sdk` with `DataApp`, `DataAppComponent`, and a
lightweight `@lightdash/sdk/data-app` entry. These exports are not yet released
to npm. Existing Chart, Dashboard, and Explore behavior is unchanged.

`DataApp` renders a trusted module that the host has already loaded. It uses
the module's provider, passes typed provider props, and renders the complete
app when no children are supplied. Children replace that default layout.
`DataAppComponent` selects an explicitly declared component export.

```tsx
import { DataApp, DataAppComponent } from '@lightdash/sdk/data-app';

<DataApp module={publishedApp} providerProps={appProps}>
    <DataAppComponent module={publishedApp} name="Forecast" />
    <DataAppComponent module={publishedApp} name="StudyList" />
</DataApp>
```

The module contract contains version `1`, a stable app id, declared component
names, a `DataAppProvider`, an `AppComponent`, and a component map. The module's
provider owns its query SDK connection, data context, filter props, and event
callbacks. Query authorization remains with Lightdash. The adapter does not
convert app embed tokens into saved-chart tokens or grant new permissions.

The host and module must use the same React runtime. Build npm modules with
React externalized as a peer dependency. For browser-loaded ESM, supply an
import map that resolves React and ReactDOM to the host's shared runtime.
The module must also supply its scoped stylesheet. The adapter does not
download code, inject styles, mint tokens, or provide a security sandbox.

Wrap the integration in the host's error boundary. Unknown component names
and unsupported contract versions produce explicit errors. Keep component
names and provider props compatible when publishing a new module version.

The FP&A demo uses the exact adapter source through
`sandboxes/data-apps/embedded-demo/scripts/sync-sdk.mjs`. It shows shared filter
props and a study-selection callback into a host-owned review panel.
