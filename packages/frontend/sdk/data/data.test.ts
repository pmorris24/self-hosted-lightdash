import {
    CartesianSeriesType,
    ChartType,
    DimensionType,
    FieldType,
    FunnelChartDataInput,
    MapChartType,
    TimeFrames,
} from '@lightdash/common';
import { describe, expect, it } from 'vitest';
import { resolveColumns, toItemsMap, toResultRows } from './adapter';
import {
    buildChartConfig,
    buildTableConfig,
    getDimensionColumns,
    getValueColumns,
    orderColumnsForChart,
} from './chartConfig';
import { pivotRows } from './pivot';
import { type DataRow } from './types';

const rows: DataRow[] = [
    { month: '2026-01-01', method: 'coupon', revenue: 1234.5, paid: true },
    { month: '2026-02-01', method: null, revenue: 80, paid: false },
];

describe('resolveColumns', () => {
    it('infers one typed column per key of the first row', () => {
        expect(resolveColumns(rows)).toEqual([
            { name: 'month', label: 'month', type: 'date' },
            { name: 'method', label: 'method', type: 'string' },
            { name: 'revenue', label: 'revenue', type: 'number' },
            { name: 'paid', label: 'paid', type: 'boolean' },
        ]);
    });

    it('keeps the given order, labels and types', () => {
        expect(
            resolveColumns(rows, [
                { name: 'revenue', label: 'Revenue' },
                { name: 'month', type: 'string' },
            ]),
        ).toEqual([
            { name: 'revenue', label: 'Revenue', type: 'number' },
            { name: 'month', label: 'month', type: 'string' },
        ]);
    });

    it('reads a time of day as a timestamp and skips null samples', () => {
        const timed: DataRow[] = [{ at: null }, { at: '2026-01-01T10:30:00Z' }];
        expect(resolveColumns(timed)[0].type).toBe('timestamp');
    });
});

describe('toItemsMap', () => {
    const columns = resolveColumns(rows);

    it('makes value columns metrics and the rest dimensions', () => {
        const items = toItemsMap(columns, ['revenue'], rows);
        expect(items.revenue).toEqual(
            expect.objectContaining({ fieldType: FieldType.METRIC }),
        );
        expect(items.method).toEqual(
            expect.objectContaining({
                fieldType: FieldType.DIMENSION,
                type: DimensionType.STRING,
            }),
        );
    });

    it('reads a number column as a measure unless the chart uses it as a dimension', () => {
        const numeric: DataRow[] = [{ orders: 12, revenue: 80, lat: 40.7 }];
        const items = toItemsMap(
            resolveColumns(numeric),
            ['revenue'],
            numeric,
            ['orders', 'lat'],
        );
        expect(items.revenue.fieldType).toBe(FieldType.METRIC);
        expect(items.orders.fieldType).toBe(FieldType.DIMENSION);
        expect(items.lat.fieldType).toBe(FieldType.DIMENSION);
        // Not a value column and not named as a dimension: still a measure.
        expect(
            toItemsMap(resolveColumns(numeric), ['revenue'], numeric).orders
                .fieldType,
        ).toBe(FieldType.METRIC);
    });

    it('marks first-of-month dates as monthly, so the axis labels months', () => {
        const items = toItemsMap(columns, ['revenue'], rows);
        expect(items.month).toEqual(
            expect.objectContaining({ timeInterval: TimeFrames.MONTH }),
        );
    });

    it('marks first-of-year dates as yearly and other dates as daily', () => {
        const yearly: DataRow[] = [{ d: '2025-01-01' }, { d: '2026-01-01' }];
        const daily: DataRow[] = [{ d: '2026-01-01' }, { d: '2026-01-17' }];
        expect(toItemsMap(resolveColumns(yearly), [], yearly).d).toEqual(
            expect.objectContaining({ timeInterval: TimeFrames.YEAR }),
        );
        expect(toItemsMap(resolveColumns(daily), [], daily).d).toEqual(
            expect.objectContaining({ timeInterval: TimeFrames.DAY }),
        );
    });
});

