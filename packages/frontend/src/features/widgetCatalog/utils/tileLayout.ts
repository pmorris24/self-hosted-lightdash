import { type Dashboard } from '@lightdash/common';
import { BASE_GRID_COLS } from '../../dashboardTabs/gridUtils';

type Tile = Dashboard['tiles'][number];

/**
 * Lays tiles out left to right, wrapping to the next row when the next tile
 * would overflow the grid. Positions are relative: the first row is y 0, so
 * the caller can offset the whole block onto the end of the dashboard.
 */
export const flowTilesIntoRows = <T extends Tile>(tiles: T[]): T[] => {
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    return tiles.map((tile) => {
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
