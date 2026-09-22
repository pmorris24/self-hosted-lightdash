import { describe, expect, it } from 'vitest';
import type { LightdashChartModel, LightdashQueryRows } from '../api';
import { chartModelTranslator } from './chartModelTranslator';

const chart: LightdashChartModel = {
    uuid: 'chart-1',
    name: 'Revenue by status',
    description: 'Per year',
    exploreName: 'orders',
    chartKind: 'vertical_bar',
    dimensions: ['orders_year', 'orders_status'],
    metrics: ['orders_revenue'],
    tableCalculations: ['orders_share'],
    limit: 500,
};

const result: LightdashQueryRows = {
    rows: [
        { orders_year: 2025, orders_status: 'paid', orders_revenue: 10 },
        { orders_year: 2025, orders_status: 'open', orders_revenue: 4 },
    ],
    formattedRows: [],
    columns: [
        { name: 'orders_year', label: 'Year', type: 'number' },
        { name: 'orders_status', label: 'Status', type: 'string' },
        { name: 'orders_revenue', label: 'Revenue', type: 'number' },
    ],
};

describe('chartModelTranslator', () => {
    it('maps saved chart kinds to data chart types', () => {
        expect(chartModelTranslator.toDataChartType('horizontal_bar')).toBe(
            'bar',
        );
        expect(chartModelTranslator.toDataChartType('big_number')).toBe('kpi');
        expect(chartModelTranslator.toDataChartType('table')).toBeNull();
        expect(chartModelTranslator.toDataChartType(null)).toBeNull();
    });

    it('builds the query of the saved chart, with overrides', () => {
        expect(
            chartModelTranslator.toMetricQueryParams(chart, { limit: 10 }),
        ).toEqual({
            exploreName: 'orders',
            dimensions: ['orders_year', 'orders_status'],
            metrics: ['orders_revenue'],
            limit: 10,
        });
    });

    it('puts the first dimension on the category axis and breaks by the second', () => {
        expect(chartModelTranslator.toDataChartProps(chart, result)).toEqual({
            rows: result.rows,
            columns: result.columns,
            chartType: 'column',
            dataOptions: {
                category: 'orders_year',
                value: ['orders_revenue'],
                breakBy: 'orders_status',
            },
        });
    });

    it('gives a pie one value and a kpi no category', () => {
        expect(
            chartModelTranslator.toDataOptions(
                { ...chart, chartKind: 'pie', dimensions: ['orders_status'] },
                result.columns,
            ),
        ).toEqual({ category: 'orders_status', value: 'orders_revenue' });
        expect(
            chartModelTranslator.toDataOptions(
                { ...chart, chartKind: 'big_number', dimensions: [] },
                result.columns,
            ),
        ).toEqual({ value: 'orders_revenue' });
    });

    it('lists only the measures the result holds, or its number columns', () => {
        expect(
            chartModelTranslator.toDataTableProps(chart, result).valueColumns,
        ).toEqual(['orders_revenue']);
        expect(
            chartModelTranslator.toDataTableProps(
                { ...chart, metrics: ['other'], tableCalculations: [] },
                result,
            ).valueColumns,
        ).toEqual(['orders_year', 'orders_revenue']);
    });

    it('pivots on the last dimension and refuses a single dimension', () => {
        expect(chartModelTranslator.toDataPivotTableProps(chart, result)).toEqual(
            {
                rows: result.rows,
                columns: result.columns,
                rowFields: ['orders_year'],
                columnField: 'orders_status',
                value: ['orders_revenue'],
            },
        );
        expect(
            chartModelTranslator.toDataPivotTableProps(
                { ...chart, dimensions: ['orders_year'] },
                result,
            ),
        ).toBeNull();
    });

    it('titles widgets with the chart name and picks pivot for tables', () => {
        expect(chartModelTranslator.toDataChartWidgetProps(chart, result)).toMatchObject(
            { title: 'Revenue by status', description: 'Per year', chartType: 'column' },
        );
        expect(
            chartModelTranslator.toWidgetProps(
                { ...chart, chartKind: 'table' },
                result,
            ).widgetType,
        ).toBe('pivot');
        expect(
            chartModelTranslator.toWidgetProps(
                { ...chart, chartKind: 'table', dimensions: ['orders_year'] },
                result,
            ).widgetType,
        ).toBe('dataChart');
        expect(
            chartModelTranslator.toWidgetProps(
                { ...chart, description: null },
                result,
            ),
        ).not.toHaveProperty('description');
    });
});
