import { useCallback, useMemo, useRef, useState } from 'react';
import {
    createLightdashApiClient,
    type LightdashApiClientConfig,
} from '../api';
import { useResolvedConfig } from '../connection';
import { type AgentArtifact } from './agentChartTranslator';

export type AgentMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    // Charts the agent made while answering. Feed them to the chart pieces
    // through `agentChartTranslator`.
    charts: AgentArtifact[];
    // True while this answer is still being written.
    isStreaming: boolean;
};

export type UseAgentConversationResult = {
    messages: AgentMessage[];
    // What the agent is doing right now, in its own words, or null when idle.
    status: string | null;
    isStreaming: boolean;
    error: Error | null;
    threadUuid: string | null;
    ask: (prompt: string) => Promise<void>;
    stop: () => void;
    // Forget the conversation and start a new thread on the next question.
    reset: () => void;
};

type ThreadCreated = { uuid: string; threadUuid?: string };
type SavedThread = {
    messages: {
        role: 'user' | 'assistant';
        uuid: string;
        message: string | null;
        status?: 'idle' | 'pending' | 'error';
        errorMessage?: string | null;
        artifacts?: AgentArtifact[] | null;
    }[];
};

const EVENT_PREFIX = 'data: ';

type StreamEvent = {
    type?: string;
    delta?: string;
    data?: { message?: string };
};

const parseEvent = (line: string): StreamEvent | null => {
    if (!line.startsWith(EVENT_PREFIX)) return null;
    const data = line.slice(EVENT_PREFIX.length).trim();
    if (!data || data === '[DONE]') return null;
    try {
        return JSON.parse(data) as StreamEvent;
    } catch {
        return null;
    }
};

/**
 * A conversation with an AI agent: the questions, the answers as they are
 * written, and the charts the agent made along the way. Your page decides
 * what all of it looks like.
 */
export const useAgentConversation = (
    args: { agentUuid: string; projectUuid?: string },
    options: { config?: LightdashApiClientConfig } = {},
): UseAgentConversationResult => {
    const config = useResolvedConfig(options.config);
    const { agentUuid } = args;
    const projectUuid = args.projectUuid ?? config.projectUuid;
    const token = config.auth?.token;
    const { instanceUrl, fetch: configFetch } = config;

    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [status, setStatus] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [threadUuid, setThreadUuid] = useState<string | null>(null);
    const threadRef = useRef<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setIsStreaming(false);
        setStatus(null);
    }, []);

    const reset = useCallback(() => {
        stop();
        threadRef.current = null;
        setThreadUuid(null);
        setMessages([]);
        setError(null);
    }, [stop]);

    const ask = useCallback(
        async (prompt: string) => {
            if (!token || !projectUuid) {
                setError(new Error('A token and a projectUuid are required'));
                return;
            }
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setError(null);
            setIsStreaming(true);
            setStatus('Thinking…');

            const answerId = `assistant-${Date.now()}`;
            setMessages((current) => [
                ...current,
                {
                    id: `user-${Date.now()}`,
                    role: 'user',
                    text: prompt,
                    charts: [],
                    isStreaming: false,
                },
                {
                    id: answerId,
                    role: 'assistant',
                    text: '',
                    charts: [],
                    isStreaming: true,
                },
            ]);

            const client = createLightdashApiClient({
                instanceUrl,
                projectUuid,
                auth: { type: 'embedToken', token },
                fetch: configFetch,
            });
            const base = `/api/v1/projects/${projectUuid}/aiAgents/${agentUuid}/threads`;
            const fetcher = configFetch ?? fetch;

            try {
                // The first question makes the thread; the rest continue it.
                if (!threadRef.current) {
                    const thread = await client.request<ThreadCreated>({
                        method: 'POST',
                        path: base,
                        body: { prompt },
                        signal: controller.signal,
                    });
                    threadRef.current = thread.threadUuid ?? thread.uuid;
                    setThreadUuid(threadRef.current);
                } else {
                    await client.request({
                        method: 'POST',
                        path: `${base}/${threadRef.current}/messages`,
                        body: { prompt },
                        signal: controller.signal,
                    });
                }

                const response = await fetcher(
                    `${instanceUrl.replace(/\/$/, '')}${base}/${threadRef.current}/stream`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'lightdash-embed-token': token,
                        },
                        body: JSON.stringify({}),
                        signal: controller.signal,
                    },
                );
                if (!response.ok || !response.body) {
                    throw new Error(
                        `The agent did not answer (status ${response.status})`,
                    );
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let text = '';
                let unfinished = '';
                for (;;) {
                    // eslint-disable-next-line no-await-in-loop
                    const { done, value } = await reader.read();
                    if (done) break;
                    const lines = (
                        unfinished + decoder.decode(value, { stream: true })
                    ).split('\n');
                    unfinished = lines.pop() ?? '';
                    lines.forEach((line) => {
                        const event = parseEvent(line);
                        if (!event) return;
                        if (event.type === 'text-delta' && event.delta) {
                            text += event.delta;
                            setStatus(null);
                            setMessages((current) =>
                                current.map((message) =>
                                    message.id === answerId
                                        ? { ...message, text }
                                        : message,
                                ),
                            );
                        }
                        if (
                            event.type === 'data-step-progress' &&
                            event.data?.message
                        ) {
                            setStatus(event.data.message);
                        }
                    });
                }

                // The saved thread carries the charts the agent made, and the
                // answer as it was stored rather than as it arrived.
                const saved = await client.request<SavedThread>({
                    path: `${base}/${threadRef.current}`,
                    signal: controller.signal,
                });
                const answer = [...saved.messages]
                    .reverse()
                    .find((message) => message.role === 'assistant');
                if (answer?.status === 'error') {
                    throw new Error(
                        answer.errorMessage ?? 'The agent returned an error',
                    );
                }
                // A thread lists its artifacts by name only. The chart the
                // agent drew lives on the version, so fetch each one.
                const charts = await Promise.all(
                    (answer?.artifacts ?? []).map((artifact) =>
                        client
                            .request<AgentArtifact>({
                                path: `${base.replace('/threads', '')}/artifacts/${artifact.artifactUuid}/versions/${artifact.versionUuid}`,
                                signal: controller.signal,
                            })
                            .catch(() => artifact),
                    ),
                );
                setMessages((current) =>
                    current.map((message) =>
                        message.id === answerId
                            ? {
                                  ...message,
                                  text: answer?.message ?? text,
                                  charts: charts.filter(
                                      (chart) => chart.chartConfig,
                                  ),
                                  isStreaming: false,
                              }
                            : message,
                    ),
                );
            } catch (reason: unknown) {
                if (controller.signal.aborted) return;
                setError(
                    reason instanceof Error
                        ? reason
                        : new Error('The agent returned an error'),
                );
                setMessages((current) =>
                    current.map((message) =>
                        message.id === answerId
                            ? { ...message, isStreaming: false }
                            : message,
                    ),
                );
            } finally {
                if (!controller.signal.aborted) {
                    setIsStreaming(false);
                    setStatus(null);
                }
            }
        },
        [agentUuid, configFetch, instanceUrl, projectUuid, token],
    );

    return useMemo(
        () => ({
            messages,
            status,
            isStreaming,
            error,
            threadUuid,
            ask,
            stop,
            reset,
        }),
        [messages, status, isStreaming, error, threadUuid, ask, stop, reset],
    );
};
