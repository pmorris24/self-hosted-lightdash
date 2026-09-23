import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { LauncherDockProvider } from '../../src/ee/features/aiCopilot/components/Launcher/LauncherDockProvider';
import { PendingPromptProvider } from '../../src/ee/features/aiCopilot/components/PendingPromptContext/PendingPromptContext';
import { setEmbeddedAiAgentMode } from '../../src/ee/features/aiCopilot/hooks/aiAgentRouting';
import { createAiAgentStore } from '../../src/ee/features/aiCopilot/store';
import { openPanel } from '../../src/ee/features/aiCopilot/store/aiAgentLauncherSlice';
import { useAiAgentStoreSelector } from '../../src/ee/features/aiCopilot/store/hooks';
import { AiAgentThreadStreamAbortControllerContextProvider } from '../../src/ee/features/aiCopilot/streaming/AiAgentThreadStreamAbortControllerContextProvider';
import { embedContractClass } from '../../src/ee/features/embed/styles/embedClassContract';
import AgentPage from '../../src/ee/pages/AiAgents/AgentPage';
import AiAgentThreadPage from '../../src/ee/pages/AiAgents/AgentThreadPage';
import AiAgentNewThreadPage from '../../src/ee/pages/AiAgents/AiAgentNewThreadPage';
import AiAgentsNotAuthorizedPage from '../../src/ee/pages/AiAgents/AiAgentsNotAuthorizedPage';
import { EmbeddedAgentPanel } from '../../src/ee/pages/AiAgents/EmbeddedAgentPanel';
import { useLightdashTheme } from '../theme/themeContext';
import {
    agentThemeVariables,
    mergeAgentThemes,
    type AgentThemeSettings,
} from './agentTheme';

const THREAD_PATH = /\/threads\/([^/?#]+)/;

/**
 * The thread the viewer is in. A new question makes a thread and the pages
 * route to it; in a frame that becomes a message to the host page, but here
 * the router is the host page's own, so we read it from the route.
 */
const ThreadWatcher: FC<{
    onThreadChange: (options: { threadUuid: string }) => void;
}> = ({ onThreadChange }) => {
    const { pathname } = useLocation();
    const reportedRef = useRef<string | null>(null);
    const callbackRef = useRef(onThreadChange);
    callbackRef.current = onThreadChange;

    useEffect(() => {
        const threadUuid = THREAD_PATH.exec(pathname)?.[1];
        if (!threadUuid || reportedRef.current === threadUuid) return;
        reportedRef.current = threadUuid;
        callbackRef.current({ threadUuid });
    }, [pathname]);

    return null;
};

export type AgentLayout = 'panel' | 'page';

const PanelThreadWatcher: FC<{
    onThreadChange: (options: { threadUuid: string }) => void;
}> = ({ onThreadChange }) => {
    const threadUuid = useAiAgentStoreSelector(
        (state) => state.aiAgentLauncher.activeThreadId,
    );
    const reportedRef = useRef<string | null>(null);
    const callbackRef = useRef(onThreadChange);
    callbackRef.current = onThreadChange;

    useEffect(() => {
        if (!threadUuid || reportedRef.current === threadUuid) return;
        reportedRef.current = threadUuid;
        callbackRef.current({ threadUuid });
    }, [threadUuid]);

    return null;
};

type Props = {
    styleOptions?: AgentThemeSettings;
    onThreadChange?: (options: { threadUuid: string }) => void;
    layout: AgentLayout;
    projectUuid: string;
    agentUuid: string;
    threadUuid?: string;
};

/**
 * Lightdash's own agent, rendered into the host's page rather than a frame:
 * the same conversation, chart cards, suggested questions and composer the
 * product ships, sharing the page's React tree and wearing its styles.
 *
 * Two containers: the outer one carries the page's style options, and the
 * inner one is the public `ld-agent-root`, under which the SDK's stylesheet
 * feeds them back into the parts of the UI that have no class of their own.
 */
export const AgentChat: FC<Props> = ({
    styleOptions,
    onThreadChange,
    layout,
    projectUuid,
    agentUuid,
    threadUuid,
}) => {
    const [aiAgentStore] = useState(createAiAgentStore);

    useEffect(() => {
        if (layout !== 'panel') return;
        aiAgentStore.dispatch(
            openPanel({ agentUuid, threadId: threadUuid ?? null }),
        );
    }, [agentUuid, aiAgentStore, layout, threadUuid]);

    // The pages decide what an embedded viewer may see from the URL, which
    // here belongs to the host page, so we say it instead. Declared while
    // rendering rather than in an effect, because the pages below read it as
    // they first render.
    setEmbeddedAiAgentMode(true);

    // The surrounding `ThemeProvider`'s agent section, with this agent's own
    // `styleOptions` laid over it.
    const { agent } = useLightdashTheme();
    const settings = useMemo(
        () => mergeAgentThemes(agent, styleOptions),
        [agent, styleOptions],
    );
    const variables = useMemo(() => agentThemeVariables(settings), [settings]);

    return (
        <div className="lightdash-agent-scope" style={variables}>
            <div
                className={embedContractClass('ld-agent-root')}
                data-agent-themed={
                    Object.keys(variables).length > 0 ? '' : undefined
                }
                data-agent-max-width={
                    settings.body?.maxWidth === undefined ? undefined : ''
                }
                data-agent-padding={
                    settings.body?.padding === undefined ? undefined : ''
                }
                data-agent-message-gap={
                    settings.body?.gapBetweenMessages === undefined
                        ? undefined
                        : ''
                }
            >
                <ReduxProvider store={aiAgentStore}>
                    <AiAgentThreadStreamAbortControllerContextProvider>
                        <PendingPromptProvider>
                            <LauncherDockProvider>
                                {onThreadChange &&
                                    (layout === 'panel' ? (
                                        <PanelThreadWatcher
                                            onThreadChange={onThreadChange}
                                        />
                                    ) : (
                                        <ThreadWatcher
                                            onThreadChange={onThreadChange}
                                        />
                                    ))}
                                {layout === 'panel' ? (
                                    <EmbeddedAgentPanel
                                        projectUuid={projectUuid}
                                        agentUuid={agentUuid}
                                    />
                                ) : (
                                    <Routes>
                                        <Route
                                            path="/embed/:projectUuid/ai-agents/not-authorized"
                                            element={
                                                <AiAgentsNotAuthorizedPage />
                                            }
                                        />
                                        <Route
                                            path="/embed/:projectUuid/ai-agents/:agentUuid"
                                            element={<AgentPage />}
                                        >
                                            <Route
                                                index
                                                element={
                                                    <Navigate
                                                        to="threads"
                                                        replace
                                                    />
                                                }
                                            />
                                            <Route
                                                path="threads"
                                                element={
                                                    <AiAgentNewThreadPage />
                                                }
                                            />
                                            <Route
                                                path="threads/:threadUuid"
                                                element={<AiAgentThreadPage />}
                                            />
                                        </Route>
                                    </Routes>
                                )}
                            </LauncherDockProvider>
                        </PendingPromptProvider>
                    </AiAgentThreadStreamAbortControllerContextProvider>
                </ReduxProvider>
            </div>
        </div>
    );
};
