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
            'createEmbedClient requires embedToken, baseUrl, projectUuid and appUuid.',
        );
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
