import {
    getChartKind,
    type ApiAiAgentThreadSummaryListResponse,
    type ApiContentResponse,
    type EmbedDashboard,
    type Explore,
    type FieldValueSearchResult,
    type InteractivityOptions,
    type SavedChart,
} from '@lightdash/common';

export type LightdashSdkContentType =
    | 'chart'
    | 'dashboard'
    | 'space'
    | 'data_app';

export type LightdashSdkApiAuth = {
    type: 'embedToken';
    token: string;
};

export type LightdashApiClientConfig = {
    instanceUrl: string;
    projectUuid?: string;
    auth?: LightdashSdkApiAuth;
    fetch?: typeof fetch;
};

type LightdashApiRequestOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: string;
    body?: unknown;
    signal?: AbortSignal;
    // The token to send instead of the client's own, for an exchanged one.
    auth?: LightdashSdkApiAuth;
};

export type ListContentOptions = {
    projectUuids?: string[];
    spaceUuids?: string[];
    parentSpaceUuid?: string;
    contentTypes?: LightdashSdkContentType[];
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: 'name' | 'space_name' | 'last_updated_at';
    sortDirection?: 'asc' | 'desc';
};

export type LightdashContentResults = ApiContentResponse['results'];
export type LightdashContentItem = LightdashContentResults['data'][number];

export type LightdashExploreField = {
    model: string;
    field: string;
    fieldId: string;
    label: string;
    tableLabel: string;
    kind: 'dimension' | 'metric';
    type: string;
};

export type LightdashQueryFilter = {
    // A field id, for example `orders_status`.
    field: string;
    operator: 'equals' | 'notEquals';
    value: string | number | boolean | null;
};

export type RunMetricQueryOptions = {
    exploreName: string;
    // Field ids, for example `orders_status` and `orders_total_order_amount`.
    dimensions: string[];
    metrics: string[];
    filters?: LightdashQueryFilter[];
    sorts?: { field: string; descending?: boolean }[];
    limit?: number;
    projectUuid?: string;
    signal?: AbortSignal;
};

// Same shape as a `DataColumn` of the data pieces, with the label and the
// display metadata the semantic layer defines for the field.
export type LightdashQueryColumn = {
    name: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'timestamp' | 'boolean';
    format?: string;
    round?: number;
    compact?: string;
    timeInterval?: 'day' | 'week' | 'month' | 'quarter' | 'year';
};

export type LightdashQueryRows = {
    rows: Record<string, string | number | boolean | null>[];
    // The same rows as display text, formatted by the Lightdash server.
    formattedRows: Record<string, string>[];
    columns: LightdashQueryColumn[];
};

// The parts of a saved chart a host page can build on.
export type LightdashChartModel = {
    uuid: string;
    name: string;
    description: string | null;
    exploreName: string;
    // A `ChartKind` such as `line`, `vertical_bar` or `table`.
    chartKind: string | null;
    dimensions: string[];
    metrics: string[];
    tableCalculations: string[];
    limit: number;
};

export type LightdashChartFields = {
    exploreName: string;
    dimensions: string[];
    // Metrics and table calculations: every numeric column of the result.
    measures: string[];
};

/** The dimensions and measures of a chart model, for a query or a picker. */
export const extractFields = (
    chart: LightdashChartModel,
): LightdashChartFields => ({
    exploreName: chart.exploreName,
    dimensions: chart.dimensions,
    measures: [...chart.metrics, ...chart.tableCalculations],
});

export type LightdashFetchOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
};

export type SearchFieldValuesOptions = {
    model: string;
    field: string;
    search?: string;
    limit?: number;
    projectUuid?: string;
};

export type ListAiAgentThreadsOptions = {
    agentUuid: string;
    projectUuid?: string;
};

export type LightdashAiAgentThreadResults =
    ApiAiAgentThreadSummaryListResponse['results'];
export type LightdashAiAgentThread = LightdashAiAgentThreadResults[number];

export class LightdashSdkApiError extends Error {
    statusCode: number | null;

    payload: unknown;

