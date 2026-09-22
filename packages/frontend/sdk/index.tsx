import '@mantine/core/styles.css';
import '@mantine/code-highlight/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/tiptap/styles.css';
import '../src/styles/global.css';
import './styles/sdk.css';
import {
    assertUnreachable,
    ChartType,
    FilterOperator,
    getErrorMessage,
    type ChartConfig,
    type EmbedDashboard as EmbedDashboardType,
    type LanguageMap,
    type SavedChart,
    type SdkUiOverrides,
    type UiStringKey,
} from '@lightdash/common';
import { Portal, type MantineThemeOverride } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type FC,
    type PropsWithChildren,
} from 'react';
import { createPortal } from 'react-dom';
import { MemoryRouter, Route, Routes } from 'react-router';
import SuboptimalState from '../src/components/common/SuboptimalState/SuboptimalState';
import { type SdkChartSelection } from '../src/ee/features/embed/EmbedChart/types';
import { type SdkFilter } from '../src/ee/features/embed/EmbedDashboard/types';
import { embedContractClass } from '../src/ee/features/embed/styles/embedClassContract';
import EmbedChart from '../src/ee/pages/EmbedChart';
import EmbedDashboard from '../src/ee/pages/EmbedDashboard';
import EmbedExplore from '../src/ee/pages/EmbedExplore';
import { EmbedInstanceContext } from '../src/ee/providers/Embed/EmbedInstanceContext';
import EmbedProvider from '../src/ee/providers/Embed/EmbedProvider';
import { type EmbedExploreChart } from '../src/ee/providers/Embed/types';
import useEmbed from '../src/ee/providers/Embed/useEmbed';
import ErrorBoundary from '../src/features/errorBoundary/ErrorBoundary';
import { useCreateMutation } from '../src/hooks/dashboard/useDashboard';
import ChartColorMappingContextProvider from '../src/hooks/useChartColorConfig/ChartColorMappingContextProvider';
import { useAccount } from '../src/hooks/user/useAccount';
import MetricsCatalogPage from '../src/pages/MetricsCatalog';
import AbilityProvider from '../src/providers/Ability/AbilityProvider';
import ActiveJobProvider from '../src/providers/ActiveJob/ActiveJobProvider';
import AppProvider from '../src/providers/App/AppProvider';
import FullscreenProvider from '../src/providers/Fullscreen/FullscreenProvider';
import MantineProvider from '../src/providers/MantineProvider';
import { PortalTargetContext } from '../src/providers/PortalTarget/PortalTargetContext';
import ReactQueryProvider from '../src/providers/ReactQuery/ReactQueryProvider';
import { unregisterEmbedInstance } from '../src/utils/embedInstance';
import ThirdPartyServicesProvider from '../src/providers/ThirdPartyServicesProvider';
import TrackingProvider from '../src/providers/Tracking/TrackingProvider';
import { setToInMemoryStorage } from '../src/utils/inMemoryStorage';
import {
    createLightdashApiClient,
    decodeContentType,
    requestContentToken,
    type EmbedContentToken,
    type EmbedContentTokenRequest,
    type LightdashAiAgentThread,
    type LightdashAiAgentThreadResults,
    type LightdashApiClientConfig,
    type LightdashContentItem,
    type LightdashContentResults,
    extractFields,
    type LightdashChartFields,
    type LightdashChartModel,
    type LightdashQueryFilter,
    type LightdashSdkApiAuth,
    type ListAiAgentThreadsOptions,
    type ListContentOptions,
} from './api';
import { DataApp, DataAppComponent } from './DataApp';
import { ComposedDashboard } from './composed/ComposedDashboard';
import {
    addFilter,
    addFilters,
    removeFilter,
    removeFilters,
    replaceFilter,
} from './composed/filters';
import { createDefaultLayout } from './composed/layout';
import { resolveColumns } from './data/adapter';
import {
    buildChartConfig,
    getDimensionColumns,
    getValueColumns,
    orderColumnsForChart,
} from './data/chartConfig';
import { DataVisualization } from './data/DataVisualization';
import { pivotRows } from './data/pivot';
import {
    type DataChartSelection,
    type DataChartType,
    type DataColumn,
    type DataFormatter,
    type DataOptions,
    type DataRow,
} from './data/types';
import {
    ContextMenu,
    type ContextMenuItem,
    type ContextMenuSection,
} from './drilldown/ContextMenu';
import { DrilldownBreadcrumbs } from './drilldown/DrilldownBreadcrumbs';
import { DrilldownWidget } from './drilldown/DrilldownWidget';
import {
    useDrilldown,
    type DrilldownFilter,
    type DrilldownStep,
    type UseDrilldownOptions,
    type UseDrilldownResult,
} from './drilldown/useDrilldown';
import {
    useJumpToDashboard,
    type JumpToDashboardTarget,
} from './drilldown/useJumpToDashboard';
import { AgentInsights } from './ai/AgentInsights';
import { type AgentAnswer } from './ai/agentApi';
import {
    useAgentAnswer,
    type UseAgentAnswerResult,
} from './ai/useAgentAnswer';
import { useAgentSuggestions } from './ai/useAgentSuggestions';
import { LoadingOverlay } from './helpers/LoadingOverlay';
import {
    formatDate,
    formatNumber,
    formatRows,
    getDefaultDateFormat,
    type DateGranularity,
} from './helpers/formatting';
import {
    createLinearGradient,
    createRadialGradient,
    GradientDirections,
    isGradient,
    isLinearGradient,
    isRadialGradient,
    type Gradient,
    type GradientStop,
    type LinearGradient,
    type RadialGradient,
} from './helpers/gradients';
import { useSyncedState } from './helpers/useSyncedState';
import { useLightdashTheme, type LightdashTheme } from './theme/themeContext';
import { ThemeProvider } from './theme/ThemeProvider';
import { CustomWidgetsProvider } from './widgets/customWidgets';
import {
    useCustomWidgets,
    useOptionalCustomWidgets,
    type CustomWidgetComponent,
    type CustomWidgetProps,
} from './widgets/customWidgetsContext';
import {
    WidgetFrame,
    type WidgetFrameProps,
    type WidgetStyleOptions,
} from './widgets/WidgetFrame';
import {
    LightdashFrame,
    type LightdashFrameEvent,
    type LightdashFrameEventName,
    type LightdashFrameOptions,
} from './frame/LightdashFrame';
import {
    FilterTileContent,
    type FilterTileFieldProps,
} from './filters/FilterTileContent';
import { dashboardModelToComposed } from './composed/model';
import {
    chartModelTranslator,
    defaultDataOptions,
    type ChartModelDataChartWidgetProps,
    type ChartModelDataChartProps,
    type ChartModelDataPivotTableProps,
    type ChartModelDataTableProps,
    type ChartModelPivotTableWidgetProps,
    type ChartModelQueryChartProps,
    type ChartModelQueryChartWidgetProps,
    type ChartModelQueryParams,
    type ChartModelWidgetProps,
} from './model/chartModelTranslator';
import { useComposedDashboard } from './composed/useComposedDashboard';
import {
    filterFactory,
    type LightdashDateFilterSettings,
    type LightdashFilterGroup,
    type LightdashFilterOperator,
    type LightdashFilterRule,
    type LightdashFilterValue,
    type LightdashSimpleFilter,
    type LightdashUnitOfTime,
} from './model/queryFilters';
import {
    useDashboardModel,
    useExploreFields,
    useFieldValues,
    useLightdashFetch,
    useChartModel,
    useChartQuery,
    useLightdashAiAgentThreads,
    useLightdashQueryCache,
    useMetricQuery,
    useMetricQueryPivot,
    useLightdashContent,
    type UseChartQueryArgs,
    type UseChartQueryResult,
} from './hooks';
import {
    type ComposedDashboardChangeEvent,
    type ComposedDashboardProps,
    type ComposedDashboardResult,
    type ComposedLayout,
    type ComposedWidget,
    type ComposedWidgetState,
    type UseComposedDashboardOptions,
} from './composed/types';
import { SDK_SCOPE_CLASS } from './styles/scope.json';
const LIGHTDASH_SDK_INSTANCE_URL_LOCAL_STORAGE_KEY =
    '__lightdash_sdk_instance_url';
const LIGHTDASH_SDK_VERSION_LOCAL_STORAGE_KEY = '__lightdash_sdk_version';

type BaseProps = {
    instanceUrl: string;
    token: Promise<string> | string;
    theme?: 'light' | 'dark';
    styles?: {
        backgroundColor?: string;
        fontFamily?: string;
    };
    filters?: SdkFilter[];
    contentOverrides?: LanguageMap;
    uiOverrides?: SdkUiOverrides;
    onExplore?: (options: { chart: SavedChart }) => void;
};

