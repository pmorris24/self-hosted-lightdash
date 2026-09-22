import {
    DimensionType,
    FieldType,
    MetricType,
    SupportedDbtAdapter,
    type CompiledDimension,
    type CompiledMetric,
    type CompiledTable,
    type Explore,
    type ExploreError,
} from '@lightdash/common';
import { describe, expect, test } from 'vitest';
import { emitTypes } from './generateTypes';

const dimension = (
    table: string,
    name: string,
    overrides: Partial<CompiledDimension> = {},
): CompiledDimension =>
    ({
        fieldType: FieldType.DIMENSION,
        type: DimensionType.STRING,
        name,
        label: name.replace(/_/g, ' '),
        table,
        tableLabel: table,
        sql: `\${TABLE}.${name}`,
        compiledSql: `"${table}".${name}`,
        tablesReferences: [table],
        hidden: false,
        ...overrides,
    }) as CompiledDimension;

const metric = (table: string, name: string): CompiledMetric =>
    ({
        fieldType: FieldType.METRIC,
        type: MetricType.SUM,
        name,
        label: name.replace(/_/g, ' '),
        table,
        tableLabel: table,
        sql: `\${TABLE}.${name}`,
        compiledSql: `SUM("${table}".${name})`,
        tablesReferences: [table],
        hidden: false,
        description: 'Adds it all up */ carefully',
    }) as CompiledMetric;

const table = (
    name: string,
    dimensions: CompiledDimension[],
    metrics: CompiledMetric[],
): CompiledTable =>
    ({
        name,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        database: 'db',
        schema: 'public',
        sqlTable: `"public"."${name}"`,
        dimensions: Object.fromEntries(dimensions.map((d) => [d.name, d])),
        metrics: Object.fromEntries(metrics.map((m) => [m.name, m])),
        lineageGraph: {},
    }) as CompiledTable;

const orders: Explore = {
    name: 'orders',
    label: 'Orders',
    tags: [],
    baseTable: 'orders',
    joinedTables: [
        {
            table: 'customers',
            sqlOn: '1 = 1',
            compiledSqlOn: '1 = 1',
            type: undefined,
        },
    ],
    tables: {
        orders: table(
            'orders',
            [
                dimension('orders', 'status'),
                dimension('orders', 'order_date_month', {
                    type: DimensionType.DATE,
                    label: 'Order date (Month)',
                }),
                dimension('orders', 'secret', { hidden: true }),
                dimension('orders', '1st_touch'),
                dimension('orders', 'explore'),
            ],
            [metric('orders', 'total_order_amount')],
        ),
        customers: table(
            'customers',
            [dimension('customers', 'first_name')],
            [],
        ),
    },
    targetDatabase: SupportedDbtAdapter.POSTGRES,
};

const broken: ExploreError = {
    name: 'payments',
    label: 'Payments',
    tags: [],
    errors: [{ type: 'MetricNotFound' as never, message: 'nope' }],
};

describe('emitTypes', () => {
    test('writes one namespace per explore with camel-cased field ids', () => {
        const { code, explores, skipped } = emitTypes([orders, broken]);
        expect(explores).toEqual(['orders']);
        expect(skipped).toEqual(['payments']);
        expect(code).toContain('export const Orders = {');
        expect(code).toContain("    explore: 'orders',");
        expect(code).toContain("    status: 'orders_status',");
        expect(code).toContain(
            "    orderDateMonth: 'orders_order_date_month',",
        );
        expect(code).toContain(
            "    totalOrderAmount: 'orders_total_order_amount',",
        );
        expect(code).toContain("        firstName: 'customers_first_name',");
        expect(code).toContain(
            'export const explores = {\n    orders: Orders,\n} as const;',
        );
        expect(code).toContain('export type FieldId =\n    | OrdersFieldId;');
    });

    test('keeps every key a valid identifier and never overwrites the explore key', () => {
        const { code } = emitTypes([orders]);
        expect(code).toContain("    _1stTouch: 'orders_1st_touch',");
        expect(code).toContain("    explore2: 'orders_explore',");
        expect(code).not.toContain('orders_secret');
    });

    test('documents each field and keeps comments safe', () => {
        const { code } = emitTypes([orders]);
        expect(code).toContain('/** Order date (Month) · dimension · date. */');
        expect(code).toContain(
            '/** total order amount · metric · sum. Adds it all up * / carefully */',
        );
        expect(code).toContain('/** Fields of the joined table Customers. */');
    });

    test('lists the field ids of an explore as a union type', () => {
        const { code } = emitTypes([orders]);
        expect(code).toContain(
            "export type OrdersFieldId =\n    | 'orders_status'\n    | 'orders_order_date_month'\n    | 'orders_1st_touch'\n    | 'orders_explore'\n    | 'orders_total_order_amount'\n    | 'customers_first_name';",
        );
    });
});
