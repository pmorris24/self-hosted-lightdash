import { describe, expect, it } from 'vitest';
import { createApiTransport, type FetchAdapter } from './apiTransport';
import { query } from './query';

// Serves a finished query whose rows are split across pages of `rowsPerPage`,
// which may be smaller than the page size the SDK asks for.
function pagedResultsAdapter({
    totalRows,
    rowsPerPage,
}: {
    totalRows: number;
    rowsPerPage: number;
}) {
    const pageCount = Math.ceil(totalRows / rowsPerPage);
    const requests = { pages: [] as number[], maxConcurrent: 0 };
    let inFlight = 0;

    const adapter: FetchAdapter = async <T>(
        method: string,
        path: string,
    ): Promise<T> => {
        if (method === 'POST') {
            return {
                queryUuid: 'query-1',
                metricQuery: {},
                fields: {
                    orders_total: { fieldType: 'metric', type: 'number' },
                },
            } as T;
        }

        const page = Number(
            new URL(path, 'http://sdk.test').searchParams.get('page'),
        );
        requests.pages.push(page);
        inFlight += 1;
        requests.maxConcurrent = Math.max(requests.maxConcurrent, inFlight);
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        inFlight -= 1;

        const firstRow = (page - 1) * rowsPerPage;
        const rows = Array.from(
            { length: Math.min(rowsPerPage, totalRows - firstRow) },
            (_, index) => ({
                orders_total: {
                    value: {
                        raw: firstRow + index,
                        formatted: String(firstRow + index),
                    },
                },
            }),
        );
        return {
            status: 'ready',
            queryUuid: 'query-1',
            columns: {
                orders_total: { reference: 'orders_total', type: 'number' },
            },
            rows,
            totalResults: totalRows,
            nextPage: page < pageCount ? page + 1 : undefined,
        } as T;
    };

    return { adapter, requests };
}

const runQuery = (adapter: FetchAdapter) =>
    createApiTransport(
        { apiKey: '', baseUrl: '', projectUuid: 'project-1' },
        adapter,
    ).executeQuery(query('orders').metrics(['total']).limit(10000).build());

const sequence = (length: number) =>
    Array.from({ length }, (_, index) => index);

describe('result pagination', () => {
    it('returns every row in order when results span several pages', async () => {
        const { adapter } = pagedResultsAdapter({
            totalRows: 1234,
            rowsPerPage: 500,
        });

        const result = await runQuery(adapter);

        expect(result.rows.map((row) => row.total)).toEqual(sequence(1234));
    });

    it('requests the remaining pages concurrently, each once', async () => {
        const { adapter, requests } = pagedResultsAdapter({
            totalRows: 2500,
            rowsPerPage: 500,
        });

        await runQuery(adapter);

        expect(requests.maxConcurrent).toBeGreaterThan(1);
        expect([...requests.pages].sort((a, b) => a - b)).toEqual([
            1, 2, 3, 4, 5,
        ]);
    });

    it('collects every row when the server returns smaller pages than requested', async () => {
        const { adapter } = pagedResultsAdapter({
            totalRows: 950,
            rowsPerPage: 200,
        });

        const result = await runQuery(adapter);

        expect(result.rows.map((row) => row.total)).toEqual(sequence(950));
    });
});