type DashboardProps = Omit<BaseProps, 'instanceUrl' | 'token'> &
    ConnectionProps & {
    // The dashboard to show. The token decides what a viewer may read, so
    // this only makes page code explicit; a mismatch is reported, not served.
    id?: string;
    paletteUuid?: string;
    isEditMode?: boolean;
    onEditModeChange?: (isEditMode: boolean) => void;
};

type DashboardBuilderProps = DashboardProps & {
    onDashboardReady?: (dashboard: EmbedDashboardType) => void;
};

type ChartProps = Omit<
    BaseProps,
    'filters' | 'onExplore' | 'instanceUrl' | 'token'
> &
    ConnectionProps & {
        id: string;
        isEditMode?: boolean;
        // Host filters. The server narrows the chart with them and ignores
        // fields the chart's explore does not have.
        filters?: SdkFilter[];
        // A viewer clicked a data point.
        onSelect?: (selection: SdkChartSelection) => void;
    };

type AiAgentProps = Omit<
    BaseProps,
    | 'contentOverrides'
    | 'uiOverrides'
    | 'filters'
    | 'onExplore'
    | 'instanceUrl'
    | 'token'
> &
    ConnectionProps & {
    agentUuid: string;
    onThreadChange?: (options: { threadUuid: string }) => void;
    threadUuid?: string;
};

type MetricsCatalogProps = Omit<
    BaseProps,
    | 'contentOverrides'
    | 'uiOverrides'
    | 'filters'
    | 'onExplore'
    | 'instanceUrl'
    | 'token'
> &
    ConnectionProps;

const decodeJWT = (token: string) => {
    const splits = token.split('.');
    if (splits.length !== 3) {
        throw new Error('Invalid JWT token');
    }

    const [header, payload, signature] = splits;

    const decodedHeader = JSON.parse(atob(header));
    const decodedPayload = JSON.parse(atob(payload));

    return {
        header: decodedHeader,
        payload: decodedPayload,
        signature: signature,
    };
};

const normalizeInstanceUrl = (instanceUrl: string) =>
    instanceUrl.endsWith('/') ? instanceUrl : `${instanceUrl}/`;

const persistInstanceUrl = (instanceUrl: string) => {
    sessionStorage.setItem(
        LIGHTDASH_SDK_INSTANCE_URL_LOCAL_STORAGE_KEY,
        normalizeInstanceUrl(instanceUrl),
    );

    if (typeof __SDK_VERSION__ !== 'undefined') {
        setToInMemoryStorage(
            LIGHTDASH_SDK_VERSION_LOCAL_STORAGE_KEY,
            __SDK_VERSION__,
        );
    }
};

type SdkConnection = Pick<BaseProps, 'instanceUrl' | 'token'> &
    Pick<BaseProps, 'theme' | 'styles'>;

const SdkConnectionContext = createContext<SdkConnection | null>(null);

type ProviderProps = PropsWithChildren<SdkConnection>;

/**
 * One connection for a host page. Pieces inside it can omit `instanceUrl`,
 * `token`, `theme` and `styles`; a prop on a piece still wins.
 */
const Provider: FC<ProviderProps> = ({
    children,
    instanceUrl,
    token,
    theme,
    styles,
}) => {
    const connection = useMemo(
        () => ({ instanceUrl, token, theme, styles }),
        [instanceUrl, token, theme, styles],
    );
    return (
        <SdkConnectionContext.Provider value={connection}>
            {children}
        </SdkConnectionContext.Provider>
    );
};

type ConnectionProps = Partial<SdkConnection>;

/**
 * The hook config of the page's `Lightdash.Provider`, for the query hooks:
 * the instance, the project of the token and the token itself. Until a token
 * promise resolves, the config has no project, which keeps the hooks idle.
 */
const useLightdashConfig = (): LightdashApiClientConfig => {
    const shared = useContext(SdkConnectionContext);
    if (!shared) {
        throw new Error(
            'Lightdash SDK: useLightdashConfig needs a <Lightdash.Provider> above it.',
        );
    }
    const { instanceUrl, token: tokenOrTokenPromise } = shared;
    const [token, setToken] = useState<string | null>(
        typeof tokenOrTokenPromise === 'string' ? tokenOrTokenPromise : null,
    );

    useEffect(() => {
        let isCurrent = true;
        Promise.resolve(tokenOrTokenPromise).then((resolved) => {
            if (isCurrent) setToken(resolved);
        });
        return () => {
            isCurrent = false;
        };
    }, [tokenOrTokenPromise]);

    return useMemo(() => {
        if (!token) return { instanceUrl };
        const { payload } = decodeJWT(token);
        const projectUuid =
            payload &&
            'content' in payload &&
            typeof payload.content?.projectUuid === 'string'
                ? payload.content.projectUuid
                : undefined;
        return {
            instanceUrl,
            projectUuid,
            auth: { type: 'embedToken', token },
        };
    }, [instanceUrl, token]);
};

type ContentTokenState = {
    token: string | null;
    error: Error | null;
};

/**
 * A dashboard or chart token minted from the token of the page's
 * `Lightdash.Provider`, for a frame or for code outside the React pieces.
 * `rights` keeps a subset of what the project token grants; it cannot add
 * any. A dashboard or chart token in the Provider is returned as is.
 */
const useContentToken = (
    request: EmbedContentTokenRequest,
): ContentTokenState => {
    const { instanceUrl, projectUuid, auth } = useLightdashConfig();
    const pageToken = auth?.token;
    const requestKey = JSON.stringify(request);
    const requestRef = useRef(request);
    requestRef.current = request;
    const [state, setState] = useState<ContentTokenState & { key: string }>({
        key: requestKey,
        token: null,
        error: null,
    });

    useEffect(() => {
        if (!pageToken || !projectUuid) return undefined;
        let isCurrent = true;
        const exchange =
            decodeContentType(pageToken) === 'project'
                ? exchangeProjectToken(
                      instanceUrl,
                      projectUuid,
                      pageToken,
                      requestRef.current,
                  )
                : Promise.resolve(pageToken);
        exchange.then(
            (token) => {
                if (isCurrent) setState({ key: requestKey, token, error: null });
            },
            (error: unknown) => {
                if (isCurrent) {
                    setState({
                        key: requestKey,
                        token: null,
                        error:
                            error instanceof Error
                                ? error
                                : new Error('Could not get a content token'),
                    });
                }
            },
        );
        return () => {
            isCurrent = false;
        };
    }, [instanceUrl, projectUuid, pageToken, requestKey]);

    return state.key === requestKey
        ? { token: state.token, error: state.error }
        : { token: null, error: null };
};

const useSdkConnection = (props: ConnectionProps): SdkConnection => {
    const shared = useContext(SdkConnectionContext);
    const lightdashTheme = useLightdashTheme();
    const instanceUrl = props.instanceUrl ?? shared?.instanceUrl;
    const token = props.token ?? shared?.token;
    if (!instanceUrl || !token) {
        throw new Error(
            'Lightdash SDK: pass `instanceUrl` and `token`, or wrap this component in <Lightdash.Provider>.',
        );
    }
    return {
        instanceUrl,
        token,
        theme: props.theme ?? shared?.theme ?? lightdashTheme.colorScheme,
        styles: props.styles ??
            shared?.styles ?? {
                backgroundColor: lightdashTheme.backgroundColor,
                fontFamily: lightdashTheme.fontFamily,
            },
    };
};

// Content tokens minted from a project token, one per project token and
// content, so several components for the same content share one exchange.
const contentTokenCache = new Map<string, Promise<string>>();

const exchangeProjectToken = (
    instanceUrl: string,
    projectUuid: string,
    projectToken: string,
    content: EmbedContentTokenRequest,
): Promise<string> => {
    // Keyed on the whole request: the same content with other rights is
    // another token.
    const key = `${projectToken}\u0000${JSON.stringify(content)}`;
    const cached = contentTokenCache.get(key);
    if (cached) return cached;
    const exchange = requestContentToken(
        instanceUrl,
        projectUuid,
        projectToken,
        content,
    ).then((result) => result.token);
    contentTokenCache.set(key, exchange);
    exchange.catch(() => contentTokenCache.delete(key));
    return exchange;
};

/**
 * The token a component sends, decoded. A project token is exchanged for the
 * token of `content` when the component names its content; without it, the
 * project token is passed on as is, for the pieces that only run queries.
 */
