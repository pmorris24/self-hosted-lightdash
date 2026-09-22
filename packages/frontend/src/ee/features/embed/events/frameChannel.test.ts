import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyFrameCommand,
    getEmbedFrameState,
    parseFrameCommand,
    resetEmbedFrameState,
    subscribeToEmbedFrameState,
} from './frameChannel';

describe('parseFrameCommand', () => {
    it('accepts a filter command with valid filters', () => {
        const filters = [
            {
                model: 'orders',
                field: 'status',
                operator: 'equals',
                value: 'a',
            },
        ];
        expect(
            parseFrameCommand({
                type: 'lightdash:command:setFilters',
                payload: { filters },
            }),
        ).toEqual({ type: 'setFilters', filters });
    });

    it('accepts a theme command', () => {
        expect(
            parseFrameCommand({
                type: 'lightdash:command:setTheme',
                payload: { theme: 'dark' },
            }),
        ).toEqual({ type: 'setTheme', theme: 'dark' });
    });

    it.each([
        ['not an object', 'setFilters'],
        ['no namespace', { type: 'setFilters', payload: { filters: [] } }],
        ['unknown command', { type: 'lightdash:command:logout' }],
        [
            'unknown operator',
            {
                type: 'lightdash:command:setFilters',
                payload: {
                    filters: [{ model: 'o', field: 'f', operator: 'drop' }],
                },
            },
        ],
        [
            'filter without a model',
            {
                type: 'lightdash:command:setFilters',
                payload: { filters: [{ field: 'f', operator: 'equals' }] },
            },
        ],
        [
            'unknown theme',
            { type: 'lightdash:command:setTheme', payload: { theme: 'pink' } },
        ],
    ])('rejects %s', (_name, data) => {
        expect(parseFrameCommand(data)).toBeNull();
    });
});

describe('embed frame state', () => {
    afterEach(() => resetEmbedFrameState());

    it('starts empty, keeps each command, and tells subscribers', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeToEmbedFrameState(listener);
        expect(getEmbedFrameState()).toEqual({ filters: null, theme: null });

        applyFrameCommand({ type: 'setTheme', theme: 'dark' });
        applyFrameCommand({ type: 'setFilters', filters: [] });

        expect(getEmbedFrameState()).toEqual({ filters: [], theme: 'dark' });
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        applyFrameCommand({ type: 'setTheme', theme: 'light' });
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
