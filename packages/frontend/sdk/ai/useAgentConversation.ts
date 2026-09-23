import { useCallback, useMemo, useRef, useState } from 'react';
import {
    createLightdashApiClient,
    type LightdashApiClientConfig,
} from '../api';
import { useResolvedConfig } from '../connection';
import { type AgentArtifact } from './agentChartTranslator';

/**
 * One thing the agent did while answering: a tool it called, what it sent and
 * what came back. A page can show the work — the way a coding agent shows its
 * steps — or ignore all of it and render the answer alone.
 */
export type AgentStep = {
    // The tool call's own id, stable for the life of the step.
    id: string;
    // The tool's name as the agent reports it, e.g. `generateBarVizConfig`.
    toolName: string;
    // What the agent called the step, when it said: "Running query".
    label: string;
    // The arguments the agent sent, once they are complete; null until then.
    input: unknown;
    // What the tool returned, as text.
    output: string | null;
    // True until the tool returns.
    isRunning: boolean;
};

export type AgentMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    // Charts the agent made while answering. Feed them to the chart pieces
    // through `agentChartTranslator`.
    charts: AgentArtifact[];
    // The tool calls behind this answer, in the order they happened.
    steps: AgentStep[];
    // When it was written, as an ISO string: for timestamps and day dividers.
    createdAt: string;
    // True while this answer is still being written.
    isStreaming: boolean;
    // The viewer stopped this answer.
    isStopped: boolean;
};

export type UseAgentConversationResult = {
    messages: AgentMessage[];
    // What the agent is doing right now, in its own words, or null when idle.
    status: string | null;
    isStreaming: boolean;
    error: Error | null;
    threadUuid: string | null;
    ask: (prompt: string) => Promise<void>;
    // Ask the last question again, after an error or a stop.
    retry: () => Promise<void>;
    // Open a conversation this token may read, and continue it.
    openThread: (threadUuid: string) => Promise<void>;
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
        createdAt?: string;
    }[];
};

const EVENT_PREFIX = 'data: ';

type StreamEvent = {
    type?: string;
    delta?: string;
    data?: { message?: string };
    // Tool calls: one id through start, input and output.
    toolCallId?: string;
    toolName?: string;
    title?: string;
    input?: unknown;
    output?: unknown;
};

/**
 * What a tool returned, as text. Most tools answer `{ result: "```csv…```" }`;
 * the fences are for a chat window, so they come off here.
 */