const useEmbedTokenContext = (
    instanceUrl: string,
    tokenOrTokenPromise: BaseProps['token'],
    content?: EmbedContentTokenRequest,
) => {
    const [tokenContext, setTokenContext] = useState<{
        token: string;
        projectUuid: string;
        // The dashboard the token is signed for, when it is a dashboard token.
        dashboardUuid: string | null;
        // True when the token is a project token that was not exchanged.
        isProjectToken: boolean;
    } | null>(null);
    const contentKey = content ? JSON.stringify(content) : null;

    useEffect(() => {
        // Flipped by cleanup on unmount and whenever the token prop changes,
        // so an older token promise resolving late cannot overwrite a newer one.
        let isCurrent = true;

        persistInstanceUrl(instanceUrl);

        Promise.resolve(tokenOrTokenPromise)
            .then((tokenToDecode) => {
                if (!isCurrent) {
                    return;
                }

                const { payload } = decodeJWT(tokenToDecode);

                if (
                    !payload ||
                    !('content' in payload) ||
                    !('projectUuid' in payload.content)
                ) {
                    throw new Error('Error decoding token');
                }
                const projectUuid: string = payload.content.projectUuid;

                if (payload.content.type === 'project' && content) {
                    return exchangeProjectToken(
                        instanceUrl,
                        projectUuid,
                        tokenToDecode,
                        content,
                    ).then((contentToken) => {
                        if (!isCurrent) return;
                        setTokenContext({
                            token: contentToken,
                            projectUuid,
                            dashboardUuid:
                                content.type === 'dashboard'
                                    ? content.dashboardUuid
                                    : null,
                            isProjectToken: false,
                        });
                    });
                }

                setTokenContext({
                    token: tokenToDecode,
                    projectUuid,
                    dashboardUuid:
                        'dashboardUuid' in payload.content &&
                        typeof payload.content.dashboardUuid === 'string'
                            ? payload.content.dashboardUuid
                            : null,
                    isProjectToken: payload.content.type === 'project',
                });
                return undefined;
            })
            .catch((error) => {
                console.error(error);
                throw new Error('Error retrieving token');
            });

        return () => {
            isCurrent = false;
        };
    }, [instanceUrl, tokenOrTokenPromise, contentKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return tokenContext;
};

const PROJECT_TOKEN_NEEDS_ID =
    'A project token needs the `id` of the content to show.';

const getDashboardContainerStyles = (
    styles: DashboardProps['styles'],
    theme: DashboardProps['theme'],
) => ({
    width: '100%',
    height: '100%',
    position: 'relative' as const,
    overflow: 'auto',
    backgroundColor:
        styles?.backgroundColor ??
        (theme ? 'var(--mantine-color-body)' : undefined),
});

const getSavedChartExploreHandler = (onExplore: BaseProps['onExplore']) =>
    onExplore
        ? ({ chart }: { chart: EmbedExploreChart }) => {
              if ('uuid' in chart) {
                  onExplore({ chart });
              }
          }
        : undefined;

const useDashboardExploreNavigation = (onExplore: BaseProps['onExplore']) => {
    const [exploreChart, setExploreChart] = useState<EmbedExploreChart>();

    const handleExplore = useCallback(
        ({ chart }: { chart: EmbedExploreChart }) => {
            if ('uuid' in chart) {
                onExplore?.({ chart });
            } else {
                setExploreChart(chart);
            }
        },
        [onExplore],
    );

    const handleBackToDashboard = useCallback(
        () => setExploreChart(undefined),
        [],
    );

    return { exploreChart, handleExplore, handleBackToDashboard };
};

const getAiAgentEmbedUrl = ({
    agentUuid,
    instanceUrl,
    projectUuid,
    targetOrigin,
    theme,
    threadUuid,
    token,
}: {
    agentUuid: string;
    instanceUrl: string;
    projectUuid: string;
    targetOrigin?: string;
    theme: AiAgentProps['theme'];
    threadUuid?: string;
    token: string;
}) => {
    const normalizedInstanceUrl = instanceUrl.endsWith('/')
        ? instanceUrl
        : `${instanceUrl}/`;
    const path = threadUuid
        ? `embed/${projectUuid}/ai-agents/${agentUuid}/threads/${threadUuid}`
        : `embed/${projectUuid}/ai-agents/${agentUuid}/threads`;
    const url = new URL(path, normalizedInstanceUrl);

    if (theme) {
        url.searchParams.set('theme', theme);
    }
    if (targetOrigin) {
        url.searchParams.set('targetOrigin', targetOrigin);
    }

    url.hash = token;
    return url.toString();
};

const AI_AGENT_THREAD_CHANGED_EVENT = 'lightdash:aiAgentThreadChanged';

type AiAgentThreadChangedMessage = {
    type: typeof AI_AGENT_THREAD_CHANGED_EVENT;
    payload: {
        agentUuid: string;
        projectUuid: string;
        threadUuid: string;
    };
};

const isAiAgentThreadChangedMessage = (
    data: unknown,
): data is AiAgentThreadChangedMessage =>
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === AI_AGENT_THREAD_CHANGED_EVENT &&
    'payload' in data &&
    typeof data.payload === 'object' &&
    data.payload !== null &&
    'agentUuid' in data.payload &&
    typeof data.payload.agentUuid === 'string' &&
    'projectUuid' in data.payload &&
    typeof data.payload.projectUuid === 'string' &&
    'threadUuid' in data.payload &&
    typeof data.payload.threadUuid === 'string';

// Distinguishes this copy of the bundle from another one on the same page, so
// instance ids never collide.
const SDK_BUNDLE_ID = Math.random().toString(36).slice(2, 8);

const SdkProviders: FC<
    PropsWithChildren<{
        styles?: { backgroundColor?: string; fontFamily?: string };
        theme?: 'light' | 'dark';
        projectUuid?: string;
        instanceUrl?: string;
    }>
> = ({ children, styles, theme, projectUuid, instanceUrl }) => {
    const colorScheme = theme ?? 'light';
    const rootRef = useRef<HTMLDivElement>(null);
    const getRootElement = useCallback(() => rootRef.current ?? undefined, []);
    // Each mounted component gets its own class for Mantine's CSS variables,
    // so two embeds with different fonts or themes on one page don't fight
    // over shared variables. The scope class stays shared: the build-time
    // scoped stylesheets key on it.
    const instanceId = `${SDK_BUNDLE_ID}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const instanceClass = `lightdash-sdk-instance-${instanceId}`;
    // The instance id also scopes this piece's requests, so several pieces on
    // one page each send their own token.
    const embedInstance = useMemo(
        () => ({
            embedInstanceId: instanceId,
            instanceUrl: instanceUrl ? normalizeInstanceUrl(instanceUrl) : null,
        }),
        [instanceId, instanceUrl],
    );
    useEffect(() => () => unregisterEmbedInstance(instanceId), [instanceId]);
    // Body-level container for everything that portals out of the inline root
    // (dropdowns, modals, drag overlays), so it escapes the host's overflow and
    // stacking contexts while keeping the SDK's variables and colour scheme.
    // Mantine resolves a selector target in its layout effect, by which time
    // the container below is in the DOM, so no render round-trip.
    const portalId = `lightdash-sdk-portal-${instanceId}`;
    const fontFamily = styles?.fontFamily;
    // Only override the font when the consumer sets one: Mantine 8's CSS-vars
    // generator stringifies an explicit undefined into `font-family: undefined`.
    const themeOverride = useMemo<MantineThemeOverride>(
        () => ({
            ...(fontFamily
                ? {
                      fontFamily,
                      other: { tableFont: fontFamily, chartFont: fontFamily },
                  }
                : {}),
            components: {
                Portal: Portal.extend({
                    defaultProps: { target: `#${portalId}` },
                }),
            },
        }),
        [fontFamily, portalId],
    );
    const route = projectUuid ? `/projects/${projectUuid}` : '/';
    const routedChildren = projectUuid ? (
        <Routes>
            <Route path="/projects/:projectUuid/*" element={<>{children}</>} />
        </Routes>
    ) : (
        children
    );

    return (
        <>
            {createPortal(
                <div
                    id={portalId}
                    className={embedContractClass(
                        'ld-sdk-portal',
                        SDK_SCOPE_CLASS,
                        instanceClass,
                    )}
                    data-mantine-color-scheme={colorScheme}
                />,
                document.body,
            )}
            <ReactQueryProvider embedInstanceId={instanceId}>
                <EmbedInstanceContext.Provider value={embedInstance}>
                <MantineProvider
                    themeOverride={themeOverride}
                    notificationsLimit={0}
                    forceColorScheme={colorScheme}
                    cssVariablesSelector={`.${instanceClass}`}
                    getRootElement={getRootElement}
                    syncBodyColorMode={false}
                >
                    <div
                        ref={rootRef}
                        className={embedContractClass(
                            'ld-sdk-root',
                            SDK_SCOPE_CLASS,
                            instanceClass,
                        )}
                    >
                        <PortalTargetContext.Provider value={`#${portalId}`}>
                            <ModalsProvider>
                                <AppProvider>
                                    <FullscreenProvider enabled={false}>
                                        <ThirdPartyServicesProvider
                                            enabled={false}
                                        >
                                            <ErrorBoundary
                                                wrapper={{ mt: '4xl' }}
                                            >
                                                <MemoryRouter
                                                    initialEntries={[route]}
                                                >
                                                    <TrackingProvider
                                                        enabled={true}
                                                    >
                                                        <AbilityProvider>
                                                            <ChartColorMappingContextProvider>
                                                                <ActiveJobProvider>
                                                                    {
                                                                        routedChildren
                                                                    }
                                                                </ActiveJobProvider>
                                                            </ChartColorMappingContextProvider>
                                                        </AbilityProvider>
                                                    </TrackingProvider>
                                                </MemoryRouter>
                                            </ErrorBoundary>
                                        </ThirdPartyServicesProvider>
                                    </FullscreenProvider>
                                </AppProvider>
                            </ModalsProvider>
                        </PortalTargetContext.Provider>
                    </div>
                </MantineProvider>
                </EmbedInstanceContext.Provider>
            </ReactQueryProvider>
        </>
    );
};