describe('toResultRows', () => {
    const columns = resolveColumns(rows);

    it('wraps each value and formats numbers with separators by default', () => {
        const [first, second] = toResultRows(rows, columns);
        expect(first.revenue.value.raw).toBe(1234.5);
        expect(first.revenue.value.formatted).toBe(
            new Intl.NumberFormat(undefined, {
                maximumFractionDigits: 2,
            }).format(1234.5),
        );
        expect(first.paid.value).toEqual({ raw: true, formatted: 'true' });
        expect(second.method.value).toEqual({ raw: null, formatted: '' });
    });

    it('uses the formatter of the caller', () => {
        const [first] = toResultRows(rows, columns, (value, column) =>
            column.name === 'revenue' ? `$${value}` : String(value),
        );
        expect(first.revenue.value.formatted).toBe('$1234.5');
    });
});

describe('buildChartConfig', () => {
    it('builds one series per value column', () => {
        const config = buildChartConfig('column', {
            category: 'method',
            value: ['revenue', 'refunds'],
        });
        expect(config).toEqual({
            type: ChartType.CARTESIAN,
            config: {
                layout: {
                    xField: 'method',
                    yField: ['revenue', 'refunds'],
                    flipAxes: false,
                },
                eChartsConfig: {
                    series: [
                        {
                            type: CartesianSeriesType.BAR,
                            encode: {
                                xRef: { field: 'method' },
                                yRef: { field: 'revenue' },
                            },
                        },
                        {
                            type: CartesianSeriesType.BAR,
                            encode: {
                                xRef: { field: 'method' },
                                yRef: { field: 'refunds' },
                            },
                        },
                    ],
                },
            },
        });
    });

    it('draws a bar chart as flipped axes, and an area as a filled stacked line', () => {
        const bar = buildChartConfig('bar', { category: 'm', value: 'v' });
        expect(bar.type === ChartType.CARTESIAN && bar.config?.layout.flipAxes).toBe(
            true,
        );
        const area = buildChartConfig('area', {
            category: 'm',
            value: 'v',
            stack: true,
        });
        expect(
            area.type === ChartType.CARTESIAN &&
                area.config?.eChartsConfig.series?.[0],
        ).toEqual(
            expect.objectContaining({
                type: CartesianSeriesType.LINE,
                areaStyle: {},
                stack: 'stack',
            }),
        );
    });

    it('builds pie, donut, kpi and funnel configs', () => {
        expect(buildChartConfig('donut', { category: 'm', value: 'v' })).toEqual({
            type: ChartType.PIE,
            config: { groupFieldIds: ['m'], metricId: 'v', isDonut: true },
        });
        expect(buildChartConfig('kpi', { value: 'v' })).toEqual({
            type: ChartType.BIG_NUMBER,
            config: { selectedField: 'v' },
        });
        expect(buildChartConfig('funnel', { category: 'm', value: 'v' })).toEqual({
            type: ChartType.FUNNEL,
            config: { dataInput: FunnelChartDataInput.COLUMN, fieldId: 'v' },
        });
    });

    it('builds treemap, gauge, sankey and map configs', () => {
        expect(buildChartConfig('treemap', { category: 'm', value: 'v' })).toEqual({
            type: ChartType.TREEMAP,
            config: { groupFieldIds: ['m'], sizeMetricId: 'v' },
        });
        expect(buildChartConfig('gauge', { value: 'v', min: 0, max: 100 })).toEqual({
            type: ChartType.GAUGE,
            config: { selectedField: 'v', min: 0, max: 100 },
        });
        expect(
            buildChartConfig('sankey', { source: 'a', target: 'b', value: 'v' }),
        ).toEqual({
            type: ChartType.SANKEY,
            config: { sourceFieldId: 'a', targetFieldId: 'b', metricFieldId: 'v' },
        });
        expect(
            buildChartConfig('map', { latitude: 'lat', longitude: 'lon', value: 'v' }),
        ).toEqual({
            type: ChartType.MAP,
            config: {
                locationType: MapChartType.SCATTER,
                latitudeFieldId: 'lat',
                longitudeFieldId: 'lon',
                valueFieldId: 'v',
                sizeFieldId: 'v',
            },
        });
    });

    it('says which option is missing', () => {
        expect(() => buildChartConfig('line', { value: 'v' })).toThrow(
            'a "line" chart needs dataOptions.category',
        );
        expect(() => buildChartConfig('sankey', { source: 'a', value: 'v' })).toThrow(
            'a "sankey" chart needs dataOptions.target',
        );
    });
});

