import {
    formatDate as formatCommonDate,
    formatNumberValue,
    TimeFrames,
    type CustomFormat,
} from '@lightdash/common';
import { type DataColumn, type DataRow } from '../data/types';

export type DateGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

const timeFrames: Record<DateGranularity, TimeFrames> = {
    day: TimeFrames.DAY,
    week: TimeFrames.WEEK,
    month: TimeFrames.MONTH,
    quarter: TimeFrames.QUARTER,
    year: TimeFrames.YEAR,
};

/** A number as Lightdash shows it. `format` takes the options of a metric. */
export const formatNumber = (value: number, format?: CustomFormat): string =>
    formatNumberValue(value, format);

/** A date as Lightdash shows it for a time interval. */
export const formatDate = (
    value: string | number | Date,
    granularity: DateGranularity = 'day',
): string => formatCommonDate(value, timeFrames[granularity]);

export const getDefaultDateFormat = (granularity: DateGranularity): string => {
    switch (granularity) {
        case 'year':
            return 'YYYY';
        case 'quarter':
            return 'YYYY-[Q]Q';
        case 'month':
            return 'YYYY-MM';
        default:
            return 'YYYY-MM-DD';
    }
};

/** Rows as display text: numbers and dates formatted, the rest as strings. */
export const formatRows = (
    rows: DataRow[],
    columns: DataColumn[],
): Record<string, string>[] =>
    rows.map((row) =>
        Object.fromEntries(
            columns.map((column) => {
                const value = row[column.name];
                if (value === null || value === undefined) {
                    return [column.name, ''];
                }
                if (column.type === 'number' && typeof value === 'number') {
                    return [column.name, formatNumber(value)];
                }
                if (
                    (column.type === 'date' || column.type === 'timestamp') &&
                    typeof value !== 'boolean'
                ) {
                    return [column.name, formatDate(value)];
                }
                return [column.name, String(value)];
            }),
        ),
    );
