import type {
    LightdashChartModel,
    LightdashQueryRows,
    RunMetricQueryOptions,
} from '../api';
import type {
    DataChartType,
    DataColumn,
    DataOptions,
    DataRow,
} from '../data/types';

// The arguments `useMetricQuery` and `runMetricQuery` take for a saved chart.
export type ChartModelQueryParams = Omit<
    RunMetricQueryOptions,
    'signal' | 'projectUuid'
>;

type ChartModelRowsProps = {
    rows: DataRow[];
    columns: DataColumn[];
};

export type ChartModelDataChartProps = ChartModelRowsProps & {
    chartType: DataChartType;
    dataOptions: DataOptions;
};

export type ChartModelDataTableProps = ChartModelRowsProps & {
    valueColumns: string[];
};

export type ChartModelDataPivotTableProps = ChartModelRowsProps & {
    rowFields: string[];
    columnField: string;
    value: string[];
};

type ChartModelFrameProps = {
    title: string;
    description?: string;
};

export type ChartModelDataChartWidgetProps = ChartModelFrameProps &
    ChartModelDataChartProps;

export type ChartModelPivotTableWidgetProps = ChartModelFrameProps &
    ChartModelDataPivotTableProps;

export type ChartModelWidgetProps =
    | ({ widgetType: 'dataChart' } & ChartModelDataChartWidgetProps)
    | ({ widgetType: 'pivot' } & ChartModelPivotTableWidgetProps);

// Props for `Chart` and `ChartWidget`, from the model alone: the chart runs
// the query itself.
export type ChartModelChartProps = ChartModelQueryParams & {
    chartType: DataChartType;
    dataOptions: DataOptions;
};

export type ChartModelChartWidgetProps = ChartModelFrameProps &
    ChartModelChartProps;

const CHART_KIND_TO_DATA_CHART_TYPE: Record<string, DataChartType> = {
    line: 'line',
    horizontal_bar: 'bar',
    vertical_bar: 'column',
    scatter: 'scatter',
    area: 'area',
    mixed: 'column',
    pie: 'pie',
    big_number: 'kpi',
    funnel: 'funnel',
    treemap: 'treemap',
    gauge: 'gauge',
    map: 'map',
    sankey: 'sankey',
};

/** The data chart type of a saved chart kind. Null for a table or a custom chart. */
export const toDataChartType = (
    chartKind: string | null,
): DataChartType | null =>
    chartKind ? (CHART_KIND_TO_DATA_CHART_TYPE[chartKind] ?? null) : null;

/** The arguments of the saved chart's query, for `useMetricQuery`. */
export const toMetricQueryParams = (
    chart: LightdashChartModel,
    overrides: Partial<ChartModelQueryParams> = {},
): ChartModelQueryParams => ({
    exploreName: chart.exploreName,
    dimensions: chart.dimensions,
    metrics: chart.metrics,
    filters: chart.filters,
    sorts: chart.sorts,
    limit: chart.limit,
    ...overrides,
});

// The measures of the chart that the result holds, in the chart's order. A
// result without any of them (host rows) falls back to its number columns.
const resolveMeasures = (
    chart: LightdashChartModel,
    columns: DataColumn[],
): string[] => {
    const present = new Set(columns.map((column) => column.name));
    const measures = [...chart.metrics, ...chart.tableCalculations].filter(
        (name) => present.has(name),
    );
    if (measures.length > 0) return measures;
    return columns
        .filter((column) => column.type === 'number')
        .map((column) => column.name);
};

const resolveDimensions = (
    chart: LightdashChartModel,
    columns: DataColumn[],
): string[] => {
    const present = new Set(columns.map((column) => column.name));
    return chart.dimensions.filter((name) => present.has(name));
};

/**
 * The data options a query draws with when the host sets none: the first
 * dimension on the category axis, the measures as values, a second dimension
 * as `breakBy`; the shape each chart type needs.
 */
export const defaultDataOptions = (
    chartType: DataChartType | null,
    dimensions: string[],
    measures: string[],
): DataOptions => {
    const [category, second] = dimensions;

    switch (chartType) {
        case 'kpi':
        case 'gauge':
        case 'map':
            return { value: measures[0] ?? '' };
        case 'pie':
        case 'donut':
        case 'funnel':
        case 'treemap':
            return { category, value: measures[0] ?? '' };
        case 'sankey':
            return { source: category, target: second, value: measures[0] ?? '' };
        case 'bar':
        case 'column':
        case 'line':
        case 'area':
        case 'scatter':
        case null:
            return {
                category,
                value: measures,
                ...(second && measures.length > 0 ? { breakBy: second } : {}),
            };
        default:
            return { category, value: measures };
    }
};

