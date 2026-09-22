import type { ComponentType, PropsWithChildren } from 'react';

export type DataAppDefinition<Props, Components> = {
    contractVersion: 1;
    id: string;
    Provider: ComponentType<PropsWithChildren<Props>>;
    App: ComponentType;
    components: Components;
};

/** A shared provider and explicit exports for the viewer and React hosts. */
export function defineDataApp<Props, Components extends Record<string, ComponentType>>(
    definition: DataAppDefinition<Props, Components>,
): DataAppDefinition<Props, Components> {
    if (definition.contractVersion !== 1 || !/^[a-z][a-z0-9-]*$/.test(definition.id)) {
        throw new Error('Unsupported Data App contract');
    }
    if (!Object.keys(definition.components).length) {
        throw new Error('A Data App must export at least one component');
    }
    for (const name of Object.keys(definition.components)) {
        if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) throw new Error('Invalid component export');
    }
    return Object.freeze({ ...definition, components: Object.freeze({ ...definition.components }) });
}
