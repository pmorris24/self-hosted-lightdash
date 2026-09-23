import { DashboardTileTypes, defaultTileSize } from '@lightdash/common';
import { describe, expect, it } from 'vitest';
import { flowTilesIntoRows } from './tileLayout';

const tile = (uuid: string, size = defaultTileSize) => ({
    uuid,
    type: DashboardTileTypes.MARKDOWN as const,
    properties: { title: uuid, content: '' },
    tabUuid: undefined,
    ...size,
});

describe('flowTilesIntoRows', () => {
    it('fills a row left to right before wrapping', () => {
        // Default tiles are 15 wide, so two fit in the 36-column grid
        const placed = flowTilesIntoRows([tile('a'), tile('b'), tile('c')]);

        expect(placed.map(({ x, y }) => ({ x, y }))).toEqual([
            { x: 0, y: 0 },
            { x: 15, y: 0 },
            { x: 0, y: 9 },
        ]);
    });

    it('starts a new row at the tallest tile in the previous one', () => {
        const placed = flowTilesIntoRows([
            tile('a', { ...defaultTileSize, h: 6 }),
            tile('b', { ...defaultTileSize, h: 12 }),
            tile('c'),
        ]);

        expect(placed[2]).toMatchObject({ x: 0, y: 12 });
    });

    it('clamps a tile wider than the grid and gives it its own row', () => {
        const placed = flowTilesIntoRows([
            tile('a'),
            tile('b', { ...defaultTileSize, w: 40 }),
            tile('c'),
        ]);

        expect(placed[1]).toMatchObject({ x: 0, y: 9, w: 36 });
        expect(placed[2]).toMatchObject({ x: 0, y: 18 });
    });

    it('leaves a single tile at the origin', () => {
        expect(flowTilesIntoRows([tile('a')])[0]).toMatchObject({ x: 0, y: 0 });
    });
});
