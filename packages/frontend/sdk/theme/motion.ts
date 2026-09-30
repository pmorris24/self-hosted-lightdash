// Easing curves the chart renderer knows by name.
export type MotionEasing =
    | 'linear'
    | 'quadraticOut'
    | 'cubicOut'
    | 'cubicInOut'
    | 'quarticOut'
    | 'quinticOut'
    | 'exponentialOut'
    | 'circularOut'
    | 'backOut'
    | 'elasticOut'
    | 'bounceOut';

/**
 * How Lightdash charts move. Leave it out and charts draw still, as they
 * always have. A duration or delay is in milliseconds.
 */
export type LightdashMotion = {
    /** `false` keeps every chart still, whatever else is set. */
    enabled?: boolean;
    /** The first time a chart draws. */
    enter?: {
        duration?: number;
        easing?: MotionEasing;
        /** Wait before the first mark moves. */
        delay?: number;
        /** Extra wait for each mark after the first, so they arrive in turn. */
        stagger?: number;
    };
    /**
     * When the rows under a chart change — a filter, a new date range — the
     * marks travel from their old values to the new ones.
     */
    update?: {
        duration?: number;
        easing?: MotionEasing;
    };
    /**
     * Pointing at a mark: the others fade back and the one under the pointer
     * lifts, a slice out from the pie and a bar or point with a shadow.
     */
    hover?: {
        /** How far the other marks fade, from 0 (gone) to 1 (not at all). */
        dim?: number;
        /** How far the mark lifts, in pixels. */
        lift?: number;
        /** How long the fade and lift take. */
        duration?: number;
    };
    /**
     * `respect`, the default, keeps charts still for a viewer whose system
     * asks for less motion. `ignore` animates regardless.
     */
    reducedMotion?: 'respect' | 'ignore';
};

const ENTER_DURATION = 800;
const UPDATE_DURATION = 500;

/** A nested provider changes only the motion keys it sets. */
export const mergeMotion = (
    base?: LightdashMotion,
    override?: LightdashMotion,
): LightdashMotion | undefined => {
    if (!base) return override;
    if (!override) return base;
    return {
        ...base,
        ...override,
        enter: { ...base.enter, ...override.enter },
        update: { ...base.update, ...override.update },
        ...(base.hover || override.hover
            ? { hover: { ...base.hover, ...override.hover } }
            : {}),
    };
};

// One delay function per delay and stagger, so a chart that renders again
// with the same theme hands the renderer an equal option and nothing restarts.
const staggers = new Map<string, (index: number) => number>();
const staggered = (delay: number, stagger: number) => {
    const key = `${delay}:${stagger}`;
    let delayOf = staggers.get(key);
    if (!delayOf) {
        delayOf = (index: number) => delay + index * stagger;
        staggers.set(key, delayOf);
    }
    return delayOf;
};

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Series = {
    type?: string;
    emphasis?: Record<string, unknown> & { itemStyle?: object };
    blur?: Record<string, unknown> & {
        itemStyle?: object;
        lineStyle?: object;
        areaStyle?: object;
    };
};

// The hover states of one series: the rest blur back, the mark lifts.
const withHover = (series: Series, hover: LightdashMotion['hover']) => {
    if (!hover) return {};
    const lift = hover.lift ?? 8;
    const opacity = hover.dim ?? 0.3;
    const isPie = series.type === 'pie';
    return {
        emphasis: {
            ...series.emphasis,
            // A line highlights as a whole; bars and slices one at a time.
            focus: series.type === 'line' ? 'series' : 'self',
            ...(isPie ? { scale: true, scaleSize: lift } : {}),
            itemStyle: {
                ...series.emphasis?.itemStyle,
                shadowBlur: lift * 2,
                shadowOffsetY: isPie ? 0 : lift / 2,
                shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
        },
        blur: {
            ...series.blur,
            itemStyle: { ...series.blur?.itemStyle, opacity },
            lineStyle: { ...series.blur?.lineStyle, opacity },
            areaStyle: { ...series.blur?.areaStyle, opacity: opacity / 2 },
        },
        stateAnimation: {
            duration: hover.duration ?? 250,
            easing: 'cubicOut',
        },
    };
};

/**
 * Lays a theme's motion over a chart option. The renderer draws SDK charts
 * without animation; a theme that sets motion turns it on and shapes it, for
 * every chart type at once. No motion in the theme leaves the option as it was.
 */
export const withMotion = <T>(option: T, motion?: LightdashMotion): T => {
    if (!motion || !option || typeof option !== 'object') return option;
    const still =
        motion.enabled === false ||
        (motion.reducedMotion !== 'ignore' && prefersReducedMotion());
    if (still) return { ...option, animation: false };

    const { enter = {}, update = {} } = motion;
    const delay = enter.delay ?? 0;
    const stagger = enter.stagger ?? 0;
    const settings = {
        animation: true,
        animationDuration: enter.duration ?? ENTER_DURATION,
        animationEasing: enter.easing ?? 'cubicOut',
        animationDelay: stagger ? staggered(delay, stagger) : delay,
        animationDurationUpdate: update.duration ?? UPDATE_DURATION,
        animationEasingUpdate: update.easing ?? 'cubicInOut',
    };
    // Series carry their own animation switches, which win over the chart's,
    // so the theme's settings go on each of them too.
    const onSeries = (series: unknown) =>
        series && typeof series === 'object'
            ? {
                  ...series,
                  ...settings,
                  ...withHover(series as Series, motion.hover),
              }
            : series;
    const { series } = option as { series?: unknown };
    return {
        ...option,
        ...settings,
        ...(series === undefined
            ? {}
            : {
                  series: Array.isArray(series)
                      ? series.map(onSeries)
                      : onSeries(series),
              }),
    };
};
