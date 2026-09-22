import Lightdash, { type DataRow } from '@lightdash/sdk';
import { type CSSProperties, type ReactNode } from 'react';
import { ExampleLayout } from '../components/ExampleLayout';
import { useDevTokens } from '../hooks/useDevTokens';
import { type EmbedConfigState } from '../hooks/useEmbedConfig';
import { getRepoSourceUrl } from '../lib/repo';
import { emptyStateBoxStyle, emptyStateStyle } from '../styles';
import {
    sectionDescStyle,
    sectionTitleStyle,
} from './PaletteUuidExamplePage.styles';

type DataChartsExamplePageProps = {
    embedConfig: EmbedConfigState;
};

const sourceUrl = getRepoSourceUrl(
    'packages/sdk-test-app/src/examples/DataChartsExamplePage.tsx',
);

// Rows this page owns. They could come from the query SDK, a REST API, or a file.
const byMethod: DataRow[] = [
    { method: 'credit_card', revenue: 2000, refunds: 140, orders: 55 },
    { method: 'bank_transfer', revenue: 1080, refunds: 60, orders: 33 },
    { method: 'gift_card', revenue: 810, refunds: 95, orders: 12 },
    { method: 'coupon', revenue: 260, refunds: 10, orders: 13 },
];

const byMonth: DataRow[] = [
    { month: '2026-01-01', revenue: 620, orders: 21 },
    { month: '2026-02-01', revenue: 710, orders: 24 },
    { month: '2026-03-01', revenue: 690, orders: 23 },
    { month: '2026-04-01', revenue: 880, orders: 31 },
    { month: '2026-05-01', revenue: 1240, orders: 38 },
];

// Long rows: one row per month and method.
const byMonthAndMethod: DataRow[] = [
    { month: '2026-01-01', method: 'credit_card', revenue: 410 },
    { month: '2026-01-01', method: 'gift_card', revenue: 210 },
    { month: '2026-02-01', method: 'credit_card', revenue: 480 },
    { month: '2026-02-01', method: 'gift_card', revenue: 230 },
    { month: '2026-03-01', method: 'credit_card', revenue: 520 },
    { month: '2026-03-01', method: 'gift_card', revenue: 170 },
    { month: '2026-03-01', method: 'coupon', revenue: 60 },
];

const funnel: DataRow[] = [
    { stage: 'Visited', people: 4200 },
    { stage: 'Added to cart', people: 1300 },
    { stage: 'Paid', people: 410 },
];

const total: DataRow[] = [{ revenue: 4150 }];

const target: DataRow[] = [{ attained: 72 }];

const flows: DataRow[] = [
    { from: 'Visited', to: 'Added to cart', people: 1300 },
    { from: 'Visited', to: 'Left', people: 2900 },
    { from: 'Added to cart', to: 'Paid', people: 410 },
    { from: 'Added to cart', to: 'Abandoned', people: 890 },
];

const stores: DataRow[] = [
    { city: 'New York', lat: 40.71, lon: -74.0, revenue: 2000 },
    { city: 'Chicago', lat: 41.88, lon: -87.63, revenue: 1080 },
    { city: 'Austin', lat: 30.27, lon: -97.74, revenue: 810 },
    { city: 'Seattle', lat: 47.61, lon: -122.33, revenue: 260 },
];

const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
    fontFamily: 'ui-monospace, monospace',
};

const Tile = ({
    name,
    height = 280,
    children,
}: {
    name: string;
    height?: number;
    children: ReactNode;
}) => (
    <div style={tileStyle} data-testid={`data-chart-${name}`}>
        <h4 style={tileTitleStyle}>{name}</h4>
        <div style={{ height }}>{children}</div>
    </div>
);

