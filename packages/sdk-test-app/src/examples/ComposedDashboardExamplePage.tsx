import Lightdash, {
    type ComposedDashboardChangeEvent,
    type ComposedDashboardProps,
} from '@lightdash/sdk';
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { ExampleLayout } from '../components/ExampleLayout';
import { useDevTokens, type DevTokens } from '../hooks/useDevTokens';
import { type EmbedConfigState } from '../hooks/useEmbedConfig';
import { getRepoSourceUrl } from '../lib/repo';
import { emptyStateBoxStyle, emptyStateStyle } from '../styles';
import {
    sectionDescStyle,
    sectionTitleStyle,
} from './PaletteUuidExamplePage.styles';

type ComposedDashboardExamplePageProps = {
    embedConfig: EmbedConfigState;
};

const sourceUrl = getRepoSourceUrl(
    'packages/sdk-test-app/src/examples/ComposedDashboardExamplePage.tsx',
);

const PAYMENT_METHODS = ['credit_card', 'bank_transfer', 'gift_card', 'coupon'];

// Fields of the dashboard's explores. The tiles are Lightdash components; the
// list of filters they edit is the same one the hook holds.
const PANEL_FIELDS = [
    {
        model: 'payments',
        field: 'payment_method',
        operators: ['equals', 'notEquals'] as const,
    },
    { model: 'orders', field: 'status' },
    { model: 'orders', field: 'order_date', operators: ['inThePast', 'inBetween'] as const },
].map((panelField) => ({
    ...panelField,
    operators: panelField.operators ? [...panelField.operators] : undefined,
}));

const workspaceStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '240px minmax(0, 1fr)',
    gap: 16,
    alignItems: 'start',
};

const panelStyle: CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 14,
    background: '#fff',
};

const panelTitleStyle: CSSProperties = {
    margin: '0 0 12px',
    fontSize: 13,
    fontWeight: 600,
};

const barStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    fontSize: 13,
};

const buttonStyle = (active: boolean): CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: active ? '#111827' : '#fff',
    color: active ? '#fff' : '#111827',
    cursor: 'pointer',
    fontSize: 13,
});

const tileStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
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

const logStyle: CSSProperties = {
    marginTop: 16,
    padding: 12,
    borderRadius: 6,
    background: '#f3f4f6',
    fontSize: 12,
    fontFamily: 'ui-monospace, monospace',
    whiteSpace: 'pre-wrap',
    maxHeight: 180,
    overflow: 'auto',
};

const describeEvent = (event: ComposedDashboardChangeEvent) => {
    switch (event.type) {
        case 'filters/updated':
            return `filters/updated ${JSON.stringify(event.payload)}`;
        case 'selection/changed':
            return `selection/changed widget=${event.payload.widgetId} ${JSON.stringify(event.payload.selection.filters)}`;
        case 'layout/updated':
            return `layout/updated rows=${event.payload.columns[0]?.rows.length}`;
        default:
            return 'unknown event';
    }
};

