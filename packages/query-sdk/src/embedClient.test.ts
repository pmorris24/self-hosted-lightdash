import { JWT_HEADER_NAME, LightdashAppUuidHeader } from '@lightdash/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmbedClient } from './client';

const BASE_URL = 'https://lightdash.example.com/';
const PROJECT_UUID = 'proj-1';
const APP_UUID = 'app-1';
const EMBED_TOKEN = 'embed-jwt';

const EMBED_USER = {
    userUuid: 'user-1',
    firstName: 'jane',
    lastName: '',
    email: 'jane@acme.com',
    role: 'embed',
    organizationUuid: 'org-1',
    userAttributes: { tenant: 'acme' },
};

type SentRequest = {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string | undefined;
};

const okResponse = (results: unknown) => ({
    ok: true,
    status: 200,
    json: async () => ({ status: 'ok', results }),
    text: async () => '',
});

const errorResponse = (status: number, text: string) => ({
    ok: false,
    status,
    json: async () => {
        throw new Error('Response body is not JSON');
    },
    text: async () => text,
});

function stubFetch(
    respond: (
        request: SentRequest,
    ) => ReturnType<typeof okResponse> | ReturnType<typeof errorResponse>,
): SentRequest[] {
    const sent: SentRequest[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: RequestInit) => {
            const request = {
                url,
                method: init.method ?? 'GET',
                headers: init.headers as Record<string, string>,
                body: typeof init.body === 'string' ? init.body : undefined,
            };
            sent.push(request);
            return respond(request);
        }),
    );
    return sent;
}

const EMBED_OPTIONS = {
    baseUrl: BASE_URL,
    projectUuid: PROJECT_UUID,
    appUuid: APP_UUID,
    embedToken: EMBED_TOKEN,
};

const createTestClient = (useProxy?: boolean) =>
    createEmbedClient({ ...EMBED_OPTIONS, useProxy });

