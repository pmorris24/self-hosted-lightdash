import { useCallback } from 'react';
import { type SdkChartSelection } from '../../src/ee/features/embed/EmbedChart/types';
import { type SdkFilter } from '../../src/ee/features/embed/EmbedDashboard/types';

export type JumpToDashboardTarget = {
    dashboardUuid: string;
    // Filters to carry: the clicked values, plus any the caller adds.
    filters: SdkFilter[];
};

type Options = {
    dashboardUuid: string;
    // Filters of the source page to carry along with the clicked values.
    filters?: SdkFilter[];
    // The host navigates: a route change, a modal, a new `Lightdash.Dashboard`.
    onJump: (target: JumpToDashboardTarget) => void;
};

/**
 * A click handler for `Lightdash.Chart` that opens another dashboard with the
 * clicked values as filters. The SDK decides nothing about navigation.
 */
export const useJumpToDashboard = ({
    dashboardUuid,
    filters = [],
    onJump,
}: Options) =>
    useCallback(
        (selection: SdkChartSelection) =>
            onJump({
                dashboardUuid,
                filters: [
                    ...filters.filter(
                        (filter) =>
                            !selection.filters.some(
                                (selected) =>
                                    selected.model === filter.model &&
                                    selected.field === filter.field,
                            ),
                    ),
                    ...selection.filters,
                ],
            }),
        [dashboardUuid, filters, onJump],
    );