const Dashboard: FC<DashboardProps> = ({
    id,
    filters,
    contentOverrides,
    uiOverrides,
    onExplore,
    paletteUuid,
    isEditMode,
    onEditModeChange,
    ...connectionProps
}) => {
    const {
        token: tokenOrTokenPromise,
        instanceUrl,
        styles,
        theme,
    } = useSdkConnection(connectionProps);
    const tokenContext = useEmbedTokenContext(
        instanceUrl,
        tokenOrTokenPromise,
        id ? { type: 'dashboard', dashboardUuid: id } : undefined,
    );
    const { exploreChart, handleExplore, handleBackToDashboard } =
        useDashboardExploreNavigation(onExplore);

    if (!tokenContext) {
        return null;
    }

    if (tokenContext.isProjectToken) {
        return <p role="alert">{PROJECT_TOKEN_NEEDS_ID}</p>;
    }

    if (id && tokenContext.dashboardUuid && id !== tokenContext.dashboardUuid) {
        return (
            <p role="alert">
                This token is signed for another dashboard than `{id}`.
            </p>
        );
    }

    return (
        <SdkProviders
            instanceUrl={instanceUrl}
            projectUuid={tokenContext.projectUuid}
            styles={styles}
            theme={theme}
        >
            <EmbedProvider
                embedToken={tokenContext.token}
                projectUuid={tokenContext.projectUuid}
                filters={filters}
                paletteUuid={paletteUuid}
                contentOverrides={contentOverrides}
                uiOverrides={uiOverrides}
                onExplore={handleExplore}
                onBackToDashboard={handleBackToDashboard}
            >
                {exploreChart ? (
                    <EmbedExplore
                        exploreId={exploreChart.tableName}
                        savedChart={exploreChart}
                        containerStyles={getDashboardContainerStyles(
                            styles,
                            theme,
                        )}
                    />
                ) : (
                    <EmbedDashboard
                        containerStyles={getDashboardContainerStyles(
                            styles,
                            theme,
                        )}
                        isEditMode={isEditMode}
                        onEditModeChange={onEditModeChange}
                    />
                )}
            </EmbedProvider>
        </SdkProviders>
    );
};

const dashboardBuilderCreatePromises = new Map<
    string,
    Promise<EmbedDashboardType>
>();

const DashboardBuilderContent: FC<{
    containerStyles?: React.CSSProperties;
    isEditMode?: boolean;
    onEditModeChange?: (isEditMode: boolean) => void;
    onDashboardReady?: (dashboard: EmbedDashboardType) => void;
}> = ({ containerStyles, isEditMode, onEditModeChange, onDashboardReady }) => {
    const { content, embedToken, projectUuid, writeActions } = useEmbed();
    const [dashboard, setDashboard] = useState<EmbedDashboardType>();
    const [createDashboardError, setCreateDashboardError] = useState<
        string | null
    >(null);
    const hasCreatedDashboard = useRef(false);
    const { mutateAsync: createDashboard } = useCreateMutation(
        projectUuid,
        false,
        { showToastOnSuccess: false },
    );

    useEffect(() => {
        if (
            hasCreatedDashboard.current ||
            dashboard ||
            !embedToken ||
            !projectUuid ||
            !writeActions?.spaceUuid
        )
            return;

        hasCreatedDashboard.current = true;
        setCreateDashboardError(null);

        const createKey = `${projectUuid}:${writeActions.spaceUuid}:${
            content?.type === 'dashboard' && 'dashboardUuid' in content
                ? content.dashboardUuid
                : ''
        }`;
        const createPromise =
            dashboardBuilderCreatePromises.get(createKey) ??
            createDashboard({
                name: 'Untitled dashboard',
                description: '',
                spaceUuid: writeActions.spaceUuid,
                tiles: [],
                tabs: [],
            }).then(
                (createdDashboard) => createdDashboard as EmbedDashboardType,
            );

        dashboardBuilderCreatePromises.set(createKey, createPromise);

        createPromise
            .then((createdDashboard) => setDashboard(createdDashboard))
            .catch((error) => {
                console.error(error);
                setCreateDashboardError(getErrorMessage(error));
                hasCreatedDashboard.current = false;
            })
            .finally(() => {
                dashboardBuilderCreatePromises.delete(createKey);
            });
    }, [
        createDashboard,
        content,
        dashboard,
        embedToken,
        projectUuid,
        writeActions?.spaceUuid,
    ]);

    useEffect(() => {
        if (dashboard) {
            onDashboardReady?.(dashboard);
        }
    }, [dashboard, onDashboardReady]);

    if (createDashboardError) {
        return (
            <SuboptimalState
                title="Unable to create dashboard"
                description={createDashboardError}
            />
        );
    }

    if (!dashboard) {
        return null;
    }

    return (
        <EmbedDashboard
            initialDashboard={dashboard}
            containerStyles={containerStyles}
            isEditMode={isEditMode}
            onEditModeChange={onEditModeChange}
        />
    );
};

const DashboardBuilder: FC<DashboardBuilderProps> = ({
    id,
    filters,
    contentOverrides,
    uiOverrides,
    onExplore,
    paletteUuid,
    isEditMode,
    onEditModeChange,
    onDashboardReady,
    ...connectionProps
}) => {
    const {
        token: tokenOrTokenPromise,
        instanceUrl,
        styles,
        theme,
    } = useSdkConnection(connectionProps);
    const tokenContext = useEmbedTokenContext(
        instanceUrl,
        tokenOrTokenPromise,
        id ? { type: 'dashboard', dashboardUuid: id } : undefined,
    );
    const { exploreChart, handleExplore, handleBackToDashboard } =
        useDashboardExploreNavigation(onExplore);

    if (!tokenContext) {
        return null;
    }

    if (tokenContext.isProjectToken) {
        return <p role="alert">{PROJECT_TOKEN_NEEDS_ID}</p>;
    }

    return (
        <SdkProviders
            instanceUrl={instanceUrl}
            projectUuid={tokenContext.projectUuid}
            styles={styles}
            theme={theme}
        >
            <EmbedProvider
                embedToken={tokenContext.token}
                projectUuid={tokenContext.projectUuid}
                filters={filters}
                paletteUuid={paletteUuid}
                contentOverrides={contentOverrides}
                uiOverrides={uiOverrides}
                onExplore={handleExplore}
                onBackToDashboard={handleBackToDashboard}
            >
                {exploreChart ? (
                    <EmbedExplore
                        exploreId={exploreChart.tableName}
                        savedChart={exploreChart}
                        containerStyles={getDashboardContainerStyles(
                            styles,
                            theme,
                        )}
                    />
                ) : (
                    <DashboardBuilderContent
                        containerStyles={getDashboardContainerStyles(
                            styles,
                            theme,
                        )}
                        isEditMode={isEditMode}
                        onEditModeChange={onEditModeChange}
                        onDashboardReady={onDashboardReady}
                    />
                )}
            </EmbedProvider>
        </SdkProviders>
    );
};

const Explore: FC<
    Omit<BaseProps, 'instanceUrl' | 'token'> &
        ConnectionProps & { exploreId: string; savedChart: SavedChart }
> = ({
    filters,
    contentOverrides,
    uiOverrides,
    onExplore,
    exploreId,
    savedChart,
    ...connectionProps
}) => {
    const {
        token: tokenOrTokenPromise,
        instanceUrl,
        styles,
        theme,
    } = useSdkConnection(connectionProps);
    const tokenContext = useEmbedTokenContext(instanceUrl, tokenOrTokenPromise);

    if (!tokenContext) {
        return null;
    }

    return (
        <SdkProviders
            instanceUrl={instanceUrl}
            projectUuid={tokenContext.projectUuid}
            styles={styles}
            theme={theme}
        >
            <EmbedProvider
                embedToken={tokenContext.token}
                projectUuid={tokenContext.projectUuid}
                filters={filters}
                contentOverrides={contentOverrides}
                uiOverrides={uiOverrides}
                onExplore={getSavedChartExploreHandler(onExplore)}
            >
                <EmbedExplore
                    exploreId={exploreId}
                    savedChart={savedChart}
                    containerStyles={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        overflow: 'auto',
                        backgroundColor:
                            styles?.backgroundColor ??
                            (theme ? 'var(--mantine-color-body)' : undefined),
                    }}
                />
            </EmbedProvider>
        </SdkProviders>
    );
};

