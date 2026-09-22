import { describe, expect, it } from 'vitest';
import { getDataPointSelectionValues } from './selectionValues';

const cell = (raw: unknown) => ({ value: { raw, formatted: String(raw) } });

describe('getDataPointSelectionValues', () => {
    it('returns the dimension values of the row and skips metrics', () => {
        expect(
            getDataPointSelectionValues({
                row: {
                    orders_status: cell('completed'),
                    orders_total: cell(120),
                },
                dimensions: ['orders_status'],
                tableNames: ['orders', 'customers'],
            }),
        ).toEqual([
            {
                model: 'orders',
                field: 'status',
                fieldId: 'orders_status',
                value: 'completed',
            },
        ]);
    });

    it('uses the longest table name that matches the field id', () => {
        const [value] = getDataPointSelectionValues({
            row: { order_items_sku: cell('A1') },
            dimensions: ['order_items_sku'],
            tableNames: ['order', 'order_items'],
        });
        expect(value).toMatchObject({ model: 'order_items', field: 'sku' });
    });

    it('returns nothing without a row, a cell, or a known table', () => {
        const args = { dimensions: ['orders_status'], tableNames: ['orders'] };
        expect(
            getDataPointSelectionValues({ ...args, row: undefined }),
        ).toEqual([]);
        expect(getDataPointSelectionValues({ ...args, row: {} })).toEqual([]);
        expect(
            getDataPointSelectionValues({
                row: { orders_status: cell('a') },
                dimensions: ['orders_status'],
                tableNames: ['payments'],
            }),
        ).toEqual([]);
    });
});
