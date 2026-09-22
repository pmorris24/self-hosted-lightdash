import {
    assertUnreachable,
    CartesianSeriesType,
    ChartType,
    FunnelChartDataInput,
    MapChartType,
    type ChartConfig,
    type EchartsGrid,
    type EchartsLegend,
    type Series,
} from '@lightdash/common';
import {
    type DataChartStyleOptions,
    type DataChartType,
    type DataOptions,
    type DataTableOptions,
} from './types';

/** The category column first, where the renderer reads labels by position. */
export const orderColumnsForChart = <T extends { name: string }>(
    columns: T[],
    dataOptions: DataOptions,
): T[] => {
    const { category } = dataOptions;
    if (!category) return columns;
    return [
        ...columns.filter((column) => column.name === category),
        ...columns.filter((column) => column.name !== category),
    ];
};

/** The columns a chart reads as dimensions, whatever their type. */
export const getDimensionColumns = (dataOptions: DataOptions): string[] =>
    [
        dataOptions.category,
        dataOptions.source,
        dataOptions.target,
        dataOptions.latitude,
        dataOptions.longitude,
    ].filter((name): name is string => !!name);

export const getValueColumns = (dataOptions: DataOptions): string[] =>
    Array.isArray(dataOptions.value) ? dataOptions.value : [dataOptions.value];

const seriesTypes: Record<
    'bar' | 'column' | 'line' | 'area' | 'scatter',
    CartesianSeriesType
> = {
    bar: CartesianSeriesType.BAR,
    column: CartesianSeriesType.BAR,
    line: CartesianSeriesType.LINE,
    area: CartesianSeriesType.LINE,
    scatter: CartesianSeriesType.SCATTER,
};

const requireOption = (
    chartType: DataChartType,
    dataOptions: DataOptions,
    option: 'source' | 'target' | 'latitude' | 'longitude',
): string => {
    const value = dataOptions[option];
    if (!value) {
        throw new Error(
            `Lightdash SDK: a "${chartType}" chart needs dataOptions.${option}.`,
        );
    }
    return value;
};

const requireCategory = (
    chartType: DataChartType,
    dataOptions: DataOptions,
): string => {
    if (!dataOptions.category) {
        throw new Error(
            `Lightdash SDK: a "${chartType}" chart needs dataOptions.category.`,
        );
    }
    return dataOptions.category;
};

type LegendPlacementConfig = {
    legend: EchartsLegend;
    // What the plot gives up so the legend sits beside it, not over it.
    grid: EchartsGrid;
};

const LEGEND_POSITIONS: Record<
    NonNullable<NonNullable<DataChartStyleOptions['legend']>['position']>,
    LegendPlacementConfig
> = {
    // Above or below the plot, ECharts placement: `top` takes top/middle/
    // bottom and `left` takes left/center/right. The renderer pads the top
    // for a legend on its own, so both edges are set here to keep the gap
    // the same either way.
    top: {
        legend: { orient: 'horizontal', top: 'top', left: 'center' },
        grid: { top: '56px', bottom: '30px' },
    },
    bottom: {
        legend: { orient: 'horizontal', top: 'bottom', left: 'center' },
        grid: { top: '30px', bottom: '56px' },
    },
    // Beside the plot, the renderer's own presets, which reserve a column.
    // Its default is a quarter of the width; this is tighter, and the label
    // truncation follows the same number.
    left: {
        legend: { placement: 'outsideLeft' },
        grid: { left: '16%' },
    },
    right: {
        legend: { placement: 'outsideRight' },
        grid: { right: '16%' },
    },
};

const buildLegend = (
    style: DataChartStyleOptions,
): LegendPlacementConfig | undefined => {
    const { legend } = style;
    if (!legend) return undefined;
    const placement = legend.position
        ? LEGEND_POSITIONS[legend.position]
        : undefined;
    return {
        legend: {
            ...(legend.show === undefined ? {} : { show: legend.show }),
            ...(placement?.legend ?? {}),
        },
        // A hidden legend needs no room.
        grid: legend.show === false ? {} : (placement?.grid ?? {}),
    };
};

