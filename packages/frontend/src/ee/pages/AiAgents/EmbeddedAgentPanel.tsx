import { Center, Loader } from '@mantine/core';
import { type CSSProperties, type FC } from 'react';
import { LauncherPanel } from '../../features/aiCopilot/components/Launcher/LauncherPanel';
import { useProjectAiAgent } from '../../features/aiCopilot/hooks/useProjectAiAgents';
import { useAiAgentStoreSelector } from '../../features/aiCopilot/store/hooks';

type Props = {
    projectUuid: string;
    agentUuid: string;
};

// The launcher's panel is anchored to its bubble; embedded, it fills the box
// the host page gives it instead.
const FILL: CSSProperties = {
    position: 'static',
    width: '100%',
    height: '100%',
    maxHeight: 'none',
};

/**
 * The agent as the product's own panel: the small surface that opens beside a
 * dashboard, with its title bar, the agent's mark and description, its
 * connections and pinned context, and the compact composer.
 */
export const EmbeddedAgentPanel: FC<Props> = ({ projectUuid, agentUuid }) => {
    const { data: agent, isLoading } = useProjectAiAgent(
        projectUuid,
        agentUuid,
    );
    const activeThreadId = useAiAgentStoreSelector(
        (state) => state.aiAgentLauncher.activeThreadId,
    );

    if (isLoading || !agent) {
        return (
            <Center h="100%">
                <Loader size="sm" color="gray" />
            </Center>
        );
    }

    return (
        <LauncherPanel
            projectUuid={projectUuid}
            agent={agent}
            agents={[]}
            activeThreadId={activeThreadId}
            style={FILL}
        />
    );
};