describe('column helpers', () => {
    it('lists the columns a chart reads as dimensions', () => {
        expect(
            getDimensionColumns({
                category: 'm',
                latitude: 'lat',
                longitude: 'lon',
                value: 'v',
            }),
        ).toEqual(['m', 'lat', 'lon']);
    });

    it('reads one or many value columns', () => {
        expect(getValueColumns({ value: 'v' })).toEqual(['v']);
        expect(getValueColumns({ value: ['a', 'b'] })).toEqual(['a', 'b']);
    });

    it('puts the category first, where the funnel reads its labels', () => {
        const columns = [{ name: 'people' }, { name: 'stage' }];
        expect(
            orderColumnsForChart(columns, { category: 'stage', value: 'people' }),
        ).toEqual([{ name: 'stage' }, { name: 'people' }]);
        expect(orderColumnsForChart(columns, { value: 'people' })).toEqual(columns);
    });
});

describe('pivotRows', () => {
    const long: DataRow[] = [
        { month: '2026-01-01', method: 'card', revenue: 10, orders: 1 },
        { month: '2026-01-01', method: 'coupon', revenue: 4, orders: 2 },
        { month: '2026-02-01', method: 'card', revenue: 12, orders: 3 },
    ];

    it('makes one row per group and one column per break value', () => {
        const pivoted = pivotRows({
            rows: long,
            columns: resolveColumns(long),
            groupBy: ['month'],
            breakBy: 'method',
            values: ['revenue'],
        });
        expect(pivoted.valueColumns).toEqual(['revenue__card', 'revenue__coupon']);
        expect(pivoted.rows).toEqual([
            { month: '2026-01-01', revenue__card: 10, revenue__coupon: 4 },
            // No coupon row in February: the column is there, with no value.
            { month: '2026-02-01', revenue__card: 12, revenue__coupon: null },
        ]);
        expect(pivoted.columns.map((column) => column.label)).toEqual([
            'month',
            'card',
            'coupon',
        ]);
    });

    it('names each column by value and break value when there are several values', () => {
        const pivoted = pivotRows({
            rows: long,
            columns: resolveColumns(long, [
                { name: 'month' },
                { name: 'method' },
                { name: 'revenue', label: 'Revenue' },
                { name: 'orders', label: 'Orders' },
            ]),
            groupBy: ['month'],
            breakBy: 'method',
            values: ['revenue', 'orders'],
        });
        expect(pivoted.valueColumns).toEqual([
            'revenue__card',
            'orders__card',
            'revenue__coupon',
            'orders__coupon',
        ]);
        expect(pivoted.columns[1].label).toBe('Revenue · card');
    });
});