describe('createEmbedClient', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('runs queries against the instance with the embed token instead of an API key', async () => {
        const sent = stubFetch(({ method }) =>
            method === 'POST'
                ? okResponse({
                      queryUuid: 'query-1',
                      metricQuery: {},
                      fields: {
                          orders_status: {
                              fieldType: 'dimension',
                              type: 'string',
                          },
                          orders_revenue: {
                              fieldType: 'metric',
                              type: 'number',
                          },
                      },
                  })
                : okResponse({
                      status: 'ready',
                      queryUuid: 'query-1',
                      columns: {
                          orders_status: {
                              reference: 'orders_status',
                              type: 'string',
                          },
                          orders_revenue: {
                              reference: 'orders_revenue',
                              type: 'number',
                          },
                      },
                      rows: [
                          {
                              orders_status: {
                                  value: {
                                      raw: 'shipped',
                                      formatted: 'Shipped',
                                  },
                              },
                              orders_revenue: {
                                  value: { raw: 1200, formatted: '$1,200' },
                              },
                          },
                      ],
                      totalResults: 1,
                  }),
        );
        const client = createTestClient();

        const result = await client.transport.executeQuery(
            client
                .model('orders')
                .dimensions(['status'])
                .metrics(['revenue'])
                .limit(10)
                .build(),
        );

        expect(result.rows).toEqual([{ status: 'shipped', revenue: 1200 }]);
        expect(sent.length).toBeGreaterThan(0);
        for (const request of sent) {
            expect(request.url).toMatch(
                /^https:\/\/lightdash\.example\.com\/api\//,
            );
            expect(request.headers[JWT_HEADER_NAME]).toBe(EMBED_TOKEN);
            expect(request.headers[LightdashAppUuidHeader]).toBe(APP_UUID);
            expect(request.headers.Authorization).toBeUndefined();
        }
    });

    it('resolves the current user from the embed user-info endpoint', async () => {
        const sent = stubFetch(({ url }) =>
            url ===
            'https://lightdash.example.com/api/v1/embed/proj-1/user-info'
                ? okResponse(EMBED_USER)
                : errorResponse(403, 'Forbidden'),
        );

        const user = await createTestClient().auth.getUser();

        expect(user).toEqual({
            name: 'jane',
            email: 'jane@acme.com',
            role: 'embed',
            orgId: 'org-1',
            attributes: { tenant: 'acme' },
        });
        expect(sent[0].headers[JWT_HEADER_NAME]).toBe(EMBED_TOKEN);
    });

    it('calls relative /api paths when useProxy is set', async () => {
        const sent = stubFetch(() => okResponse(EMBED_USER));

        await createTestClient(true).auth.getUser();

        expect(sent[0].url).toBe('/api/v1/embed/proj-1/user-info');
    });

    it("proxies external fetches through the app's external-fetch endpoint", async () => {
        const upstream = {
            status: 201,
            contentType: 'application/json',
            headers: {},
            body: { id: 'ch_1' },
            truncated: false,
        };
        const sent = stubFetch(() => okResponse(upstream));

        const result = await createTestClient().externalFetch('stripe', {
            method: 'POST',
            path: '/v1/charges',
            body: { amount: 100 },
        });

        expect(result).toEqual(upstream);
        expect(sent[0].method).toBe('POST');
        expect(sent[0].url).toBe(
            'https://lightdash.example.com/api/v1/ee/projects/proj-1/apps/app-1/external-fetch',
        );
        expect(JSON.parse(sent[0].body ?? '')).toEqual({
            connectionAlias: 'stripe',
            method: 'POST',
            path: '/v1/charges',
            body: { amount: 100 },
        });
    });

    it.each([
        [
            'a JSON error body',
            errorResponse(
                401,
                JSON.stringify({
                    status: 'error',
                    error: { message: 'Invalid embed token' },
                }),
            ),
            'Lightdash API error (401): Invalid embed token',
        ],
        [
            'a plain-text body',
            errorResponse(502, 'Bad Gateway'),
            'Lightdash API error (502): Bad Gateway',
        ],
    ])(
        'surfaces the API error message from %s',
        async (_label, response, message) => {
            stubFetch(() => response);

            await expect(createTestClient().auth.getUser()).rejects.toThrow(
                message,
            );
        },
    );

    it('rejects options without an embed token', () => {
        expect(() =>
            createEmbedClient({ ...EMBED_OPTIONS, embedToken: '' }),
        ).toThrow(
            'createEmbedClient requires embedToken, baseUrl and projectUuid.',
        );
    });

    describe('with a chart or dashboard token (no appUuid)', () => {
        const createHostClient = () =>
            createEmbedClient({
                baseUrl: BASE_URL,
                projectUuid: PROJECT_UUID,
                embedToken: EMBED_TOKEN,
            });

        it('sends the embed token and no app header', async () => {
            const sent = stubFetch(() => okResponse({ userUuid: 'embed-user' }));

            await createHostClient().auth.getUser();

            expect(sent).toHaveLength(1);
            expect(sent[0].headers[JWT_HEADER_NAME]).toBe(EMBED_TOKEN);
            expect(sent[0].headers).not.toHaveProperty(LightdashAppUuidHeader);
        });

        it('says external connections need a data app, and sends nothing', async () => {
            const sent = stubFetch(() => okResponse({}));

            await expect(
                createHostClient().externalFetch('crm', { path: '/deals' }),
            ).rejects.toThrow('External connections need a data app');
            expect(sent).toHaveLength(0);
        });
    });

    it('switches the SDK into embedded mode', async () => {
        vi.resetModules();
        const client = await import('./client');
        const { exportToSheets } = await import('./exportToSheets');

        client.createEmbedClient(EMBED_OPTIONS);

        await expect(
            exportToSheets({ title: 'Usage', columns: [], rows: [] }),
        ).rejects.toThrow('not available when the app is embedded');
    });
});

