import { useEffect, useRef } from 'react';

export type AgentThreadChange = (options: {
    threadUuid: string | null;
}) => void;

/**
 * Tells the host which thread the viewer is in, and `null` once they leave
 * one for a new conversation, so a host holding the thread in state can
 * follow along rather than pinning the viewer to the thread it first saw.
 *
 * Nothing is reported before the first thread: a viewer who has not started
 * one has not left one either.
 */
export const useReportedThread = (
    threadUuid: string | null | undefined,
    onThreadChange: AgentThreadChange,
): void => {
    const reportedRef = useRef<string | null | undefined>(undefined);
    const callbackRef = useRef(onThreadChange);
    callbackRef.current = onThreadChange;

    useEffect(() => {
        const current = threadUuid ?? null;
        if (reportedRef.current === current) return;
        if (current === null && reportedRef.current === undefined) return;
        reportedRef.current = current;
        callbackRef.current({ threadUuid: current });
    }, [threadUuid]);
};
