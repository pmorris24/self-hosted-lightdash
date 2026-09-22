export type DataColumnType =
    | 'string'
    | 'number'
    | 'date'
    | 'timestamp'
    | 'boolean';

export type DataTimeInterval = 'day' | 'week' | 'month' | 'quarter' | 'year';

// Same shape as a column of `@lightdash/query-sdk`, plus display metadata
// the Lightdash renderer reads for axis labels, tooltips and table cells.
export type DataColumn = {
    name: string;
    label?: string;
    type?: DataColumnType;
    // A named format such as 'usd', 'gbp', 'eur' or 'percent', or a format
    // expression such as '#,##0.00' or '$#,##0'.
    format?: string;
    // Decimal places.
    round?: number;
    // Show large numbers as 'thousands', 'millions', 'billions' or 'auto'.
    compact?: string;
    // Dates: the interval the axis labels. Default: read from the rows.
    timeInterval?: DataTimeInterval;
};

// A column after defaults: every column has a label and a type.
export type ResolvedDataColumn = DataColumn & {
    label: string;
    type: DataColumnType;
};

// Same shape as a row of `@lightdash/query-sdk`: flat values keyed by column.
export type DataRow = Record<string, string | number | boolean | null>;

export type DataChartType =
    | 'bar'
    | 'column'
    | 'line'
    | 'area'
    | 'scatter'
    | 'pie'
    | 'donut'
    | 'funnel'
    | 'kpi'
    | 'treemap'
    | 'gauge'
    | 'sankey'
    | 'map';

export type DataOptions = {
    // The column on the category axis, or the slices of a pie or funnel.
    category?: string;
    // One or more numeric columns.
    value: string | string[];
    // Stack the value columns (bar, column, area). 'percent' makes every
    // stack fill the height, so the chart reads as a share of the whole.
    stack?: boolean | 'normal' | 'percent';
    // Draw one value column as a different chart type, for a combo chart.
    // Keyed by column name; anything unlisted uses the chart's own type.
    seriesTypes?: Record<string, 'bar' | 'column' | 'line' | 'area' | 'scatter'>;
    // Value columns to put on a second axis, on the right. Use it when two
    // measures share a category but not a scale.
    rightAxis?: string[];
    // Split each value into one series per value of this column
    // (bar, column, line, area, scatter).
    breakBy?: string;
    // Sankey: the columns a flow goes from and to.
    source?: string;
    target?: string;
    // Map: the columns with the position of each point.
    latitude?: string;
    longitude?: string;
    // Gauge: the ends of the scale. Default: 0 to the largest value.
    min?: number;
    max?: number;
};

/**
 * How a chart looks, separate from what it draws. Every field is optional
 * and falls back to the renderer's own default.
 */
export type DataChartStyleOptions = {
    legend?: {
        show?: boolean;
        // Which edge of the chart the legend sits on. Default: bottom.
        position?: 'top' | 'bottom' | 'left' | 'right';
    };
    xAxis?: {
        title?: string;
        // The axis line and its labels. Default: shown.
        show?: boolean;
        gridLines?: boolean;
    };
    yAxis?: {
        title?: string;
        show?: boolean;
        gridLines?: boolean;
        min?: number;
        max?: number;
    };
    // The value printed on each mark.
    dataLabels?: {
        show?: boolean;
        position?: 'left' | 'top' | 'right' | 'bottom' | 'inside';
    };
    // Line and area charts.
    line?: {
        // Curve the line between points instead of joining them straight.
        smooth?: boolean;
        // A dot on every point.
        markers?: boolean;
    };
    // Slice or series colours: one per value column in order, or by column
    // name. A pie or treemap reads them by category value instead.
    colors?: string[] | Record<string, string>;
    // Pie and donut: what each slice says, and where. Default: hidden.
    sliceLabels?: {
        position?: 'inside' | 'outside' | 'hidden';
        showValue?: boolean;
        showPercentage?: boolean;
    };
    axisLabelFontSize?: number;
    axisTitleFontSize?: number;
};

/**
 * How a table reads, separate from what is in it. Every field is optional
 * and falls back to the renderer's own default.
 */
export type DataTableOptions = {
    // The counter down the left. Default: shown.
    rowNumbers?: boolean;
    // Print a repeated dimension value once, not on every row.
    groupRepeatedValues?: boolean;
    // The row count, above the table.
    resultsCount?: boolean;
};
// Totals, subtotals and metrics-as-rows are deliberately absent: the renderer
// computes them from the aggregation of a saved chart's metric query, which
// rows handed to it by a host page do not carry, so they render empty.

// What a host page receives when a viewer clicks a data point.
export type DataChartSelection = {
    // The clicked row, keyed by column name.
    row: Record<string, unknown>;
    // The columns of the clicked series, category first.
    columns: string[];
    // Where the viewer clicked, in viewport pixels. For a host context menu.
    position: { left: number; top: number };
};

// Turns one value into display text. Default: the value as a string.
export type DataFormatter = (
    value: DataRow[string],
    column: DataColumn,
    row: DataRow,
) => string;
