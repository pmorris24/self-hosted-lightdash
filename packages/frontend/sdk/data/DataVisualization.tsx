import {
    ECHARTS_DEFAULT_COLORS,
    QueryHistoryStatus,
    type ChartConfig,
    type MetricQuery,
} from '@lightdash/common';
import { useCallback, useMemo, type FC } from 'react';
import LightdashVisualization from '../../src/components/LightdashVisualization';
import VisualizationProvider from '../../src/components/LightdashVisualization/VisualizationProvider';
import { type EchartsSeriesClickEvent } from '../../src/components/SimpleChart';
import { useResizeObserver } from '../../src/hooks/useResizeObserver';
import {
    isMeasureColumn,
    resolveColumns,
    toItemsMap,
    toResultRows,
} from './adapter';
import {
    type DataChartSelection,
    type DataColumn,
    type DataFormatter,
    type DataRow,
} from './types';

type Props = {
    rows: DataRow[];
    columns?: DataColumn[];
    chartConfig: ChartConfig;
    // Columns the chart draws as measures.
    valueColumns: string[];
    // Columns the chart reads as dimensions, even when they hold numbers.
    dimensionColumns?: string[];
    format?: DataFormatter;
    isLoading?: boolean;
    colorPalette?: string[];
    onSelect?: (selection: DataChartSelection) => void;
};

const noop = () => {};
const EMPTY_COLUMNS: string[] = [];
const noopAsync = async () => {};

/**
 * Draws rows a host page supplies with the Lightdash renderer. No saved chart,
 * no explore and no query: the results are made from the rows.
 */
export const DataVisualization: FC<Props> = ({
    rows,
    columns,
    chartConfig,
    valueColumns,
    dimensionColumns = EMPTY_COLUMNS,
    format,
    isLoading = false,
    colorPalette = ECHARTS_DEFAULT_COLORS,
    onSelect,
}) => {
    const [measureRef, { width, height }] = useResizeObserver<HTMLDivElement>();

    const resolvedColumns = useMemo(
        () => resolveColumns(rows, columns),
        [rows, columns],
    );
    const columnOrder = useMemo(
        () => resolvedColumns.map((column) => column.name),
        [resolvedColumns],
    );

    const resultsData = useMemo(() => {
        const measures = resolvedColumns
            .filter((column) =>
                isMeasureColumn(column, valueColumns, dimensionColumns),
            )
            .map((column) => column.name);
        const metricQuery: MetricQuery = {
            exploreName: 'data',
            dimensions: columnOrder.filter((name) => !measures.includes(name)),
            metrics: measures,
            filters: {},
            sorts: [],
            limit: rows.length,
            tableCalculations: [],
        };
        return {
            queryUuid: undefined,
            queryStatus: QueryHistoryStatus.READY,
            rows: toResultRows(rows, resolvedColumns, format),
            totalResults: rows.length,
            isInitialLoading: false,
            isFetchingFirstPage: false,
            isFetchingRows: isLoading,
            isFetchingAllPages: false,
            fetchMoreRows: noop,
            refetchRows: noopAsync,
            setFetchAll: noop,
            fetchAll: false,
            hasFetchedAllRows: true,
            totalClientFetchTimeMs: undefined,
            error: null,
            metricQuery,
            fields: toItemsMap(
                resolvedColumns,
                valueColumns,
                rows,
                dimensionColumns,
            ),
        };
    }, [
        rows,
        resolvedColumns,
        columnOrder,
        valueColumns,
        dimensionColumns,
        format,
        isLoading,
    ]);

    const handleSeriesClick = useCallback(
        (clickEvent: EchartsSeriesClickEvent) => {
            onSelect?.({
                row: clickEvent.datasetRow ?? {},
                columns: clickEvent.dimensionNames,
                position: {
                    left: clickEvent.event.event.clientX,
                    top: clickEvent.event.event.clientY,
                },
            });
        },
        [onSelect],
    );

    return (
        <VisualizationProvider
            minimal
            hasExplorerStore={false}
            onSeriesContextMenu={onSelect ? handleSeriesClick : undefined}
            chartConfig={chartConfig}
            initialPivotDimensions={undefined}
            resultsData={resultsData}
            isLoading={isLoading}
            columnOrder={columnOrder}
            colorPalette={colorPalette}
            containerWidth={width}
            containerHeight={height}
        >
            <div
                style={{ width: '100%', height: '100%', minHeight: 'inherit' }}
                data-lightdash-data-visualization={chartConfig.type}
            >
                <LightdashVisualization
                    ref={measureRef}
                    enableContextMenu={false}
                    data-testid="sdk-data-visualization"
                />
            </div>
        </VisualizationProvider>
    );
};
