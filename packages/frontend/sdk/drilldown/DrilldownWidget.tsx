import { type FC, type ReactNode } from 'react';
import { DrilldownBreadcrumbs } from './DrilldownBreadcrumbs';
import {
    useDrilldown,
    type UseDrilldownOptions,
    type UseDrilldownResult,
} from './useDrilldown';

type Props = UseDrilldownOptions & {
    labels?: Record<string, string>;
    // Draw the chart of the current level. Call `drill(value)` on a click.
    children: (drilldown: UseDrilldownResult) => ReactNode;
};

/** Drill-down state plus breadcrumbs, around a chart the caller draws. */
export const DrilldownWidget: FC<Props> = ({
    paths,
    onChange,
    labels,
    children,
}) => {
    const drilldown = useDrilldown({ paths, onChange });
    return (
        <div
            data-lightdash-drilldown-widget=""
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                height: '100%',
            }}
        >
            <DrilldownBreadcrumbs
                steps={drilldown.steps}
                currentDimension={drilldown.dimension}
                labels={labels}
                onSelect={drilldown.goTo}
            />
            <div style={{ flex: 1, minHeight: 0 }}>{children(drilldown)}</div>
        </div>
    );
};
