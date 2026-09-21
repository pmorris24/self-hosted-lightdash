import {
    startTransition,
    useCallback,
    useMemo,
    useReducer,
    type FC,
    type ReactNode,
} from 'react';
import { PreviewQueueContext, type PreviewQueue } from './context';

// Each live preview runs a warehouse query, so only a few run at once.
const MAX_RUNNING_PREVIEWS = 4;

type State = {
    granted: ReadonlySet<string>;
    running: string[];
    waiting: string[];
    isPaused: boolean;
};

type Action =
    | { type: 'request' | 'release' | 'revoke'; id: string }
    | { type: 'setPaused'; isPaused: boolean };

const promoteWaiting = (state: State): State => {
    const free = MAX_RUNNING_PREVIEWS - state.running.length;
    if (state.isPaused || free <= 0 || state.waiting.length === 0) {
        return state;
    }
    const promoted = state.waiting.slice(0, free);
    return {
        ...state,
        granted: new Set([...state.granted, ...promoted]),
        running: [...state.running, ...promoted],
        waiting: state.waiting.slice(free),
    };
};

const reducer = (state: State, action: Action): State => {
    if (action.type === 'setPaused') {
        if (state.isPaused === action.isPaused) return state;
        return promoteWaiting({ ...state, isPaused: action.isPaused });
    }
    const { type, id } = action;
    if (type === 'request') {
        if (state.granted.has(id) || state.waiting.includes(id)) return state;
        return promoteWaiting({ ...state, waiting: [...state.waiting, id] });
    }
    const isQueued = state.running.includes(id) || state.waiting.includes(id);
    if (!isQueued && !(type === 'revoke' && state.granted.has(id))) {
        return state;
    }
    return promoteWaiting({
        ...state,
        granted:
            type === 'revoke'
                ? new Set([...state.granted].filter((g) => g !== id))
                : state.granted,
        running: state.running.filter((runningId) => runningId !== id),
        waiting: state.waiting.filter((waitingId) => waitingId !== id),
    });
};

const initialState: State = {
    granted: new Set(),
    running: [],
    waiting: [],
    isPaused: false,
};

export const PreviewQueueProvider: FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    // Mounting a preview is heavy. As a transition React can interrupt it, so
    // scrolling and clicks stay responsive while previews fill in.
    const request = useCallback(
        (id: string) =>
            startTransition(() => dispatch({ type: 'request', id })),
        [],
    );
    const release = useCallback(
        (id: string) =>
            startTransition(() => dispatch({ type: 'release', id })),
        [],
    );
    const revoke = useCallback(
        (id: string) => dispatch({ type: 'revoke', id }),
        [],
    );
    // Pausing must land at once; resuming mounts previews, so it can wait
    const setPaused = useCallback((isPaused: boolean) => {
        if (isPaused) dispatch({ type: 'setPaused', isPaused });
        else startTransition(() => dispatch({ type: 'setPaused', isPaused }));
    }, []);
    const queue = useMemo<PreviewQueue>(
        () => ({
            granted: state.granted,
            request,
            release,
            revoke,
            setPaused,
        }),
        [state.granted, request, release, revoke, setPaused],
    );

    return (
        <PreviewQueueContext.Provider value={queue}>
            {children}
        </PreviewQueueContext.Provider>
    );
};
