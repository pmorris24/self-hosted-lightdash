import { afterEach, describe, expect, it, vi } from 'vitest';

const SEEDED_SEARCH = `?state=${encodeURIComponent(JSON.stringify({ period: 'ytd' }))}`;

// The embedded flag and the shared stores are module state, so each test
// loads fresh modules.
async function markFreshModulesEmbedded() {
    vi.resetModules();
    const { markEmbedded } = await import('./embedMode');
    markEmbedded();
}

describe('embedded mode', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        window.history.replaceState(null, '', '/');
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = '';
    });

    it('keeps URL state in memory instead of reading or writing the page URL', async () => {
        window.history.replaceState(null, '', `/${SEEDED_SEARCH}`);
        await markFreshModulesEmbedded();
        const { createSharedUrlStateStore } = await import('./urlState');
        vi.useFakeTimers();
        const replaceState = vi.spyOn(window.history, 'replaceState');

        const store = createSharedUrlStateStore();
        expect(store.getState()).toEqual({});

        store.setKey('period', 'last_month');
        vi.runAllTimers();

        expect(store.getState()).toEqual({ period: 'last_month' });
        expect(replaceState).not.toHaveBeenCalled();
        expect(window.location.search).toBe(SEEDED_SEARCH);
    });

    it('does not stamp the color scheme onto the page <html>', async () => {
        await markFreshModulesEmbedded();
        const { setColorScheme } = await import('./colorScheme');

        setColorScheme('dark');

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('stamps <html> when the app owns the page', async () => {
        vi.resetModules();
        const { setColorScheme } = await import('./colorScheme');

        setColorScheme('dark');

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('refuses Sheets export instead of posting rows to the parent window', async () => {
        await markFreshModulesEmbedded();
        const { exportToSheets } = await import('./exportToSheets');
        const postMessage = vi.fn();
        const originalParent = window.parent;
        Object.defineProperty(window, 'parent', {
            configurable: true,
            value: { postMessage },
        });
        try {
            await expect(
                exportToSheets({ title: 'Usage', columns: [], rows: [] }),
            ).rejects.toThrow('not available when the app is embedded');
            expect(postMessage).not.toHaveBeenCalled();
        } finally {
            Object.defineProperty(window, 'parent', {
                configurable: true,
                value: originalParent,
            });
        }
    });
});
