import { type SdkFilter } from '../EmbedDashboard/types';

export type SdkChartSelectionValue = {
    model: string;
    field: string;
    fieldId: string;
    value: unknown;
};

// What a host page receives when a viewer clicks a data point.
export type SdkChartSelection = {
    chartUuid: string;
    values: SdkChartSelectionValue[];
    // The same selection as filters, ready to pass back through `filters`.
    filters: SdkFilter[];
    row: Record<string, unknown> | undefined;
    // Where the viewer clicked, in viewport pixels. For a host context menu.
    position: { left: number; top: number };
};
