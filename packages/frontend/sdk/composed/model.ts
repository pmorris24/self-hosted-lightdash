import {
    DashboardTileTypes,
    type Dashboard,
    type DashboardTile,
} from '@lightdash/common';
import {
    type ComposedDashboardProps,
    type ComposedLayoutRow,
    type ComposedWidget,
} from './types';

// The dashboard grid: 36 columns, and rows of this height in pixels.
const GRID_COLUMNS = 36;
const GRID_ROW_HEIGHT = 55;

type ChartTile = DashboardTile & {
    type: DashboardTileTypes.SAVED_CHART;
};

const isChartTile = (tile: DashboardTile): tile is ChartTile =>
    tile.type === DashboardTileTypes.SAVED_CHART &&
    !!tile.properties.savedChartUuid;

/**
 * Turns a saved dashboard into widgets and a layout for
 * `useComposedDashboard`. Chart tiles keep their place and size; tiles of
 * other types (markdown, loom, headings) are left out. `tabUuid` picks one tab.
 */
export const dashboardModelToComposed = (
    dashboard: Pick<Dashboard, 'name' | 'tiles'>,
    options: { tabUuid?: string } = {},
): ComposedDashboardProps => {
    const tiles = dashboard.tiles
        .filter(isChartTile)
        .filter(
            (tile) =>
                options.tabUuid === undefined ||
                tile.tabUuid === options.tabUuid,
        );

    const widgets: ComposedWidget[] = tiles.map((tile) => ({
        id: tile.uuid,
        chartUuid: tile.properties.savedChartUuid as string,
        title:
            tile.properties.title ||
            tile.properties.chartName ||
            undefined,
    }));

    const rowsByY = new Map<number, ChartTile[]>();
    tiles.forEach((tile) => {
        rowsByY.set(tile.y, [...(rowsByY.get(tile.y) ?? []), tile]);
    });

    const rows: ComposedLayoutRow[] = [...rowsByY.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, rowTiles]) => ({
            cells: [...rowTiles]
                .sort((a, b) => a.x - b.x)
                .map((tile) => ({
                    widgetId: tile.uuid,
                    widthPercentage: (tile.w / GRID_COLUMNS) * 100,
                    height: tile.h * GRID_ROW_HEIGHT,
                })),
        }));

    return {
        title: dashboard.name,
        widgets,
        layout: { columns: [{ widthPercentage: 100, rows }] },
    };
};
