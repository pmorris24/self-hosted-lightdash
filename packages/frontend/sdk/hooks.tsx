import {
    type EmbedDashboard,
    type FieldValueSearchResult,
} from '@lightdash/common';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createLightdashApiClient,
    type LightdashAiAgentThreadResults,
    type LightdashApiClientConfig,
    type LightdashContentResults,
    type ListAiAgentThreadsOptions,
    type LightdashExploreField,
    type LightdashChartModel,
    type LightdashFetchOptions,
    type LightdashQueryRows,
    type ListContentOptions,
    type RunMetricQueryOptions,
    type SearchFieldValuesOptions,
} from './api';
import { useResolvedConfig } from './connection';
import { pivotRows, type PivotedData } from './data/pivot';
import {
    toMetricQueryParams,
    type ChartModelQueryParams,
} from './model/chartModelTranslator';

type UseLightdashApiState<T> = {
    data: T | null;
    error: Error | null;
    isLoading: boolean;
};

export type UseLightdashApiResult<T> = UseLightdashApiState<T> & {
    refetch: () => void;
};

type UseLightdashApiOptions = {
    enabled?: boolean;
    // The connection to run against. Default: the page's `Lightdash.Provider`.
    config?: LightdashApiClientConfig;
};

const toError = (error: unknown) => {
    if (error instanceof Error) return error;

    if (
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof error.error === 'object' &&
        error.error !== null &&
        'message' in error.error &&
        typeof error.error.message === 'string'
    ) {
        return new Error(error.error.message);
    }

    return new Error('Lightdash request failed');
};

export const useLightdashApiQuery = <T,>(
    key: string,
    enabled: boolean,
    // `isForced` is true for the run a `refetch()` caused, so a loader that
    // reads a cache knows to go to the network instead.
    load: (signal: AbortSignal, isForced: boolean) => Promise<T>,
): UseLightdashApiResult<T> => {
    const [fetchCount, setFetchCount] = useState(0);
    const forcedRef = useRef(false);
    const [state, setState] = useState<UseLightdashApiState<T>>({
        data: null,
        error: null,
        isLoading: enabled,
    });

    const loadRef = useRef(load);

    useEffect(() => {
        loadRef.current = load;
    }, [load]);

    useEffect(() => {
        if (!enabled) {
            setState({ data: null, error: null, isLoading: false });
            return undefined;
        }

        const abortController = new AbortController();

        setState((current) => ({
            data: current.data,
            error: null,
            isLoading: true,
        }));

        const isForced = forcedRef.current;
        forcedRef.current = false;

        loadRef
            .current(abortController.signal, isForced)
            .then((data) => {
                if (abortController.signal.aborted) return;
                setState({ data, error: null, isLoading: false });
            })
            .catch((error: unknown) => {
                if (abortController.signal.aborted) return;
                setState({
                    data: null,
                    error: toError(error),
                    isLoading: false,
                });
            });

        return () => abortController.abort();
    }, [enabled, fetchCount, key]);

    const refetch = useCallback(() => {
        forcedRef.current = true;
        setFetchCount((current) => current + 1);
    }, []);

    return {
        ...state,
        refetch,
    };
};

const useLightdashApiClient = (config: LightdashApiClientConfig) => {
    const authKey = JSON.stringify(config.auth ?? null);

    return useMemo(
        () => createLightdashApiClient(config),
        [authKey, config.fetch, config.instanceUrl, config.projectUuid], // eslint-disable-line react-hooks/exhaustive-deps
    );
};

export const useLightdashContent = (
    args: ListContentOptions = {},
    options: UseLightdashApiOptions = {},
): UseLightdashApiResult<LightdashContentResults> => {
    const config = useResolvedConfig(options.config);
    const client = useLightdashApiClient(config);
    const key = JSON.stringify([
        'content',
        config.instanceUrl,
        config.projectUuid ?? null,
        config.auth ?? null,
        args,
    ]);
    const enabled = options.enabled !== false;

    return useLightdashApiQuery(
        key,
        enabled,
        useCallback(() => client.listContent(args), [args, client]),
    );
};

/**
 * Reads the saved dashboard a dashboard token is signed for, so a host page
 * can place its charts in its own layout. See `dashboardModelToComposed`.
 */
export type UseDashboardModelOptions = UseLightdashApiOptions & {
    // The dashboard to read. Required with a project token; a dashboard
    // token already names its dashboard.
    dashboardUuid?: string;
};

export const useDashboardModel = (
    options: UseDashboardModelOptions = {},
): UseLightdashApiResult<EmbedDashboard> => {
    const config = useResolvedConfig(options.config);
    const client = useLightdashApiClient(config);
    const { dashboardUuid } = options;
    const key = JSON.stringify([
        'dashboard-model',
        config.instanceUrl,
        config.projectUuid ?? null,
        config.auth ?? null,
        dashboardUuid ?? null,
    ]);
    const enabled = options.enabled !== false && !!config.projectUuid;

    return useLightdashApiQuery(
        key,
        enabled,
        useCallback(
            () => client.getDashboard({ dashboardUuid }),
            [client, dashboardUuid],
        ),
    );
};