// One colour per value column: a list is read in order, a map by column name.
const colorFor = (
    style: DataChartStyleOptions,
    value: string,
    index: number,
): string | undefined => {
    const { colors } = style;
    if (!colors) return undefined;
    return Array.isArray(colors) ? colors[index] : colors[value];
};

const buildSeriesStyle = (
    style: DataChartStyleOptions,
    value: string,
    index: number,
) => ({
    ...(style.dataLabels
        ? {
              label: {
                  ...(style.dataLabels.show === undefined
                      ? {}
                      : { show: style.dataLabels.show }),
                  ...(style.dataLabels.position
                      ? { position: style.dataLabels.position }
                      : {}),
              },
          }
        : {}),
    ...(style.line?.smooth === undefined ? {} : { smooth: style.line.smooth }),
    ...(style.line?.markers === undefined
        ? {}
        : { showSymbol: style.line.markers }),
    ...(colorFor(style, value, index)
        ? { color: colorFor(style, value, index) }
        : {}),
});

const axisEntry = (axis: DataChartStyleOptions['yAxis']) => ({
    ...(axis?.title ? { name: axis.title } : {}),
    ...(axis?.min === undefined ? {} : { min: String(axis.min) }),
    ...(axis?.max === undefined ? {} : { max: String(axis.max) }),
});

