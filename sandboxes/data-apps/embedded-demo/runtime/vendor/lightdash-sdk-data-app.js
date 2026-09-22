// Generated from packages/frontend/sdk/DataApp.tsx by scripts/sync-sdk.mjs.

// ../../../packages/frontend/sdk/DataApp.tsx
import {
  createElement
} from "react";
function DataApp({
  module,
  providerProps,
  children
}) {
  if (module.contract.version !== 1) {
    throw new Error("Unsupported native Data App contract version");
  }
  return createElement(
    module.DataAppProvider,
    providerProps,
    children === void 0 ? createElement(module.AppComponent) : children
  );
}
function DataAppComponent({
  module,
  name
}) {
  if (!module.contract.components.includes(name) || !Object.prototype.hasOwnProperty.call(module.components, name)) {
    throw new Error(`Unknown native Data App component: ${name}`);
  }
  return createElement(module.components[name]);
}
export {
  DataApp,
  DataAppComponent
};
