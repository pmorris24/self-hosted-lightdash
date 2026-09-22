import { afterEach, describe, expect, it, vi } from 'vitest';

const useLightdash = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock('./useLightdash', () => ({ useLightdash }));

import { useSavedChartQuery } from './useSavedChartQuery';

describe('useSavedChartQuery', () => {
    afterEach(() => {
        useLightdash.mockClear();
    });

    it('runs the saved chart with no options', () => {
        useSavedChartQuery('chart-uuid');

        expect(useLightdash).toHaveBeenCalledTimes(1);
        const [chartQuery] = useLightdash.mock.calls[0] as unknown as [
            { kind: string; chartUuid: string; limitValue?: number },
        ];
        expect(chartQuery.kind).toBe('savedChart');
        expect(chartQuery.chartUuid).toBe('chart-uuid');
        expect(chartQuery.limitValue).toBeUndefined();
    });

    it('passes the label, limit, parameters and filters to the saved chart query', () => {
        useSavedChartQuery('chart-uuid', {
            label: 'Revenue by method',
            limit: 25,
            parameters: { region: 'EU' },
            filters: [{ field: 'status', operator: 'equals', value: 'paid' }],
        });

        const [chartQuery] = useLightdash.mock.calls[0] as unknown as [
            {
                labelText?: string;
                limitValue?: number;
                parameterValues?: Record<string, unknown>;
                filterValues?: unknown[];
            },
        ];
        expect(chartQuery.labelText).toBe('Revenue by method');
        expect(chartQuery.limitValue).toBe(25);
        expect(chartQuery.parameterValues).toEqual({ region: 'EU' });
        expect(chartQuery.filterValues).toHaveLength(1);
    });
});
