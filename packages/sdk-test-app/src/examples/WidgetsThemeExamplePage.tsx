import Lightdash, {
    useChartModel,
    useLightdashQueryCache,
    useMetricQueryPivot,
    type CustomWidgetProps,
} from '@lightdash/sdk';
import { useMemo, useState, type CSSProperties } from 'react';
import { ExampleLayout } from '../components/ExampleLayout';
import { useDevTokens, type DevTokens } from '../hooks/useDevTokens';
import { type EmbedConfigState } from '../hooks/useEmbedConfig';
import { getRepoSourceUrl } from '../lib/repo';
import { emptyStateBoxStyle, emptyStateStyle } from '../styles';
import {
    sectionDescStyle,
    sectionTitleStyle,
} from './PaletteUuidExamplePage.styles';

type WidgetsThemeExamplePageProps = {
    embedConfig: EmbedConfigState;
};

const sourceUrl = getRepoSourceUrl(
    'packages/sdk-test-app/src/examples/WidgetsThemeExamplePage.tsx',
);

const ROWS = [
    { region: 'North', revenue: 4200, target: 4000 },
    { region: 'South', revenue: 3100, target: 3600 },
    { region: 'East', revenue: 5300, target: 5000 },
    { region: 'West', revenue: 2700, target: 3000 },
];

const THEMES = {
    light: {
        colorScheme: 'light',
        backgroundColor: '#ffffff',
        palette: ['#2563eb', '#f59e0b', '#10b981'],
    },
    dark: {
        colorScheme: 'dark',
        backgroundColor: '#111827',
        palette: ['#a78bfa', '#f472b6', '#34d399'],
    },
} as const;

const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
};

const buttonStyle: CSSProperties = {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    marginBottom: 12,
};

// A widget type this page owns: progress of each region against its target.
function TargetBars({ rows, options }: CustomWidgetProps<{ color: string }>) {
    return (
        <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            {rows.map((row) => {
                const share = Math.min(
                    1,
                    Number(row.revenue) / Number(row.target),
                );
                return (
                    <div key={String(row.region)} style={{ fontSize: 13 }}>
                        {String(row.region)} · {Math.round(share * 100)}%
                        <div style={{ height: 8, background: '#e5e7eb' }}>
                            <div
                                style={{
                                    width: `${share * 100}%`,
                                    height: 8,
                                    background: options.color,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

const CUSTOM_WIDGETS = { targetBars: TargetBars };

function GovernedWidgets({ tokens }: { tokens: DevTokens }) {
    const chart = tokens.charts.find(
        (candidate) => candidate.exploreName === 'orders',
    );
    const config = useMemo(
        () => ({
            instanceUrl: tokens.instanceUrl,
            projectUuid: tokens.projectUuid,
            auth: chart
                ? ({ type: 'embedToken', token: chart.token } as const)
                : undefined,
        }),
        [chart, tokens.instanceUrl, tokens.projectUuid],
    );
    const model = useChartModel(config, { chartUuid: chart?.uuid ?? '' });
    const pivot = useMetricQueryPivot(
        config,
        {
            exploreName: 'orders',
            dimensions: ['orders_order_date_year', 'orders_status'],
            metrics: ['orders_total_order_amount'],
            rowFields: ['orders_order_date_year'],
            columnField: 'orders_status',
        },
        { cache: true, enabled: !!chart },
    );
    const cache = useLightdashQueryCache();

    if (!chart) return null;
    return (
        <>
            <p style={sectionDescStyle} data-testid="chart-model">
                useChartModel: {model.data?.name ?? '…'} · explore{' '}
                {model.data?.exploreName ?? '…'} · cached results:{' '}
                {cache.size()}
            </p>
            <div style={gridStyle}>
                <div style={{ height: 340 }} data-testid="saved-chart-widget">
                    <Lightdash.Chart
                        frame={{
                            title: chart.name,
                            description: 'A saved chart in a widget frame',
                        }}
                        id={chart.uuid}
                        instanceUrl={tokens.instanceUrl}
                        token={chart.token}
                    />
                </div>
                <div style={{ height: 340 }} data-testid="pivot-query-widget">
                    <Lightdash.WidgetFrame
                        title="Order amount by year and status"
                        description="useMetricQueryPivot → DataTable"
                    >
                        <Lightdash.LoadingOverlay isVisible={pivot.isLoading}>
                            <Lightdash.DataTable
                                rows={pivot.data?.rows ?? []}
                                columns={pivot.data?.columns}
                            />
                        </Lightdash.LoadingOverlay>
                    </Lightdash.WidgetFrame>
                </div>
            </div>
        </>
    );
}

export function WidgetsThemeExamplePage({
    embedConfig,
}: WidgetsThemeExamplePageProps) {
    const { tokens, error } = useDevTokens();
    const [scheme, setScheme] = useState<'light' | 'dark'>('light');
    const chart = tokens?.charts[0];

    return (
        <ExampleLayout
            embedConfig={embedConfig}
            sourceUrl={sourceUrl}
            title="Widgets and theme demo"
            description={
                <>
                    <code>Lightdash.ThemeProvider</code> gives every piece one
                    look. <code>Lightdash.Widget</code> frames charts, pivot
                    tables, and widget types this page registers.
                </>
            }
        >
            {tokens && chart ? (
                <Lightdash.Provider
                    instanceUrl={tokens.instanceUrl}
                    token={chart.token}
                >
                    <Lightdash.ThemeProvider theme={THEMES[scheme]}>
                        <Lightdash.CustomWidgetsProvider
                            widgets={CUSTOM_WIDGETS}
                        >
                            <section>
                                <h3 style={sectionTitleStyle}>
                                    One theme, three widget kinds
                                </h3>
                                <button
                                    type="button"
                                    style={buttonStyle}
                                    data-testid="theme-toggle"
                                    onClick={() =>
                                        setScheme(
                                            scheme === 'light'
                                                ? 'dark'
                                                : 'light',
                                        )
                                    }
                                >
                                    Theme: {scheme}
                                </button>
                                <div style={gridStyle}>
                                    <div
                                        style={{ height: 320 }}
                                        data-testid="chart-widget"
                                    >
                                        <Lightdash.Widget
                                            widgetType="dataChart"
                                            title="Revenue and target"
                                            rows={ROWS}
                                            chartType="column"
                                            dataOptions={{
                                                category: 'region',
                                                value: ['revenue', 'target'],
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{ height: 320 }}
                                        data-testid="custom-widget"
                                    >
                                        <Lightdash.Widget
                                            widgetType="custom"
                                            customWidgetType="targetBars"
                                            title="Progress to target"
                                            rows={ROWS}
                                            options={{
                                                color: THEMES[scheme]
                                                    .palette[0],
                                            }}
                                        />
                                    </div>
                                </div>
                                <h3 style={sectionTitleStyle}>
                                    Governed data in widgets
                                </h3>
                                <GovernedWidgets tokens={tokens} />
                            </section>
                        </Lightdash.CustomWidgetsProvider>
                    </Lightdash.ThemeProvider>
                </Lightdash.Provider>
            ) : (
                <div style={emptyStateStyle}>
                    <div style={emptyStateBoxStyle}>
                        {error ?? 'Signing tokens for the local instance…'}
                    </div>
                </div>
            )}
        </ExampleLayout>
    );
}
