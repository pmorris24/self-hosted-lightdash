import { type DashboardTile } from '@lightdash/common';
import { BASE_GRID_COLS } from './gridUtils';

export type PlaceableTile = Pick<DashboardTile, 'x' | 'y' | 'w' | 'h'> & {
    tabUuid: string | null | undefined;
};

const isSameTab = (a: PlaceableTile, b: PlaceableTile) =>
    (a.tabUuid ?? null) === (b.tabUuid ?? null);

/**
 * Places new tiles in reading order: each one sits to the right of the one
 * before it and wraps to a new row when it no longer fits. The first one
 * carries on from the bottom row of the tab it lands in, so tiles added one at
 * a time fill a row before starting the next.
 */
export const placeNewTilesInFlow = <T extends PlaceableTile>(
    existingTiles: T[],
    newTiles: T[],
): T[] => {
    const [firstNewTile] = newTiles;
    if (!firstNewTile) return [];

    const tilesInTab = existingTiles.filter((tile) =>
        isSameTab(tile, firstNewTile),
    );
    const bottomRowY =
        tilesInTab.length > 0 ? Math.max(...tilesInTab.map((t) => t.y)) : 0;
    const bottomRow = tilesInTab.filter((tile) => tile.y === bottomRowY);

    let x = bottomRow.reduce(
        (edge, tile) => Math.max(edge, tile.x + tile.w),
        0,
    );
    let y = bottomRowY;
    let rowHeight = bottomRow.reduce(
        (height, tile) => Math.max(height, tile.h),
        0,
    );

    return newTiles.map((tile) => {
        const w = Math.min(tile.w, BASE_GRID_COLS);
        if (x > 0 && x + w > BASE_GRID_COLS) {
            x = 0;
            y += rowHeight;
            rowHeight = 0;
        }
        const placed = { ...tile, w, x, y };
        x += w;
        rowHeight = Math.max(rowHeight, tile.h);
        return placed;
    });
};
