import { type AgentLayout } from './AgentChat';

/**
 * Which agent surface a host asked for. `panel` is the compact agent beside a
 * dashboard, `page` is the conversation without the application shell, and
 * `workspace` is the whole native workspace including thread navigation.
 */
export type AiAgentSurface = 'panel' | 'page' | 'workspace';

const warned = new Set<string>();

export const warnOnce = (message: string): void => {
    if (warned.has(message) || process.env.NODE_ENV === 'production') return;
    warned.add(message);
    // eslint-disable-next-line no-console
    console.warn(`[@lightdash/sdk] ${message}`);
};

/** Test seam: the warnings are once per process, which a test has to reset. */
export const resetSurfaceWarnings = (): void => warned.clear();

const LAYOUT_DEPRECATED =
    '`layout` on AiAgent is deprecated. Use `surface` instead: layout="panel" is surface="panel", layout="page" is surface="page".';

/**
 * `surface` is what a host writes now; `layout` is the older name for the
 * same thing and wins nothing when both are given.
 */
export const resolveAgentLayout = (
    surface: AiAgentSurface | undefined,
    layout: AgentLayout | undefined,
): AgentLayout => {
    if (surface === undefined) {
        if (layout !== undefined) warnOnce(LAYOUT_DEPRECATED);
        return layout ?? 'panel';
    }
    return surface;
};
