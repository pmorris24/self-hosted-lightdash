import {
    ChartType,
    FilterOperator,
    SupportedDbtAdapter,
    VizAggregationOptions,
    VizIndexType,
    type DashboardFilters,
    type Explore,
    type ItemsMap,
    type MetricQuery,
    type PivotConfiguration,
    type SavedChartDAO,
} from '@lightdash/common';
import type * as LightdashCommon from '@lightdash/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    derivePivotConfigurationFromChart: vi.fn(),
    getFieldsFromMetricQuery: vi.fn(),
}));

vi.mock('@lightdash/common', async (importOriginal) => ({
    ...(await importOriginal<typeof LightdashCommon>()),
    derivePivotConfigurationFromChart: mocks.derivePivotConfigurationFromChart,
    getFieldsFromMetricQuery: mocks.getFieldsFromMetricQuery,
}));

import { buildQueryArgs } from './buildQueryArgs';

const metricQuery: MetricQuery = {
    exploreName: 'orders',
    dimensions: ['orders_created_date', 'orders_status'],
    metrics: ['orders_total'],
    filters: {},
    sorts: [],
    limit: 500,
    tableCalculations: [],
};

const savedChart: Pick<SavedChartDAO, 'chartConfig' | 'pivotConfig'> = {
    chartConfig: {
        type: ChartType.DATA_APP_VIZ,
        config: {
            dataAppVizUuid: 'viz-uuid',
            fieldMapping: {
                category: 'orders_created_date',
                value: 'orders_total',
                series: 'orders_status',
            },
        },
    },
    pivotConfig: { columns: ['orders_status'] },
};

const pivotConfiguration: PivotConfiguration = {
    indexColumn: [
        { reference: 'orders_created_date', type: VizIndexType.TIME },
    ],
    valuesColumns: [
        {
            reference: 'orders_total',
            aggregation: VizAggregationOptions.ANY,
        },
    ],
    groupByColumns: [{ reference: 'orders_status' }],
    sortBy: undefined,
};

const itemsMap: ItemsMap = {};
const explore: Explore = {
    name: 'orders',
    label: 'Orders',
    tags: [],
    baseTable: 'orders',
    joinedTables: [],
    tables: {},
    targetDatabase: SupportedDbtAdapter.POSTGRES,
};

describe('buildQueryArgs', () => {
    beforeEach(() => {
        mocks.getFieldsFromMetricQuery.mockReturnValue(itemsMap);
        mocks.derivePivotConfigurationFromChart.mockReturnValue(
            pivotConfiguration,
        );
    });

    it('passes the reusable chart pivot through the v2 metric-query args', () => {
        const result = buildQueryArgs({
            activeFields: new Set(['orders_created_date']),
            tableName: 'orders',
            projectUuid: 'project-uuid',
            explore,
            computedMetricQuery: metricQuery,
            parameters: undefined,
            isEditMode: true,
            minimal: false,
            customSqlProvenanceChartUuid: 'chart-uuid',
            savedChart,
        });

        expect(mocks.derivePivotConfigurationFromChart).toHaveBeenCalledWith(
            savedChart,
            metricQuery,
            {},
        );
        expect(result).toEqual(
            expect.objectContaining({
                pivotConfiguration,
                customSqlProvenanceChartUuid: 'chart-uuid',
                query: expect.objectContaining({
                    pivotDimensions: ['orders_status'],
                }),
            }),
        );
    });

    it('carries the host filters of an embedded saved chart', () => {
        const dashboardFilters: DashboardFilters = {
            dimensions: [
                {
                    id: 'sdk-filter-0',
                    label: 'status',
                    target: {
                        fieldId: 'orders_status',
                        tableName: 'orders',
                    },
                    operator: FilterOperator.EQUALS,
                    values: ['completed'],
                },
            ],
            metrics: [],
            tableCalculations: [],
        };

        const result = buildQueryArgs({
            activeFields: new Set(['orders_created_date']),
            tableName: 'orders',
            projectUuid: 'project-uuid',
            explore,
            computedMetricQuery: metricQuery,
            parameters: undefined,
            isEditMode: false,
            viewModeQueryArgs: { chartUuid: 'chart-uuid', dashboardFilters },
            minimal: true,
            savedChart,
        });

        expect(result).toEqual(
            expect.objectContaining({
                chartUuid: 'chart-uuid',
                dashboardFilters,
            }),
        );
    });
});
