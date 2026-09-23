import type { DataChartType, DataOptions } from '../data/types';
import type { ChartModelQueryParams } from '../model/chartModelTranslator';

/**
 * A chart an agent made, as the API returns it. The agent decides the query
 * and the shape; the host page decides everything about how it looks.
 */
export type AgentArtifact = {
    artifactUuid: string;
    versionUuid: string;
    title: string;
    description?: string | null;
    chartConfig?: {
        config: {
            chartConfig: {
                defaultVizType?: string | null;
                xAxisDimension?: string | null;
                yAxisMetrics?: string[] | null;
                groupBy?: string | null;
                xAxisLabel?: string | null;
                yAxisLabel?: string | null;
            };
            queryConfig: {
                exploreName: string;
                dimensions?: string[] | null;
                metrics?: string[] | null;
                sorts?:
                    | { fieldId: string; descending?: boolean | null }[]
                    | null;
                limit?: number | null;
            };
        };
    } | null;
};

/**
 * The props of an SDK chart. The same shape `chartModelTranslator` returns
 * for a saved chart, so an agent's chart is an ordinary chart: it runs its
 * own query, and every style option applies to it.
 */
export type AgentChartProps = ChartModelQueryParams & {
    chartType: DataChartType;
    dataOptions: DataOptions;
};

/** An agent's chart with the frame it wrote the title for. */
export type AgentFramedChartProps = AgentChartProps & {
    frame: { title: string; description?: string };
};

// The agent names chart types in its own words; these are ours.
const VIZ_TYPES: Record<string, DataChartType> = {
    bar: 'column',
    horizontal_bar: 'bar',
    column: 'column',
    line: 'line',
    area: 'area',
    scatter: 'scatter',
    pie: 'pie',
    donut: 'donut',
    funnel: 'funnel',
    treemap: 'treemap',
    // A table has no chart type of its own; columns read closest.
    table: 'column',
};

/** The chart type the agent asked for, in the SDK's vocabulary. */
export const toChartType = (
    vizType: string | null | undefined,
): DataChartType => (vizType && VIZ_TYPES[vizType]) || 'column';

/**
 * Props for a chart, from an agent's artifact: the governed query the agent
 * wrote and the shape it chose. Override any of it before rendering, exactly
 * as with a saved chart's model.
 */
export const toChartProps = (
    artifact: AgentArtifact,
    overrides: Partial<AgentChartProps> = {},
): AgentChartProps => {
    const config = artifact.chartConfig?.config;
    if (!config) {
        throw new Error(
            'Lightdash SDK: this artifact carries no chart, so there is nothing to draw.',
        );
    }
    const { chartConfig: shape, queryConfig: query } = config;
    const metrics = shape.yAxisMetrics ?? query.metrics ?? [];
    const dimensions = query.dimensions ?? [];
    const category = shape.xAxisDimension ?? dimensions[0];
    const {
        chartType: typeOverride,
        dataOptions: optionsOverride,
        ...queryOverrides
    } = overrides;
    return {
        exploreName: query.exploreName,
        dimensions,
        metrics,
        ...(query.sorts
            ? {
                  sorts: query.sorts.map((sort) => ({
                      field: sort.fieldId,
                      descending: sort.descending ?? false,
                  })),
              }
            : {}),
        ...(query.limit === null || query.limit === undefined
            ? {}
            : { limit: query.limit }),
        ...queryOverrides,
        chartType: typeOverride ?? toChartType(shape.defaultVizType),
        dataOptions: optionsOverride ?? {
            ...(category ? { category } : {}),
            value: metrics,
            ...(shape.groupBy ? { breakBy: shape.groupBy } : {}),
        },
    };
};

/** The same, with the title and description the agent wrote, for a frame. */
export const toFramedChartProps = (
    artifact: AgentArtifact,
    overrides: Partial<AgentChartProps> = {},
): AgentFramedChartProps => ({
    frame: {
        title: artifact.title,
        ...(artifact.description ? { description: artifact.description } : {}),
    },
    ...toChartProps(artifact, overrides),
});

/**
 * Turns a chart an agent made into the props of the SDK's own chart pieces,
 * so an answer renders as part of your product rather than as the agent's
 * own picture.
 */
export const agentChartTranslator = {
    toChartType,
    toChartProps,
    toFramedChartProps,
};
