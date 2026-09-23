import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetSurfaceWarnings, resolveAgentLayout } from './agentSurface';

afterEach(() => {
    resetSurfaceWarnings();
    vi.restoreAllMocks();
});

describe('agent surface', () => {
    it('defaults to the panel when a host says nothing', () => {
        expect(resolveAgentLayout(undefined, undefined)).toBe('panel');
    });

    it('maps the two surfaces a host can render today', () => {
        expect(resolveAgentLayout('panel', undefined)).toBe('panel');
        expect(resolveAgentLayout('page', undefined)).toBe('page');
    });

    it('keeps the deprecated layout prop working', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(resolveAgentLayout(undefined, 'page')).toBe('page');
        expect(resolveAgentLayout(undefined, 'panel')).toBe('panel');
        expect(warn).toHaveBeenCalledOnce();
        expect(warn.mock.calls[0][0]).toContain('deprecated');
    });

    it('prefers surface when both are given, and says nothing about layout', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(resolveAgentLayout('panel', 'page')).toBe('panel');
        expect(warn).not.toHaveBeenCalled();
    });

    it('renders the page for a workspace and says why', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(resolveAgentLayout('workspace', undefined)).toBe('page');
        expect(warn).toHaveBeenCalledOnce();
        expect(warn.mock.calls[0][0]).toContain('not available yet');
    });

    it('warns once, not on every render', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        resolveAgentLayout('workspace', undefined);
        resolveAgentLayout('workspace', undefined);
        resolveAgentLayout('workspace', undefined);
        expect(warn).toHaveBeenCalledOnce();
    });
});