const EditableChartContent: FC<{
    containerStyles: React.CSSProperties;
    isEditMode: boolean;
}> = ({ containerStyles, isEditMode }) => {
    const { embedWriteContext } = useEmbed();
    const account = useAccount();

    if (account.isLoading) {
        return null;
    }

    if (embedWriteContext?.canUpdateSavedChart === true) {
        return (
            <EmbedExplore
                containerStyles={containerStyles}
                allowChartUpdate
                isEditMode={isEditMode}
                chartView
            />
        );
    }

    if (isEditMode) {
        return (
            <SuboptimalState
                title="Unable to edit chart"
                description="The embed write actor does not have permission to update this chart in the configured write space."
            />
        );
    }

    return <EmbedChart containerStyles={containerStyles} />;
};

const ChartContent: FC<{
    containerStyles: React.CSSProperties;
    isEditMode?: boolean;
}> = ({ containerStyles, isEditMode }) => {
    // Omitting isEditMode preserves the legacy Chart renderer exactly. Passing
    // an explicit boolean opts into the mounted view/edit explorer surface.
    if (isEditMode === undefined) {
        return <EmbedChart containerStyles={containerStyles} />;
    }

    return (
        <EditableChartContent
            containerStyles={containerStyles}
            isEditMode={isEditMode}
        />
    );
};

const Chart: FC<ChartProps> = ({
    contentOverrides,
    uiOverrides,
    id,
    isEditMode,
    filters,
    onSelect,
    ...connectionProps
}) => {
    const {
        token: tokenOrTokenPromise,
        instanceUrl,
        styles,
        theme,
    } = useSdkConnection(connectionProps);
    const tokenContext = useEmbedTokenContext(instanceUrl, tokenOrTokenPromise, {
        type: 'chart',
        savedChartUuid: id,
    });

    if (!tokenContext) {
        return null;
    }

    const containerStyles = {
        width: '100%',
        height: '100%',
        position: 'relative' as const,
        // A chart fills its box. With `auto`, one brief scrollbar makes the
        // fixed-size canvas larger than the box, and both scrollbars stay.
        overflow: isEditMode ? 'auto' : 'hidden',
        backgroundColor:
            styles?.backgroundColor ??
            (theme ? 'var(--mantine-color-body)' : undefined),
    };

    return (
        <SdkProviders
            instanceUrl={instanceUrl}
            projectUuid={tokenContext.projectUuid}
            styles={styles}
            theme={theme}
        >
            <EmbedProvider
                embedToken={tokenContext.token}
                projectUuid={tokenContext.projectUuid}
                contentOverrides={contentOverrides}
                uiOverrides={uiOverrides}
                savedQueryUuid={id}
                filters={filters}
                onSelect={onSelect}
            >
                <ChartContent
                    containerStyles={containerStyles}
                    isEditMode={isEditMode}
                />
            </EmbedProvider>
        </SdkProviders>
    );
};

const AiAgent: FC<AiAgentProps> = ({
    agentUuid,
    onThreadChange,
    threadUuid,
    ...connectionProps
}) => {
    const {
        token: tokenOrTokenPromise,
        instanceUrl,
        styles,
        theme,
    } = useSdkConnection(connectionProps);
    const tokenContext = useEmbedTokenContext(instanceUrl, tokenOrTokenPromise);
    const instanceOrigin = new URL(instanceUrl).origin;
    const targetOrigin =
        typeof window !== 'undefined' && onThreadChange
            ? window.location.origin
            : undefined;

    useEffect(() => {
        if (!tokenContext || !onThreadChange) {
            return undefined;
        }

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== instanceOrigin) {
                return;
            }
            if (!isAiAgentThreadChangedMessage(event.data)) {
                return;
            }
            if (
                event.data.payload.projectUuid !== tokenContext.projectUuid ||
                event.data.payload.agentUuid !== agentUuid
            ) {
                return;
            }

            onThreadChange({ threadUuid: event.data.payload.threadUuid });
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [agentUuid, instanceOrigin, onThreadChange, tokenContext]);

    if (!tokenContext) {
        return null;
    }

    return (
        <iframe
            title="Lightdash AI agent"
            src={getAiAgentEmbedUrl({
                agentUuid,
                instanceUrl,
                projectUuid: tokenContext.projectUuid,
                targetOrigin,
                theme,
                threadUuid,
                token: tokenContext.token,
            })}
            style={{
                width: '100%',
                height: '100%',
                border: 0,
                backgroundColor:
                    styles?.backgroundColor ??
                    (theme ? 'var(--mantine-color-body)' : undefined),
            }}
        />
    );
};

const MetricsCatalog: FC<MetricsCatalogProps> = (connectionProps) => {
    const {
        token: tokenOrTokenPromise,
        instanceUrl,
        styles,
        theme,
    } = useSdkConnection(connectionProps);
    const tokenContext = useEmbedTokenContext(instanceUrl, tokenOrTokenPromise);
    const [exploreChart, setExploreChart] = useState<EmbedExploreChart>();

    if (!tokenContext) {
        return null;
    }

    return (
        <SdkProviders
            instanceUrl={instanceUrl}
            projectUuid={tokenContext.projectUuid}
            styles={styles}
            theme={theme}
        >
            <EmbedProvider
                embedToken={tokenContext.token}
                projectUuid={tokenContext.projectUuid}
                onExplore={({ chart }) => setExploreChart(chart)}
                onBackToDashboard={() => setExploreChart(undefined)}
            >
                {exploreChart ? (
                    <EmbedExplore
                        exploreId={exploreChart.tableName}
                        savedChart={exploreChart}
                        containerStyles={getDashboardContainerStyles(
                            styles,
                            theme,
                        )}
                    />
                ) : (
                    <div
                        style={{
                            ...getDashboardContainerStyles(styles, theme),
                            overflow: 'hidden',
                        }}
                    >
                        <MetricsCatalogPage />
                    </div>
                )}
            </EmbedProvider>
        </SdkProviders>
    );
};

type FilterPieceProps = ConnectionProps & Pick<BaseProps, 'uiOverrides'>;

// Filter components are SDK pieces too: they need the token scope for field
// values, and the SDK's theme and UI strings.
const FilterPiece: FC<PropsWithChildren<FilterPieceProps>> = ({
    children,
    uiOverrides,
    ...connectionProps
}) => {
    const {
        token: tokenOrTokenPromise,
        instanceUrl,
        styles,
        theme,
    } = useSdkConnection(connectionProps);
    const tokenContext = useEmbedTokenContext(instanceUrl, tokenOrTokenPromise);

    if (!tokenContext) {
        return null;
    }

    return (
        <SdkProviders
            instanceUrl={instanceUrl}
            projectUuid={tokenContext.projectUuid}
            styles={styles}
            theme={theme}
        >
            <EmbedProvider
                embedToken={tokenContext.token}
                projectUuid={tokenContext.projectUuid}
                uiOverrides={uiOverrides}
            >
                {children}
            </EmbedProvider>
        </SdkProviders>
    );
};

type FilterTileProps = FilterPieceProps & FilterTileFieldProps;

/** One filter on one field: an operator and a value input with field values. */
const FilterTile: FC<FilterTileProps> = ({
    model,
    field,
    label,
    operators,
    defaultOperator,
    filter,
    onChange,
    ...pieceProps
}) => (
    <FilterPiece {...pieceProps}>
        <FilterTileContent
            model={model}
            field={field}
            label={label}
            operators={operators}
            defaultOperator={defaultOperator}
            filter={filter}
            onChange={onChange}
        />
    </FilterPiece>
);

type TypedFilterTileProps = Omit<FilterTileProps, 'operators'>;

const MEMBER_OPERATORS: FilterTileProps['operators'] = ['equals', 'notEquals'];
const DATE_RANGE_OPERATORS: FilterTileProps['operators'] = ['inBetween'];
const RELATIVE_DATE_OPERATORS: FilterTileProps['operators'] = [
    'inThePast',
    'notInThePast',
    'inTheNext',
    'inTheCurrent',
    'notInTheCurrent',
];
const CRITERIA_OPERATORS: FilterTileProps['operators'] = [
    'equals',
    'notEquals',
    'lessThan',
    'lessThanOrEqual',
    'greaterThan',
    'greaterThanOrEqual',
    'inBetween',
    'notInBetween',
];

/** Pick members of a field from a list of its values. */
const MemberFilterTile: FC<TypedFilterTileProps> = (props) => (
    <FilterTile {...props} operators={MEMBER_OPERATORS} />
);

/** A start date and an end date. */
const DateRangeFilterTile: FC<TypedFilterTileProps> = (props) => (
    <FilterTile {...props} operators={DATE_RANGE_OPERATORS} />
);