describe('buildChartConfig style options', () => {
    it('maps legend, axes and gridlines onto a cartesian chart', () => {
        const config = buildChartConfig(
            'column',
            { category: 'method', value: 'revenue' },
            {
                legend: { show: true, position: 'right' },
                xAxis: { title: 'Method', gridLines: false },
                yAxis: { title: 'Revenue', min: 0, max: 100, show: false },
                axisLabelFontSize: 11,
            },
        );
        if (config.type !== ChartType.CARTESIAN) throw new Error('not cartesian');
        expect(config.config.eChartsConfig.legend).toEqual({
            show: true,
            placement: 'outsideRight',
        });
        expect(config.config.eChartsConfig.grid).toEqual({ right: '16%' });
        expect(config.config.eChartsConfig.xAxis).toEqual([{ name: 'Method' }]);
        expect(config.config.eChartsConfig.yAxis).toEqual([
            { name: 'Revenue', min: '0', max: '100' },
        ]);
        expect(config.config.eChartsConfig.axisLabelFontSize).toBe(11);
        expect(config.config.layout.showGridX).toBe(false);
        expect(config.config.layout.showYAxis).toBe(false);
    });

    it('styles every series', () => {
        const styled = buildChartConfig(
            'line',
            { category: 'month', value: ['revenue', 'costs'] },
            {
                dataLabels: { show: true, position: 'top' },
                line: { smooth: true, markers: false },
                colors: ['#111111', '#222222'],
            },
        );
        if (styled.type !== ChartType.CARTESIAN) throw new Error('not cartesian');
        const [first, second] = styled.config.eChartsConfig.series ?? [];
        expect(first.label).toEqual({ show: true, position: 'top' });
        expect(first.smooth).toBe(true);
        expect(first.showSymbol).toBe(false);
        expect(first.color).toBe('#111111');
        expect(second.color).toBe('#222222');

        const byName = buildChartConfig(
            'column',
            { category: 'month', value: 'revenue', stack: true },
            { colors: { revenue: '#333333' } },
        );
        if (byName.type !== ChartType.CARTESIAN) throw new Error('not cartesian');
        const [series] = byName.config.eChartsConfig.series ?? [];
        expect(series.stack).toBe('stack');
        expect(series.color).toBe('#333333');
    });

    it('maps legend, slice labels and colours onto a pie', () => {
        const config = buildChartConfig(
            'donut',
            { category: 'method', value: 'revenue' },
            {
                legend: { show: false, position: 'bottom' },
                sliceLabels: { showValue: true, showPercentage: false },
                colors: { card: '#444444' },
            },
        );
        if (config.type !== ChartType.PIE) throw new Error('not pie');
        expect(config.config.isDonut).toBe(true);
        expect(config.config.showLegend).toBe(false);
        expect(config.config.legendPosition).toBe('horizontal');
        expect(config.config.valueLabel).toBe('inside');
        expect(config.config.showValue).toBe(true);
        expect(config.config.showPercentage).toBe(false);
        expect(config.config.groupColorOverrides).toEqual({ card: '#444444' });
    });

    it('leaves the config untouched when no style options are given', () => {
        const plain = buildChartConfig('column', { category: 'm', value: 'r' });
        const empty = buildChartConfig('column', { category: 'm', value: 'r' }, {});
        expect(empty).toEqual(plain);
    });
});

describe('buildChartConfig chart variants', () => {
    it('stacks to a percentage', () => {
        const config = buildChartConfig('column', {
            category: 'month',
            value: ['a', 'b'],
            stack: 'percent',
        });
        if (config.type !== ChartType.CARTESIAN) throw new Error('not cartesian');
        expect(config.config.layout.stack).toBe('stack100');
        expect(config.config.eChartsConfig.series?.[0].stack).toBe('stack');

        const normal = buildChartConfig('column', {
            category: 'month',
            value: 'a',
            stack: true,
        });
        if (normal.type !== ChartType.CARTESIAN) throw new Error('not cartesian');
        expect(normal.config.layout.stack).toBe('stack');
    });

    it('draws one column as another chart type', () => {
        const config = buildChartConfig('column', {
            category: 'month',
            value: ['revenue', 'target'],
            seriesTypes: { target: 'line' },
        });
        if (config.type !== ChartType.CARTESIAN) throw new Error('not cartesian');
        const [revenue, target] = config.config.eChartsConfig.series ?? [];
        expect(revenue.type).toBe(CartesianSeriesType.BAR);
        expect(target.type).toBe(CartesianSeriesType.LINE);
        expect(target.areaStyle).toBeUndefined();
    });

    it('puts a column on a second axis and adds that axis', () => {
        const config = buildChartConfig('column', {
            category: 'month',
            value: ['revenue', 'orders'],
            rightAxis: ['orders'],
        });
        if (config.type !== ChartType.CARTESIAN) throw new Error('not cartesian');
        const [revenue, orders] = config.config.eChartsConfig.series ?? [];
        expect(revenue.yAxisIndex).toBeUndefined();
        expect(orders.yAxisIndex).toBe(1);
        expect(config.config.eChartsConfig.yAxis).toHaveLength(2);
    });
});

describe('buildTableConfig', () => {
    it('is empty when nothing is asked for', () => {
        expect(buildTableConfig()).toEqual({ type: ChartType.TABLE, config: {} });
    });

    it('maps the table options onto the renderer, including the inverted one', () => {
        expect(
            buildTableConfig({
                rowNumbers: false,
                groupRepeatedValues: true,
                resultsCount: true,
            }),
        ).toEqual({
            type: ChartType.TABLE,
            config: {
                hideRowNumbers: true,
                showRowGrouping: true,
                showResultsTotal: true,
            },
        });
    });
});

