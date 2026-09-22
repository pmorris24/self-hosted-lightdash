import {
    type DataColumn,
    type DataRow,
    type ResolvedDataColumn,
} from './types';

export type PivotedData = {
    rows: DataRow[];
    columns: DataColumn[];
    // The generated value columns, in order of first appearance.
    valueColumns: string[];
};

type PivotArgs = {
    rows: DataRow[];
    columns: ResolvedDataColumn[];
    // Columns that stay as they are and identify one output row.
    groupBy: string[];
    // The column whose values become new columns.
    breakBy: string;
    values: string[];
};

const keyOf = (row: DataRow, names: string[]) =>
    names.map((name) => String(row[name])).join('\u0000');

/**
 * Long rows to wide rows: one output row per `groupBy` combination, and one
 * column per value of `breakBy` (times each value column). Runs in the page,
 * so rows a host supplies need no server-side pivot.
 */
export const pivotRows = ({
    rows,
    columns,
    groupBy,
    breakBy,
    values,
}: PivotArgs): PivotedData => {
    const labelOf = (name: string) =>
        columns.find((column) => column.name === name)?.label ?? name;
    const groups = new Map<string, DataRow>();
    const generated = new Map<string, DataColumn>();

    rows.forEach((row) => {
        const key = keyOf(row, groupBy);
        const output: DataRow =
            groups.get(key) ??
            Object.fromEntries(groupBy.map((name) => [name, row[name] ?? null]));
        groups.set(key, output);

        const breakValue = String(row[breakBy] ?? '∅');
        values.forEach((value) => {
            const name = `${value}__${breakValue}`;
            if (!generated.has(name)) {
                const source = columns.find((column) => column.name === value);
                generated.set(name, {
                    // The new column keeps the format of the value column.
                    ...(source
                        ? { format: source.format, round: source.round, compact: source.compact }
                        : {}),
                    name,
                    // One value column: the break value is the whole label.
                    label:
                        values.length > 1
                            ? `${labelOf(value)} · ${breakValue}`
                            : breakValue,
                    type: 'number',
                });
            }
            output[name] = row[value] ?? null;
        });
    });

    const valueColumns = [...generated.keys()];
    const pivoted = [...groups.values()].map((row) => ({
        // Every row carries every generated column, so a series has no holes.
        ...Object.fromEntries(valueColumns.map((name) => [name, null])),
        ...row,
    }));

    return {
        rows: pivoted,
        columns: [
            ...groupBy.map((name) => ({
                ...(columns.find((column) => column.name === name) ?? { name }),
            })),
            ...generated.values(),
        ],
        valueColumns,
    };
};
