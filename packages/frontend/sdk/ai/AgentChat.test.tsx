import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { openPanel } from '../../src/ee/features/aiCopilot/store/aiAgentLauncherSlice';
import {
    useAiAgentStoreDispatch,
    useAiAgentStoreSelector,
} from '../../src/ee/features/aiCopilot/store/hooks';
import { AgentChat } from './AgentChat';

vi.mock('../theme/themeContext', () => ({ useLightdashTheme: () => ({}) }));
vi.mock(
    '../../src/ee/features/aiCopilot/components/Launcher/LauncherDockProvider',
    () => ({
        LauncherDockProvider: ({ children }: { children: React.ReactNode }) =>
            children,
    }),
);
vi.mock(
    '../../src/ee/features/aiCopilot/components/PendingPromptContext/PendingPromptContext',
    () => ({
        PendingPromptProvider: ({ children }: { children: React.ReactNode }) =>
            children,
    }),
);
vi.mock(
    '../../src/ee/features/aiCopilot/streaming/AiAgentThreadStreamAbortControllerContextProvider',
    () => ({
        AiAgentThreadStreamAbortControllerContextProvider: ({
            children,
        }: {
            children: React.ReactNode;
        }) => children,
    }),
);
vi.mock('../../src/ee/pages/AiAgents/AgentPage', () => ({
    default: () => null,
}));
vi.mock('../../src/ee/pages/AiAgents/AgentThreadPage', () => ({
    default: () => null,
}));
vi.mock('../../src/ee/pages/AiAgents/AiAgentNewThreadPage', () => ({
    default: () => null,
}));
vi.mock('../../src/ee/pages/AiAgents/AiAgentsNotAuthorizedPage', () => ({
    default: () => null,
}));
vi.mock('../../src/ee/pages/AiAgents/EmbeddedAgentPanel', () => ({
    EmbeddedAgentPanel: ({ agentUuid }: { agentUuid: string }) => {
        const thread = useAiAgentStoreSelector(
            (state) => state.aiAgentLauncher.activeThreadId,
        );
        const dispatch = useAiAgentStoreDispatch();
        return (
            <button
                onClick={() =>
                    dispatch(openPanel({ agentUuid, threadId: 'new-thread' }))
                }
            >
                {agentUuid}: {thread ?? 'empty'}
            </button>
        );
    },
}));

const panel = (agentUuid: string, threadUuid?: string) => (
    <AgentChat
        projectUuid="project"
        agentUuid={agentUuid}
        threadUuid={threadUuid}
        layout="panel"
    />
);

describe('embedded agent conversations', () => {
    it('enables theme overrides only when the host supplies a theme', () => {
        const { container, rerender } = render(panel('agent'), {
            wrapper: MemoryRouter,
        });
        expect(container.querySelector('[data-agent-themed]')).toBeNull();
        rerender(
            <AgentChat
                projectUuid="project"
                agentUuid="agent"
                layout="panel"
                styleOptions={{ accentColor: '#5E4CFF' }}
            />,
        );
        expect(container.querySelector('[data-agent-themed]')).not.toBeNull();
        rerender(panel('agent'));
        expect(container.querySelector('[data-agent-themed]')).toBeNull();
    });

    it('opens the supplied thread and follows thread changes', () => {
        const { rerender } = render(panel('agent', 'thread-one'), {
            wrapper: MemoryRouter,
        });
        expect(screen.getByText('agent: thread-one')).toBeInTheDocument();
        rerender(panel('agent', 'thread-two'));
        expect(screen.getByText('agent: thread-two')).toBeInTheDocument();
        rerender(panel('agent'));
        expect(screen.getByText('agent: empty')).toBeInTheDocument();
    });

    it('keeps separate embedded panels isolated', () => {
        render(
            <>
                {panel('first', 'one')}
                {panel('second', 'two')}
            </>,
            { wrapper: MemoryRouter },
        );
        fireEvent.click(screen.getByText('first: one'));
        expect(screen.getByText('first: new-thread')).toBeInTheDocument();
        expect(screen.getByText('second: two')).toBeInTheDocument();
    });

    it('keeps a conversation created inside an uncontrolled panel on rerender', () => {
        const { rerender } = render(panel('agent'), { wrapper: MemoryRouter });
        fireEvent.click(screen.getByText('agent: empty'));
        rerender(panel('agent'));
        expect(screen.getByText('agent: new-thread')).toBeInTheDocument();
    });
});
