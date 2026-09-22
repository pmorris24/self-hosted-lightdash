import { savedChart } from './savedChart';
import type { Filter, ParametersValuesMap } from './types';
import { useLightdash, type UseLightdashResult } from './useLightdash';

export type UseSavedChartQueryOptions = {
    /** ANDed onto the chart's own filters on the server. */
    filters?: Filter[];
    limit?: number;
    parameters?: ParametersValuesMap;
    /** Name shown in the query inspector. */
    label?: string;
};

/**
 * Runs the query of a saved chart and returns its rows and columns. The
 * analyst keeps the definition; the caller decides how to draw the rows.
 */
export function useSavedChartQuery(
    chartUuid: string,
    options: UseSavedChartQueryOptions = {},
): UseLightdashResult {
    let chartQuery = savedChart(chartUuid);
    if (options.label) chartQuery = chartQuery.label(options.label);
    if (options.limit !== undefined) chartQuery = chartQuery.limit(options.limit);
    if (options.parameters) {
        chartQuery = chartQuery.parameters(options.parameters);
    }
    if (options.filters?.length) chartQuery = chartQuery.filters(options.filters);
    return useLightdash(chartQuery);
}
