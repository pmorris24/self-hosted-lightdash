import {
    createEmbedClient,
    LightdashProvider,
    savedChart,
    useLightdash,
} from '@lightdash/query-sdk';
import Lightdash from '@lightdash/sdk';
import { useMemo, type CSSProperties } from 'react';
import { ExampleLayout } from '../components/ExampleLayout';
import { useDevTokens, type DevTokens } from '../hooks/useDevTokens';
import { type EmbedConfigState } from '../hooks/useEmbedConfig';
import { getRepoSourceUrl } from '../lib/repo';
import { emptyStateBoxStyle, emptyStateStyle } from '../styles';
import {
    sectionDescStyle,
    sectionTitleStyle,
} from './PaletteUuidExamplePage.styles';

type QueryToChartExamplePageProps = {
    embedConfig: EmbedConfigState;
};

const sourceUrl = getRepoSourceUrl(
    'packages/sdk-test-app/src/examples/QueryToChartExamplePage.tsx',
);

const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
};

const tileStyle: CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
};

const tileTitleStyle: CSSProperties = {
    margin: 0,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 500,
    borderBottom: '1px solid #e5e7eb',
};

const statusStyle: CSSProperties = {
    padding: 16,
    fontSize: 13,
    color: '#6b7280',
};

// The analyst owns the query: it is the saved chart's. This page owns the look.
function SavedChartRows({ chartUuid }: { chartUuid: string }) {
    const { data, columns, loading, error } = useLightdash(
        savedChart(chartUuid),
    );
    const category = columns.find((column) => column.type !== 'number')?.name;
    const values = columns
        .filter((column) => column.type === 'number')
        .map((column) => column.name);

    if (error) {
        return (
            <div style={statusStyle} data-testid="query-error">
                The query failed: {error.message}
            </div>
        );
    }
    if (loading || !category || values.length === 0) {
        return <div style={statusStyle}>Running the saved chart's query…</div>;
    }

    return (
        <div style={gridStyle}>
            <div style={tileStyle} data-testid="query-column-chart">
                <h4 style={tileTitleStyle}>
                    Lightdash.ColumnChart from the rows
                </h4>
                <div style={{ height: 320 }}>
                    <Lightdash.ColumnChart
                        rows={data}
                        columns={columns}
                        dataOptions={{ category, value: values }}
                    />
                </div>
            </div>
            <div style={tileStyle} data-testid="query-data-table">
                <h4 style={tileTitleStyle}>Lightdash.DataTable from the rows</h4>
                <div style={{ height: 320 }}>
                    <Lightdash.DataTable rows={data} columns={columns} />
                </div>
            </div>
        </div>
    );
}

function QueryWorkspace({ tokens }: { tokens: DevTokens }) {
    const chart = tokens.charts.find(
        (candidate) => candidate.chartKind === 'horizontal_bar',
    );
    // A chart token, and no appUuid: this page is not a data app.
    const client = useMemo(
        () =>
            chart
                ? createEmbedClient({
                      baseUrl: tokens.instanceUrl,
                      projectUuid: tokens.projectUuid,
                      embedToken: chart.token,
                  })
                : null,
        [chart, tokens.instanceUrl, tokens.projectUuid],
    );

    if (!chart || !client) {
        return <div style={statusStyle}>No saved chart to query.</div>;
    }

    return (
        <Lightdash.Provider instanceUrl={tokens.instanceUrl} token={chart.token}>
            <LightdashProvider client={client}>
                <p style={sectionDescStyle}>
                    Saved chart: <strong>{chart.name}</strong>
                </p>
                <SavedChartRows chartUuid={chart.uuid} />
            </LightdashProvider>
        </Lightdash.Provider>
    );
}

export function QueryToChartExamplePage({
    embedConfig,
}: QueryToChartExamplePageProps) {
    const { tokens, error } = useDevTokens();

    return (
        <ExampleLayout
            embedConfig={embedConfig}
            sourceUrl={sourceUrl}
            title="Saved chart query demo"
            description={
                <>
                    Host code runs a saved chart's governed query with{' '}
                    <code>@lightdash/query-sdk</code> and a chart token, then
                    draws the rows with its own choice of components.
                </>
            }
        >
            {tokens ? (
                <section>
                    <h3 style={sectionTitleStyle}>
                        savedChart() → rows → DataChart
                    </h3>
                    <QueryWorkspace tokens={tokens} />
                </section>
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