export function DataChartsExamplePage({
    embedConfig,
}: DataChartsExamplePageProps) {
    const { tokens, error } = useDevTokens();

    return (
        <ExampleLayout
            embedConfig={embedConfig}
            sourceUrl={sourceUrl}
            title="Charts from rows demo"
            description={
                <>
                    Charts and a table drawn by the Lightdash renderer from rows
                    this page supplies. There is no saved chart and no query.
                </>
            }
        >
            {tokens ? (
                <section>
                    <h3 style={sectionTitleStyle}>One component per chart type</h3>
                    <p style={sectionDescStyle}>
                        Each tile is <code>rows</code> plus{' '}
                        <code>dataOptions</code>. <code>Lightdash.DataChart</code>{' '}
                        takes a <code>chartType</code>; the named components fix
                        it.
                    </p>
                    <Lightdash.Provider
                        instanceUrl={tokens.instanceUrl}
                        token={tokens.dashboard.tokens.plain}
                    >
                        <div style={gridStyle}>
                            <Tile name="ColumnChart">
                                <Lightdash.ColumnChart
                                    rows={byMethod}
                                    dataOptions={{
                                        category: 'method',
                                        value: ['revenue', 'refunds'],
                                    }}
                                />
                            </Tile>
                            <Tile name="BarChart">
                                <Lightdash.BarChart
                                    rows={byMethod}
                                    dataOptions={{
                                        category: 'method',
                                        value: 'orders',
                                    }}
                                />
                            </Tile>
                            <Tile name="LineChart">
                                <Lightdash.LineChart
                                    rows={byMonth}
                                    dataOptions={{
                                        category: 'month',
                                        value: 'revenue',
                                    }}
                                />
                            </Tile>
                            <Tile name="AreaChart">
                                <Lightdash.AreaChart
                                    rows={byMonth}
                                    dataOptions={{
                                        category: 'month',
                                        value: ['revenue', 'orders'],
                                        stack: true,
                                    }}
                                />
                            </Tile>
                            <Tile name="ScatterChart">
                                <Lightdash.ScatterChart
                                    rows={byMethod}
                                    dataOptions={{
                                        category: 'orders',
                                        value: 'revenue',
                                    }}
                                />
                            </Tile>
                            <Tile name="PieChart">
                                <Lightdash.PieChart
                                    rows={byMethod}
                                    dataOptions={{
                                        category: 'method',
                                        value: 'revenue',
                                    }}
                                />
                            </Tile>
                            <Tile name="DataChart donut">
                                <Lightdash.DataChart
                                    chartType="donut"
                                    rows={byMethod}
                                    dataOptions={{
                                        category: 'method',
                                        value: 'orders',
                                    }}
                                />
                            </Tile>
                            <Tile name="FunnelChart">
                                <Lightdash.FunnelChart
                                    rows={funnel}
                                    dataOptions={{
                                        category: 'stage',
                                        value: 'people',
                                    }}
                                />
                            </Tile>
                            <Tile name="KpiChart">
                                <Lightdash.KpiChart
                                    rows={total}
                                    columns={[
                                        {
                                            name: 'revenue',
                                            label: 'Revenue this year',
                                        },
                                    ]}
                                    dataOptions={{ value: 'revenue' }}
                                />
                            </Tile>
                            <Tile name="TreemapChart">
                                <Lightdash.TreemapChart
                                    rows={byMethod}
                                    dataOptions={{
                                        category: 'method',
                                        value: 'revenue',
                                    }}
                                />
                            </Tile>
                            <Tile name="GaugeChart">
                                <Lightdash.GaugeChart
                                    rows={target}
                                    dataOptions={{
                                        value: 'attained',
                                        min: 0,
                                        max: 100,
                                    }}
                                />
                            </Tile>
                            <Tile name="SankeyChart">
                                <Lightdash.SankeyChart
                                    rows={flows}
                                    dataOptions={{
                                        source: 'from',
                                        target: 'to',
                                        value: 'people',
                                    }}
                                />
                            </Tile>
                        </div>
                        <div style={{ ...gridStyle, marginTop: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            <Tile name="ColumnChart breakBy">
                                <Lightdash.ColumnChart
                                    rows={byMonthAndMethod}
                                    dataOptions={{
                                        category: 'month',
                                        value: 'revenue',
                                        breakBy: 'method',
                                        stack: true,
                                    }}
                                />
                            </Tile>
                            <Tile name="DataPivotTable">
                                <Lightdash.DataPivotTable
                                    rows={byMonthAndMethod}
                                    rowFields={['month']}
                                    columnField="method"
                                    value="revenue"
                                />
                            </Tile>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <Tile name="MapChart" height={360}>
                                <Lightdash.MapChart
                                    rows={stores}
                                    dataOptions={{
                                        latitude: 'lat',
                                        longitude: 'lon',
                                        value: 'revenue',
                                    }}
                                />
                            </Tile>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <Tile name="DataTable" height={260}>
                                <Lightdash.DataTable
                                    rows={byMethod}
                                    columns={[
                                        { name: 'method', label: 'Payment method' },
                                        { name: 'revenue', label: 'Revenue' },
                                        { name: 'refunds', label: 'Refunds' },
                                        { name: 'orders', label: 'Orders' },
                                    ]}
                                />
                            </Tile>
                        </div>
                    </Lightdash.Provider>
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