const toolOutputText = (output: unknown): string => {
    const value =
        typeof output === 'string'
            ? output
            : output &&
                typeof output === 'object' &&
                'result' in output &&
                typeof (output as { result: unknown }).result === 'string'
              ? (output as { result: string }).result
              : JSON.stringify(output, null, 2);
    return (value ?? '').replace(/```\w*\n?/g, '').trim();
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
    const lastPromptRef = useRef<string | null>(null);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setIsStreaming(false);
        setStatus(null);
        setMessages((current) =>
            current.map((message) =>
                message.isStreaming
                    ? {
                          ...message,
                          isStreaming: false,
                          isStopped: true,
                          steps: message.steps.map((step) => ({
                              ...step,
                              isRunning: false,
                          })),
                      }
                    : message,
            ),
        );
    }, []);

    const reset = useCallback(() => {
        stop();
        threadRef.current = null;
        setThreadUuid(null);
        setMessages([]);
        setError(null);
    }, [stop]);

    // Everything the hook needs to talk to this agent, in one place.
    const connect = useCallback(() => {
        if (!token || !projectUuid) return null;
        return {
            client: createLightdashApiClient({
                instanceUrl,
                projectUuid,
                auth: { type: 'embedToken' as const, token },
                fetch: configFetch,
            }),
            base: `/api/v1/projects/${projectUuid}/aiAgents/${agentUuid}/threads`,
        };
    }, [agentUuid, configFetch, instanceUrl, projectUuid, token]);

    /**
     * A conversation that already exists, as its messages: the questions, the
     * answers, and the charts the agent made. The next question continues it.
     */
    const openThread = useCallback(
        async (uuid: string) => {
            const connection = connect();
            if (!connection) {
                setError(new Error('A token and a projectUuid are required'));
                return;
            }
            const { client, base } = connection;
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setError(null);
            try {
                const saved = await client.request<SavedThread>({
                    path: `${base}/${uuid}`,
                    signal: controller.signal,
                });
                const messages = await Promise.all(
                    (saved.messages ?? []).map(async (message) => {
                        const charts = await Promise.all(
                            (message.artifacts ?? []).map((artifact) =>
                                client
                                    .request<AgentArtifact>({
                                        path: `${base.replace('/threads', '')}/artifacts/${artifact.artifactUuid}/versions/${artifact.versionUuid}`,
                                        signal: controller.signal,
                                    })
                                    .catch(() => artifact),
                            ),
                        );
                        return {
                            id: message.uuid,
                            role: message.role,
                            text: message.message ?? '',
                            charts: charts.filter((chart) => chart.chartConfig),
                            steps: [],
                            createdAt:
                                message.createdAt ?? new Date().toISOString(),
                            isStreaming: false,
                            isStopped: false,
                        } satisfies AgentMessage;
                    }),
                );
                threadRef.current = uuid;
                setThreadUuid(uuid);
                setMessages(messages);
            } catch (reason: unknown) {
                if (controller.signal.aborted) return;
                setError(
                    reason instanceof Error
                        ? reason
                        : new Error('That conversation could not be opened'),
                );
            } finally {
                if (abortRef.current === controller) abortRef.current = null;
            }
        },
        [connect],
    );

    const ask = useCallback(
        async (prompt: string) => {
            lastPromptRef.current = prompt;
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
                    steps: [],
                    createdAt: new Date().toISOString(),
                    isStreaming: false,
                    isStopped: false,
                },
                {
                    id: answerId,
                    role: 'assistant',
                    text: '',
                    charts: [],
                    steps: [],
                    createdAt: new Date().toISOString(),
                    isStreaming: true,
                    isStopped: false,
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
                    const updateAnswer = (
                        update: (message: AgentMessage) => AgentMessage,
                    ) =>
                        setMessages((current) =>
                            current.map((message) =>
                                message.id === answerId
                                    ? update(message)
                                    : message,
                            ),
                        );
                    const updateStep = (
                        id: string,
                        update: (step: AgentStep) => AgentStep,
                    ) =>
                        updateAnswer((message) => ({
                            ...message,
                            steps: message.steps.map((step) =>
                                step.id === id ? update(step) : step,
                            ),
                        }));

                    lines.forEach((line) => {
                        const event = parseEvent(line);
                        if (!event) return;
                        if (event.type === 'text-delta' && event.delta) {
                            text += event.delta;
                            setStatus(null);
                            updateAnswer((message) => ({ ...message, text }));
                        }
                        if (
                            event.type === 'data-step-progress' &&
                            event.data?.message
                        ) {
                            setStatus(event.data.message);
                        }
                        // A tool call arrives in three parts: it starts, its
                        // arguments complete, then it returns.
                        if (event.type === 'tool-input-start') {
                            const toolName = event.toolName ?? '';
                            const id = event.toolCallId ?? toolName;
                            if (!id) return;
                            const label = event.title ?? toolName;
                            setStatus(label);
                            updateAnswer((message) =>
                                message.steps.some((step) => step.id === id)
                                    ? message
                                    : {
                                          ...message,
                                          steps: [
                                              ...message.steps,
                                              {
                                                  id,
                                                  toolName,
                                                  label,
                                                  input: null,
                                                  output: null,
                                                  isRunning: true,
                                              },
                                          ],
                                      },
                            );
                        }
                        if (
                            event.type === 'tool-input-available' &&
                            event.toolCallId
                        ) {
                            const { input } = event;
                            updateStep(event.toolCallId, (step) => ({
                                ...step,
                                input: input ?? null,
                            }));
                        }
                        if (
                            event.type === 'tool-output-available' &&
                            event.toolCallId
                        ) {
                            const output = toolOutputText(event.output);
                            updateStep(event.toolCallId, (step) => ({
                                ...step,
                                output: output || step.output,
                                isRunning: false,
                            }));
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
                                  steps: message.steps.map((step) => ({
                                      ...step,
                                      isRunning: false,
                                  })),
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

    /**
     * The last question again. The turn that failed stays where it is, and
     * the answer arrives under it as a new one.
     */
    const retry = useCallback(async () => {
        const prompt = lastPromptRef.current;
        if (prompt) await ask(prompt);
    }, [ask]);

    return useMemo(
        () => ({
            messages,
            status,
            isStreaming,
            error,
            threadUuid,
            ask,
            retry,
            openThread,
            stop,
            reset,
        }),
        [
            messages,
            status,
            isStreaming,
            error,
            threadUuid,
            ask,
            retry,
            openThread,
            stop,
            reset,
        ],
    );
};
