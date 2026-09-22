import { act, render, renderHook, screen } from '@testing-library/react';
import { type FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { extractFields } from '../api';
import { useLightdashTheme } from '../theme/themeContext';
import { ThemeProvider } from '../theme/ThemeProvider';
import { CustomWidgetsProvider } from '../widgets/customWidgets';
import {
    useCustomWidgets,
    type CustomWidgetProps,
} from '../widgets/customWidgetsContext';
import { formatDate, formatNumber, formatRows } from './formatting';
import {
    createLinearGradient,
    createRadialGradient,
    GradientDirections,
    isGradient,
    isLinearGradient,
    isRadialGradient,
} from './gradients';
import { useSyncedState } from './useSyncedState';

describe('gradients', () => {
    it('sorts the stops and clamps positions to 0..1', () => {
        const gradient = createLinearGradient(GradientDirections.topToBottom, [
            { position: 1.4, color: '#000' },
            { position: 0, color: '#fff' },
        ]);
        expect(gradient).toEqual({
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
                { offset: 0, color: '#fff' },
                { offset: 1, color: '#000' },
            ],
        });
    });

    it('tells the gradient kinds apart', () => {
        const linear = createLinearGradient(GradientDirections.diagonal, []);
        const radial = createRadialGradient({ x: 0.5, y: 0.5, radius: 0.5 }, []);
        expect(isLinearGradient(linear)).toBe(true);
        expect(isRadialGradient(linear)).toBe(false);
        expect(isRadialGradient(radial)).toBe(true);
        expect(isGradient('#fff')).toBe(false);
    });
});

describe('formatting', () => {
    it('formats numbers and dates as Lightdash does', () => {
        expect(formatNumber(1234.5)).toBe('1,234.5');
        expect(formatDate('2026-03-09', 'month')).toBe('2026-03');
        expect(formatDate('2026-03-09', 'year')).toBe('2026');
    });

    it('formats rows by column type and blanks out nulls', () => {
        expect(
            formatRows(
                [{ day: '2026-03-09', total: 1500, status: null }],
                [
                    { name: 'day', type: 'date' },
                    { name: 'total', type: 'number' },
                    { name: 'status', type: 'string' },
                ],
            ),
        ).toEqual([{ day: '2026-03-09', total: '1,500', status: '' }]);
    });
});

describe('useSyncedState', () => {
    it('follows the parent value and reports only local changes', () => {
        const onLocalChange = vi.fn();
        const { result, rerender } = renderHook(
            ({ value }) => useSyncedState(value, onLocalChange),
            { initialProps: { value: 'a' } },
        );
        expect(result.current[0]).toBe('a');

        act(() => result.current[1]('local'));
        expect(result.current[0]).toBe('local');
        expect(onLocalChange).toHaveBeenCalledWith('local');

        rerender({ value: 'b' });
        expect(result.current[0]).toBe('b');
        expect(onLocalChange).toHaveBeenCalledTimes(1);
    });
});

describe('ThemeProvider', () => {
    it('lets a nested provider change only the keys it sets', () => {
        const { result } = renderHook(() => useLightdashTheme(), {
            wrapper: ({ children }) => (
                <ThemeProvider
                    theme={{ colorScheme: 'dark', palette: ['#111'] }}
                >
                    <ThemeProvider theme={{ fontFamily: 'Inter' }}>
                        {children}
                    </ThemeProvider>
                </ThemeProvider>
            ),
        });
        expect(result.current).toEqual({
            colorScheme: 'dark',
            palette: ['#111'],
            fontFamily: 'Inter',
        });
    });
});

describe('custom widgets', () => {
    const Histogram: FC<CustomWidgetProps> = ({ rows }) => (
        <p>{rows.length} rows</p>
    );

    it('finds widgets from the provider and ones registered later', () => {
        const Late: FC<CustomWidgetProps> = () => null;
        const { result } = renderHook(() => useCustomWidgets(), {
            wrapper: ({ children }) => (
                <CustomWidgetsProvider widgets={{ histogram: Histogram }}>
                    {children}
                </CustomWidgetsProvider>
            ),
        });
        expect(result.current.hasCustomWidget('histogram')).toBe(true);
        expect(result.current.hasCustomWidget('late')).toBe(false);

        act(() => result.current.registerCustomWidget('late', Late));
        expect(result.current.getCustomWidget('late')).toBe(Late);
    });

    it('throws a clear error outside the provider', () => {
        const Probe = () => {
            useCustomWidgets();
            return null;
        };
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<Probe />)).toThrow(/CustomWidgetsProvider/);
        spy.mockRestore();
        expect(screen.queryByText('rows')).toBeNull();
    });
});

describe('extractFields', () => {
    it('puts metrics and table calculations together as measures', () => {
        expect(
            extractFields({
                uuid: 'c',
                name: 'Revenue',
                description: null,
                exploreName: 'orders',
                chartKind: 'cartesian',
                dimensions: ['orders_status'],
                metrics: ['orders_total'],
                tableCalculations: ['share'],
                limit: 500,
                sorts: [],
                filters: [],
            }),
        ).toEqual({
            exploreName: 'orders',
            dimensions: ['orders_status'],
            measures: ['orders_total', 'share'],
        });
    });
});
