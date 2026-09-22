import { useEffect, type CSSProperties, type FC } from 'react';
import { type LightdashApiClientConfig } from '../api';
import { useAgentAnswer } from './useAgentAnswer';

type Props = {
    config: LightdashApiClientConfig;
    agentUuid: string;
    // The question to answer, for example "Summarise revenue by region".
    prompt: string;
    style?: CSSProperties;
    loadingText?: string;
};

/**
 * A written answer from an AI agent, placed anywhere on a host page. It asks
 * again when `prompt` changes. The text is Markdown, shown as plain text.
 */
export const AgentInsights: FC<Props> = ({
    config,
    agentUuid,
    prompt,
    style,
    loadingText = 'Writing…',
}) => {
    const { ask, partialText, isLoading, error } = useAgentAnswer(config, {
        agentUuid,
    });

    // A request to a server: the one kind of work an effect is for.
    useEffect(() => {
        if (prompt.trim().length > 0) void ask(prompt);
    }, [ask, prompt]);

    if (error) {
        return (
            <p role="alert" style={style}>
                {error.message}
            </p>
        );
    }
    return (
        <p
            style={{ whiteSpace: 'pre-wrap', margin: 0, ...style }}
            aria-busy={isLoading}
            data-lightdash-agent-insights=""
        >
            {partialText || (isLoading ? loadingText : '')}
        </p>
    );
};