describe('createEmbedClient with a project token', () => {
    const encode = (payload: object) =>
        `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
            JSON.stringify(payload),
        ).toString('base64url')}.test`;
    const projectToken = encode({
        content: { type: 'project', projectUuid: PROJECT_UUID },
    });
    const chartToken = encode({
        content: { type: 'chart', projectUuid: PROJECT_UUID, contentId: 'chart-1' },
    });
    const chartRun = {
        queryUuid: 'query-1',
        metricQuery: {},
        fields: {
            orders_status: { fieldType: 'dimension', type: 'string' },
            orders_revenue: { fieldType: 'metric', type: 'number' },
        },
    };
    const readyPage = {
        status: 'ready',
        queryUuid: 'query-1',
        columns: {
            orders_status: { reference: 'orders_status', type: 'string' },
            orders_revenue: { reference: 'orders_revenue', type: 'number' },
        },
        rows: [
            {
                orders_status: { value: { raw: 'shipped', formatted: 'Shipped' } },
                orders_revenue: { value: { raw: 1200, formatted: '$1,200' } },
            },
        ],
        totalResults: 1,
    };
    const respond = ({ url, method }: SentRequest) => {
        if (url.endsWith('/content-token')) {
            return okResponse({ token: chartToken, expiresAt: '2030-01-01' });
        }
        return method === 'POST' ? okResponse(chartRun) : okResponse(readyPage);
    };

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('exchanges the project token for a chart token and runs the chart with it', async () => {
        const sent = stubFetch(respond);
        const client = createEmbedClient({
            baseUrl: BASE_URL,
            projectUuid: PROJECT_UUID,
            embedToken: projectToken,
        });

        const result = await client.transport.executeSavedChart({
            chartUuid: 'chart-1',
        });

        expect(result.rows).toEqual([
            { orders_status: 'shipped', orders_revenue: 1200 },
        ]);
        const [exchange, run, ...polls] = sent;
        expect(exchange.url).toBe(
            `https://lightdash.example.com/api/v1/embed/${PROJECT_UUID}/content-token`,
        );
        expect(exchange.headers[JWT_HEADER_NAME]).toBe(projectToken);
        expect(JSON.parse(exchange.body ?? '')).toEqual({
            type: 'chart',
            savedChartUuid: 'chart-1',
        });
        expect(run.url).toContain('/query/chart');
        expect(run.headers[JWT_HEADER_NAME]).toBe(chartToken);
        expect(polls.length).toBeGreaterThan(0);
        for (const poll of polls) {
            expect(poll.headers[JWT_HEADER_NAME]).toBe(chartToken);
        }
    });

    it('exchanges once per chart', async () => {
        const sent = stubFetch(respond);
        const client = createEmbedClient({
            baseUrl: BASE_URL,
            projectUuid: PROJECT_UUID,
            embedToken: projectToken,
        });

        await client.transport.executeSavedChart({ chartUuid: 'chart-1' });
        await client.transport.executeSavedChart({ chartUuid: 'chart-1' });

        expect(sent.filter((r) => r.url.endsWith('/content-token'))).toHaveLength(1);
    });

    it('runs metric queries on the project token without an exchange', async () => {
        const sent = stubFetch(respond);
        const client = createEmbedClient({
            baseUrl: BASE_URL,
            projectUuid: PROJECT_UUID,
            embedToken: projectToken,
        });

        await client.transport.executeQuery(
            client.model('orders').dimensions(['status']).metrics(['revenue']).build(),
        );

        expect(sent.some((r) => r.url.endsWith('/content-token'))).toBe(false);
        for (const request of sent) {
            expect(request.headers[JWT_HEADER_NAME]).toBe(projectToken);
        }
    });

    it('leaves a chart token alone', async () => {
        const sent = stubFetch(respond);
        const client = createEmbedClient({
            baseUrl: BASE_URL,
            projectUuid: PROJECT_UUID,
            embedToken: chartToken,
        });

        await client.transport.executeSavedChart({ chartUuid: 'chart-1' });

        expect(sent.some((r) => r.url.endsWith('/content-token'))).toBe(false);
        expect(sent[0].headers[JWT_HEADER_NAME]).toBe(chartToken);
    });
});