/**
 * The `dataOptions` of the saved chart: its first dimension on the category
 * axis, its measures as values, a second dimension as `breakBy`. A map needs
 * `latitude` and `longitude` from the host.
 */
export const toDataOptions = (
    chart: LightdashChartModel,
    columns: DataColumn[],
): DataOptions =>
    defaultDataOptions(
        toDataChartType(chart.chartKind),
        resolveDimensions(chart, columns),
        resolveMeasures(chart, columns),
    );

/**
 * Props for a chart, from the model alone: the saved query and the saved
 * look. The chart runs the query itself, so no rows are needed. A table
 * chart draws as columns unless `chartType` overrides it.
 */
export const toChartProps = (
    chart: LightdashChartModel,
    overrides: Partial<ChartModelChartProps> = {},
): ChartModelChartProps => {
    const { chartType: chartTypeOverride, dataOptions, ...queryOverrides } =
        overrides;
    const savedType = toDataChartType(chart.chartKind);
    return {
        ...toMetricQueryParams(chart, queryOverrides),
        chartType: chartTypeOverride ?? savedType ?? 'column',
        dataOptions:
            dataOptions ??
            defaultDataOptions(savedType, chart.dimensions, [
                ...chart.metrics,
                ...chart.tableCalculations,
            ]),
    };
};

/** Props for `DataChart`: the saved chart's look, drawn from the result rows. */
export const toDataChartProps = (
    chart: LightdashChartModel,
    result: LightdashQueryRows,
    overrides: Partial<Pick<ChartModelDataChartProps, 'chartType'>> = {},
): ChartModelDataChartProps => ({
    rows: result.rows,
    columns: result.columns,
    chartType: overrides.chartType ?? toDataChartType(chart.chartKind) ?? 'column',
    dataOptions: toDataOptions(chart, result.columns),
});

/** Props for `DataTable`: the result rows, the chart's measures as values. */
export const toDataTableProps = (
    chart: LightdashChartModel,
    result: LightdashQueryRows,
): ChartModelDataTableProps => ({
    rows: result.rows,
    columns: result.columns,
    valueColumns: resolveMeasures(chart, result.columns),
});

/**
 * Props for `DataPivotTable`: the last dimension becomes the columns, the
 * others stay as row headers. Null when the chart has fewer than two
 * dimensions, since there is nothing to pivot on.
 */
export const toDataPivotTableProps = (
    chart: LightdashChartModel,
    result: LightdashQueryRows,
): ChartModelDataPivotTableProps | null => {
    const dimensions = resolveDimensions(chart, result.columns);
    if (dimensions.length < 2) return null;
    const columnField = dimensions[dimensions.length - 1];
    return {
        rows: result.rows,
        columns: result.columns,
        rowFields: dimensions.slice(0, -1),
        columnField,
        value: resolveMeasures(chart, result.columns),
    };
};

const toFrameProps = (chart: LightdashChartModel): ChartModelFrameProps => ({
    title: chart.name,
    ...(chart.description ? { description: chart.description } : {}),
});

/** Props for `DataChartWidget`: the chart in a frame titled with its name. */
export const toDataChartWidgetProps = (
    chart: LightdashChartModel,
    result: LightdashQueryRows,
): ChartModelDataChartWidgetProps => ({
    ...toFrameProps(chart),
    ...toDataChartProps(chart, result),
});

/** Props for `ChartWidget`: the chart in a frame titled with its name. */
export const toChartWidgetProps = (
    chart: LightdashChartModel,
    overrides: Partial<ChartModelChartProps> = {},
): ChartModelChartWidgetProps => ({
    ...toFrameProps(chart),
    ...toChartProps(chart, overrides),
});

/**
 * Props for `Widget`: a pivot widget for a table chart with two or more
 * dimensions, otherwise a data chart widget.
 */
export const toWidgetProps = (
    chart: LightdashChartModel,
    result: LightdashQueryRows,
): ChartModelWidgetProps => {
    if (chart.chartKind === 'table') {
        const pivot = toDataPivotTableProps(chart, result);
        if (pivot) {
            return { widgetType: 'pivot', ...toFrameProps(chart), ...pivot };
        }
    }
    return { widgetType: 'dataChart', ...toDataChartWidgetProps(chart, result) };
};

/**
 * Turns a saved chart model and its query result into the props of the data
 * pieces, so a host page renders a saved chart with its own components.
 */
export const chartModelTranslator = {
    toDataChartType,
    toMetricQueryParams,
    toDataOptions,
    toDataChartProps,
    toDataTableProps,
    toDataPivotTableProps,
    toDataChartWidgetProps,
    toChartProps,
    toChartWidgetProps,
    toWidgetProps,
};
