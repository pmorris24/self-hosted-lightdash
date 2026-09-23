import type EChartsReactClass from 'echarts-for-react';
import EChartsReact from 'echarts-for-react';
import { forwardRef, useMemo } from 'react';
import { SDK_SCOPE_CLASS } from '../../sdk/styles/scope.json';

/**
 * ECharts puts its tooltip in the document body. The colours it reads are
 * Mantine variables, and in an SDK embed those are declared on the SDK's own
 * root rather than on the page, so a tooltip in the body falls back to the
 * light values and shows up white on a dark page. Inside the SDK the tooltip
 * uses ECharts' default chart container, where the variables resolve and
 * the scheme follows the page; everywhere else it still goes to the body.
 * Returning the chart element as a custom appendTo target triggers coordinate
 * conversion through the SVG viewport, which cannot resolve HTML markers.
 * No custom target also lets ECharts establish the positioning context.
 *
 * `appendToBody` has to go with it: ECharts reads that first and ignores
 * `appendTo` whenever it is set.
 */
const tooltipContainer = (container: HTMLElement) =>
    container.closest(`.${SDK_SCOPE_CLASS}`) ? null : document.body;

const withScopedTooltip = <T extends { tooltip?: unknown }>(option: T): T => {
    if (!option || typeof option !== 'object' || !option.tooltip) return option;
    const scoped = (tooltip: unknown) =>
        typeof tooltip === 'object' && tooltip !== null
            ? { ...tooltip, appendToBody: false, appendTo: tooltipContainer }
            : tooltip;
    return {
        ...option,
        tooltip: Array.isArray(option.tooltip)
            ? option.tooltip.map(scoped)
            : scoped(option.tooltip),
    };
};

/**
 * Usage:
 * ```tsx
 * import EChartsReact from './components/EChartsReactWrapper';
 *
 * <EChartsReact option={chartOption} />
 * ```
 */
const EChartsReactWrapper = forwardRef<
    EChartsReactClass,
    React.ComponentProps<typeof EChartsReactClass>
>((props, ref) => {
    const option = useMemo(
        () => withScopedTooltip(props.option),
        [props.option],
    );
    return <EChartsReact {...props} option={option} ref={ref as any} />;
});

EChartsReactWrapper.displayName = 'EChartsReactWrapper';

export default EChartsReactWrapper;

export type { default as EChartsReact } from 'echarts-for-react';

export type {
    EChartsInstance,
    EChartsOption,
    EChartsReactProps,
} from 'echarts-for-react';
