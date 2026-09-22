import { type ApiExploreResults, type SavedChart } from '@lightdash/common';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type SdkFilter } from '../../EmbedDashboard/types';
import { type SdkChartSelection } from '../types';
import { useEmbeddedChartInteractions } from './useEmbeddedChartInteractions';

type EmbedState = {
    savedQueryUuid?: string;
    filters?: SdkFilter[];
    onSelect?: (selection: SdkChartSelection) => void;
};

let embedState: EmbedState = {};
vi.mock('../../../../providers/Embed/useEmbed', () => ({
    default: () => embedState,
}));

const savedChart = {
    uuid: 'chart-1',
    metricQuery: { dimensions: ['orders_status'] },
} as SavedChart;
const explore = { tables: { orders: {} } } as unknown as ApiExploreResults;
const statusFilter: SdkFilter = {
    model: 'orders',
    field: 'status',
    operator: 'equals',
    value: 'completed',
};

describe('useEmbeddedChartInteractions', () => {
    beforeEach(() => {
        embedState = {};
    });

    it('does nothing outside an SDK chart embed', () => {
        embedState = { onSelect: vi.fn() };
        const fetchResults = vi.fn();
        const { result } = renderHook(() =>
            useEmbeddedChartInteractions({ explore, savedChart, fetchResults }),
        );
        expect(result.current.onSeriesContextMenu).toBeUndefined();
        expect(result.current.onDataPointSelect).toBeUndefined();
        expect(fetchResults).not.toHaveBeenCalled();
    });

    it('runs the query again when the host filters change, not before', () => {
        embedState = { savedQueryUuid: 'chart-1', filters: [] };
        const fetchResults = vi.fn();
        const { rerender } = renderHook(() =>
            useEmbeddedChartInteractions({ explore, savedChart, fetchResults }),
        );
        expect(fetchResults).not.toHaveBeenCalled();

        // A new array with the same content is not a change.
        embedState = { savedQueryUuid: 'chart-1', filters: [] };
        rerender();
        expect(fetchResults).not.toHaveBeenCalled();

        embedState = { savedQueryUuid: 'chart-1', filters: [statusFilter] };
        rerender();
        expect(fetchResults).toHaveBeenCalledTimes(1);
    });

    it('turns a clicked slice into a selection with ready-made filters', () => {
        const onSelect = vi.fn();
        embedState = { savedQueryUuid: 'chart-1', onSelect };
        const { result } = renderHook(() =>
            useEmbeddedChartInteractions({
                explore,
                savedChart,
                fetchResults: vi.fn(),
            }),
        );

        result.current.onDataPointSelect?.({
            rows: [
                {
                    orders_status: {
                        value: { raw: 'completed', formatted: 'Completed' },
                    },
                    orders_total: { value: { raw: 120, formatted: '$120' } },
                },
            ],
            position: { left: 10, top: 20 },
        });

        expect(onSelect).toHaveBeenCalledWith({
            chartUuid: 'chart-1',
            values: [
                {
                    model: 'orders',
                    field: 'status',
                    fieldId: 'orders_status',
                    value: 'completed',
                },
            ],
            filters: [statusFilter],
            row: { orders_status: 'completed', orders_total: 120 },
            position: { left: 10, top: 20 },
        });
    });
});
