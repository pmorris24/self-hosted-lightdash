import type EChartsReactClass from 'echarts-for-react';
import type { EChartsInstance } from 'echarts-for-react';
import EChartsReact from 'echarts-for-react';
import {
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import { SDK_SCOPE_CLASS } from '../../sdk/styles/scope.json';
import { withMotion } from '../../sdk/theme/motion';
import { ThemeContext } from '../../sdk/theme/themeContext';

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
type ResizeOptions = {
    width?: number | string;
    height?: number | string;
    silent?: boolean;
    animation?: { duration?: number; easing?: string };
};

type Handlers = NonNullable<
    React.ComponentProps<typeof EChartsReactClass>['onEvents']
>;

// The series a chart draws, by type and name: when it is the same as last
// time, new rows can move the marks instead of redrawing them.
const seriesShape = (option: unknown) => {
    const { series } = (option ?? {}) as { series?: unknown };
    const list = Array.isArray(series) ? series : [series];
    return JSON.stringify(
        list.map((item) => {
            const { type, id, name, stack } = (item ?? {}) as Record<
                string,
                unknown
            >;
            return [type, id ?? name, stack];
        }),
    );
};

const EChartsReactWrapper = forwardRef<
    EChartsReactClass,
    React.ComponentProps<typeof EChartsReactClass>
>((props, ref) => {
    // Inside an SDK ThemeProvider, the theme's motion shapes the animation;
    // elsewhere the context is empty and the option is left as it is.
    const { motion } = useContext(ThemeContext);
    const option = useMemo(
        () => withMotion(withScopedTooltip(props.option), motion),
        [props.option, motion],
    );

    // echarts-for-react disposes and rebuilds the whole chart whenever
    // `onEvents` is not deep-equal to the last one, and handlers are new
    // functions on most renders. Hand it one stable handler per event that
    // calls the latest one, so a chart is only built once.
    const handlers = useRef<Handlers | undefined>(props.onEvents);
    useLayoutEffect(() => {
        handlers.current = props.onEvents;
    });
    const eventNames = Object.keys(props.onEvents ?? {}).join(',');
    const onEvents = useMemo<Handlers | undefined>(
        () =>
            eventNames
                ? Object.fromEntries(
                      eventNames
                          .split(',')
                          .map((name) => [
                              name,
                              (...args: unknown[]) =>
                                  (
                                      handlers.current?.[name] as
                                          | ((...values: unknown[]) => unknown)
                                          | undefined
                                  )?.(...args),
                          ]),
                  )
                : undefined,
        [eventNames],
    );

    // With motion on and the same series as last time, merge the new option
    // so the marks travel to their new values; otherwise replace as asked.
    const shape = seriesShape(option);
    const lastShape = useRef<string | undefined>(undefined);
    useEffect(() => {
        lastShape.current = shape;
    });
    const morph =
        !!motion && motion.enabled !== false && lastShape.current === shape;

    // A chart's own resize observer calls `resize()` as soon as it starts,
    // before anything has changed, and a resize finishes every animation at
    // once. With motion on, a resize that leaves the size as it was is
    // skipped, and a real one moves with the theme rather than jumping.
    const motionRef = useRef(motion);
    useLayoutEffect(() => {
        motionRef.current = motion;
    });
    const { onChartReady } = props;
    const readyRef = useRef(onChartReady);
    useLayoutEffect(() => {
        readyRef.current = onChartReady;
    });
    const handleChartReady = useCallback((instance: EChartsInstance) => {
        const resize: (opts?: ResizeOptions) => void =
            instance.resize.bind(instance);
        const sizeOf = () => {
            const dom = instance.getDom();
            return `${dom.clientWidth}x${dom.clientHeight}`;
        };
        let lastSize = sizeOf();
        instance.resize = (opts?: ResizeOptions) => {
            const current = motionRef.current;
            const size = sizeOf();
            if (!current || current.enabled === false) {
                lastSize = size;
                return resize(opts);
            }
            if (size === lastSize && !opts?.width && !opts?.height) return;
            lastSize = size;
            return resize({
                animation: {
                    duration: current.update?.duration ?? 500,
                    easing: current.update?.easing ?? 'cubicInOut',
                },
                ...opts,
            });
        };
        readyRef.current?.(instance);
    }, []);

    return (
        <EChartsReact
            {...props}
            option={option}
            onEvents={onEvents}
            onChartReady={handleChartReady}
            notMerge={morph ? false : props.notMerge}
            ref={ref as any}
        />
    );
});

EChartsReactWrapper.displayName = 'EChartsReactWrapper';

export default EChartsReactWrapper;

export type { default as EChartsReact } from 'echarts-for-react';

export type {
    EChartsInstance,
    EChartsOption,
    EChartsReactProps,
} from 'echarts-for-react';
