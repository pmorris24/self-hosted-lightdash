import { FilterOperator } from '@lightdash/common';
import { type SdkFilter } from '../EmbedDashboard/types';

// Messages a host page sends to a framed embed. The reverse direction is
// `LightdashUiEvent`.
const FRAME_COMMAND_NAMESPACE = 'lightdash:command:';

export type EmbedFrameTheme = 'light' | 'dark';

export type EmbedFrameState = {
    // `null` until the host sends a value: the URL and the token decide.
    filters: SdkFilter[] | null;
    theme: EmbedFrameTheme | null;
};

export type EmbedFrameCommand =
    | { type: 'setFilters'; filters: SdkFilter[] }
    | { type: 'setTheme'; theme: EmbedFrameTheme };

const operators = new Set<string>(Object.values(FilterOperator));

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isSdkFilter = (value: unknown): value is SdkFilter =>
    isRecord(value) &&
    typeof value.model === 'string' &&
    typeof value.field === 'string' &&
    typeof value.operator === 'string' &&
    operators.has(value.operator);

// Message data comes from another origin, so nothing about it is trusted.
export const parseFrameCommand = (data: unknown): EmbedFrameCommand | null => {
    if (!isRecord(data) || typeof data.type !== 'string') return null;
    if (!data.type.startsWith(FRAME_COMMAND_NAMESPACE)) return null;
    const payload = isRecord(data.payload) ? data.payload : {};

    switch (data.type.slice(FRAME_COMMAND_NAMESPACE.length)) {
        case 'setFilters':
            return Array.isArray(payload.filters) &&
                payload.filters.every(isSdkFilter)
                ? { type: 'setFilters', filters: payload.filters }
                : null;
        case 'setTheme':
            return payload.theme === 'light' || payload.theme === 'dark'
                ? { type: 'setTheme', theme: payload.theme }
                : null;
        default:
            return null;
    }
};

let state: EmbedFrameState = { filters: null, theme: null };
const listeners = new Set<() => void>();

export const getEmbedFrameState = (): EmbedFrameState => state;

export const subscribeToEmbedFrameState = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const applyFrameCommand = (command: EmbedFrameCommand): void => {
    state =
        command.type === 'setFilters'
            ? { ...state, filters: command.filters }
            : { ...state, theme: command.theme };
    listeners.forEach((listener) => listener());
};

export const resetEmbedFrameState = (): void => {
    state = { filters: null, theme: null };
    listeners.forEach((listener) => listener());
};
