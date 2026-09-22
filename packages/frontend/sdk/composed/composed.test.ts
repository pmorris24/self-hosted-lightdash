import { DashboardTileTypes, type Dashboard } from '@lightdash/common';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type SdkChartSelection } from '../../src/ee/features/embed/EmbedChart/types';
import { type SdkFilter } from '../../src/ee/features/embed/EmbedDashboard/types';
import {
    addFilter,
    getWidgetFilters,
    removeFilter,
    replaceFilter,
    toggleSelectionFilters,
} from './filters';
import { createDefaultLayout, reconcileLayout } from './layout';
import { dashboardModelToComposed } from './model';
import { useComposedDashboard } from './useComposedDashboard';

const method = (value: string): SdkFilter => ({
    model: 'payments',
    field: 'payment_method',
    operator: 'equals',
    value,
});
const status: SdkFilter = {
    model: 'orders',
    field: 'status',
    operator: 'equals',
    value: ['completed'],
};

const selectionOf = (filters: SdkFilter[]): SdkChartSelection => ({
    chartUuid: 'chart-a',
    values: [],
    filters,
    row: undefined,
});

describe('filter helpers', () => {
    it('adds a filter and replaces the one on the same field', () => {
        const filters = addFilter([status, method('coupon')], method('gift_card'));
        expect(filters).toEqual([status, method('gift_card')]);
    });

    it('removes by field and leaves the others', () => {
        expect(removeFilter([status, method('coupon')], method('any'))).toEqual([
            status,
        ]);
    });

    it('replaces only a filter that exists', () => {
        expect(replaceFilter([status], method('coupon'))).toEqual([status]);
        expect(replaceFilter([method('coupon')], method('gift_card'))).toEqual([
            method('gift_card'),
        ]);
    });

    it('toggles a selection: set, change, then clear on the same value', () => {
        const first = toggleSelectionFilters([], [method('coupon')]);
        expect(first).toEqual([method('coupon')]);
        const changed = toggleSelectionFilters(first, [method('gift_card')]);
        expect(changed).toEqual([method('gift_card')]);
        expect(toggleSelectionFilters(changed, [method('gift_card')])).toEqual(
            [],
        );
    });

    it('treats a single value and a one-item list as the same selection', () => {
        const filters = [{ ...method('coupon'), value: ['coupon'] }];
        expect(toggleSelectionFilters(filters, [method('coupon')])).toEqual([]);
    });

    it('applies the ignoreFilters option of a widget', () => {
        const filters = [status, method('coupon')];
        expect(getWidgetFilters(filters, {})).toEqual(filters);
        expect(getWidgetFilters(filters, { ignoreFilters: true })).toEqual([]);
        expect(
            getWidgetFilters(filters, { ignoreFilters: ['payment_method'] }),
        ).toEqual([status]);
        expect(
            getWidgetFilters(filters, { ignoreFilters: ['orders.status'] }),
        ).toEqual([method('coupon')]);
    });
});

describe('layout', () => {
    const widgets = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    it('creates rows of equal-width cells', () => {
        const layout = createDefaultLayout(widgets, 2);
        expect(layout.columns[0].rows.map((row) => row.cells.map((c) => c.widgetId))).toEqual([
            ['a', 'b'],
            ['c'],
        ]);
        expect(layout.columns[0].rows[0].cells[0].widthPercentage).toBe(50);
        expect(layout.columns[0].rows[1].cells[0].widthPercentage).toBe(100);
    });

    it('drops unknown and repeated cells and appends widgets with no cell', () => {
        const layout = reconcileLayout(
            {
                columns: [
                    {
                        widthPercentage: 100,
                        rows: [
                            {
                                cells: [
                                    { widgetId: 'gone', widthPercentage: 50 },
                                    { widgetId: 'a', widthPercentage: 50 },
                                    { widgetId: 'a', widthPercentage: 50 },
                                ],
                            },
                        ],
                    },
                ],
            },
            widgets,
        );
        expect(layout.columns[0].rows.map((row) => row.cells.map((c) => c.widgetId))).toEqual([
            ['a'],
            ['b', 'c'],
        ]);
    });
});

describe('dashboardModelToComposed', () => {
    const tile = (uuid: string, x: number, y: number, w: number, h: number) => ({
        uuid,
        type: DashboardTileTypes.SAVED_CHART,
        x,
        y,
        w,
        h,
        tabUuid: undefined,
        properties: { savedChartUuid: `chart-${uuid}`, chartName: `Chart ${uuid}` },
    });

    it('keeps chart tiles with their place and size, and leaves other tiles out', () => {
        const dashboard = {
            name: 'Jaffle dashboard',
            tiles: [
                tile('right', 18, 0, 18, 6),
                tile('left', 0, 0, 18, 6),
                tile('wide', 0, 6, 36, 4),
                {
                    uuid: 'note',
                    type: DashboardTileTypes.MARKDOWN,
                    x: 0,
                    y: 10,
                    w: 36,
                    h: 2,
                    tabUuid: undefined,
                    properties: { title: 'Note', content: 'text' },
                },
            ],
        } as unknown as Pick<Dashboard, 'name' | 'tiles'>;

        const composed = dashboardModelToComposed(dashboard);

        expect(composed.title).toBe('Jaffle dashboard');
        expect(composed.widgets.map((widget) => widget.id)).toEqual([
            'right',
            'left',
            'wide',
        ]);
        expect(composed.widgets[1]).toEqual({
            id: 'left',
            chartUuid: 'chart-left',
            title: 'Chart left',
        });
        const rows = composed.layout!.columns[0].rows;
        expect(rows.map((row) => row.cells.map((cell) => cell.widgetId))).toEqual([
            ['left', 'right'],
            ['wide'],
        ]);
        expect(rows[0].cells[0]).toEqual({
            widgetId: 'left',
            widthPercentage: 50,
            height: 330,
        });
    });
});

