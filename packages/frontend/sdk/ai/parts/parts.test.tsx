import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type AgentMessage } from '../useAgentConversation';
import { AgentSurface, AgentTranscript, agentMarkdown, agentStepLabel } from './index';

const answer: AgentMessage = {
    id: 'a1',
    role: 'assistant',
    text: 'Credit card leads at **$1.24M**.',
    charts: [],
    steps: [
        {
            id: 's1',
            toolName: 'runMetricQuery',
            label: 'Run metric query',
            input: { exploreName: 'payments' },
            output: 'payment_method,total\ncredit_card,1240000',
            isRunning: false,
        },
    ],
    isStreaming: false,
    isStopped: false,
};

describe('agent parts', () => {
    it('shows the work behind an answer: the step, its request and its result', () => {
        const { container } = render(
            <AgentSurface>
                <AgentTranscript messages={[answer]} />
            </AgentSurface>,
        );

        expect(container.querySelector('.ld-agent-row__label')?.textContent).toBe(
            'Run metric query',
        );
        const io = [...container.querySelectorAll('.ld-agent-io__row')].map(
            (row) => row.textContent,
        );
        expect(io[0]).toContain('"exploreName"');
        expect(io[1]).toContain('credit_card,1240000');
        expect(container.querySelector('.ld-agent-markdown')?.innerHTML).toContain(
            '<strong>$1.24M</strong>',
        );
    });

    it('puts the theme on the surface, for every part inside it', () => {
        const { container } = render(
            <AgentSurface styleOptions={{ accentColor: '#16A394', borderRadius: 2 }}>
                <AgentTranscript messages={[]} />
            </AgentSurface>,
        );

        const surface = container.querySelector<HTMLElement>('.ld-agent-surface');
        expect(
            surface?.style.getPropertyValue('--lightdash-agent-accent-color'),
        ).toBe('#16A394');
        expect(
            surface?.style.getPropertyValue('--lightdash-agent-border-radius'),
        ).toBe('2px');
    });

    it('hides the work when a page asks for the answer alone', () => {
        const { container } = render(
            <AgentSurface>
                <AgentTranscript messages={[answer]} showSteps={false} />
            </AgentSurface>,
        );

        expect(container.querySelector('.ld-agent-io')).toBeNull();
        expect(container.querySelector('.ld-agent-markdown')).toBeTruthy();
    });

    it('escapes an answer rather than letting it write HTML', () => {
        expect(agentMarkdown('<img src=x onerror=alert(1)>')).not.toContain(
            '<img',
        );
    });

    it('reads a tool name as words', () => {
        expect(
            agentStepLabel({
                id: '1',
                toolName: 'generateBarVizConfig',
                label: '',
                input: null,
                output: null,
                isRunning: false,
            }),
        ).toBe('Generate bar viz config');
    });
});
