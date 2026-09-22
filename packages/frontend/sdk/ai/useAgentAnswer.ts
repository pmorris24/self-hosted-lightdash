import { useCallback, useMemo, useRef, useState } from 'react';
import {
    createLightdashApiClient,
    type LightdashApiClientConfig,
} from '../api';
import { askAgent, type AgentAnswer } from './agentApi';

export type UseAgentAnswerResult = {
    answer: AgentAnswer | null;
    // The text so far, while the agent writes.
    partialText: string;
    isLoading: boolean;
    error: Error | null;
    ask: (prompt: string) => Promise<AgentAnswer | null>;
    reset: () => void;
};

/**
 * Ask an AI agent a question from host code and get the text answer. Needs an
 * embed token signed for that agent. Each `ask` makes a new thread.
 */
export const useAgentAnswer = (
    config: LightdashApiClientConfig,
    args: { agentUuid: string; projectUuid?: string },
): UseAgentAnswerResult => {
    const [state, setState] = useState<
        Pick<UseAgentAnswerResult, 'answer' | 'partialText' | 'isLoading' | 'error'>
    >({ answer: null, partialText: '', isLoading: false, error: null });
    const abortRef = useRef<AbortController | null>(null);
    const token = config.auth?.token;
    const projectUuid = args.projectUuid ?? config.projectUuid;
    const { agentUuid } = args;
    const { instanceUrl, fetch: configFetch } = config;

    const ask = useCallback(
        async (prompt: string) => {
            if (!token || !projectUuid) {
                setState((current) => ({
                    ...current,
                    error: new Error('A token and a projectUuid are required'),
                }));
                return null;
            }
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setState({ answer: null, partialText: '', isLoading: true, error: null });

            const client = createLightdashApiClient({
                instanceUrl,
                projectUuid,
                auth: { type: 'embedToken', token },
                fetch: configFetch,
            });
            try {
                const answer = await askAgent(
                    client,
                    configFetch ?? fetch,
                    { instanceUrl, token },
                    {
                        agentUuid,
                        prompt,
                        projectUuid,
                        signal: controller.signal,
                        onProgress: (partialText) =>
                            setState((current) => ({ ...current, partialText })),
                    },
                );
                if (controller.signal.aborted) return null;
                setState({
                    answer,
                    partialText: answer.text,
                    isLoading: false,
                    error: null,
                });
                return answer;
            } catch (error) {
                if (controller.signal.aborted) return null;
                setState({
                    answer: null,
                    partialText: '',
                    isLoading: false,
                    error:
                        error instanceof Error
                            ? error
                            : new Error('The agent request failed'),
                });
                return null;
            }
        },
        [agentUuid, configFetch, instanceUrl, projectUuid, token],
    );

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setState({ answer: null, partialText: '', isLoading: false, error: null });
    }, []);

    return useMemo(() => ({ ...state, ask, reset }), [state, ask, reset]);
};
