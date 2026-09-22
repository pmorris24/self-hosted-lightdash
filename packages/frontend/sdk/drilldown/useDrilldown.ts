import { useCallback, useMemo, useState } from 'react';

export type DrilldownStep = {
    // The dimension the viewer clicked in, and the value they picked.
    dimension: string;
    value: string | number | boolean | null;
};

export type DrilldownFilter = {
    field: string;
    operator: 'equals';
    value: DrilldownStep['value'];
};

export type UseDrilldownOptions = {
    // Dimensions to drill through, from the widest to the narrowest.
    paths: string[];
    onChange?: (state: { dimension: string; steps: DrilldownStep[] }) => void;
};

export type UseDrilldownResult = {
    // The dimension to group by at the current level.
    dimension: string;
    level: number;
    // The picks so far, one per level above the current one.
    steps: DrilldownStep[];
    // The same picks as `equals` filters, for the query of the current level.
    filters: DrilldownFilter[];
    canDrill: boolean;
    // Pick a value at the current level and go one level down.
    drill: (value: DrilldownStep['value']) => void;
    // Go back up to a level. Level 0 is the top.
    goTo: (level: number) => void;
    reset: () => void;
};

/**
 * Keeps the state of a drill down: which dimension to group by, and which
 * values the viewer picked on the way. The caller runs the query and draws it.
 */
export const useDrilldown = ({
    paths,
    onChange,
}: UseDrilldownOptions): UseDrilldownResult => {
    if (paths.length === 0) {
        throw new Error('Lightdash SDK: useDrilldown needs at least one path.');
    }
    const [steps, setSteps] = useState<DrilldownStep[]>([]);
    const level = Math.min(steps.length, paths.length - 1);
    const dimension = paths[level];
    const canDrill = steps.length < paths.length - 1;

    const update = useCallback(
        (next: DrilldownStep[]) => {
            setSteps(next);
            onChange?.({
                dimension: paths[Math.min(next.length, paths.length - 1)],
                steps: next,
            });
        },
        [onChange, paths],
    );

    const drill = useCallback(
        (value: DrilldownStep['value']) => {
            if (!canDrill) return;
            update([...steps, { dimension, value }]);
        },
        [canDrill, dimension, steps, update],
    );
    const goTo = useCallback(
        (target: number) =>
            update(steps.slice(0, Math.max(0, Math.min(target, steps.length)))),
        [steps, update],
    );
    const reset = useCallback(() => update([]), [update]);

    const filters = useMemo<DrilldownFilter[]>(
        () =>
            steps.map((step) => ({
                field: step.dimension,
                operator: 'equals',
                value: step.value,
            })),
        [steps],
    );

    return { dimension, level, steps, filters, canDrill, drill, goTo, reset };
};
