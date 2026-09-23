import { DashboardTileTypes, defaultTileSize } from '@lightdash/common';
import { describe, expect, it } from 'vitest';
import { placeNewTilesInFlow } from './tileLayout';

const tile = (
    uuid: string,
    overrides: Partial<typeof defaultTileSize> & { tabUuid?: string } = {},
) => ({
    uuid,
    type: DashboardTileTypes.MARKDOWN as const,
    properties: { title: uuid, content: '' },
    tabUuid: undefined,
    ...defaultTileSize,
    ...overrides,
});

const at = ({ x, y }: { x: number; y: number }) => ({ x, y });

describe('placeNewTilesInFlow', () => {
    it('fills a row left to right before wrapping', () => {
        // Default tiles are 15 wide, so two fit in the 36-column grid
        const placed = placeNewTilesInFlow(
            [],
            [tile('a'), tile('b'), tile('c')],
        );

        expect(placed.map(at)).toEqual([
            { x: 0, y: 0 },
            { x: 15, y: 0 },
            { x: 0, y: 9 },
        ]);
    });

    it('carries on from the bottom row of the dashboard', () => {
        const placed = placeNewTilesInFlow([tile('a')], [tile('b')]);

        expect(placed.map(at)).toEqual([{ x: 15, y: 0 }]);
    });

    it('starts a new row when the bottom row is full', () => {
        const placed = placeNewTilesInFlow(
            [tile('a'), tile('b', { x: 15 })],
            [tile('c'), tile('d')],
        );

        expect(placed.map(at)).toEqual([
            { x: 0, y: 9 },
            { x: 15, y: 9 },
        ]);
    });

    it('drops below the tallest tile in the row it leaves', () => {
        const placed = placeNewTilesInFlow(
            [tile('a', { h: 12 }), tile('b', { x: 15, h: 6 })],
            [tile('c')],
        );

        expect(placed.map(at)).toEqual([{ x: 0, y: 12 }]);
    });

    it('only measures the tab the tiles are added to', () => {
        const placed = placeNewTilesInFlow(
            [tile('a', { tabUuid: 'tab-1' })],
            [tile('b', { tabUuid: 'tab-2' })],
        );

        expect(placed.map(at)).toEqual([{ x: 0, y: 0 }]);
    });

    it('clamps a tile wider than the grid and gives it its own row', () => {
        const placed = placeNewTilesInFlow(
            [],
            [tile('a'), tile('b', { w: 40 }), tile('c')],
        );

        expect(placed[1]).toMatchObject({ x: 0, y: 9, w: 36 });
        expect(placed[2]).toMatchObject({ x: 0, y: 18 });
    });

    it('returns nothing when there is nothing to add', () => {
        expect(placeNewTilesInFlow([tile('a')], [])).toEqual([]);
    });
});
