import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SDK_SCOPE_CLASS } from '../../sdk/styles/scope.json';
import { ThemeContext } from '../../sdk/theme/themeContext';
import EChartsReactWrapper from './EChartsReactWrapper';

const capture = vi.hoisted(() => vi.fn());
vi.mock('echarts-for-react', () => ({
    default: (props: unknown) => {
        capture(props);
        return null;
    },
}));

afterEach(() => {
    cleanup();
    capture.mockClear();
});

describe('tooltip container', () => {
    it('uses default chart coordinates in SDK scopes and the body elsewhere', () => {
        const tooltip = { appendToBody: true, confine: true };
        render(<EChartsReactWrapper option={{ tooltip }} />);
        const scoped = capture.mock.lastCall![0].option.tooltip;
        const scope = document.createElement('div');
        scope.className = SDK_SCOPE_CLASS;
        const chart = scope.appendChild(document.createElement('div'));

        expect(scoped.appendToBody).toBe(false);
        // A custom element here breaks SVG tooltip coordinate conversion.
        expect(scoped.appendTo(chart)).toBeNull();
        expect(scoped.appendTo(document.createElement('div'))).toBe(
            document.body,
        );
        expect(scoped.confine).toBe(true);
        expect(tooltip).toEqual({ appendToBody: true, confine: true });
    });

    it('handles each tooltip in an option array', () => {
        render(
            <EChartsReactWrapper
                option={{ tooltip: [{ trigger: 'axis' }, { trigger: 'item' }] }}
            />,
        );
        const tooltips = capture.mock.lastCall![0].option.tooltip;
        expect(
            tooltips.map((tooltip: { trigger: string }) => tooltip.trigger),
        ).toEqual(['axis', 'item']);
        expect(
            tooltips.every(
                (tooltip: { appendToBody: boolean }) =>
                    tooltip.appendToBody === false,
            ),
        ).toBe(true);
    });
});

describe('chart lifecycle', () => {
    it('keeps the same event handlers across renders, calling the latest', () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = render(
            <EChartsReactWrapper option={{}} onEvents={{ click: first }} />,
        );
        const before = capture.mock.lastCall![0].onEvents;
        rerender(
            <EChartsReactWrapper option={{}} onEvents={{ click: second }} />,
        );
        const after = capture.mock.lastCall![0].onEvents;

        // The same object, so echarts-for-react never disposes the chart.
        expect(after).toBe(before);
        after.click('event');
        expect(second).toHaveBeenCalledWith('event');
        expect(first).not.toHaveBeenCalled();
    });

    it('merges new rows into the same series only when the theme sets motion', () => {
        const option = (data: number[]) => ({
            series: [{ type: 'bar', name: 'Revenue', data }],
        });
        const themed = (data: number[]) => (
            <ThemeContext.Provider
                value={{ motion: { enter: { duration: 500 } } }}
            >
                <EChartsReactWrapper option={option(data)} notMerge />
            </ThemeContext.Provider>
        );
        const { rerender } = render(themed([1, 2]));
        expect(capture.mock.lastCall![0].notMerge).toBe(true);
        rerender(themed([3, 4]));
        expect(capture.mock.lastCall![0].notMerge).toBe(false);

        rerender(<EChartsReactWrapper option={option([5, 6])} notMerge />);
        expect(capture.mock.lastCall![0].notMerge).toBe(true);
    });
});

describe('resizing under motion', () => {
    const fakeChart = () => {
        const dom = { clientWidth: 400, clientHeight: 300 };
        const resize = vi.fn();
        return { dom, resize, instance: { getDom: () => dom, resize } };
    };

    it('skips a resize that changes nothing and animates a real one', () => {
        const chart = fakeChart();
        render(
            <ThemeContext.Provider
                value={{ motion: { update: { duration: 250 } } }}
            >
                <EChartsReactWrapper option={{}} />
            </ThemeContext.Provider>,
        );
        capture.mock.lastCall![0].onChartReady(chart.instance);

        chart.instance.resize();
        expect(chart.resize).not.toHaveBeenCalled();

        chart.dom.clientWidth = 600;
        chart.instance.resize();
        expect(chart.resize).toHaveBeenCalledWith({
            animation: { duration: 250, easing: 'cubicInOut' },
        });
    });

    it('resizes as before when the theme sets no motion', () => {
        const chart = fakeChart();
        const onChartReady = vi.fn();
        render(<EChartsReactWrapper option={{}} onChartReady={onChartReady} />);
        capture.mock.lastCall![0].onChartReady(chart.instance);

        chart.instance.resize();
        expect(chart.resize).toHaveBeenCalledTimes(1);
        expect(onChartReady).toHaveBeenCalledWith(chart.instance);
    });
});
