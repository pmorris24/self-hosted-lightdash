import { createContext, useContext } from 'react';

export type PreviewQueue = {
    // Ids allowed to mount their preview
    granted: ReadonlySet<string>;
    request: (id: string) => void;
    // The preview has settled: frees its slot, and it stays mounted.
    release: (id: string) => void;
    // The card unmounted: frees its slot and its grant, so it queues again.
    revoke: (id: string) => void;
    // While paused nothing new is granted. The grid pauses during a scroll, so
    // mounting previews never competes with the scroll itself.
    setPaused: (isPaused: boolean) => void;
};

export const PreviewQueueContext = createContext<PreviewQueue | null>(null);

export const usePreviewQueue = (): PreviewQueue => {
    const queue = useContext(PreviewQueueContext);
    if (!queue) {
        throw new Error(
            'usePreviewQueue must be used inside PreviewQueueProvider',
        );
    }
    return queue;
};