/** A period relative to now: the last 7 days, this month, the next quarter. */
const RelativeDateFilterTile: FC<TypedFilterTileProps> = (props) => (
    <FilterTile {...props} operators={RELATIVE_DATE_OPERATORS} />
);

/** A comparison on a number: greater than, between, and so on. */
const CriteriaFilterTile: FC<TypedFilterTileProps> = (props) => (
    <FilterTile {...props} operators={CRITERIA_OPERATORS} />
);

type FiltersPanelField = Pick<
    FilterTileFieldProps,
    'model' | 'field' | 'label' | 'operators' | 'defaultOperator'
>;

type FiltersPanelProps = FilterPieceProps & {
    fields: FiltersPanelField[];
    filters: SdkFilter[];
    onChange: (filters: SdkFilter[]) => void;
};

/** Several filter tiles in one piece, working on one list of filters. */
const FiltersPanel: FC<FiltersPanelProps> = ({
    fields,
    filters,
    onChange,
    ...pieceProps
}) => (
    <FilterPiece {...pieceProps}>
        <div
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            data-lightdash-filters-panel=""
        >
            {fields.map((panelField) => (
                <FilterTileContent
                    key={`${panelField.model}.${panelField.field}`}
                    {...panelField}
                    filter={filters.find(
                        (filter) =>
                            filter.model === panelField.model &&
                            filter.field === panelField.field,
                    )}
                    onChange={(next) =>
                        onChange(
                            next
                                ? addFilter(filters, next)
                                : removeFilter(filters, panelField),
                        )
                    }
                />
            ))}
        </div>
    </FilterPiece>
);

type DataPieceProps = FilterPieceProps & {
    rows: DataRow[];
    columns?: DataColumn[];
    format?: DataFormatter;
    isLoading?: boolean;
    colorPalette?: string[];
};

type DataChartCommonProps = FilterPieceProps & {
    format?: DataFormatter;
    isLoading?: boolean;
    colorPalette?: string[];
    chartType: DataChartType;
    // A viewer clicked a data point.
    onSelect?: (selection: DataChartSelection) => void;
};

/** A chart from rows the host supplies, from the query SDK or anywhere else. */
type RowsDataChartProps = DataChartCommonProps & {
    rows: DataRow[];
    columns?: DataColumn[];
    dataOptions: DataOptions;
};

/**
 * A chart that runs its own governed query. The data options default from
 * the query: the first dimension on the category axis, the metrics as values,
 * a second dimension as `breakBy`.
 */
type QueryDataChartProps = DataChartCommonProps &
    ChartModelQueryParams & {
        dataOptions?: DataOptions;
    };

type DataChartProps = RowsDataChartProps | QueryDataChartProps;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
    ? Omit<T, K>
    : never;

const RowsDataChart: FC<RowsDataChartProps> = ({
    rows: inputRows,
    columns: inputColumns,
    format,
    isLoading,
    colorPalette,
    chartType,
    dataOptions,
    onSelect,
    ...pieceProps
}) => {
    const { palette: themePalette } = useLightdashTheme();
    // `breakBy` pivots the rows here, then the chart sees plain value columns.
    const pivoted = useMemo(() => {
        const { breakBy, category } = dataOptions;
        if (!breakBy || !category) return null;
        return pivotRows({
            rows: inputRows,
            columns: resolveColumns(inputRows, inputColumns),
            groupBy: [category],
            breakBy,
            values: getValueColumns(dataOptions),
        });
    }, [inputRows, inputColumns, dataOptions]);
    const rows = pivoted?.rows ?? inputRows;
    const columns = pivoted?.columns ?? inputColumns;
    const chartDataOptions = useMemo(
        () =>
            pivoted
                ? { ...dataOptions, value: pivoted.valueColumns }
                : dataOptions,
        [pivoted, dataOptions],
    );

    const chartConfig = useMemo(
        () => buildChartConfig(chartType, chartDataOptions),
        [chartType, chartDataOptions],
    );
    const valueColumns = useMemo(
        () => getValueColumns(chartDataOptions),
        [chartDataOptions],
    );
    const orderedColumns = useMemo(
        () =>
            orderColumnsForChart(
                resolveColumns(rows, columns),
                chartDataOptions,
            ),
        [rows, columns, chartDataOptions],
    );
    // A scatter reads numbers on both axes: its category stays a measure, so
    // the x axis is a value axis and not a list of categories.
    const dimensionColumns = useMemo(
        () =>
            chartType === 'scatter'
                ? getDimensionColumns(dataOptions).filter(
                      (name) => name !== dataOptions.category,
                  )
                : getDimensionColumns(dataOptions),
        [chartType, dataOptions],
    );
    // The renderer reads its config once, on mount. Rows that arrive later
    // can add series (`breakBy`), so a new set of fields remounts it.
    const configKey = [
        chartType,
        chartDataOptions.category ?? '',
        ...valueColumns,
    ].join('\u0000');
    return (
        <FilterPiece {...pieceProps}>
            <DataVisualization
                key={configKey}
                rows={rows}
                columns={orderedColumns}
                format={format}
                isLoading={isLoading}
                colorPalette={colorPalette ?? themePalette}
                chartConfig={chartConfig}
                valueColumns={valueColumns}
                dimensionColumns={dimensionColumns}
                onSelect={onSelect}
            />
        </FilterPiece>
    );
};

const TABLE_CHART_CONFIG: ChartConfig = { type: ChartType.TABLE, config: {} };

type DataTableProps = DataPieceProps & {
    // Columns to align and format as measures. Default: every number column.
    valueColumns?: string[];
};

/** A table from rows that host code supplies. */
const DataTable: FC<DataTableProps> = ({
    rows,
    columns,
    format,
    isLoading,
    colorPalette,
    valueColumns,
    ...pieceProps
}) => {
    const { palette: themePalette } = useLightdashTheme();
    const measures = useMemo(
        () =>
            valueColumns ??
            resolveColumns(rows, columns)
                .filter((column) => column.type === 'number')
                .map((column) => column.name),
        [valueColumns, rows, columns],
    );
    return (
        <FilterPiece {...pieceProps}>
            <DataVisualization
                rows={rows}
                columns={columns}
                format={format}
                isLoading={isLoading}
                colorPalette={colorPalette ?? themePalette}
                chartConfig={TABLE_CHART_CONFIG}
                valueColumns={measures}
            />
        </FilterPiece>
    );
};

type DataPivotTableProps = DataPieceProps & {
    // Columns that stay as row headers.
    rowFields: string[];
    // The column whose values become the table's columns.
    columnField: string;
    // One or more numeric columns to show under each column value.
    value: string | string[];
};

/** A pivot table from long rows: row headers, and one column per value. */
const DataPivotTable: FC<DataPivotTableProps> = ({
    rows,
    columns,
    format,
    isLoading,
    colorPalette,
    rowFields,
    columnField,
    value,
    ...pieceProps
}) => {
    const { palette: themePalette } = useLightdashTheme();
    const pivoted = useMemo(
        () =>
            pivotRows({
                rows,
                columns: resolveColumns(rows, columns),
                groupBy: rowFields,
                breakBy: columnField,
                values: Array.isArray(value) ? value : [value],
            }),
        [rows, columns, rowFields, columnField, value],
    );
    return (
        <FilterPiece {...pieceProps}>
            <DataVisualization
                rows={pivoted.rows}
                columns={pivoted.columns}
                format={format}
                isLoading={isLoading}
                colorPalette={colorPalette ?? themePalette}
                chartConfig={TABLE_CHART_CONFIG}
                valueColumns={pivoted.valueColumns}
                dimensionColumns={rowFields}
            />
        </FilterPiece>
    );
};

type TypedDataChartProps = DistributiveOmit<DataChartProps, 'chartType'>;

type QueryChartProps = QueryDataChartProps;

/**
 * A chart that runs its own governed query. The props are a query on one
 * explore and the look to draw it with, the shape `chartModelTranslator`
 * returns for a saved chart, so a page can change either before it renders.
 */
const QueryChart: FC<QueryChartProps> = ({
    exploreName,
    dimensions,
    metrics,
    filters,
    sorts,
    limit,
    chartType,
    dataOptions,
    onSelect,
    ...pieceProps
}) => {
    const { token: tokenOrTokenPromise, instanceUrl } =
        useSdkConnection(pieceProps);
    const tokenContext = useEmbedTokenContext(instanceUrl, tokenOrTokenPromise);
    const query = useMetricQuery(
        {
            instanceUrl,
            projectUuid: tokenContext?.projectUuid,
            auth: tokenContext
                ? { type: 'embedToken', token: tokenContext.token }
                : undefined,
        },
        { exploreName, dimensions, metrics, filters, sorts, limit },
        { enabled: !!tokenContext },
    );
    if (query.error) {
        return (
            <p role="alert" style={{ margin: 0 }}>
                {query.error.message}
            </p>
        );
    }
    return (
        <RowsDataChart
            {...pieceProps}
            rows={query.data?.rows ?? []}
            columns={query.data?.columns}
            isLoading={pieceProps.isLoading || !query.data}
            chartType={chartType}
            dataOptions={
                dataOptions ?? defaultDataOptions(chartType, dimensions, metrics)
            }
            onSelect={onSelect}
        />
    );
};

