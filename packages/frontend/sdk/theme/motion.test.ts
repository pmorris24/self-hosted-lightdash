import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeMotion, withMotion } from './motion';

const option = {
    animation: false,
    series: [{ type: 'bar', animation: false }, { type: 'line' }],
};

const reduceMotion = (reduce: boolean) =>
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({ matches: reduce } as MediaQueryList),
    );

describe('withMotion', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('leaves the option alone when the theme sets no motion', () => {
        expect(withMotion(option, undefined)).toBe(option);
    });

    it('turns animation on for the chart and every series', () => {
        reduceMotion(false);
        const moved = withMotion(option, {
            enter: { duration: 900, easing: 'backOut' },
            update: { duration: 300 },
        });
        expect(moved.animation).toBe(true);
        expect(moved).toMatchObject({
            animationDuration: 900,
            animationEasing: 'backOut',
            animationDurationUpdate: 300,
            animationEasingUpdate: 'cubicInOut',
        });
        expect(moved.series.every((series) => series.animation)).toBe(true);
        expect(moved.series[0]).toMatchObject({ type: 'bar', animationDuration: 900 });
    });

    it('staggers marks from the delay', () => {
        reduceMotion(false);
        const moved = withMotion(option, { enter: { delay: 100, stagger: 40 } }) as {
            animationDelay: (index: number) => number;
        };
        expect(moved.animationDelay(0)).toBe(100);
        expect(moved.animationDelay(3)).toBe(220);
    });

    it('hands back the same delay function for the same theme', () => {
        reduceMotion(false);
        const motion = { enter: { delay: 0, stagger: 40 } };
        const first = withMotion(option, motion) as { animationDelay: unknown };
        const second = withMotion(option, motion) as { animationDelay: unknown };
        expect(second.animationDelay).toBe(first.animationDelay);
    });

    it('keeps charts still when motion is off or the viewer asks for less', () => {
        reduceMotion(false);
        expect(withMotion(option, { enabled: false }).animation).toBe(false);
        reduceMotion(true);
        expect(withMotion(option, { enter: { duration: 900 } }).animation).toBe(false);
        expect(
            withMotion(option, { enter: { duration: 900 }, reducedMotion: 'ignore' }).animation,
        ).toBe(true);
    });
});

describe('mergeMotion', () => {
    it('changes only the keys the inner theme sets', () => {
        expect(
            mergeMotion(
                { enter: { duration: 900, stagger: 40 }, update: { duration: 500 } },
                { enter: { duration: 300 } },
            ),
        ).toEqual({
            enter: { duration: 300, stagger: 40 },
            update: { duration: 500 },
        });
    });
});
