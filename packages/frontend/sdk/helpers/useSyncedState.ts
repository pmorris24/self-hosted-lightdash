import { useCallback, useRef, useState } from 'react';

/**
 * State that starts from a value a parent owns and follows that value when it
 * changes, but that the component can also set. `onLocalChange` reports only
 * the changes made here, so a parent can keep both sides in step.
 */
export const useSyncedState = <T>(
    syncValue: T,
    onLocalChange?: (value: T) => void,
): [T, (value: T) => void] => {
    const [local, setLocal] = useState(syncValue);
    const lastSynced = useRef(syncValue);
    let value = local;

    // Adjusted during render, which React supports, so no frame shows a
    // stale value and no effect copies a prop into state.
    if (!Object.is(lastSynced.current, syncValue)) {
        lastSynced.current = syncValue;
        value = syncValue;
        setLocal(syncValue);
    }

    const set = useCallback(
        (next: T) => {
            setLocal(next);
            onLocalChange?.(next);
        },
        [onLocalChange],
    );

    return [value, set];
};