/**
 * One chart component for both inputs: a governed query (`exploreName`,
 * `dimensions`, `metrics`) that the chart runs itself, or `rows` the host
 * already has. Drawn by the Lightdash renderer either way.
 */
const DataChart: FC<DataChartProps> = (props) =>
    'exploreName' in props ? (
        <QueryChart {...props} />
    ) : (
        <RowsDataChart {...props} />
    );

type WidgetBaseProps = Omit<WidgetFrameProps, 'children'>;

type ChartWidgetProps = WidgetBaseProps & ChartProps;
type DataChartWidgetProps = WidgetBaseProps & DataChartProps;
type QueryChartWidgetProps = WidgetBaseProps & QueryChartProps;

const splitWidgetProps = <T extends WidgetBaseProps>({
    title,
    description,
    styleOptions,
    height,
    ...rest
}: T) => ({ frame: { title, description, styleOptions, height }, rest });

/**
 * A saved chart by its id, in a frame. The frame takes the chart's name and
 * description from Lightdash unless the host sets them.
 */
const ChartWidget: FC<ChartWidgetProps> = (props) => {
    const { frame, rest } = splitWidgetProps(props);
    const { token: tokenOrTokenPromise, instanceUrl } = useSdkConnection(rest);
    const tokenContext = useEmbedTokenContext(instanceUrl, tokenOrTokenPromise, {
        type: 'chart',
        savedChartUuid: rest.id,
    });
    const needsModel =
        frame.title === undefined || frame.description === undefined;
    const model = useChartModel(
        {
            instanceUrl,
            projectUuid: tokenContext?.projectUuid,
            auth: tokenContext
                ? { type: 'embedToken', token: tokenContext.token }
                : undefined,
        },
        { chartUuid: rest.id },
        { enabled: !!tokenContext && needsModel },
    );
    return (
        <WidgetFrame
            {...frame}
            title={frame.title ?? model.data?.name}
            description={
                frame.description ?? model.data?.description ?? undefined
            }
        >
            <Chart {...rest} />
        </WidgetFrame>
    );
};

/** A chart from a query or from host rows, in a titled frame. */
const DataChartWidget: FC<DataChartWidgetProps> = ({
    title,
    description,
    styleOptions,
    height,
    ...rest
}) => (
    <WidgetFrame
        title={title}
        description={description}
        styleOptions={styleOptions}
        height={height}
    >
        <DataChart {...rest} />
    </WidgetFrame>
);

/** A chart that runs its own query, in a titled frame. */
const QueryChartWidget: FC<QueryChartWidgetProps> = (props) => {
    const { frame, rest } = splitWidgetProps(props);
    return (
        <WidgetFrame {...frame}>
            <QueryChart {...rest} />
        </WidgetFrame>
    );
};

type PivotTableWidgetProps = WidgetBaseProps & DataPivotTableProps;

/** A pivot table from host rows, in a titled frame. */
const PivotTableWidget: FC<PivotTableWidgetProps> = (props) => {
    const { frame, rest } = splitWidgetProps(props);
    return (
        <WidgetFrame {...frame}>
            <DataPivotTable {...rest} />
        </WidgetFrame>
    );
};

type CustomWidgetFrameProps = WidgetBaseProps &
    Pick<DataPieceProps, 'rows' | 'columns'> & {
        // A type registered through `useCustomWidgets` or the provider.
        customWidgetType: string;
        options?: Record<string, unknown>;
        onSelect?: DataChartProps['onSelect'];
    };

type WidgetProps =
    | ({ widgetType: 'chart' } & ChartWidgetProps)
    | ({ widgetType: 'dataChart' } & DataChartWidgetProps)
    | ({ widgetType: 'queryChart' } & QueryChartWidgetProps)
    | ({ widgetType: 'pivot' } & PivotTableWidgetProps)
    | ({ widgetType: 'custom' } & CustomWidgetFrameProps);

/**
 * One entry point for every widget kind. A `custom` widget is drawn by the
 * component the host registered for its type.
 */
const Widget: FC<WidgetProps> = (props) => {
    const registry = useOptionalCustomWidgets();
    switch (props.widgetType) {
        case 'chart': {
            const { widgetType: _chart, ...chartProps } = props;
            return <ChartWidget {...chartProps} />;
        }
        case 'dataChart': {
            const { widgetType: _dataChart, ...dataChartProps } = props;
            return <DataChartWidget {...dataChartProps} />;
        }
        case 'queryChart': {
            const { widgetType: _queryChart, ...queryChartProps } = props;
            return <QueryChartWidget {...queryChartProps} />;
        }
        case 'pivot': {
            const { widgetType: _pivot, ...pivotProps } = props;
            return <PivotTableWidget {...pivotProps} />;
        }
        case 'custom': {
            const { frame, rest } = splitWidgetProps(props);
            const Custom = registry?.getCustomWidget(rest.customWidgetType);
            return (
                <WidgetFrame {...frame}>
                    {Custom ? (
                        <Custom
                            rows={rest.rows}
                            columns={resolveColumns(rest.rows, rest.columns)}
                            options={rest.options ?? {}}
                            onSelect={rest.onSelect}
                        />
                    ) : (
                        <p role="alert" style={{ margin: 0, padding: 14 }}>
                            No custom widget is registered for “
                            {rest.customWidgetType}”.
                        </p>
                    )}
                </WidgetFrame>
            );
        }
        default:
            return assertUnreachable(props, 'Unknown widget type');
    }
};

type DrilldownChartProps = Omit<DataPieceProps, 'rows' | 'columns'> & {
    exploreName: string;
    // Dimension field ids to drill through, from the widest to the narrowest.
    paths: string[];
    // Metric field ids to show at every level.
    metrics: string[];
    chartType?: DataChartType;
    // Filters that apply at every level, under the picks of the viewer.
    filters?: LightdashQueryFilter[];
    // Display names for the dimensions in the breadcrumbs.
    labels?: Record<string, string>;
    limit?: number;
    onChange?: UseDrilldownOptions['onChange'];
};

/**
 * One chart that a viewer drills through. A click on a data point filters by
 * that value and groups by the next dimension; the breadcrumbs go back up.
 * Each level is a governed query on the explore of the token.
 */
const DrilldownChart: FC<DrilldownChartProps> = ({
    exploreName,
    paths,
    metrics,
    chartType = 'column',
    filters = [],
    labels,
    limit,
    onChange,
    ...pieceProps
}) => {
    const { token: tokenOrTokenPromise, instanceUrl } =
        useSdkConnection(pieceProps);
    const tokenContext = useEmbedTokenContext(instanceUrl, tokenOrTokenPromise);
    const drilldown = useDrilldown({ paths, onChange });
    const query = useMetricQuery(
        {
            instanceUrl,
            projectUuid: tokenContext?.projectUuid,
            auth: tokenContext
                ? { type: 'embedToken', token: tokenContext.token }
                : undefined,
        },
        {
            exploreName,
            dimensions: [drilldown.dimension],
            metrics,
            filters: [...filters, ...drilldown.filters],
            sorts: [{ field: drilldown.dimension }],
            limit,
        },
        { enabled: !!tokenContext },
    );
    // The category shows the server's display text; a click maps it back to
    // the raw value, which is what the filter of the next level needs.
    const display = useMemo(() => {
        const { dimension } = drilldown;
        const rawByLabel = new Map<string, DrilldownStep['value']>();
        const rows = (query.data?.rows ?? []).map((row, index) => {
            const label =
                query.data?.formattedRows[index]?.[dimension] ??
                String(row[dimension]);
            rawByLabel.set(label, row[dimension]);
            return { ...row, [dimension]: label };
        });
        const columns = (query.data?.columns ?? []).map((column) => ({
            ...column,
            type: column.name === dimension ? ('string' as const) : column.type,
            label: labels?.[column.name] ?? column.label,
        }));
        return { rows, columns, rawByLabel };
    }, [drilldown, labels, query.data]);
    const [stepLabels, setStepLabels] = useState<string[]>([]);

    return (
        <div
            data-lightdash-drilldown-widget=""
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                height: '100%',
            }}
        >
            <DrilldownBreadcrumbs
                steps={drilldown.steps.map((step, index) => ({
                    ...step,
                    value: stepLabels[index] ?? step.value,
                }))}
                currentDimension={drilldown.dimension}
                labels={labels}
                onSelect={(level) => {
                    setStepLabels((current) => current.slice(0, level));
                    drilldown.goTo(level);
                }}
            />
            {query.error ? (
                <p role="alert" style={{ margin: 0 }}>
                    {query.error.message}
                </p>
            ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                    <DataChart
                        {...pieceProps}
                        rows={display.rows}
                        columns={display.columns}
                        isLoading={query.isLoading}
                        chartType={chartType}
                        dataOptions={{
                            category: drilldown.dimension,
                            value: metrics,
                        }}
                        onSelect={({ row }) => {
                            const label = String(row[drilldown.dimension]);
                            if (!drilldown.canDrill) return;
                            if (!display.rawByLabel.has(label)) return;
                            setStepLabels((current) => [
                                ...current.slice(0, drilldown.steps.length),
                                label,
                            ]);
                            drilldown.drill(
                                display.rawByLabel.get(label) ?? null,
                            );
                        }}
                    />
                </div>
            )}
        </div>
    );
};