/** The visible dimensions and metrics of one explore. */
export const useExploreFields = (
    args: { exploreName: string; projectUuid?: string },
    options: UseLightdashApiOptions = {},
): UseLightdashApiResult<LightdashExploreField[]> => {
    const config = useResolvedConfig(options.config);
    const client = useLightdashApiClient(config);
    const key = JSON.stringify([
        'explore-fields',
        config.instanceUrl,
        config.projectUuid ?? null,
        config.auth ?? null,
        args,
    ]);
    const enabled =
        options.enabled !== false &&
        args.exploreName.length > 0 &&
        !!(args.projectUuid ?? config.projectUuid);

    return useLightdashApiQuery(
        key,
        enabled,
        useCallback(() => client.getExploreFields(args), [args, client]),
    );
};

/** The model of one saved chart: its explore, dimensions and metrics. */
export const useChartModel = (
    args: { chartUuid: string; projectUuid?: string },
    options: UseLightdashApiOptions = {},
): UseLightdashApiResult<LightdashChartModel> => {
    const config = useResolvedConfig(options.config);
    const client = useLightdashApiClient(config);
    const { chartUuid, projectUuid } = args;
    const key = JSON.stringify([
        'chart-model',
        config.instanceUrl,
        config.projectUuid ?? null,
        config.auth ?? null,
        chartUuid,
        projectUuid ?? null,
    ]);
    const enabled =
        options.enabled !== false &&
        chartUuid.length > 0 &&
        !!(projectUuid ?? config.projectUuid);

    return useLightdashApiQuery(
        key,
        enabled,
        useCallback(
            () => client.getChart({ chartUuid, projectUuid }),
            [chartUuid, client, projectUuid],
        ),
    );
};

// Results of `useMetricQuery({ cache: true })`, newest last. The key holds the
// token, so one viewer never reads the rows of another.
const QUERY_CACHE_MAX_ENTRIES = 50;
// A result this new is used as it is: a component that mounts again within the
// window, because a page remounted it or because a second piece asks the same
// question, reads rows instead of running the query again.
const QUERY_CACHE_FRESH_MS = 30_000;
type CachedQuery = { result: LightdashQueryRows; at: number };
const queryCache = new Map<string, CachedQuery>();

const rememberQuery = (key: string, result: LightdashQueryRows) => {
    queryCache.delete(key);
    queryCache.set(key, { result, at: Date.now() });
    if (queryCache.size > QUERY_CACHE_MAX_ENTRIES) {
        const oldest = queryCache.keys().next();
        if (!oldest.done) queryCache.delete(oldest.value);
    }
};

const isFresh = (entry: CachedQuery) =>
    Date.now() - entry.at < QUERY_CACHE_FRESH_MS;

/** Control of the result cache that `useMetricQuery` fills. */
export const useLightdashQueryCache = () =>
    useMemo(
        () => ({
            clear: () => queryCache.clear(),
            size: () => queryCache.size,
        }),
        [],
    );

export type UseMetricQueryOptions = UseLightdashApiOptions & {
    // Keep results in the page, so the same query does not run twice.
    cache?: boolean;
};

/** A governed query on one explore, as flat rows for `DataChart`. */
export const useMetricQuery = (
    args: Omit<RunMetricQueryOptions, 'signal'>,
    options: UseMetricQueryOptions = {},
): UseLightdashApiResult<LightdashQueryRows> => {
    const config = useResolvedConfig(options.config);
    const client = useLightdashApiClient(config);
    const argsKey = JSON.stringify(args);
    const key = JSON.stringify([
        'metric-query',
        config.instanceUrl,
        config.projectUuid ?? null,
        config.auth ?? null,
        argsKey,
    ]);
    const enabled =
        options.enabled !== false &&
        args.exploreName.length > 0 &&
        args.dimensions.length + args.metrics.length > 0 &&
        !!(args.projectUuid ?? config.projectUuid);

    const result = useLightdashApiQuery(
        key,
        enabled,
        useCallback(
            async (signal: AbortSignal, isForced: boolean) => {
                const cached = options.cache ? queryCache.get(key) : undefined;
                if (cached && isFresh(cached) && !isForced)
                    return cached.result;
                const rows = await client.runMetricQuery({ ...args, signal });
                if (options.cache) rememberQuery(key, rows);
                return rows;
            },
            [argsKey, client, key, options.cache], // eslint-disable-line react-hooks/exhaustive-deps
        ),
    );

    // Rows this page already has are drawn on the first frame, rather than a
    // frame of nothing while the effect reaches the same cache a tick later.
    // Older rows stand in while the query behind them runs again.
    const cached = options.cache ? queryCache.get(key) : undefined;
    if (result.data || result.error || !cached || !enabled) return result;
    return { ...result, data: cached.result };
};

export type UseChartQueryArgs = {
    chartUuid: string;
    projectUuid?: string;
    // Changes to the saved chart's query, for example a lower `limit`.
    overrides?: Partial<ChartModelQueryParams>;
};

export type UseChartQueryResult = {
    chart: UseLightdashApiResult<LightdashChartModel>;
    query: UseLightdashApiResult<LightdashQueryRows>;
    // True while either the model or the rows are loading.
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
};