/** Simple data options to the chart config the Lightdash renderer reads. */
export const buildChartConfig = (
    chartType: DataChartType,
    dataOptions: DataOptions,
    styleOptions: DataChartStyleOptions = {},
): ChartConfig => {
    const values = getValueColumns(dataOptions);
    const legend = buildLegend(styleOptions);

    switch (chartType) {
        case 'bar':
        case 'column':
        case 'line':
        case 'area':
        case 'scatter': {
            const category = requireCategory(chartType, dataOptions);
            const rightAxis = new Set(dataOptions.rightAxis ?? []);
            const series: Series[] = values.map((value, index) => {
                const seriesType = dataOptions.seriesTypes?.[value] ?? chartType;
                return {
                type: seriesTypes[seriesType],
                encode: {
                    xRef: { field: category },
                    yRef: { field: value },
                },
                ...(seriesType === 'area' ? { areaStyle: {} } : {}),
                ...(dataOptions.stack ? { stack: 'stack' } : {}),
                ...(rightAxis.has(value) ? { yAxisIndex: 1 } : {}),
                ...buildSeriesStyle(styleOptions, value, index),
                };
            });
            const { xAxis, yAxis } = styleOptions;
            return {
                type: ChartType.CARTESIAN,
                config: {
                    layout: {
                        xField: category,
                        yField: values,
                        // Lightdash names a horizontal bar chart by flipped axes.
                        flipAxes: chartType === 'bar',
                        ...(dataOptions.stack
                            ? {
                                  stack:
                                      dataOptions.stack === 'percent'
                                          ? 'stack100'
                                          : 'stack',
                              }
                            : {}),
                        ...(xAxis?.gridLines === undefined
                            ? {}
                            : { showGridX: xAxis.gridLines }),
                        ...(yAxis?.gridLines === undefined
                            ? {}
                            : { showGridY: yAxis.gridLines }),
                        ...(xAxis?.show === undefined
                            ? {}
                            : { showXAxis: xAxis.show }),
                        ...(yAxis?.show === undefined
                            ? {}
                            : { showYAxis: yAxis.show }),
                    },
                    eChartsConfig: {
                        series,
                        ...(legend ? { legend: legend.legend } : {}),
                        ...(legend && Object.keys(legend.grid).length > 0
                            ? { grid: legend.grid }
                            : {}),
                        ...(xAxis ? { xAxis: [axisEntry(xAxis)] } : {}),
                        ...(yAxis || rightAxis.size > 0
                            ? {
                                  yAxis:
                                      rightAxis.size > 0
                                          ? [axisEntry(yAxis), {}]
                                          : [axisEntry(yAxis)],
                              }
                            : {}),
                        ...(styleOptions.axisLabelFontSize === undefined
                            ? {}
                            : {
                                  axisLabelFontSize:
                                      styleOptions.axisLabelFontSize,
                              }),
                        ...(styleOptions.axisTitleFontSize === undefined
                            ? {}
                            : {
                                  axisTitleFontSize:
                                      styleOptions.axisTitleFontSize,
                              }),
                    },
                },
            };
        }
        case 'pie':
        case 'donut': {
            const { colors, sliceLabels } = styleOptions;
            return {
                type: ChartType.PIE,
                config: {
                    groupFieldIds: [requireCategory(chartType, dataOptions)],
                    metricId: values[0],
                    isDonut: chartType === 'donut',
                    ...(styleOptions.legend?.show === undefined
                        ? {}
                        : { showLegend: styleOptions.legend.show }),
                    ...(styleOptions.legend?.position
                        ? {
                              legendPosition:
                                  styleOptions.legend.position === 'left' ||
                                  styleOptions.legend.position === 'right'
                                      ? 'vertical'
                                      : 'horizontal',
                          }
                        : {}),
                    ...(sliceLabels
                        ? {
                              valueLabel:
                                  sliceLabels.position ??
                                  // Asking for a label means asking to see it.
                                  (sliceLabels.showValue ||
                                  sliceLabels.showPercentage
                                      ? 'inside'
                                      : 'hidden'),
                          }
                        : {}),
                    ...(sliceLabels?.showValue === undefined
                        ? {}
                        : { showValue: sliceLabels.showValue }),
                    ...(sliceLabels?.showPercentage === undefined
                        ? {}
                        : { showPercentage: sliceLabels.showPercentage }),
                    ...(colors && !Array.isArray(colors)
                        ? { groupColorOverrides: colors }
                        : {}),
                },
            };
        }
        case 'funnel':
            // "Column" input: one stage per row, the value from one column.
            // The renderer labels a stage with the row's first column, so
            // `orderColumnsForChart` puts the category first.
            requireCategory(chartType, dataOptions);
            return {
                type: ChartType.FUNNEL,
                config: {
                    dataInput: FunnelChartDataInput.COLUMN,
                    fieldId: values[0],
                },
            };
        case 'kpi':
            return {
                type: ChartType.BIG_NUMBER,
                config: { selectedField: values[0] },
            };
        case 'treemap':
            return {
                type: ChartType.TREEMAP,
                config: {
                    groupFieldIds: [requireCategory(chartType, dataOptions)],
                    sizeMetricId: values[0],
                },
            };
        case 'gauge':
            return {
                type: ChartType.GAUGE,
                config: {
                    selectedField: values[0],
                    min: dataOptions.min,
                    max: dataOptions.max,
                },
            };
        case 'sankey':
            return {
                type: ChartType.SANKEY,
                config: {
                    sourceFieldId: requireOption(chartType, dataOptions, 'source'),
                    targetFieldId: requireOption(chartType, dataOptions, 'target'),
                    metricFieldId: values[0],
                },
            };
        case 'map':
            return {
                type: ChartType.MAP,
                config: {
                    locationType: MapChartType.SCATTER,
                    latitudeFieldId: requireOption(
                        chartType,
                        dataOptions,
                        'latitude',
                    ),
                    longitudeFieldId: requireOption(
                        chartType,
                        dataOptions,
                        'longitude',
                    ),
                    valueFieldId: values[0],
                    sizeFieldId: values[0],
                },
            };
        default:
            return assertUnreachable(
                chartType,
                `Unknown data chart type: ${chartType}`,
            );
    }
};

/** Table options to the table config the Lightdash renderer reads. */
export const buildTableConfig = (options: DataTableOptions = {}): ChartConfig => ({
    type: ChartType.TABLE,
    config: {
        ...(options.rowNumbers === undefined
            ? {}
            : { hideRowNumbers: !options.rowNumbers }),
        ...(options.groupRepeatedValues === undefined
            ? {}
            : { showRowGrouping: options.groupRepeatedValues }),
        ...(options.resultsCount === undefined
            ? {}
            : { showResultsTotal: options.resultsCount }),
    },
});
