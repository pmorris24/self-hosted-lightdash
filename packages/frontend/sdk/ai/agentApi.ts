import { type LightdashApiClient } from '../api';

export type AgentAnswer = {
    threadUuid: string;
    // The text answer of the agent, as Markdown.
    text: string;
};

export type AskAgentOptions = {
    agentUuid: string;
    prompt: string;
    projectUuid: string;
    signal?: AbortSignal;
    // Text so far, while the agent writes. The full answer is the result.
    onProgress?: (text: string) => void;
};

type ThreadSummary = { uuid: string };

type ThreadWithMessages = {
    messages: {
        role: 'user' | 'assistant';
        status?: 'idle' | 'pending' | 'error';
        message: string | null;
        errorMessage?: string | null;
    }[];
};

const EVENT_PREFIX = 'data: ';

// The answer arrives as server-sent events. Only `text-delta` events carry
// answer text; tool calls and steps are skipped, the saved thread has them.
const readTextDelta = (line: string): string => {
    if (!line.startsWith(EVENT_PREFIX)) return '';
    const data = line.slice(EVENT_PREFIX.length).trim();
    if (data === '[DONE]') return '';
    try {
        const event: unknown = JSON.parse(data);
        return typeof event === 'object' &&
            event !== null &&
            'type' in event &&
            event.type === 'text-delta' &&
            'delta' in event &&
            typeof event.delta === 'string'
            ? event.delta
            : '';
    } catch {
        return '';
    }
};

/**
 * One question to an AI agent with an `aiAgent` embed token: make a thread,
 * let the agent answer, then read the saved answer.
 */
export const askAgent = async (
    client: LightdashApiClient,
    fetcher: typeof fetch,
    connection: { instanceUrl: string; token: string },
    options: AskAgentOptions,
): Promise<AgentAnswer> => {
    const { agentUuid, prompt, projectUuid, signal, onProgress } = options;
    const base = `/api/v1/projects/${projectUuid}/aiAgents/${agentUuid}/threads`;

    const thread = await client.request<ThreadSummary>({
        method: 'POST',
        path: base,
        body: { prompt },
        signal,
    });

    // `client.request` parses JSON, and this response is a stream.
    const response = await fetcher(
        `${connection.instanceUrl.replace(/\/$/, '')}${base}/${thread.uuid}/stream`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'lightdash-embed-token': connection.token,
            },
            body: JSON.stringify({}),
            signal,
        },
    );
    if (!response.ok || !response.body) {
        throw new Error(`The agent did not answer (status ${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamed = '';
    // A network chunk can end in the middle of a line.
    let unfinishedLine = '';
    for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        const lines = (
            unfinishedLine + decoder.decode(value, { stream: true })
        ).split('\n');
        unfinishedLine = lines.pop() ?? '';
        const text = lines.map(readTextDelta).join('');
        if (text) {
            streamed += text;
            onProgress?.(streamed);
        }
    }
    streamed += readTextDelta(unfinishedLine);

    const saved = await client.request<ThreadWithMessages>({
        path: `${base}/${thread.uuid}`,
        signal,
    });
    const answer = [...saved.messages]
        .reverse()
        .find((message) => message.role === 'assistant');
    if (answer?.status === 'error') {
        throw new Error(answer.errorMessage ?? 'The agent returned an error');
    }
    return { threadUuid: thread.uuid, text: answer?.message ?? streamed };
};
