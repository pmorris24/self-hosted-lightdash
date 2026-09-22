import { describe, expect, it } from 'vitest';
import {
    filterFactory,
    fromApiFilters,
    toApiFilters,
    toFilterRule,
} from './queryFilters';

describe('filterFactory', () => {
    it('builds rules by name', () => {
        expect(filterFactory.members('orders_status', ['paid', 'open'])).toEqual({
            field: 'orders_status',
            operator: 'equals',
            values: ['paid', 'open'],
        });
        expect(filterFactory.between('orders_total', 10, 20)).toEqual({
            field: 'orders_total',
            operator: 'inBetween',
            values: [10, 20],
        });
        expect(filterFactory.isNull('orders_note').values).toEqual([]);
        expect(filterFactory.inThePast('orders_date', 30, 'days', true)).toEqual({
            field: 'orders_date',
            operator: 'inThePast',
            values: [30],
            settings: { unitOfTime: 'days', completed: true },
        });
        expect(filterFactory.inTheCurrent('orders_date', 'months')).toEqual({
            field: 'orders_date',
            operator: 'inTheCurrent',
            values: [],
            settings: { unitOfTime: 'months' },
        });
    });

    it('nests groups', () => {
        expect(
            filterFactory.or(
                filterFactory.equals('a', 1),
                filterFactory.and(filterFactory.equals('b', 2), filterFactory.notNull('c')),
            ),
        ).toEqual({
            or: [
                { field: 'a', operator: 'equals', values: [1] },
                {
                    and: [
                        { field: 'b', operator: 'equals', values: [2] },
                        { field: 'c', operator: 'notNull', values: [] },
                    ],
                },
            ],
        });
    });

    it('turns a host filter into a query filter', () => {
        expect(
            filterFactory.fromHostFilter({
                model: 'orders',
                field: 'status',
                operator: 'equals',
                value: ['paid'],
            }),
        ).toEqual({ field: 'orders_status', operator: 'equals', values: ['paid'] });
        expect(
            filterFactory.fromHostFilter(
                { model: 'orders', field: 'date', operator: 'inThePast', value: 7 },
                { unitOfTime: 'days', completed: false },
            ),
        ).toEqual({
            field: 'orders_date',
            operator: 'inThePast',
            values: [7],
            settings: { unitOfTime: 'days', completed: false },
        });
    });

    it('reads the short form as a rule', () => {
        expect(toFilterRule({ field: 'a', operator: 'equals', value: 'x' })).toEqual({
            field: 'a',
            operator: 'equals',
            values: ['x'],
        });
    });
});

describe('toApiFilters', () => {
    it('splits dimension and metric filters and keeps groups', () => {
        const filters = toApiFilters(
            [
                { field: 'orders_status', operator: 'equals', value: 'paid' },
                filterFactory.greaterThan('orders_revenue', 100),
                filterFactory.or(
                    filterFactory.equals('orders_region', 'EU'),
                    filterFactory.equals('orders_region', 'US'),
                ),
            ],
            ['orders_revenue'],
        );
        expect(filters).toEqual({
            dimensions: {
                id: 'sdk-query-dimensions',
                and: [
                    {
                        id: 'sdk-query-dimensions-0',
                        target: { fieldId: 'orders_status' },
                        operator: 'equals',
                        values: ['paid'],
                    },
                    {
                        id: 'sdk-query-dimensions-1',
                        or: [
                            {
                                id: 'sdk-query-dimensions-1-0',
                                target: { fieldId: 'orders_region' },
                                operator: 'equals',
                                values: ['EU'],
                            },
                            {
                                id: 'sdk-query-dimensions-1-1',
                                target: { fieldId: 'orders_region' },
                                operator: 'equals',
                                values: ['US'],
                            },
                        ],
                    },
                ],
            },
            metrics: {
                id: 'sdk-query-metrics',
                and: [
                    {
                        id: 'sdk-query-metrics-0',
                        target: { fieldId: 'orders_revenue' },
                        operator: 'greaterThan',
                        values: [100],
                    },
                ],
            },
        });
    });

    it('turns a null value into a null check and keeps date settings', () => {
        const filters = toApiFilters(
            [
                { field: 'orders_note', operator: 'equals', value: null },
                filterFactory.inThePast('orders_date', 2, 'weeks'),
            ],
            [],
        );
        expect(filters.metrics).toBeUndefined();
        expect(filters.dimensions).toEqual({
            id: 'sdk-query-dimensions',
            and: [
                {
                    id: 'sdk-query-dimensions-0',
                    target: { fieldId: 'orders_note' },
                    operator: 'isNull',
                    values: [],
                },
                {
                    id: 'sdk-query-dimensions-1',
                    target: { fieldId: 'orders_date' },
                    operator: 'inThePast',
                    values: [2],
                    settings: { unitOfTime: 'weeks', completed: false },
                },
            ],
        });
    });
});

describe('fromApiFilters', () => {
    it('flattens saved and-groups, keeps or-groups, drops disabled rules', () => {
        expect(
            fromApiFilters({
                dimensions: {
                    id: 'd',
                    and: [
                        {
                            id: 'r1',
                            target: { fieldId: 'orders_status' },
                            operator: 'equals',
                            values: ['paid'],
                        },
                        {
                            id: 'r2',
                            target: { fieldId: 'orders_note' },
                            operator: 'equals',
                            values: [],
                            disabled: true,
                        },
                        {
                            id: 'g',
                            or: [
                                {
                                    id: 'r3',
                                    target: { fieldId: 'orders_date' },
                                    operator: 'inTheCurrent',
                                    values: [],
                                    settings: { unitOfTime: 'years' },
                                },
                            ],
                        },
                    ],
                },
                metrics: {
                    id: 'm',
                    and: [
                        {
                            id: 'r4',
                            target: { fieldId: 'orders_revenue' },
                            operator: 'greaterThan',
                            values: [0],
                        },
                    ],
                },
            }),
        ).toEqual([
            { field: 'orders_status', operator: 'equals', values: ['paid'] },
            {
                or: [
                    {
                        field: 'orders_date',
                        operator: 'inTheCurrent',
                        values: [],
                        settings: { unitOfTime: 'years' },
                    },
                ],
            },
            { field: 'orders_revenue', operator: 'greaterThan', values: [0] },
        ]);
        expect(fromApiFilters({})).toEqual([]);
        expect(fromApiFilters(undefined)).toEqual([]);
    });

    it('round-trips through the API shape', () => {
        const saved = fromApiFilters(
            toApiFilters(
                [
                    filterFactory.members('orders_status', ['paid', 'open']),
                    filterFactory.greaterThan('orders_revenue', 5),
                ],
                ['orders_revenue'],
            ),
        );
        expect(saved).toEqual([
            { field: 'orders_status', operator: 'equals', values: ['paid', 'open'] },
            { field: 'orders_revenue', operator: 'greaterThan', values: [5] },
        ]);
    });
});
