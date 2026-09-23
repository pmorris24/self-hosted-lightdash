import { describe, expect, it, vi } from 'vitest';

// The surface is all this test reads. Monaco and the embed pages are heavy
// and irrelevant to it.
vi.mock('../src/components/MonacoEditor', () => ({
    default: () => null,
    MonacoDiffEditor: () => null,
}));

// eslint-disable-next-line import/first
import Lightdash from './index';

/**
 * Every name on the default export is a promise to hosts: additive only,
 * never renamed, never removed without a major. This test makes a change to
 * the surface deliberate rather than incidental. Add a name here in the same
 * commit that exports it.
 */
const PUBLIC_SURFACE = [
    // Connection
    'Provider',
    'useLightdashConfig',
    'useContentToken',
    'useLightdashFetch',
    'useLightdashContent',
    'useLightdashAiAgentThreads',
    'createLightdashApiClient',
    // Whole Lightdash screens
    'Dashboard',
    'DashboardBuilder',
    'Explore',
    'MetricsCatalog',
    'DataApp',
    'DataAppComponent',
    'AiAgent',
    // Charts and tables: the component name says where the data comes from
    'Chart',
    'QueryChart',
    'DataChart',
    'DataTable',
    'QueryTable',
    'DataPivotTable',
    'Widget',
    'WidgetFrame',
    // One component per chart type, each a QueryChart with its type fixed
    'BarChart',
    'ColumnChart',
    'LineChart',
    'AreaChart',
    'ScatterChart',
    'PieChart',
    'FunnelChart',
    'KpiChart',
    'TreemapChart',
    'GaugeChart',
    'SankeyChart',
    'MapChart',
    // Filters
    'FilterTile',
    'MemberFilterTile',
    'DateRangeFilterTile',
    'RelativeDateFilterTile',
    'CriteriaFilterTile',
    'FiltersPanel',
    'FilterOperator',
    'filterFactory',
    // Drilldown
    'ContextMenu',
    'DrilldownChart',
    'DrilldownWidget',
    'DrilldownBreadcrumbs',
    'useDrilldown',
    'useJumpToDashboard',
    // Composition
    'ComposedDashboard',
    'useComposedDashboard',
    'useDashboardModel',
    'dashboardModelToComposed',
    'dashboardHelpers',
    'createDefaultLayout',
    'CustomWidgetsProvider',
    'useCustomWidgets',
    // Queries
    'useMetricQuery',
    'useMetricQueryPivot',
    'useChartModel',
    'useChartQuery',
    'useExploreFields',
    'useFieldValues',
    'useLightdashQueryCache',
    'chartModelTranslator',
    'extractFields',
    // AI: surfaces and hooks, not chrome
    'AgentInsights',
    'AgentSurface',
    'AgentPaneHeader',
    'AgentToolbar',
    'AgentSelect',
    'AgentStatus',
    'AgentWelcome',
    'AgentSuggestion',
    'AgentTranscript',
    'AgentTurn',
    'AgentStepRow',
    'AgentChartCard',
    'AgentComposer',
    'agentMarkdown',
    'agentHighlightJson',
    'agentStepLabel',
    'agentThemeVariables',
    'agentChartTranslator',
    'mergeAgentThemes',
    'useAgentAnswer',
    'useAgentConversation',
    'useAgentSuggestions',
    // Theme and helpers
    'ThemeProvider',
    'useLightdashTheme',
    'LoadingOverlay',
    'useSyncedState',
    'formatDate',
    'formatNumber',
    'formatRows',
    'getDefaultDateFormat',
    'LightdashFrame',
] as const;

describe('SDK public surface', () => {
    it('exports exactly the names it promises', () => {
        expect(Object.keys(Lightdash).sort()).toEqual(
            [...PUBLIC_SURFACE].sort(),
        );
    });

    it('keeps page chrome out of the contract', () => {
        // Icons and gradient builders are a host's job. Shipping them means
        // supporting them forever for something every design system has.
        const chrome = [
            'AgentBolt',
            'AgentMark',
            'AgentPlusIcon',
            'AgentColumnsIcon',
            'AgentIconButton',
            'AgentCopyButton',
            'AgentDayDivider',
            'AgentTimestamp',
            'AgentScrollToBottom',
            'createLinearGradient',
            'createRadialGradient',
            'GradientDirections',
            'isGradient',
        ];
        expect(chrome.filter((name) => name in Lightdash)).toEqual([]);
    });

    it('has one chart component per input, so none has to guess', () => {
        // The regression this pins: a component that took either a saved
        // chart id or a query and sniffed `'id' in props` to tell them apart.
        expect(Lightdash.Chart).not.toBe(Lightdash.QueryChart);
        expect(Lightdash.QueryChart).not.toBe(Lightdash.DataChart);
        expect('ChartWidget' in Lightdash).toBe(false);
        expect('SavedChartWidget' in Lightdash).toBe(false);
        expect('DataChartWidget' in Lightdash).toBe(false);
        expect('QueryChartWidget' in Lightdash).toBe(false);
        expect('PivotTableWidget' in Lightdash).toBe(false);
    });
});
