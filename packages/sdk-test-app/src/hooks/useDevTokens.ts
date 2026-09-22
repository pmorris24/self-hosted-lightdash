import { useEffect, useState } from 'react';

export type DevChartToken = {
    uuid: string;
    name: string;
    chartKind: string;
    exploreName: string;
    token: string;
};

export type DevTokens = {
    instanceUrl: string;
    siteUrl: string;
    projectUuid: string;
    dashboard: {
        uuid: string;
        name: string;
        tokens: { plain: string; filters: string; toolbar: string };
    };
    charts: DevChartToken[];
};

type DevTokensState = {
    tokens: DevTokens | null;
    error: string | null;
};

// Tokens come from the dev server (devTokens.ts), signed for the local instance.
// `dashboardName` picks another saved dashboard. Default: "Jaffle shop overview".
export const useDevTokens = (dashboardName?: string): DevTokensState => {
    const [state, setState] = useState<DevTokensState>({
        tokens: null,
        error: null,
    });

    useEffect(() => {
        let isCurrent = true;
        fetch(
            dashboardName
                ? `/sdk-test-app-api/tokens?dashboard=${encodeURIComponent(dashboardName)}`
                : '/sdk-test-app-api/tokens',
        )
            .then(async (response) => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error);
                return body as DevTokens;
            })
            .then(
                (tokens) => {
                    if (isCurrent) setState({ tokens, error: null });
                },
                (error: unknown) => {
                    if (isCurrent)
                        setState({
                            tokens: null,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : 'Could not load dev tokens',
                        });
                },
            );
        return () => {
            isCurrent = false;
        };
    }, [dashboardName]);

    return state;
};
