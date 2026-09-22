import type {
    ApiErrorDetail,
    ChartConfig,
    ChartType,
    DateZoom,
    EChartsSeries,
    ItemsMap,
    MetricQuery,
    ParametersValuesMap,
    ResultRow,
    StackType,
} from '@lightdash/common';
import type { Map as LeafletMap } from 'leaflet';
import { createContext, type RefObject } from 'react';
import { type CartesianTypeOptions } from '../../hooks/cartesianChartConfig/useCartesianChartConfig';
import { type SeriesLike } from '../../hooks/useChartColorConfig/types';
import { type InfiniteQueryResults } from '../../hooks/useQueryResults';
import { type EChartsReact } from '../EChartsReactWrapper';
import { type EchartsSeriesClickEvent } from '../SimpleChart';
import { type VisualizationConfig } from './types';

export type EmbeddedDashboardInteractivity = {
    canDrillDown: boolean;
    canCrossFilter: boolean;
};

export type SavedChartReference = {
    uuid: string;
    chartConfig: ChartConfig;
};

type VisualizationContext = {
    minimal: boolean;
    chartRef: RefObject<EChartsReact | null>;
    leafletMapRef: RefObject<LeafletMap | null>;
    pivotDimensions: string[] | undefined;
    resultsData:
        | (InfiniteQueryResults & {
              metricQuery?: MetricQuery;
              fields?: ItemsMap;
              resolvedTimezone?: string;
          })
        | undefined;
    isLoading: boolean;
    columnOrder: string[];
    itemsMap: ItemsMap | undefined;
    visualizationConfig: VisualizationConfig;
    // cartesian config related
    setStacking: (value: boolean | StackType | undefined) => void;
    setCartesianType(args: CartesianTypeOptions | undefined): void;
    // --
    onSeriesContextMenu?: (
        e: EchartsSeriesClickEvent,
        series: EChartsSeries[],
    ) => void;
    // Pie and funnel: a viewer clicked a slice. When set, it takes the place
    // of the built-in context menu.
    onDataPointSelect?: (point: DataPointSelection) => void;
    setChartType: (value: ChartType) => void;
    setPivotDimensions: (value: string[] | undefined) => void;

    getSeriesColor: (seriesLike: SeriesLike) => string;
    getGroupColor: (groupPrefix: string, groupName: string) => string;
    colorPalette: string[];
    chartConfig: ChartConfig;
    savedChartUuid?: string;
    savedChartReference?: SavedChartReference;
    apiErrorDetail?: ApiErrorDetail | null;
    parameters?: ParametersValuesMap;
    // Container dimensions for responsive visualizations
    containerWidth?: number;
    containerHeight?: number;
    isDashboard?: boolean;
    isEditMode?: boolean;
    embeddedDashboardInteractivity?: EmbeddedDashboardInteractivity;
    hasExplorerStore: boolean;
    // Touch device detection for tooltip positioning
    isTouchDevice: boolean;
    // Resolved timezone for formatting (undefined when EnableTimezoneSupport flag is off)
    resolvedTimezone?: string;
    // Date-zoom granularity applied by the surface (dashboards); undefined elsewhere.
    dateZoom?: DateZoom;
};

const Context = createContext<VisualizationContext | undefined>(undefined);

export default Context;

export type DataPointSelection = {
    // The result rows behind the clicked slice.
    rows: ResultRow[];
    // Viewport pixels.
    position: { left: number; top: number };
};
