import {
    assertUnreachable,
    ChartKind,
    ChartSourceType,
    DashboardTileTypes,
    defaultTileSize,
    getAppDisplayName,
    HTML_SANITIZE_MARKDOWN_TILE_RULES,
    sanitizeHtml,
    type ChartContent,
    type Dashboard,
    type DataAppContent,
    type DashboardMarkdownTile,
} from '@lightdash/common';
import { v4 as uuid4 } from 'uuid';

export const getLoomId = (value: string | undefined): string | undefined => {
    const arr = value?.match(/share\/(.*)/);
    return arr?.[1];
};

/**
 * Helper that can be used as a value transformer with Mantine's `useForm` hook.
 */
export const markdownTileContentTransform = (
    values: DashboardMarkdownTile['properties'],
) => ({
    ...values,
    content: sanitizeHtml(values.content, HTML_SANITIZE_MARKDOWN_TILE_RULES),
});

export const buildChartTile = (
    chart: Pick<ChartContent, 'uuid' | 'name' | 'source' | 'chartKind'>,
): Dashboard['tiles'][number] => {
    switch (chart.source) {
        case ChartSourceType.SQL:
            return {
                uuid: uuid4(),
                type: DashboardTileTypes.SQL_CHART,
                properties: {
                    savedSqlUuid: chart.uuid,
                    chartName: chart.name,
                },
                tabUuid: undefined,
                ...defaultTileSize,
            };
        case ChartSourceType.DBT_EXPLORE:
            return {
                uuid: uuid4(),
                type: DashboardTileTypes.SAVED_CHART,
                properties: {
                    savedChartUuid: chart.uuid,
                    chartName: chart.name,
                    // BigNumber charts default to hidden title for cleaner appearance
                    hideTitle:
                        chart.chartKind === ChartKind.BIG_NUMBER
                            ? true
                            : undefined,
                },
                tabUuid: undefined,
                ...defaultTileSize,
            };
        default:
            return assertUnreachable(
                chart.source,
                `Unknown chart source type: ${chart.source}`,
            );
    }
};

export const buildDataAppTile = (
    app: Pick<DataAppContent, 'uuid' | 'name'>,
): Dashboard['tiles'][number] => ({
    uuid: uuid4(),
    type: DashboardTileTypes.DATA_APP,
    properties: {
        title: getAppDisplayName(app.name, app.uuid),
        appUuid: app.uuid,
    },
    tabUuid: undefined,
    ...defaultTileSize,
});
