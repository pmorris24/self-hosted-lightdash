import { LightdashFrame } from '@lightdash/sdk';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ExampleLayout } from '../components/ExampleLayout';
import { useDevTokens } from '../hooks/useDevTokens';
import { type EmbedConfigState } from '../hooks/useEmbedConfig';
import { getRepoSourceUrl } from '../lib/repo';
import { emptyStateBoxStyle, emptyStateStyle } from '../styles';
import {
    sectionDescStyle,
    sectionTitleStyle,
} from './PaletteUuidExamplePage.styles';

type FrameExamplePageProps = {
    embedConfig: EmbedConfigState;
};

const sourceUrl = getRepoSourceUrl(
    'packages/sdk-test-app/src/examples/FrameExamplePage.tsx',
);

const STATUSES = ['completed', 'shipped', 'placed', 'returned'];

const toolbarStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
};

const buttonStyle: CSSProperties = {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: '#fff',
    fontSize: 13,
    cursor: 'pointer',
};

const frameStyle: CSSProperties = {
    height: 560,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
};

const logStyle: CSSProperties = {
    margin: '12px 0 0',
    padding: 12,
    borderRadius: 8,
    background: '#f9fafb',
    fontSize: 12,
    maxHeight: 220,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
};

export function FrameExamplePage({ embedConfig }: FrameExamplePageProps) {
    const { tokens, error } = useDevTokens();
    const containerRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<LightdashFrame | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [log, setLog] = useState<string[]>([]);

    const instanceUrl = tokens?.siteUrl;
    const projectUuid = tokens?.projectUuid;
    const token = tokens?.dashboard.tokens.filters;

    // An iframe is an external system: create it once, then send commands.
    useEffect(() => {
        if (!containerRef.current || !instanceUrl || !projectUuid || !token) {
            return undefined;
        }
        const frame = new LightdashFrame({
            instanceUrl,
            projectUuid,
            token,
            container: containerRef.current,
            title: 'Jaffle dashboard',
        });
        const events = [
            'ready',
            'filterChanged',
            'tabChanged',
            'allTilesLoaded',
            'error',
        ] as const;
        events.forEach((name) =>
            frame.on(name, (event) =>
                setLog((current) =>
                    [
                        `${event.type} ${JSON.stringify(event.payload ?? {})}`,
                        ...current,
                    ].slice(0, 30),
                ),
            ),
        );
        frameRef.current = frame;
        void frame.render();
        return () => {
            frame.destroy();
            frameRef.current = null;
        };
    }, [instanceUrl, projectUuid, token]);

    const pickStatus = (next: string | null) => {
        setStatus(next);
        frameRef.current?.filters.set(
            next
                ? [
                      {
                          model: 'orders',
                          field: 'status',
                          operator: 'equals',
                          value: next,
                      },
                  ]
                : [],
        );
    };

    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        frameRef.current?.setTheme(next);
    };

    return (
        <ExampleLayout
            embedConfig={embedConfig}
            sourceUrl={sourceUrl}
            title="Frame script demo"
            description={
                <>
                    <code>LightdashFrame</code> puts a dashboard in an iframe
                    that this page controls: it sets filters and the theme,
                    and it receives events with values.
                </>
            }
        >
            {tokens ? (
                <section>
                    <h3 style={sectionTitleStyle}>Controls of this page</h3>
                    <p style={sectionDescStyle}>
                        These buttons are host code. The dashboard is a frame.
                    </p>
                    <div style={toolbarStyle} data-testid="frame-controls">
                        <button
                            type="button"
                            style={buttonStyle}
                            aria-pressed={status === null}
                            onClick={() => pickStatus(null)}
                        >
                            All statuses
                        </button>
                        {STATUSES.map((value) => (
                            <button
                                key={value}
                                type="button"
                                style={buttonStyle}
                                aria-pressed={status === value}
                                onClick={() => pickStatus(value)}
                            >
                                {value}
                            </button>
                        ))}
                        <button
                            type="button"
                            style={buttonStyle}
                            onClick={toggleTheme}
                        >
                            Theme: {theme}
                        </button>
                    </div>
                    <div
                        ref={containerRef}
                        style={frameStyle}
                        data-testid="frame-container"
                    />
                    <pre style={logStyle} data-testid="frame-log">
                        {log.length > 0 ? log.join('\n') : 'No events yet'}
                    </pre>
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
