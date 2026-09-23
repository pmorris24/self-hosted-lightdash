/**
 * Embedded surfaces that expose a public class contract. Every contract class
 * is scoped to one of these. Add a surface here before using it in a classname.
 */
type EmbedSurface = 'dashboard' | 'sdk' | 'agent';

/**
 * Public CSS class contract for embedded dashboards.
 *
 * Each entry is a STABLE classname that embedding customers target to override
 * styles. This is a public API: once a name ships, renaming or removing it
 * breaks customer stylesheets. Add new names freely; treat every existing one
 * as frozen.
 *
 * Convention: ld-[surface]-[element], where [surface] is the embedded surface the
 * customer sees (dashboard), NOT the React component. Apply only on embed-owned
 * wrappers, or — for portalled dropdowns — via the rendering component's
 * `classNames={{ dropdown }}`. Never apply inside a shared component
 * unconditionally, or the class leaks outside embeds.
 */
export const EMBED_CLASS_CONTRACT = [
    'ld-dashboard-header',
    'ld-dashboard-filters',
    'ld-dashboard-filter', // each filter pill
    'ld-dashboard-add-filter',
    'ld-dashboard-date-zoom',
    'ld-dashboard-parameters',
    'ld-dashboard-parameter', // each parameter pill
    'ld-dashboard-filter-dropdown', // portalled
    'ld-dashboard-add-filter-dropdown', // portalled
    'ld-dashboard-date-zoom-dropdown', // portalled
    'ld-dashboard-parameter-dropdown', // portalled
    'ld-dashboard-guided-setup', // modal shown while filter rules are unmet (portalled)
    'ld-dashboard-export-all', // dashboard-level "Export all" (CSV/XLSX ZIP) button
    'ld-sdk-root', // inline container the React SDK renders into
    'ld-sdk-portal', // body-level container for the SDK's dropdowns, modals and notifications
    // The AI agent's conversation. These sit on shared chat components, so
    // they are present in the app too; only the SDK's own stylesheet styles
    // them, and only under `ld-agent-root`.
    'ld-agent-root', // container the SDK renders the agent into
    'ld-agent-workspace', // the conversation and its side panels
    'ld-agent-thread', // the scrolling conversation
    'ld-agent-messages', // the column the messages are laid out in
    'ld-agent-message-list', // the messages themselves, one under the other
    'ld-agent-user-message', // one question
    'ld-agent-answer', // one answer, its tool work included
    'ld-agent-chart', // a chart the agent made, rendered in the conversation
    'ld-agent-composer', // the box a viewer types in
    'ld-agent-suggestion', // one suggested question
] as const satisfies readonly `ld-${EmbedSurface}-${string}`[];

export type EmbedContractClassName = (typeof EMBED_CLASS_CONTRACT)[number];

type ClassValue = string | false | null | undefined;

/**
 * Joins a stable public classname with the internal (hashed) CSS-module classes
 * that own the styling. The public class is frozen across builds; the module
 * classes are free to change.
 *
 *   className={embedContractClass('ld-dashboard-header', styles.headerBar)}
 */
export const embedContractClass = (
    name: EmbedContractClassName,
    ...moduleClasses: ClassValue[]
): string => [name, ...moduleClasses].filter(Boolean).join(' ');
