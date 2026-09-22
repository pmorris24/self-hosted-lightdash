import type { EmbedClientOptions } from './types';

// Mirrors JWT_HEADER_NAME in @lightdash/common, which this package can't import.
const EMBED_JWT_HEADER_NAME = 'lightdash-embed-token';

const decodeBase64Url = (value: string): string => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    if (typeof atob === 'function') return atob(padded);
    return Buffer.from(padded, 'base64').toString('utf8');
};

/** The `content.type` of an embed JWT, or null when it cannot be read. */
export function decodeEmbedContentType(token: string): string | null {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
        const payload: unknown = JSON.parse(decodeBase64Url(parts[1]));
        if (
            typeof payload === 'object' &&
            payload !== null &&
            'content' in payload &&
            typeof payload.content === 'object' &&
            payload.content !== null &&
            'type' in payload.content &&
            typeof payload.content.type === 'string'
        ) {
            return payload.content.type;
        }
        return null;
    } catch {
        return null;
    }
}

export const isProjectToken = (token: string): boolean =>
    decodeEmbedContentType(token) === 'project';

type ContentTokenResponse = {
    status: 'ok';
    results: { token: string; expiresAt: string };
};

/**
 * Exchanges the project token of `options` for a token of one saved chart,
 * through the same endpoint the React SDK uses. One exchange per chart: the
 * result is cached for the life of the client.
 */
export function createChartTokenExchange(
    options: EmbedClientOptions,
): (chartUuid: string) => Promise<string> {
    const cache = new Map<string, Promise<string>>();
    const prefix = options.useProxy ? '' : options.baseUrl.replace(/\/$/, '');
    const url = `${prefix}/api/v1/embed/${options.projectUuid}/content-token`;
    return (chartUuid) => {
        const cached = cache.get(chartUuid);
        if (cached) return cached;
        const exchange = (async () => {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [EMBED_JWT_HEADER_NAME]: options.embedToken,
                },
                body: JSON.stringify({
                    type: 'chart',
                    savedChartUuid: chartUuid,
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                let message: string;
                try {
                    const parsed = JSON.parse(text);
                    message = parsed.error?.message ?? parsed.message ?? text;
                } catch {
                    message = text;
                }
                throw new Error(
                    `Lightdash API error (${res.status}): could not exchange the project token for chart ${chartUuid}: ${message}`,
                );
            }
            const json = (await res.json()) as ContentTokenResponse;
            return json.results.token;
        })();
        cache.set(chartUuid, exchange);
        exchange.catch(() => cache.delete(chartUuid));
        return exchange;
    };
}
