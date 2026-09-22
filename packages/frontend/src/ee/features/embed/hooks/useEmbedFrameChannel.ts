import { useEffect, useSyncExternalStore } from 'react';
import useHealth from '../../../../hooks/health/useHealth';
import {
    applyFrameCommand,
    getEmbedFrameState,
    parseFrameCommand,
    subscribeToEmbedFrameState,
    type EmbedFrameState,
} from '../events/frameChannel';
import { LightdashUiEvent } from '../events/LightdashUiEvent';

export const useEmbedFrameState = (): EmbedFrameState =>
    useSyncExternalStore(subscribeToEmbedFrameState, getEmbedFrameState);

/**
 * Lets the page that frames this embed send commands. Only the parent window
 * may send them, and only from the origin it declared and the instance allows.
 */
export const useEmbedFrameChannel = (enabled: boolean): void => {
    const { data: health } = useHealth();
    const events = health?.embedding?.events;
    const allowedOrigins = events?.allowedOrigins;
    const isOn = enabled && !!events?.enabled && !!events.enablePostMessage;

    useEffect(() => {
        if (!isOn || !allowedOrigins || window.parent === window) {
            return undefined;
        }
        const targetOrigin = LightdashUiEvent.getTargetOriginFromUrl();
        if (!targetOrigin || !allowedOrigins.includes(targetOrigin)) {
            return undefined;
        }

        const onMessage = (event: MessageEvent) => {
            if (event.source !== window.parent) return;
            if (event.origin !== targetOrigin) return;
            const command = parseFrameCommand(event.data);
            if (command) applyFrameCommand(command);
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [isOn, allowedOrigins]);
};