/**
 * The query of a saved chart, by its id: reads the chart model, then runs its
 * query. `chartModelTranslator` turns the two results into props.
 */
export const useChartQuery = (
    args: UseChartQueryArgs,
    options: UseMetricQueryOptions = {},
): UseChartQueryResult => {
    const config = useResolvedConfig(options.config);
    const { chartUuid, projectUuid, overrides } = args;
    const chart = useChartModel({ chartUuid, projectUuid }, options);
    const overridesKey = JSON.stringify(overrides ?? {});
    const queryArgs = useMemo(
        () =>
            chart.data
                ? {
                      ...toMetricQueryParams(
                          chart.data,
                          JSON.parse(
                              overridesKey,
                          ) as Partial<ChartModelQueryParams>,
                      ),
                      projectUuid,
                  }
                : { exploreName: '', dimensions: [], metrics: [], projectUuid },
        [chart.data, overridesKey, projectUuid],
    );
    const query = useMetricQuery(queryArgs, {
        ...options,
        enabled: options.enabled !== false && !!chart.data,
    });
    const refetch = useCallback(() => {
        chart.refetch();
        query.refetch();
    }, [chart, query]);

    return {
        chart,
        query,
        isLoading: chart.isLoading || query.isLoading,
        error: chart.error ?? query.error,
        refetch,
    };
};

export type UseMetricQueryPivotArgs = Omit<RunMetricQueryOptions, 'signal'> & {
    // Dimensions that stay as row headers.
    rowFields: string[];
    // The dimension whose values become columns.
    columnField: string;
};

export type UseMetricQueryPivotResult = Omit<
    UseLightdashApiResult<LightdashQueryRows>,
    'data'
> & {
    // Wide rows: one per `rowFields` combination.
    data: PivotedData | null;
};

/** A governed query, pivoted in the page: one column per `columnField` value. */
export const useMetricQueryPivot = (
    args: UseMetricQueryPivotArgs,
    options: UseMetricQueryOptions = {},
): UseMetricQueryPivotResult => {
    const config = useResolvedConfig(options.config);
    const { rowFields, columnField, ...queryArgs } = args;
    const query = useMetricQuery(queryArgs, options);
    const rowFieldsKey = rowFields.join('\u0000');
    const metricsKey = queryArgs.metrics.join('\u0000');
    const data = useMemo(
        () =>
            query.data
                ? pivotRows({
                      rows: query.data.rows,
                      columns: query.data.columns,
                      groupBy: rowFieldsKey.split('\u0000'),
                      breakBy: columnField,
                      values: metricsKey.split('\u0000'),
                  })
                : null,
        [query.data, rowFieldsKey, columnField, metricsKey],
    );
    return { ...query, data };
};

/**
 * Any Lightdash API path, with the embed token of the page. For an endpoint
 * the SDK has no hook for yet. The token decides what the call may read.
 */
export const useLightdashFetch = <T,>(
    path: string,
    fetchOptions: LightdashFetchOptions = {},
    options: UseLightdashApiOptions = {},
): UseLightdashApiResult<T> => {
    const config = useResolvedConfig(options.config);
    const client = useLightdashApiClient(config);
    const key = JSON.stringify([
        'fetch',
        config.instanceUrl,
        config.auth ?? null,
        path,
        fetchOptions,
    ]);
    const enabled = options.enabled !== false && path.length > 0;

    return useLightdashApiQuery(
        key,
        enabled,
        useCallback(
            (signal: AbortSignal) =>
                client.request<T>({ path, signal, ...fetchOptions }),
            [client, path, fetchOptions],
        ),
    );
};

/** Values of one field, for a filter control a host page builds itself. */
export const useFieldValues = (
    args: SearchFieldValuesOptions,
    options: UseLightdashApiOptions = {},
): UseLightdashApiResult<FieldValueSearchResult> => {
    const config = useResolvedConfig(options.config);
    const client = useLightdashApiClient(config);
    const key = JSON.stringify([
        'field-values',
        config.instanceUrl,
        config.projectUuid ?? null,
        config.auth ?? null,
        args,
    ]);
    const enabled =
        options.enabled !== false && !!(args.projectUuid ?? config.projectUuid);

    return useLightdashApiQuery(
        key,
        enabled,
        useCallback(() => client.searchFieldValues(args), [args, client]),
    );
};

export const useLightdashAiAgentThreads = (
    args: ListAiAgentThreadsOptions,
    options: UseLightdashApiOptions = {},
): UseLightdashApiResult<LightdashAiAgentThreadResults> => {
    const config = useResolvedConfig(options.config);
    const client = useLightdashApiClient(config);
    const key = JSON.stringify([
        'ai-agent-threads',
        config.instanceUrl,
        config.projectUuid ?? null,
        config.auth ?? null,
        args,
    ]);
    const enabled =
        options.enabled !== false &&
        args.agentUuid.length > 0 &&
        !!(args.projectUuid ?? config.projectUuid);

    return useLightdashApiQuery(
        key,
        enabled,
        useCallback(() => client.listAiAgentThreads(args), [args, client]),
    );
};