    constructor(message: string, statusCode: number | null, payload: unknown) {
        super(message);
        this.name = 'LightdashSdkApiError';
        this.statusCode = statusCode;
        this.payload = payload;
    }
}

const EMBED_TOKEN_HEADER = 'lightdash-embed-token';

/**
 * What a project token is exchanged for. `rights` keeps a subset of the
 * rights the project token grants; a request cannot add one.
 */
export type EmbedContentTokenRequest =
    | {
          type: 'dashboard';
          dashboardUuid: string;
          rights?: InteractivityOptions;
      }
    | { type: 'chart'; savedChartUuid: string; rights?: InteractivityOptions };

export type EmbedContentToken = { token: string; expiresAt: string };

// The content type a token was signed for, read from its payload without
// verifying it: the server verifies, the client only decides what to send.
export const decodeContentType = (token: string): string | null => {
    try {
        const payload: unknown = JSON.parse(
            atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
        );
        if (
            typeof payload === 'object' &&
            payload !== null &&
            'content' in payload &&
            typeof payload.content === 'object' &&
            payload.content !== null &&
            'type' in payload.content &&
            typeof payload.content.type === 'string'
        ) {
            return payload.content.type;
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Exchanges a project token for a dashboard or chart token of the same
 * viewer. The server checks the content against the project's embed settings.
 */
export const requestContentToken = async (
    instanceUrl: string,
    projectUuid: string,
    projectToken: string,
    request: EmbedContentTokenRequest,
    fetcher: typeof fetch = fetch,
): Promise<EmbedContentToken> => {
    const response = await fetcher(
        `${instanceUrl.replace(/\/$/, '')}/api/v1/embed/${projectUuid}/content-token`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [EMBED_TOKEN_HEADER]: projectToken,
            },
            body: JSON.stringify(request),
        },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        throw new LightdashSdkApiError(
            getErrorMessage(payload, response.status),
            response.status,
            payload,
        );
    }
    if (
        typeof payload === 'object' &&
        payload !== null &&
        'results' in payload &&
        typeof payload.results === 'object' &&
        payload.results !== null &&
        'token' in payload.results &&
        typeof payload.results.token === 'string'
    ) {
        return payload.results as EmbedContentToken;
    }
    throw new LightdashSdkApiError(
        'The content token response had no token',
        response.status,
        payload,
    );
};
const QUERY_POLL_START_MS = 250;
const QUERY_POLL_MAX_MS = 1000;
const QUERY_PAGE_SIZE = 2500;

type QueryPage = {
    status: string;
    error?: string | null;
    rows?: Record<string, { value: { raw: unknown; formatted: string } }>[];
    columns?: Record<
        string,
        {
            reference: string;
            type: string;
            label?: string;
            format?: string;
            timeInterval?: string;
            formatOptions?: { round?: number; compact?: string };
        }
    >;
};

const TIME_INTERVALS: Record<string, LightdashQueryColumn['timeInterval']> = {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    QUARTER: 'quarter',
    YEAR: 'year',
};

// A column of a query result, with the label and the display metadata the
// semantic layer defines for the field, so charts and tables show them.
const toQueryColumn = (
    id: string,
    column: NonNullable<QueryPage['columns']>[string] | undefined,
): LightdashQueryColumn => {
    const timeInterval = column?.timeInterval
        ? TIME_INTERVALS[column.timeInterval]
        : undefined;
    const type = toColumnType(column?.type ?? 'string');
    return {
        name: id,
        label: column?.label ?? id,
        // A timestamp truncated to a day or coarser is a date: its axis and
        // its cells then read "2026-03", not a full timestamp.
        type: type === 'timestamp' && timeInterval ? 'date' : type,
        ...(column?.format ? { format: column.format } : {}),
        ...(column?.formatOptions?.round !== undefined
            ? { round: column.formatOptions.round }
            : {}),
        ...(column?.formatOptions?.compact
            ? { compact: column.formatOptions.compact }
            : {}),
        ...(timeInterval ? { timeInterval } : {}),
    };
};

const toColumnType = (type: string): LightdashQueryColumn['type'] => {
    switch (type) {
        case 'number':
        case 'date':
        case 'timestamp':
        case 'boolean':
            return type;
        default:
            return 'string';
    }
};

const toCellValue = (raw: unknown): string | number | boolean | null => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
    return String(raw);
};

