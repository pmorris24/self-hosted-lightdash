export type GradientStop = { position: number; color: string };

type GradientDirection = { x1: number; y1: number; x2: number; y2: number };

export type LinearGradient = {
    type: 'linear';
    x: number;
    y: number;
    x2: number;
    y2: number;
    colorStops: { offset: number; color: string }[];
};

export type RadialGradient = {
    type: 'radial';
    x: number;
    y: number;
    r: number;
    colorStops: { offset: number; color: string }[];
};

export type Gradient = LinearGradient | RadialGradient;

export const GradientDirections = {
    topToBottom: { x1: 0, y1: 0, x2: 0, y2: 1 },
    bottomToTop: { x1: 0, y1: 1, x2: 0, y2: 0 },
    leftToRight: { x1: 0, y1: 0, x2: 1, y2: 0 },
    rightToLeft: { x1: 1, y1: 0, x2: 0, y2: 0 },
    diagonal: { x1: 0, y1: 0, x2: 1, y2: 1 },
} as const satisfies Record<string, GradientDirection>;

const toColorStops = (stops: GradientStop[]) =>
    [...stops]
        .sort((a, b) => a.position - b.position)
        .map((stop) => ({
            offset: Math.min(1, Math.max(0, stop.position)),
            color: stop.color,
        }));

// Positions run from 0 to 1. The result is an ECharts colour value.
export const createLinearGradient = (
    direction: GradientDirection,
    stops: GradientStop[],
): LinearGradient => ({
    type: 'linear',
    x: direction.x1,
    y: direction.y1,
    x2: direction.x2,
    y2: direction.y2,
    colorStops: toColorStops(stops),
});

export const createRadialGradient = (
    center: { x: number; y: number; radius: number },
    stops: GradientStop[],
): RadialGradient => ({
    type: 'radial',
    x: center.x,
    y: center.y,
    r: center.radius,
    colorStops: toColorStops(stops),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const isLinearGradient = (value: unknown): value is LinearGradient =>
    isRecord(value) && value.type === 'linear' && Array.isArray(value.colorStops);

export const isRadialGradient = (value: unknown): value is RadialGradient =>
    isRecord(value) && value.type === 'radial' && Array.isArray(value.colorStops);

export const isGradient = (value: unknown): value is Gradient =>
    isLinearGradient(value) || isRadialGradient(value);
