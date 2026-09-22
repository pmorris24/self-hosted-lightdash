import {
    FilterOperator,
    type ApiExploreResults,
    type EChartsSeries,
    type SavedChart,
} from '@lightdash/common';
import { useCallback, useEffect, useRef } from 'react';
import { getDashboardTileContextMenuOptions } from '../../../../../components/DashboardTiles/getDashboardTileContextMenuOptions';
import { type DataPointSelection } from '../../../../../components/LightdashVisualization/context';
import { type EchartsSeriesClickEvent } from '../../../../../components/SimpleChart';
import useEmbed from '../../../../providers/Embed/useEmbed';
import { getDataPointSelectionValues } from '../selectionValues';

type Args = {
    explore: ApiExploreResults | undefined;
    savedChart: SavedChart | undefined;
    fetchResults: () => void;
};

/**
 * What a host page can do with one embedded chart: filter it, and hear about
 * clicks on its data points. Does nothing outside an SDK chart embed.
 */
export const useEmbeddedChartInteractions = ({
    explore,
    savedChart,
    fetchResults,
}: Args) => {
    const embed = useEmbed();
    const onSelect = embed?.onSelect;
    const isChartEmbed = !!embed?.savedQueryUuid;

    // The explorer runs a saved chart once. When the host page changes its
    // filters, ask for a new run; the query manager already has the new args.
    const filtersKey = isChartEmbed ? JSON.stringify(embed?.filters ?? []) : '';
    const appliedFiltersKey = useRef(filtersKey);
    useEffect(() => {
        if (appliedFiltersKey.current === filtersKey) return;
        appliedFiltersKey.current = filtersKey;
        fetchResults();
    }, [filtersKey, fetchResults]);

    const handleSeriesClick = useCallback(
        (clickEvent: EchartsSeriesClickEvent, series: EChartsSeries[]) => {
            if (!onSelect || !explore || !savedChart) return;
            const { dashboardTileFilterOptions } =
                getDashboardTileContextMenuOptions({
                    clickEvent,
                    series,
                    explore,
                    chart: savedChart,
                });
            const values = dashboardTileFilterOptions.map((rule) => ({
                model: rule.target.tableName,
                field: rule.target.fieldId.slice(
                    rule.target.tableName.length + 1,
                ),
                fieldId: rule.target.fieldId,
                value: rule.values?.[0],
            }));
            onSelect({
                chartUuid: savedChart.uuid,
                values,
                filters: values.map(({ model, field, value }) => ({
                    model,
                    field,
                    operator: FilterOperator.EQUALS,
                    value,
                })),
                row: clickEvent.datasetRow,
                position: {
                    left: clickEvent.event.event.clientX,
                    top: clickEvent.event.event.clientY,
                },
            });
        },
        [onSelect, explore, savedChart],
    );

    // Pie and funnel slices: the clicked values are the chart's dimensions.
    const handleDataPointSelect = useCallback(
        ({ rows, position }: DataPointSelection) => {
            if (!onSelect || !savedChart) return;
            const [row] = rows;
            const values = getDataPointSelectionValues({
                row,
                dimensions: savedChart.metricQuery.dimensions,
                tableNames: explore ? Object.keys(explore.tables) : [],
            });
            onSelect({
                chartUuid: savedChart.uuid,
                values,
                filters: values.map(({ model, field, value }) => ({
                    model,
                    field,
                    operator: FilterOperator.EQUALS,
                    value,
                })),
                row: row
                    ? Object.fromEntries(
                          Object.entries(row).map(([fieldId, cell]) => [
                              fieldId,
                              cell.value.raw,
                          ]),
                      )
                    : undefined,
                position,
            });
        },
        [onSelect, explore, savedChart],
    );

    return {
        onDataPointSelect:
            isChartEmbed && onSelect ? handleDataPointSelect : undefined,
        onSeriesContextMenu:
            isChartEmbed && onSelect ? handleSeriesClick : undefined,
    };
};