const normalizeBaseUrl = (instanceUrl: string) => instanceUrl.replace(/\/$/, '');

const authHeaders = (
    auth: LightdashSdkApiAuth | undefined,
): Record<string, string> => {
    if (!auth) return {};

    return { [EMBED_TOKEN_HEADER]: auth.token };
};

const createQueryString = (params: Record<string, unknown>) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => query.append(key, String(item)));
        } else if (value !== undefined && value !== null && value !== '') {
            query.append(key, String(value));
        }
    });

    return query.toString();
};

const readJson = async (response: Response) => {
    const text = await response.text();

    try {
        return text ? JSON.parse(text) : {};
    } catch {
        throw new LightdashSdkApiError(
            'Lightdash returned invalid JSON',
            response.status,
            text,
        );
    }
};

const getErrorMessage = (payload: unknown, status: number) => {
    if (typeof payload === 'object' && payload !== null) {
        if (
            'error' in payload &&
            typeof payload.error === 'object' &&
            payload.error !== null &&
            'message' in payload.error &&
            typeof payload.error.message === 'string'
        ) {
            return payload.error.message;
        }

        if ('message' in payload && typeof payload.message === 'string') {
            return payload.message;
        }
    }

    return `Lightdash API returned ${status}`;
};

export const createLightdashApiClient = (config: LightdashApiClientConfig) => {
    const fetcher = config.fetch ?? fetch;
    const baseUrl = normalizeBaseUrl(config.instanceUrl);

    const request = async <T>(options: LightdashApiRequestOptions) => {
        const response = await fetcher(`${baseUrl}${options.path}`, {
            method: options.method ?? 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders(options.auth ?? config.auth),
            },
            body:
                options.body === undefined
                    ? undefined
                    : JSON.stringify(options.body),
            signal: options.signal,
        });
        const payload = await readJson(response);

        if (!response.ok) {
            throw new LightdashSdkApiError(
                getErrorMessage(payload, response.status),
                response.status,
                payload,
            );
        }

        if (
            typeof payload === 'object' &&
            payload !== null &&
            'status' in payload &&
            payload.status === 'ok' &&
            'results' in payload
        ) {
            return payload.results as T;
        }

        return payload as T;
    };

    // A project token cannot read a dashboard or a chart itself: the client
    // exchanges it for a content token first, once per piece of content.
    const isProjectToken =
        config.auth !== undefined &&
        decodeContentType(config.auth.token) === 'project';
    const contentTokens = new Map<string, Promise<string>>();
    const authFor = async (
        content: EmbedContentTokenRequest,
    ): Promise<LightdashSdkApiAuth | undefined> => {
        if (!config.auth || !isProjectToken) return config.auth;
        const projectUuid = config.projectUuid;
        if (!projectUuid) {
            throw new LightdashSdkApiError(
                'projectUuid is required to use a project token',
                null,
                null,
            );
        }
        const key = `${content.type}:${
            content.type === 'dashboard'
                ? content.dashboardUuid
                : content.savedChartUuid
        }`;
        let exchange = contentTokens.get(key);
        if (!exchange) {
            exchange = requestContentToken(
                baseUrl,
                projectUuid,
                config.auth.token,
                content,
                fetcher,
            ).then((result) => result.token);
            contentTokens.set(key, exchange);
            exchange.catch(() => contentTokens.delete(key));
        }
        return { type: 'embedToken', token: await exchange };
    };

    // A project token may be exchanged for the token of one piece of content.
    const getContentToken = async (request: EmbedContentTokenRequest) => {
        const projectUuid = config.projectUuid;
        if (!projectUuid || !config.auth) {
            throw new LightdashSdkApiError(
                'projectUuid and auth are required to exchange a token',
                null,
                null,
            );
        }
        return requestContentToken(
            baseUrl,
            projectUuid,
            config.auth.token,
            request,
            fetcher,
        );
    };

    const listContent = async (options: ListContentOptions = {}) => {
        const params = createQueryString({
            ...options,
            projectUuids:
                options.projectUuids ??
                (config.projectUuid ? [config.projectUuid] : undefined),
        });

        return request<ApiContentResponse['results']>({
            path: `/api/v2/content?${params}`,
        });
    };

    const listAiAgentThreads = async (options: ListAiAgentThreadsOptions) => {
        const projectUuid = options.projectUuid ?? config.projectUuid;

        if (!projectUuid) {
            throw new LightdashSdkApiError(
                'projectUuid is required to list AI agent threads',
                null,
                null,
            );
        }

        return request<LightdashAiAgentThreadResults>({
            path: `/api/v1/projects/${projectUuid}/aiAgents/${options.agentUuid}/threads`,
        });
    };

    // A dashboard: its tiles, filters and tabs. A dashboard token reads the
    // dashboard it is signed for; a project token names it with `dashboardUuid`.
    const getDashboard = async (
        options: { projectUuid?: string; dashboardUuid?: string } = {},
    ) => {
        const projectUuid = options.projectUuid ?? config.projectUuid;

        if (!projectUuid) {
            throw new LightdashSdkApiError(
                'projectUuid is required to read a dashboard',
                null,
                null,
            );
        }
        if (isProjectToken && !options.dashboardUuid) {
            throw new LightdashSdkApiError(
                'dashboardUuid is required to read a dashboard with a project token',
                null,
                null,
            );
        }

        return request<EmbedDashboard>({
            method: 'POST',
            path: `/api/v1/embed/${projectUuid}/dashboard`,
            body: {},
            auth: options.dashboardUuid
                ? await authFor({
                      type: 'dashboard',
                      dashboardUuid: options.dashboardUuid,
                  })
                : undefined,
        });
    };

    // Values of one field, for a filter a host page builds itself. Needs a
    // dashboard token; the field must be in one of that dashboard's explores.
    const searchFieldValues = async (options: SearchFieldValuesOptions) => {
        const projectUuid = options.projectUuid ?? config.projectUuid;

        if (!projectUuid) {
            throw new LightdashSdkApiError(
                'projectUuid is required to search field values',
                null,
                null,
            );
        }

        const fieldId = `${options.model}_${options.field}`;
        return request<FieldValueSearchResult>({
            method: 'POST',
            path: `/api/v1/embed/${projectUuid}/filter/sdk-${fieldId}/search`,
            body: {
                search: options.search ?? '',
                limit: options.limit ?? 50,
                forceRefresh: false,
                tableName: options.model,
                fieldId,
            },
        });
    };

    // The fields of one explore, for a field picker or a filter a host builds.
    // An embed token may read the explores of the content it was signed for.
    const getExploreFields = async (options: {
        exploreName: string;
        projectUuid?: string;
    }): Promise<LightdashExploreField[]> => {
        const projectUuid = options.projectUuid ?? config.projectUuid;

        if (!projectUuid) {
            throw new LightdashSdkApiError(
                'projectUuid is required to read an explore',
                null,
                null,
            );
        }

        const explore = await request<Explore>({
            path: `/api/v1/projects/${projectUuid}/explores/${options.exploreName}`,
        });
        return Object.values(explore.tables).flatMap((table) =>
            [
                ...Object.values(table.dimensions),
                ...Object.values(table.metrics),
            ]
                .filter((field) => !field.hidden)
                .map((field) => ({
                    model: field.table,
                    field: field.name,
                    fieldId: `${field.table}_${field.name}`,
                    label: field.label,
                    tableLabel: field.tableLabel,
                    kind: field.fieldType,
                    type: field.type,
                })),
        );
    };

    // The model of one saved chart. A chart token may read its own chart.
    const getChart = async (options: {
        chartUuid: string;
        projectUuid?: string;
    }): Promise<LightdashChartModel> => {
        const projectUuid = options.projectUuid ?? config.projectUuid;

        if (!projectUuid) {
            throw new LightdashSdkApiError(
                'projectUuid is required to read a chart',
                null,
                null,
            );
        }

        const chart = await request<SavedChart>({
            path: `/api/v2/projects/${projectUuid}/saved/${options.chartUuid}`,
            auth: await authFor({
                type: 'chart',
                savedChartUuid: options.chartUuid,
            }),
        });
        return {
            uuid: chart.uuid,
            name: chart.name,
            description: chart.description ?? null,
            exploreName: chart.metricQuery.exploreName,
            chartKind:
                getChartKind(chart.chartConfig.type, chart.chartConfig.config) ??
                null,
            dimensions: chart.metricQuery.dimensions,
            metrics: chart.metricQuery.metrics,
            tableCalculations: chart.metricQuery.tableCalculations.map(
                (calculation) => calculation.name,
            ),
            limit: chart.metricQuery.limit,
        };
    };

    // A governed query on one explore. A chart or dashboard token may query
    // the explores of its own content; the server rejects any other explore.
    const runMetricQuery = async (
        options: RunMetricQueryOptions,
    ): Promise<LightdashQueryRows> => {
        const projectUuid = options.projectUuid ?? config.projectUuid;

        if (!projectUuid) {
            throw new LightdashSdkApiError(
                'projectUuid is required to run a query',
                null,
                null,
            );
        }

        const filterRules = (options.filters ?? []).map((filter, index) => ({
            id: `sdk-query-filter-${index}`,
            target: { fieldId: filter.field },
            operator:
                filter.value === null
                    ? filter.operator === 'equals'
                        ? 'isNull'
                        : 'notNull'
                    : filter.operator,
            values: filter.value === null ? [] : [filter.value],
        }));
        const metricIds = new Set(options.metrics);
        const toGroup = (rules: typeof filterRules, id: string) =>
            rules.length > 0 ? { id, and: rules } : undefined;

        const { queryUuid } = await request<{ queryUuid: string }>({
            method: 'POST',
            path: `/api/v2/projects/${projectUuid}/query/metric-query`,
            signal: options.signal,
            body: {
                context: 'embed',
                query: {
                    exploreName: options.exploreName,
                    dimensions: options.dimensions,
                    metrics: options.metrics,
                    filters: {
                        dimensions: toGroup(
                            filterRules.filter(
                                (rule) => !metricIds.has(rule.target.fieldId),
                            ),
                            'sdk-query-dimensions',
                        ),
                        metrics: toGroup(
                            filterRules.filter((rule) =>
                                metricIds.has(rule.target.fieldId),
                            ),
                            'sdk-query-metrics',
                        ),
                    },
                    sorts: (options.sorts ?? []).map((sort) => ({
                        fieldId: sort.field,
                        descending: sort.descending ?? false,
                    })),
                    limit: options.limit ?? 500,
                    tableCalculations: [],
                },
            },
        });

        const poll = async (delayMs: number): Promise<QueryPage> => {
            const page = await request<QueryPage>({
                path: `/api/v2/projects/${projectUuid}/query/${queryUuid}?page=1&pageSize=${QUERY_PAGE_SIZE}`,
                signal: options.signal,
            });
            if (['pending', 'queued', 'executing'].includes(page.status)) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                return poll(Math.min(delayMs * 2, QUERY_POLL_MAX_MS));
            }
            return page;
        };
        const page = await poll(QUERY_POLL_START_MS);
        if (page.status !== 'ready') {
            throw new LightdashSdkApiError(
                page.error ?? `Query ended with status ${page.status}`,
                null,
                page,
            );
        }

        const ids = [...options.dimensions, ...options.metrics];
        return {
            columns: ids.map((id) => toQueryColumn(id, page.columns?.[id])),
            rows: (page.rows ?? []).map((row) =>
                Object.fromEntries(
                    ids.map((id) => [id, toCellValue(row[id]?.value.raw)]),
                ),
            ),
            formattedRows: (page.rows ?? []).map((row) =>
                Object.fromEntries(
                    ids.map((id) => [id, row[id]?.value.formatted ?? '']),
                ),
            ),
        };
    };

    return {
        request,
        runMetricQuery,
        getChart,
        getContentToken,
        getDashboard,
        getExploreFields,
        searchFieldValues,
        listAiAgentThreads,
        listContent,
    };
};

export type LightdashApiClient = ReturnType<typeof createLightdashApiClient>;