describe('useComposedDashboard', () => {
    const initial = {
        title: 'Composed',
        widgets: [
            { id: 'a', chartUuid: 'chart-a' },
            { id: 'b', chartUuid: 'chart-b', ignoreFilters: true },
            { id: 'c', chartUuid: 'chart-c', crossFilter: false },
        ],
        filters: [status],
    };

    it('gives each widget the shared filters it takes', () => {
        const { result } = renderHook(() => useComposedDashboard(initial));
        const [a, b] = result.current.dashboard.widgets;
        expect(a.chartProps).toEqual(
            expect.objectContaining({ id: 'chart-a', filters: [status] }),
        );
        expect(b.chartProps.filters).toEqual([]);
    });

    it('cross filters on a click and reports both events with values', () => {
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useComposedDashboard(initial, { onChange }),
        );

        const selection = selectionOf([method('coupon')]);
        act(() => result.current.dashboard.widgets[0].chartProps.onSelect(selection));

        expect(result.current.dashboard.filters).toEqual([status, method('coupon')]);
        expect(result.current.dashboard.widgets[0].chartProps.filters).toEqual([
            status,
            method('coupon'),
        ]);
        expect(onChange).toHaveBeenNthCalledWith(1, {
            type: 'selection/changed',
            payload: { widgetId: 'a', selection },
        });
        expect(onChange).toHaveBeenNthCalledWith(2, {
            type: 'filters/updated',
            payload: [status, method('coupon')],
        });
    });

    it('reports a click on a widget with crossFilter off, and leaves the filters alone', () => {
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useComposedDashboard(initial, { onChange }),
        );

        act(() =>
            result.current.dashboard.widgets[2].chartProps.onSelect(
                selectionOf([method('coupon')]),
            ),
        );

        expect(result.current.dashboard.filters).toEqual([status]);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0].type).toBe('selection/changed');
    });

    it('sets, adds, removes and clears filters through its API', () => {
        const { result } = renderHook(() => useComposedDashboard(initial));

        act(() => result.current.addFilter(method('coupon')));
        expect(result.current.dashboard.filters).toEqual([status, method('coupon')]);
        act(() => result.current.removeFilter({ model: 'orders', field: 'status' }));
        expect(result.current.dashboard.filters).toEqual([method('coupon')]);
        act(() => result.current.setFilters([status]));
        expect(result.current.dashboard.filters).toEqual([status]);
        act(() => result.current.clearFilters());
        expect(result.current.dashboard.filters).toEqual([]);
    });

    it('sets the layout and reports it', () => {
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useComposedDashboard(initial, { onChange }),
        );
        const layout = createDefaultLayout(initial.widgets, 3);

        act(() => result.current.setLayout(layout));

        expect(result.current.dashboard.layout).toEqual(layout);
        expect(onChange).toHaveBeenCalledWith({ type: 'layout/updated', payload: layout });
    });
});

describe('useComposedDashboard widgets', () => {
    it('keeps an added widget when the caller re-renders with the same list', () => {
        const widgets = [{ id: 'a', chartUuid: 'chart-a' }];
        const { result, rerender } = renderHook(
            ({ list }) => useComposedDashboard({ widgets: list }),
            { initialProps: { list: widgets } },
        );
        act(() => result.current.addWidget({ id: 'b', chartUuid: 'chart-b' }));
        expect(result.current.dashboard.widgets.map((w) => w.id)).toEqual([
            'a',
            'b',
        ]);
        // A caller writing `widgets={[...]}` inline hands over a new array
        // every render; the same widgets are not a change.
        rerender({ list: [{ id: 'a', chartUuid: 'chart-a' }] });
        expect(result.current.dashboard.widgets.map((w) => w.id)).toEqual([
            'a',
            'b',
        ]);
    });

    it('takes the widgets of a dashboard that actually changed', () => {
        const { result, rerender } = renderHook(
            ({ list }) => useComposedDashboard({ widgets: list }),
            { initialProps: { list: [{ id: 'a', chartUuid: 'chart-a' }] } },
        );
        act(() => result.current.addWidget({ id: 'b', chartUuid: 'chart-b' }));
        rerender({ list: [{ id: 'c', chartUuid: 'chart-c' }] });
        expect(result.current.dashboard.widgets.map((w) => w.id)).toEqual(['c']);
    });

    it('removes a widget and forgets its cell', () => {
        const { result } = renderHook(() =>
            useComposedDashboard({
                widgets: [
                    { id: 'a', chartUuid: 'chart-a' },
                    { id: 'b', chartUuid: 'chart-b' },
                ],
            }),
        );
        act(() => result.current.removeWidget('a'));
        expect(result.current.dashboard.widgets.map((w) => w.id)).toEqual(['b']);
        const cells = result.current.dashboard.layout.columns.flatMap((column) =>
            column.rows.flatMap((row) => row.cells.map((cell) => cell.widgetId)),
        );
        expect(cells).toEqual(['b']);
    });
});

