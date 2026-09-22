import {
    createElement,
    type ComponentType,
    type PropsWithChildren,
} from 'react';

export type NativeDataAppModule<ProviderProps> = {
    contract: {
        version: 1;
        id: string;
        components: string[];
    };
    DataAppProvider: ComponentType<PropsWithChildren<ProviderProps>>;
    AppComponent: ComponentType;
    components: Record<string, ComponentType>;
};

export type DataAppProps<ProviderProps> = PropsWithChildren<{
    module: NativeDataAppModule<ProviderProps>;
    providerProps: ProviderProps;
}>;

/** Render a trusted, preloaded Data App with the host's React runtime. */
export function DataApp<ProviderProps extends object>({
    module,
    providerProps,
    children,
}: DataAppProps<ProviderProps>) {
    if (module.contract.version !== 1) {
        throw new Error('Unsupported native Data App contract version');
    }
    return createElement(
        module.DataAppProvider,
        providerProps,
        children === undefined ? createElement(module.AppComponent) : children,
    );
}

/** Named components share the provider's queries, filters, and events. */
export function DataAppComponent<ProviderProps extends object>({
    module,
    name,
}: {
    module: NativeDataAppModule<ProviderProps>;
    name: string;
}) {
    if (
        !module.contract.components.includes(name) ||
        !Object.prototype.hasOwnProperty.call(module.components, name)
    ) {
        throw new Error(`Unknown native Data App component: ${name}`);
    }
    return createElement(module.components[name]);
}