// Mounted once the saved dashboard is loaded: the hook reads its initial
// widgets and layout on mount.
function ComposedWorkspace({
    tokens,
    initial,
}: {
    tokens: DevTokens;
    initial: ComposedDashboardProps;
}) {
    const [events, setEvents] = useState<string[]>([]);
    const onChange = useCallback(
        (event: ComposedDashboardChangeEvent) =>
            setEvents((current) => [describeEvent(event), ...current].slice(0, 12)),
        [],
    );
    const { dashboard, addFilter, clearFilters, setFilters, setLayout } =
        Lightdash.useComposedDashboard(initial, { onChange });

    const activeMethod = dashboard.filters.find(
        (filter) => filter.field === 'payment_method',
    )?.value;
    const isActive = (method: string) =>
        activeMethod === method ||
        (Array.isArray(activeMethod) && activeMethod[0] === method);

    return (
        <Lightdash.Provider
            instanceUrl={tokens.instanceUrl}
            token={tokens.dashboard.tokens.plain}
        >
            <div style={barStyle} data-testid="composed-filter-bar">
                <span>Payment method:</span>
                <button
                    type="button"
                    style={buttonStyle(activeMethod === undefined)}
                    onClick={clearFilters}
                >
                    All
                </button>
                {PAYMENT_METHODS.map((method) => (
                    <button
                        key={method}
                        type="button"
                        style={buttonStyle(isActive(method))}
                        onClick={() =>
                            addFilter({
                                model: 'payments',
                                field: 'payment_method',
                                operator: 'equals',
                                value: [method],
                            })
                        }
                    >
                        {method}
                    </button>
                ))}
            </div>
            <div style={barStyle} data-testid="composed-layout-bar">
                <span>Layout:</span>
                <button
                    type="button"
                    style={buttonStyle(false)}
                    onClick={() => initial.layout && setLayout(initial.layout)}
                >
                    As saved in Lightdash
                </button>
                {[1, 2, 3].map((perRow) => (
                    <button
                        key={perRow}
                        type="button"
                        style={buttonStyle(false)}
                        onClick={() =>
                            setLayout(
                                Lightdash.createDefaultLayout(
                                    initial.widgets,
                                    perRow,
                                ),
                            )
                        }
                    >
                        {perRow} per row
                    </button>
                ))}
            </div>
            <div style={workspaceStyle}>
                <aside style={panelStyle} data-testid="composed-filters-panel">
                    <h4 style={panelTitleStyle}>Filters</h4>
                    <Lightdash.FiltersPanel
                        fields={PANEL_FIELDS}
                        filters={dashboard.filters}
                        onChange={setFilters}
                    />
                </aside>
                <div style={{ minWidth: 0 }}>
            <Lightdash.ComposedDashboard
                dashboard={dashboard}
                renderWidget={(widget) => (
                    <div
                        style={tileStyle}
                        data-testid={`composed-widget-${widget.chartUuid}`}
                    >
                        <h4 style={tileTitleStyle}>{widget.title}</h4>
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <Lightdash.Chart {...widget.chartProps} />
                        </div>
                    </div>
                )}
            />
                </div>
            </div>
            <div style={logStyle} data-testid="composed-event-log">
                {events.length
                    ? events.join('\n')
                    : 'onChange events appear here. Click a bar, a filter, or a layout.'}
            </div>
        </Lightdash.Provider>
    );
}

export function ComposedDashboardExamplePage({
    embedConfig,
}: ComposedDashboardExamplePageProps) {
    const { tokens, error } = useDevTokens();
    const apiConfig = useMemo(
        () => ({
            instanceUrl: tokens?.instanceUrl ?? '',
            projectUuid: tokens?.projectUuid,
            auth: tokens
                ? {
                      type: 'embedToken' as const,
                      token: tokens.dashboard.tokens.plain,
                  }
                : undefined,
        }),
        [tokens],
    );
    const model = Lightdash.useDashboardModel(apiConfig, { enabled: !!tokens });
    const initial = useMemo(
        () =>
            model.data ? Lightdash.dashboardModelToComposed(model.data) : null,
        [model.data],
    );

    return (
        <ExampleLayout
            embedConfig={embedConfig}
            sourceUrl={sourceUrl}
            title="Composed dashboard demo"
            description={
                <>
                    <code>useDashboardModel</code> reads a saved dashboard.{' '}
                    <code>useComposedDashboard</code> keeps its charts
                    coordinated inside a layout this page owns.
                </>
            }
        >
            {tokens && initial && model.data ? (
                <section>
                    <h3 style={sectionTitleStyle}>{initial.title}</h3>
                    <p style={sectionDescStyle}>
                        One dashboard token. The filter bar, the layout buttons
                        and the tiles are host code. Click a bar to cross
                        filter; click it again to clear.
                    </p>
                    <ComposedWorkspace
                        key={model.data.uuid}
                        tokens={tokens}
                        initial={initial}
                    />
                </section>
            ) : (
                <div style={emptyStateStyle}>
                    <div style={emptyStateBoxStyle}>
                        {error ??
                            model.error?.message ??
                            'Reading the saved dashboard…'}
                    </div>
                </div>
            )}
        </ExampleLayout>
    );
}
