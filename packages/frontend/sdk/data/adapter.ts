import {
    DimensionType,
    FieldType,
    formatItemValue,
    MetricType,
    TimeFrames,
    type CompactOrAlias,
    type Dimension,
    type ItemsMap,
    type Metric,
    type ResultRow,
} from '@lightdash/common';
import {
    type DataColumn,
    type DataColumnType,
    type DataFormatter,
    type DataRow,
    type DataTimeInterval,
    type ResolvedDataColumn,
} from './types';

// Rows a host page supplies do not come from an explore. The renderer still
// needs a table name on every field.
const DATA_TABLE = 'data';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const inferType = (rows: DataRow[], name: string): DataColumnType => {
    const sample = rows.find(
        (row) => row[name] !== null && row[name] !== undefined,
    )?.[name];
    if (typeof sample === 'number') return 'number';
    if (typeof sample === 'boolean') return 'boolean';
    if (typeof sample === 'string' && ISO_DATE.test(sample)) {
        return sample.length > 10 ? 'timestamp' : 'date';
    }
    return 'string';
};

/** The given columns, or one column per key of the first row, with types. */
export const resolveColumns = (
    rows: DataRow[],
    columns?: DataColumn[],
): ResolvedDataColumn[] => {
    const names = columns?.map((column) => column.name) ??
        Object.keys(rows[0] ?? {});
    return names.map((name) => {
        const given = columns?.find((column) => column.name === name);
        return {
            ...given,
            name,
            label: given?.label ?? name,
            type: given?.type ?? inferType(rows, name),
        };
    });
};

const TIME_INTERVALS: Record<DataTimeInterval, TimeFrames> = {
    day: TimeFrames.DAY,
    week: TimeFrames.WEEK,
    month: TimeFrames.MONTH,
    quarter: TimeFrames.QUARTER,
    year: TimeFrames.YEAR,
};

// The display metadata of a column, in the shape a Lightdash field holds it.
const displayOptions = (
    column: ResolvedDataColumn,
): Pick<Metric, 'format' | 'round' | 'compact'> => ({
    ...(column.format ? { format: column.format } : {}),
    ...(column.round !== undefined ? { round: column.round } : {}),
    ...(column.compact ? { compact: column.compact as CompactOrAlias } : {}),
});

const hasDisplayOptions = (column: DataColumn): boolean =>
    column.format !== undefined ||
    column.round !== undefined ||
    column.compact !== undefined;

const dimensionTypes: Record<DataColumnType, DimensionType> = {
    string: DimensionType.STRING,
    number: DimensionType.NUMBER,
    date: DimensionType.DATE,
    timestamp: DimensionType.TIMESTAMP,
    boolean: DimensionType.BOOLEAN,
};

// Dates that all fall on the first of a month (or of a year) are monthly (or
// yearly) data. The axis then labels months or years, not single days.
const inferTimeInterval = (
    rows: DataRow[],
    column: ResolvedDataColumn,
): TimeFrames | undefined => {
    if (column.type !== 'date' && column.type !== 'timestamp') return undefined;
    if (column.timeInterval) return TIME_INTERVALS[column.timeInterval];
    const dates = rows
        .map((row) => row[column.name])
        .filter((value): value is string => typeof value === 'string');
    if (dates.length === 0) return undefined;
    if (dates.every((value) => value.slice(5, 10) === '01-01'))
        return TimeFrames.YEAR;
    if (dates.every((value) => value.slice(8, 10) === '01'))
        return TimeFrames.MONTH;
    return TimeFrames.DAY;
};

const toDimension = (
    column: ResolvedDataColumn,
    rows: DataRow[],
): Dimension => {
    const timeInterval = inferTimeInterval(rows, column);
    return {
        fieldType: FieldType.DIMENSION,
        type: dimensionTypes[column.type],
        name: column.name,
        label: column.label,
        table: DATA_TABLE,
        tableLabel: '',
        sql: '',
        hidden: false,
        ...(timeInterval ? { timeInterval } : {}),
        ...displayOptions(column),
    };
};

const toMetric = (column: ResolvedDataColumn): Metric => ({
    fieldType: FieldType.METRIC,
    type: MetricType.NUMBER,
    name: column.name,
    label: column.label,
    table: DATA_TABLE,
    tableLabel: '',
    sql: '',
    hidden: false,
    ...displayOptions(column),
});

/** A value column, or a number column the chart does not use as a dimension. */
export const isMeasureColumn = (
    column: ResolvedDataColumn,
    valueColumns: string[],
    dimensionColumns: string[],
): boolean =>
    valueColumns.includes(column.name) ||
    (column.type === 'number' && !dimensionColumns.includes(column.name));

/**
 * Field metadata for the renderer. Measures become metrics; the rest become
 * dimensions. `dimensionColumns` keeps a number column a dimension, for
 * example the x axis of a scatter chart or a latitude.
 */
export const toItemsMap = (
    columns: ResolvedDataColumn[],
    valueColumns: string[],
    rows: DataRow[] = [],
    dimensionColumns: string[] = [],
): ItemsMap =>
    Object.fromEntries(
        columns.map((column) => [
            column.name,
            isMeasureColumn(column, valueColumns, dimensionColumns)
                ? toMetric(column)
                : toDimension(column, rows),
        ]),
    );

const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
});

const isDateColumn = (column: DataColumn): boolean =>
    column.type === 'date' || column.type === 'timestamp';

// The default display text: numbers with display metadata and dates with a
// time interval get the same Lightdash formatting as the axis labels; other
// numbers show up to two decimals; anything else is the value as text.
const defaultFormatter = (
    rows: DataRow[],
    columns: ResolvedDataColumn[],
): DataFormatter => {
    const fields = Object.fromEntries(
        columns.map((column) => [
            column.name,
            isDateColumn(column)
                ? toDimension(column, rows)
                : toMetric(column),
        ]),
    );
    return (value, column) => {
        if (value === null || value === undefined) return '';
        const field = fields[column.name];
        if (typeof value === 'number' && hasDisplayOptions(column)) {
            return formatItemValue(field, value);
        }
        if (
            typeof value === 'string' &&
            isDateColumn(column) &&
            field &&
            'timeInterval' in field &&
            field.timeInterval
        ) {
            return formatItemValue(field, value);
        }
        return typeof value === 'number'
            ? numberFormat.format(value)
            : String(value);
    };
};

/** Flat rows to the `{ value: { raw, formatted } }` rows the renderer reads. */
export const toResultRows = (
    rows: DataRow[],
    columns: ResolvedDataColumn[],
    format?: DataFormatter,
): ResultRow[] => {
    const formatValue = format ?? defaultFormatter(rows, columns);
    return rows.map((row) =>
        Object.fromEntries(
            columns.map((column) => [
                column.name,
                {
                    value: {
                        raw: row[column.name] ?? null,
                        formatted: formatValue(
                            row[column.name] ?? null,
                            column,
                            row,
                        ),
                    },
                },
            ]),
        ),
    );
};
