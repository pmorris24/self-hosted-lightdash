import Lightdash from '@lightdash/sdk';
import { useState, type CSSProperties } from 'react';
import { ExampleLayout } from '../components/ExampleLayout';
import { type EmbedConfigState } from '../hooks/useEmbedConfig';
import { useDevTokens } from '../hooks/useDevTokens';
import { getRepoSourceUrl } from '../lib/repo';
import { emptyStateBoxStyle, emptyStateStyle } from '../styles';
import {
    sectionDescStyle,
    sectionTitleStyle,
} from './PaletteUuidExamplePage.styles';

type CompositionExamplePageProps = {
    embedConfig: EmbedConfigState;
};

const sourceUrl = getRepoSourceUrl(
    'packages/sdk-test-app/src/examples/CompositionExamplePage.tsx',
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

const chartBoxStyle: CSSProperties = { height: 320 };

const PAYMENT_METHODS = ['credit_card', 'bank_transfer', 'gift_card', 'coupon'];

const filterBarStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    fontSize: 13,
};

const filterButtonStyle = (active: boolean): CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: active ? '#111827' : '#fff',
    color: active ? '#fff' : '#111827',
    cursor: 'pointer',
    fontSize: 13,
});

const logStyle: CSSProperties = {
    marginTop: 12,
    padding: 12,
    borderRadius: 6,
    background: '#f3f4f6',
    fontSize: 12,
    fontFamily: 'ui-monospace, monospace',
    whiteSpace: 'pre-wrap',
};

export function CompositionExamplePage({
    embedConfig,
}: CompositionExamplePageProps) {
    const { tokens, error } = useDevTokens();
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const [lastSelection, setLastSelection] = useState<string>(
        'Click a bar in the payment method chart.',
    );
    const hostFilters = paymentMethod
        ? [
              {
                  model: 'payments',
                  field: 'payment_method',
                  operator: 'equals' as const,
                  value: [paymentMethod],
              },
          ]
        : [];
    const charts = tokens?.charts.filter((chart) => chart.chartKind !== 'table');

    return (
        <ExampleLayout
            embedConfig={embedConfig}
            sourceUrl={sourceUrl}
            title="Composition demo"
            description={
                <>
                    Several saved charts on one host page, each placed with{' '}
                    <code>Lightdash.Chart</code> and its own chart token.
                </>
            }
        >
            {tokens && charts ? (
                <section>
                    <h3 style={sectionTitleStyle}>
                        {charts.length} charts, {charts.length} tokens
                    </h3>
                    <p style={sectionDescStyle}>
                        Each token reads one chart. Every chart must load with
                        its own token.
                    </p>
                    <div style={gridStyle}>
                        {charts.map((chart) => (
                            <div
                                key={chart.uuid}
                                style={tileStyle}
                                data-testid={`composition-chart-${chart.uuid}`}
                            >
                                <h4 style={tileTitleStyle}>{chart.name}</h4>
                                <div style={chartBoxStyle}>
                                    <Lightdash.Chart
                                        instanceUrl={tokens.instanceUrl}
                                        token={chart.token}
                                        id={chart.uuid}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <h3 style={{ ...sectionTitleStyle, marginTop: 40 }}>
                        One provider, one dashboard token
                    </h3>
                    <p style={sectionDescStyle}>
                        <code>Lightdash.Provider</code> holds the connection.
                        The token is for the dashboard, and it may run every
                        chart on that dashboard. The charts take no token prop.
                    </p>
                    <Lightdash.Provider
                        instanceUrl={tokens.instanceUrl}
                        token={tokens.dashboard.tokens.plain}
                    >
                        <div style={gridStyle}>
                            {charts.map((chart) => (
                                <div
                                    key={chart.uuid}
                                    style={tileStyle}
                                    data-testid={`provider-chart-${chart.uuid}`}
                                >
                                    <h4 style={tileTitleStyle}>{chart.name}</h4>
                                    <div style={chartBoxStyle}>
                                        <Lightdash.Chart id={chart.uuid} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Lightdash.Provider>
                    <h3 style={{ ...sectionTitleStyle, marginTop: 40 }}>
                        Host filters and chart clicks
                    </h3>
                    <p style={sectionDescStyle}>
                        The buttons are host code. Their state reaches each
                        chart through <code>filters</code>. A click on a bar
                        calls <code>onSelect</code>, and this page puts the
                        clicked value into the same state.
                    </p>
                    <div style={filterBarStyle} data-testid="host-filter-bar">
                        <span>Payment method:</span>
                        <button
                            type="button"
                            style={filterButtonStyle(paymentMethod === null)}
                            onClick={() => setPaymentMethod(null)}
                        >
                            All
                        </button>
                        {PAYMENT_METHODS.map((method) => (
                            <button
                                key={method}
                                type="button"
                                style={filterButtonStyle(
                                    paymentMethod === method,
                                )}
                                onClick={() => setPaymentMethod(method)}
                            >
                                {method}
                            </button>
                        ))}
                    </div>
                    <Lightdash.Provider
                        instanceUrl={tokens.instanceUrl}
                        token={tokens.dashboard.tokens.plain}
                    >
                        <div style={gridStyle}>
                            {charts.map((chart) => (
                                <div
                                    key={chart.uuid}
                                    style={tileStyle}
                                    data-testid={`filtered-chart-${chart.uuid}`}
                                >
                                    <h4 style={tileTitleStyle}>{chart.name}</h4>
                                    <div style={chartBoxStyle}>
                                        <Lightdash.Chart
                                            id={chart.uuid}
                                            filters={hostFilters}
                                            onSelect={(selection) => {
                                                setLastSelection(
                                                    JSON.stringify(
                                                        selection.filters,
                                                    ),
                                                );
                                                const method =
                                                    selection.values.find(
                                                        (value) =>
                                                            value.field ===
                                                            'payment_method',
                                                    )?.value;
                                                if (typeof method === 'string')
                                                    setPaymentMethod(method);
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Lightdash.Provider>
                    <div style={logStyle} data-testid="selection-log">
                        onSelect: {lastSelection}
                    </div>
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
