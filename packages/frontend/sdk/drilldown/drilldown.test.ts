import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDrilldown } from './useDrilldown';
import { useJumpToDashboard } from './useJumpToDashboard';

describe('useDrilldown', () => {
    const paths = ['status', 'order_month', 'customer'];

    it('starts at the first dimension with no filters', () => {
        const { result } = renderHook(() => useDrilldown({ paths }));
        expect(result.current).toEqual(
            expect.objectContaining({
                dimension: 'status',
                level: 0,
                steps: [],
                filters: [],
                canDrill: true,
            }),
        );
    });

    it('goes one level down on each pick and turns the picks into filters', () => {
        const onChange = vi.fn();
        const { result } = renderHook(() => useDrilldown({ paths, onChange }));

        act(() => result.current.drill('completed'));
        act(() => result.current.drill('2026-01'));

        expect(result.current.dimension).toBe('customer');
        expect(result.current.canDrill).toBe(false);
        expect(result.current.filters).toEqual([
            { field: 'status', operator: 'equals', value: 'completed' },
            { field: 'order_month', operator: 'equals', value: '2026-01' },
        ]);
        expect(onChange).toHaveBeenLastCalledWith({
            dimension: 'customer',
            steps: result.current.steps,
        });
    });

    it('stops at the last dimension', () => {
        const { result } = renderHook(() => useDrilldown({ paths: ['status'] }));
        act(() => result.current.drill('completed'));
        expect(result.current.steps).toEqual([]);
        expect(result.current.dimension).toBe('status');
    });

    it('goes back up to a level, and resets', () => {
        const { result } = renderHook(() => useDrilldown({ paths }));
        act(() => result.current.drill('completed'));
        act(() => result.current.drill('2026-01'));

        act(() => result.current.goTo(1));
        expect(result.current.dimension).toBe('order_month');
        expect(result.current.steps).toHaveLength(1);

        act(() => result.current.reset());
        expect(result.current.level).toBe(0);
    });
});

describe('useJumpToDashboard', () => {
    it('carries the clicked values and replaces a source filter on the same field', () => {
        const onJump = vi.fn();
        const { result } = renderHook(() =>
            useJumpToDashboard({
                dashboardUuid: 'target',
                filters: [
                    { model: 'orders', field: 'status', operator: 'equals', value: 'all' },
                    { model: 'orders', field: 'region', operator: 'equals', value: 'EU' },
                ],
                onJump,
            }),
        );

        result.current({
            chartUuid: 'chart',
            values: [],
            row: undefined,
            position: { left: 0, top: 0 },
            filters: [
                { model: 'orders', field: 'status', operator: 'equals', value: 'completed' },
            ],
        });

        expect(onJump).toHaveBeenCalledWith({
            dashboardUuid: 'target',
            filters: [
                { model: 'orders', field: 'region', operator: 'equals', value: 'EU' },
                { model: 'orders', field: 'status', operator: 'equals', value: 'completed' },
            ],
        });
    });
});