const typedDataChart = (chartType: DataChartType, displayName: string) => {
    const Component: FC<TypedDataChartProps> = (props) => (
        <DataChart {...props} chartType={chartType} />
    );
    Component.displayName = displayName;
    return Component;
};

const BarChart = typedDataChart('bar', 'BarChart');
const ColumnChart = typedDataChart('column', 'ColumnChart');
const LineChart = typedDataChart('line', 'LineChart');
const AreaChart = typedDataChart('area', 'AreaChart');
const ScatterChart = typedDataChart('scatter', 'ScatterChart');
const PieChart = typedDataChart('pie', 'PieChart');
const FunnelChart = typedDataChart('funnel', 'FunnelChart');
const KpiChart = typedDataChart('kpi', 'KpiChart');
const TreemapChart = typedDataChart('treemap', 'TreemapChart');
const GaugeChart = typedDataChart('gauge', 'GaugeChart');
const SankeyChart = typedDataChart('sankey', 'SankeyChart');
const MapChart = typedDataChart('map', 'MapChart');

const dashboardHelpers = {
    addFilter,
    addFilters,
    removeFilter,
    removeFilters,
    replaceFilter,
};

const Lightdash = {
    Provider,
    useLightdashConfig,
    useContentToken,
    DataChart,
    DataTable,
    DataPivotTable,
    BarChart,
    ColumnChart,
    LineChart,
    AreaChart,
    ScatterChart,
    PieChart,
    FunnelChart,
    KpiChart,
    TreemapChart,
    GaugeChart,
    SankeyChart,
    MapChart,
    FilterTile,
    MemberFilterTile,
    DateRangeFilterTile,
    RelativeDateFilterTile,
    CriteriaFilterTile,
    FiltersPanel,
    Widget,
    ChartWidget,
    DataChartWidget,
    QueryChart,
    QueryChartWidget,
    PivotTableWidget,
    WidgetFrame,
    CustomWidgetsProvider,
    useCustomWidgets,
    ThemeProvider,
    useLightdashTheme,
    LoadingOverlay,
    AgentInsights,
    useAgentAnswer,
    useAgentSuggestions,
    useSyncedState,
    useChartModel,
    useChartQuery,
    chartModelTranslator,
    filterFactory,
    useLightdashQueryCache,
    useMetricQueryPivot,
    extractFields,
    formatDate,
    formatNumber,
    formatRows,
    getDefaultDateFormat,
    createLinearGradient,
    createRadialGradient,
    GradientDirections,
    isGradient,
    isLinearGradient,
    isRadialGradient,
    LightdashFrame,
    ContextMenu,
    DrilldownChart,
    DrilldownWidget,
    DrilldownBreadcrumbs,
    useMetricQuery,
    useDrilldown,
    useJumpToDashboard,
    ComposedDashboard,
    useComposedDashboard,
    useDashboardModel,
    useExploreFields,
    useFieldValues,
    useLightdashFetch,
    dashboardModelToComposed,
    dashboardHelpers,
    createDefaultLayout,
    DataApp,
    DataAppComponent,
    AiAgent,
    Dashboard,
    DashboardBuilder,
    MetricsCatalog,
    Explore,
    Chart,
    FilterOperator,
    createLightdashApiClient,
    useLightdashAiAgentThreads,
    useLightdashContent,
};

// ts-unused-exports:disable-next-line
export {
    Provider,
    useLightdashConfig,
    useContentToken,
    DataChart,
    DataTable,
    DataPivotTable,
    BarChart,
    ColumnChart,
    LineChart,
    AreaChart,
    ScatterChart,
    PieChart,
    FunnelChart,
    KpiChart,
    TreemapChart,
    GaugeChart,
    SankeyChart,
    MapChart,
    FilterTile,
    MemberFilterTile,
    DateRangeFilterTile,
    RelativeDateFilterTile,
    CriteriaFilterTile,
    FiltersPanel,
    Widget,
    ChartWidget,
    DataChartWidget,
    QueryChart,
    QueryChartWidget,
    PivotTableWidget,
    WidgetFrame,
    CustomWidgetsProvider,
    useCustomWidgets,
    ThemeProvider,
    useLightdashTheme,
    LoadingOverlay,
    AgentInsights,
    useAgentAnswer,
    useAgentSuggestions,
    useSyncedState,
    useChartModel,
    useChartQuery,
    chartModelTranslator,
    filterFactory,
    useLightdashQueryCache,
    useMetricQueryPivot,
    extractFields,
    formatDate,
    formatNumber,
    formatRows,
    getDefaultDateFormat,
    createLinearGradient,
    createRadialGradient,
    GradientDirections,
    isGradient,
    isLinearGradient,
    isRadialGradient,
    LightdashFrame,
    ContextMenu,
    DrilldownChart,
    DrilldownWidget,
    DrilldownBreadcrumbs,
    useMetricQuery,
    useDrilldown,
    useJumpToDashboard,
    ComposedDashboard,
    useComposedDashboard,
    useDashboardModel,
    useExploreFields,
    useFieldValues,
    useLightdashFetch,
    dashboardModelToComposed,
    dashboardHelpers,
    createDefaultLayout,
    DataApp,
    DataAppComponent,
    AiAgent,
    Chart,
    Dashboard,
    DashboardBuilder,
    Explore,
    MetricsCatalog,
    FilterOperator,
    createLightdashApiClient,
    useLightdashAiAgentThreads,
    useLightdashContent,
};
export type {
    SdkUiOverrides,
    UiStringKey,
    SdkFilter,
    SdkChartSelection,
    ChartProps,
    DashboardProps,
    ProviderProps,
    DataChartProps,
    DataTableProps,
    DataPivotTableProps,
    DataChartSelection,
    DataChartType,
    DataColumn,
    DataFormatter,
    DataOptions,
    DataRow,
    FilterTileProps,
    FiltersPanelProps,
    ContextMenuItem,
    ContextMenuSection,
    ChartWidgetProps,
    DataChartWidgetProps,
    QueryChartProps,
    QueryChartWidgetProps,
    PivotTableWidgetProps,
    WidgetProps,
    ChartModelQueryParams,
    ChartModelQueryChartProps,
    LightdashQueryFilter,
    LightdashSimpleFilter,
    LightdashFilterRule,
    LightdashFilterGroup,
    LightdashFilterOperator,
    LightdashFilterValue,
    LightdashUnitOfTime,
    LightdashDateFilterSettings,
    ChartModelQueryChartWidgetProps,
    ChartModelDataChartProps,
    ChartModelDataTableProps,
    ChartModelDataPivotTableProps,
    ChartModelDataChartWidgetProps,
    ChartModelPivotTableWidgetProps,
    ChartModelWidgetProps,
    UseChartQueryArgs,
    UseChartQueryResult,
    WidgetFrameProps,
    WidgetStyleOptions,
    CustomWidgetComponent,
    CustomWidgetProps,
    AgentAnswer,
    UseAgentAnswerResult,
    LightdashTheme,
    LightdashChartFields,
    LightdashChartModel,
    DateGranularity,
    Gradient,
    GradientStop,
    LinearGradient,
    RadialGradient,
    LightdashFrameEvent,
    LightdashFrameEventName,
    LightdashFrameOptions,
    DrilldownChartProps,
    DrilldownFilter,
    DrilldownStep,
    UseDrilldownOptions,
    UseDrilldownResult,
    JumpToDashboardTarget,
    ComposedDashboardProps,
    ComposedDashboardResult,
    ComposedDashboardChangeEvent,
    ComposedLayout,
    ComposedWidget,
    ComposedWidgetState,
    UseComposedDashboardOptions,
    LightdashAiAgentThread,
    LightdashAiAgentThreadResults,
    LightdashApiClientConfig,
    EmbedContentTokenRequest,
    EmbedContentToken,
    LightdashContentItem,
    LightdashContentResults,
    LightdashSdkApiAuth,
    ListAiAgentThreadsOptions,
    ListContentOptions,
};
// ts-unused-exports:disable-next-line
export default Lightdash;
export type { DataAppProps, NativeDataAppModule } from './DataApp';
