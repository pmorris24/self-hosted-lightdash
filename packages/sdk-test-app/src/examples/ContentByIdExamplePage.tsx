import Lightdash, { chartModelTranslator, useChartQuery } from '@lightdash/sdk';
import { useMemo, type CSSProperties } from 'react';
import { ExampleLayout } from '../components/ExampleLayout';
import { useDevTokens, type DevTokens } from '../hooks/useDevTokens';
import { type EmbedConfigState } from '../hooks/useEmbedConfig';
import { getRepoSourceUrl } from '../lib/repo';
import { emptyStateBoxStyle, emptyStateStyle } from '../styles';
import {
    infoBoxStyle,
    sectionDescStyle,
    sectionTitleStyle,
} from './PaletteUuidExamplePage.styles';

type ContentByIdExamplePageProps = {
    embedConfig: EmbedConfigState;
};

const sourceUrl = getRepoSourceUrl(
    'packages/sdk-test-app/src/examples/ContentByIdExamplePage.tsx',
);

const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
};

const dashboardStyle: CSSProperties = {
    height: 560,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'auto',
};

const statusStyle: CSSProperties = {
    padding: 16,
    fontSize: 13,
    color: '#6b7280',
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
};

const cellStyle: CSSProperties = {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'top',
};

// A saved chart read by id: its model, its query, and its rows drawn by the
// data pieces through the translator. The host owns the layout.
function TranslatedChart({
    tokens,
    chartUuid,
    token,
}: {
    tokens: DevTokens;
    chartUuid: string;
    token: string;
}) {
    const config = useMemo(
        () => ({
            instanceUrl: tokens.instanceUrl,
            projectUuid: tokens.projectUuid,
            auth: { type: 'embedToken', token } as const,
        }),
        [token, tokens.instanceUrl, tokens.projectUuid],
    );
    const { chart, query, isLoading, error } = useChartQuery(
        config,
        { chartUuid },
        { cache: true },
    );

    if (error) {
        return (
            <div style={statusStyle} data-testid="translator-error">
                {error.message}
            </div>
        );
    }
    if (isLoading || !chart.data || !query.data) {
        return <div style={statusStyle}>Reading the chart and its rows…</div>;
    }

    const chartProps = chartModelTranslator.toDataChartProps(
        chart.data,
        query.data,
    );
    const tableProps = chartModelTranslator.toDataTableProps(
        chart.data,
        query.data,
    );
    const pivotProps = chartModelTranslator.toDataPivotTableProps(
        chart.data,
        query.data,
    );

    return (
        <>
            <div style={gridStyle}>
                <div style={{ height: 320 }} data-testid="translated-chart">
                    <Lightdash.DataChartWidget
                        {...chartModelTranslator.toDataChartWidgetProps(
                            chart.data,
                            query.data,
                        )}
                    />
                </div>
                <div style={{ height: 320 }} data-testid="translated-table">
                    <Lightdash.WidgetFrame
                        title={chart.data.name}
                        description="toDataTableProps → DataTable"
                    >
                        <Lightdash.DataTable {...tableProps} />
                    </Lightdash.WidgetFrame>
                </div>
            </div>
            <pre style={infoBoxStyle} data-testid="translated-props">
                {JSON.stringify(
                    {
                        toMetricQueryParams:
                            chartModelTranslator.toMetricQueryParams(
                                chart.data,
                            ),
                        toDataChartType: chartModelTranslator.toDataChartType(
                            chart.data.chartKind,
                        ),
                        toDataOptions: chartProps.dataOptions,
                        toDataPivotTableProps: pivotProps
                            ? {
                                  rowFields: pivotProps.rowFields,
                                  columnField: pivotProps.columnField,
                                  value: pivotProps.value,
                              }
                            : null,
                    },
                    null,
                    2,
                )}
            </pre>
        </>
    );
}

function ContentById({ tokens }: { tokens: DevTokens }) {
    const widgets = tokens.charts
        .filter((chart) => chart.chartKind !== 'table')
        .slice(0, 2);
    const translated = tokens.charts.find(
        (chart) => chart.exploreName === 'orders',
    );

    return (
        <>
            <section>
                <h3 style={sectionTitleStyle}>Dashboard by id</h3>
                <p style={sectionDescStyle}>
                    The saved dashboard <code>{tokens.dashboard.uuid}</code>,
                    with a dashboard token. The id is checked against the
                    token.
                </p>
                <div style={dashboardStyle} data-testid="dashboard-by-id">
                    <Lightdash.Dashboard
                        id={tokens.dashboard.uuid}
                        instanceUrl={tokens.instanceUrl}
                        token={tokens.dashboard.tokens.filters}
                    />
                </div>
            </section>

            <section>
                <h3 style={sectionTitleStyle}>ChartWidget with the saved title</h3>
                <p style={sectionDescStyle}>
                    One saved chart per frame, each with its own chart token.
                    The frame takes the chart's name and description from the
                    model unless the page sets them.
                </p>
                <div style={gridStyle}>
                    {widgets.map((chart) => (
                        <div
                            key={chart.uuid}
                            style={{ height: 340 }}
                            data-testid="widget-by-id"
                        >
                            <Lightdash.ChartWidget
                                id={chart.uuid}
                                instanceUrl={tokens.instanceUrl}
                                token={chart.token}
                            />
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h3 style={sectionTitleStyle}>
                    useChartQuery → chartModelTranslator → data pieces
                </h3>
                <p style={sectionDescStyle}>
                    <code>useChartQuery</code> reads the model of chart{' '}
                    <code>{translated?.uuid}</code> and runs its query.{' '}
                    <code>chartModelTranslator</code> turns the model and the
                    rows into props for <code>DataChart</code>,{' '}
                    <code>DataTable</code>, <code>DataPivotTable</code> and the
                    widgets, so the page picks the component.
                </p>
                {translated ? (
                    <Lightdash.Provider
                        instanceUrl={tokens.instanceUrl}
                        token={translated.token}
                    >
                        <TranslatedChart
                            tokens={tokens}
                            chartUuid={translated.uuid}
                            token={translated.token}
                        />
                    </Lightdash.Provider>
                ) : (
                    <div style={statusStyle}>No chart on the orders explore.</div>
                )}
            </section>

            <section>
                <h3 style={sectionTitleStyle}>Not in Lightdash, by design</h3>
                <table style={tableStyle} data-testid="not-applicable">
                    <thead>
                        <tr>
                            <th style={cellStyle}>Elsewhere</th>
                            <th style={cellStyle}>Here</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={cellStyle}>Hierarchy models</td>
                            <td style={cellStyle}>
                                There are no saved hierarchies. A drill path is
                                host code: <code>useDrilldown</code> and{' '}
                                <code>DrilldownChart</code> take the list of
                                dimensions.
                            </td>
                        </tr>
                        <tr>
                            <td style={cellStyle}>Shared formulas</td>
                            <td style={cellStyle}>
                                Metrics are defined once in the dbt semantic
                                layer. <code>useExploreFields</code> lists the
                                metrics of an explore, and every query reuses
                                them.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>
        </>
    );
}

export function ContentByIdExamplePage({
    embedConfig,
}: ContentByIdExamplePageProps) {
    const { tokens, error } = useDevTokens();

    return (
        <ExampleLayout
            embedConfig={embedConfig}
            sourceUrl={sourceUrl}
            title="Content by id demo"
            description={
                <>
                    Saved Lightdash content by its id: a dashboard, charts in
                    widget frames, and a chart model translated into props for
                    the data pieces.
                </>
            }
        >
            {tokens ? (
                <ContentById tokens={tokens} />
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
