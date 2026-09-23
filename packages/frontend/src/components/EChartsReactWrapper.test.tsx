import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SDK_SCOPE_CLASS } from '../../sdk/styles/scope.json';
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
