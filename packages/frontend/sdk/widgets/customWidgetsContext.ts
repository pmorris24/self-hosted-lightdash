import { createContext, useContext, type ComponentType } from 'react';
import { type DataColumn, type DataRow } from '../data/types';

// What a custom widget receives. It draws the rows any way it likes.
export type CustomWidgetProps<Options = Record<string, unknown>> = {
    rows: DataRow[];
    columns: DataColumn[];
    options: Options;
    // Report a click on a data point, in the same shape as `DataChart`.
    onSelect?: (selection: {
        row: Record<string, unknown>;
        columns: string[];
        position: { left: number; top: number };
    }) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CustomWidgetComponent = ComponentType<CustomWidgetProps<any>>;

export type CustomWidgetRegistry = {
    registerCustomWidget: (
        customWidgetType: string,
        component: CustomWidgetComponent,
    ) => void;
    hasCustomWidget: (customWidgetType: string) => boolean;
    getCustomWidget: (
        customWidgetType: string,
    ) => CustomWidgetComponent | undefined;
};

export const CustomWidgetsContext = createContext<CustomWidgetRegistry | null>(null);

export const useCustomWidgets = (): CustomWidgetRegistry => {
    const registry = useContext(CustomWidgetsContext);
    if (!registry) {
        throw new Error(
            'Lightdash SDK: wrap this component in <Lightdash.CustomWidgetsProvider>.',
        );
    }
    return registry;
};

export const useOptionalCustomWidgets = (): CustomWidgetRegistry | null =>
    useContext(CustomWidgetsContext);
