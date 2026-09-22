import { type ResultRow } from '@lightdash/common';
import { type SdkChartSelectionValue } from './types';

type Args = {
    row: ResultRow | undefined;
    // Field ids of the chart's dimensions, for example `orders_status`.
    dimensions: string[];
    tableNames: string[];
};

/**
 * The dimension values of one clicked row, split into model and field. A
 * field id is `<table>_<field>`, and a table name can hold `_` too, so the
 * longest table name that matches wins.
 */
export const getDataPointSelectionValues = ({
    row,
    dimensions,
    tableNames,
}: Args): SdkChartSelectionValue[] => {
    if (!row) return [];
    const longestFirst = [...tableNames].sort((a, b) => b.length - a.length);

    return dimensions.flatMap((fieldId) => {
        const cell = row[fieldId];
        const model = longestFirst.find((name) =>
            fieldId.startsWith(`${name}_`),
        );
        if (!cell || !model) return [];
        return [
            {
                model,
                field: fieldId.slice(model.length + 1),
                fieldId,
                value: cell.value.raw,
            },
        ];
    });
};
