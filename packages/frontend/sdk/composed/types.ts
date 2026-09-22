import { type SdkChartSelection } from '../../src/ee/features/embed/EmbedChart/types';
import { type SdkFilter } from '../../src/ee/features/embed/EmbedDashboard/types';

export type ComposedWidget = {
    // Stable id of this piece on the host page.
    id: string;
    // The saved chart to render.
    chartUuid: string;
    title?: string;
    // A click on this widget filters the other widgets. Default: true.
    crossFilter?: boolean;
    // Shared filters this widget does not take: all of them, or some fields.
    ignoreFilters?: boolean | string[];
};

export type ComposedLayoutCell = {
    widgetId: string;
    widthPercentage: number;
    height?: number;
};

export type ComposedLayoutRow = {
    cells: ComposedLayoutCell[];
};

export type ComposedLayoutColumn = {
    widthPercentage: number;
    rows: ComposedLayoutRow[];
};

export type ComposedLayout = {
    columns: ComposedLayoutColumn[];
};

export type ComposedDashboardProps = {
    title?: string;
    widgets: ComposedWidget[];
    filters?: SdkFilter[];
    layout?: ComposedLayout;
};

export type ComposedDashboardChangeEvent =
    | { type: 'filters/updated'; payload: SdkFilter[] }
    | {
          type: 'selection/changed';
          payload: { widgetId: string; selection: SdkChartSelection };
      }
    | { type: 'layout/updated'; payload: ComposedLayout };

export type UseComposedDashboardOptions = {
    onChange?: (event: ComposedDashboardChangeEvent) => void;
};

// A widget plus the props to spread onto `Lightdash.Chart`.
export type ComposedWidgetState = ComposedWidget & {
    chartProps: {
        id: string;
        filters: SdkFilter[];
        onSelect: (selection: SdkChartSelection) => void;
    };
};

export type ComposedDashboardResult = {
    dashboard: {
        title: string | undefined;
        widgets: ComposedWidgetState[];
        filters: SdkFilter[];
        layout: ComposedLayout;
    };
    setFilters: (filters: SdkFilter[]) => void;
    addFilter: (filter: SdkFilter) => void;
    removeFilter: (filter: Pick<SdkFilter, 'model' | 'field'>) => void;
    clearFilters: () => void;
    setLayout: (layout: ComposedLayout) => void;
};
