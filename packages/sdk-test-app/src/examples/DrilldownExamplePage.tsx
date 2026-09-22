import Lightdash from '@lightdash/sdk';
import { useState, type CSSProperties } from 'react';
import { ExampleLayout } from '../components/ExampleLayout';
import { useDevTokens } from '../hooks/useDevTokens';
import { type EmbedConfigState } from '../hooks/useEmbedConfig';
import { getRepoSourceUrl } from '../lib/repo';
import { emptyStateBoxStyle, emptyStateStyle } from '../styles';
import {
    sectionDescStyle,
    sectionTitleStyle,
} from './PaletteUuidExamplePage.styles';

type DrilldownExamplePageProps = {
    embedConfig: EmbedConfigState;
};

const sourceUrl = getRepoSourceUrl(
    'packages/sdk-test-app/src/examples/DrilldownExamplePage.tsx',
);

const PATHS = [
    'orders_order_date_year',
    'orders_status',
    'orders_order_date_month',
];

const LABELS = {
    orders_order_date_year: 'Year',
    orders_status: 'Status',
    orders_order_date_month: 'Month',
    orders_total_order_amount: 'Total order amount',
};

const tileStyle: CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 14,
    background: '#fff',
    height: 420,
};

const logStyle: CSSProperties = {
    margin: '12px 0 0',
    padding: 12,
    borderRadius: 8,
    background: '#f9fafb',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
};

const REGION_ROWS = [
    { region: 'North', revenue: 4200 },
    { region: 'South', revenue: 3100 },
    { region: 'East', revenue: 5300 },
    { region: 'West', revenue: 2700 },
];

type MenuState = {
    position: { left: number; top: number };
    region: string;
};

// The host decides what a click offers. The SDK only reports where it was.
function ContextMenuTile() {
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [picked, setPicked] = useState('Nothing picked yet');

    return (
        <>
            <div style={tileStyle} data-testid="context-menu-chart">
                <Lightdash.ColumnChart
                    rows={REGION_ROWS}
                    dataOptions={{ category: 'region', value: 'revenue' }}
                    onSelect={({ row, position }) =>
                        setMenu({ position, region: String(row.region) })
                    }
                />
            </div>
            <Lightdash.ContextMenu
                position={menu?.position ?? null}
                closeContextMenu={() => setMenu(null)}
                itemSections={[
                    {
                        sectionTitle: menu?.region,
                        items: [
                            {
                                caption: 'Open the region page',
                                onClick: () =>
                                    setPicked(`Open page: ${menu?.region}`),
                            },
                            {
                                caption: 'Create a follow-up task',
                                onClick: () =>
                                    setPicked(`New task: ${menu?.region}`),
                            },
                        ],
                    },
                ]}
            />
            <pre style={logStyle} data-testid="context-menu-state">
                {picked}
            </pre>
        </>
    );
}

// A saved pie chart reports a click on a slice the same way.
function SavedPieTile() {
    const { tokens } = useDevTokens('Fanout Tests Dashboard');
    const [selection, setSelection] = useState('Click a slice');
    const pie = tokens?.charts.find(
        (candidate) => candidate.chartKind === 'pie',
    );
    if (!tokens || !pie) return null;

    return (
        <>
            <h3 style={sectionTitleStyle}>Saved pie chart</h3>
            <p style={sectionDescStyle}>
                <code>onSelect</code> on a saved chart that is not cartesian.
            </p>
            <div style={tileStyle} data-testid="saved-pie-chart">
                <Lightdash.Chart
                    instanceUrl={tokens.instanceUrl}
                    token={pie.token}
                    id={pie.uuid}
                    onSelect={({ values, position }) =>
                        setSelection(JSON.stringify({ values, position }, null, 2))
                    }
                />
            </div>
            <pre style={logStyle} data-testid="saved-pie-state">
                {selection}
            </pre>
        </>
    );
}

export function DrilldownExamplePage({
    embedConfig,
}: DrilldownExamplePageProps) {
    const { tokens, error } = useDevTokens();
    const [state, setState] = useState('Top level');
    // A chart token may query the explore of its chart, and no other.
    const chart = tokens?.charts.find(
        (candidate) => candidate.exploreName === 'orders',
    );

    return (
        <ExampleLayout
            embedConfig={embedConfig}
            sourceUrl={sourceUrl}
            title="Drill down demo"
            description={
                <>
                    <code>Lightdash.DrilldownChart</code> runs a governed query
                    for each level. A click filters by the value and groups by
                    the next dimension.
                </>
            }
        >
            {tokens && chart ? (
                <section>
                    <h3 style={sectionTitleStyle}>Year → status → month</h3>
                    <p style={sectionDescStyle}>
                        Click a column to go down. Use the trail to go back up.
                    </p>
                    <div style={tileStyle} data-testid="drilldown-chart">
                        <Lightdash.DrilldownChart
                            instanceUrl={tokens.instanceUrl}
                            token={chart.token}
                            exploreName="orders"
                            paths={PATHS}
                            metrics={['orders_total_order_amount']}
                            labels={LABELS}
                            onChange={({ dimension, steps }) =>
                                setState(
                                    JSON.stringify({ dimension, steps }, null, 2),
                                )
                            }
                        />
                    </div>
                    <pre style={logStyle} data-testid="drilldown-state">
                        {state}
                    </pre>
                    <h3 style={sectionTitleStyle}>Context menu</h3>
                    <p style={sectionDescStyle}>
                        Click a column. The menu and its actions are host code.
                    </p>
                    <Lightdash.Provider
                        instanceUrl={tokens.instanceUrl}
                        token={chart.token}
                    >
                        <ContextMenuTile />
                    </Lightdash.Provider>
                    <SavedPieTile />
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
