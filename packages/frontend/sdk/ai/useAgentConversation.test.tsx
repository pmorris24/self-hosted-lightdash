import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAgentConversation } from './useAgentConversation';

const sse = (events: unknown[]) =>
    new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            events.forEach((event) => {
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(event)}\n`),
                );
            });
            controller.close();
        },
    });

// The agent's stream, as it arrives: a tool call in three parts, then the
// answer's text.
const STREAM = [
    {
        type: 'tool-input-start',
        toolCallId: 'call-1',
        toolName: 'grepFields',
        title: 'Grep fields',
    },
    {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        input: { table: 'orders' },
    },
    {
        type: 'tool-output-available',
        toolCallId: 'call-1',
        output: { result: '```csv\norders.amount\n```' },
    },
    { type: 'text-delta', delta: 'Revenue rose.' },
];

const fakeFetch = () =>
    vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/stream')) {
            return new Response(sse(STREAM), { status: 200 });
        }
        if (url.endsWith('/threads')) {
            return new Response(
                JSON.stringify({
                    status: 'ok',
                    results: { threadUuid: 'thread-1' },
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }
        // The saved thread, read back once the stream ends.
        return new Response(
            JSON.stringify({
                status: 'ok',
                results: {
                    messages: [
                        {
                            role: 'assistant',
                            uuid: 'message-1',
                            message: 'Revenue rose.',
                            status: 'idle',
                            artifacts: [],
                        },
                    ],
                },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    });

const config = (fetchImpl: ReturnType<typeof fakeFetch>) => ({
    instanceUrl: 'https://lightdash.test',
    projectUuid: 'project-1',
    auth: { type: 'embedToken' as const, token: 'token-1' },
    fetch: fetchImpl as unknown as typeof fetch,
});

const savedThread = {
    status: 'ok',
    results: {
        messages: [
            {
                role: 'user',
                uuid: 'message-1',
                message: 'How is revenue?',
                artifacts: [],
            },
            {
                role: 'assistant',
                uuid: 'message-2',
                message: 'Revenue rose.',
                status: 'idle',
                artifacts: [],
            },
        ],
    },
};

describe('useAgentConversation', () => {
    it('reports the work behind an answer, tool call by tool call', async () => {
        const fetchImpl = fakeFetch();
        const { result } = renderHook(() =>
            useAgentConversation(
                { agentUuid: 'agent-1' },
                { config: config(fetchImpl) },
            ),
        );

        await act(async () => {
            await result.current.ask('How is revenue?');
        });

        await waitFor(() => {
            expect(result.current.isStreaming).toBe(false);
        });

        const [question, answer] = result.current.messages;
        expect(question.role).toBe('user');
        expect(answer.text).toBe('Revenue rose.');
        expect(answer.steps).toEqual([
            {
                id: 'call-1',
                toolName: 'grepFields',
                label: 'Grep fields',
                input: { table: 'orders' },
                // The fences a chat window would have needed are gone.
                output: 'orders.amount',
                isRunning: false,
            },
        ]);
    });
});

describe('opening a conversation that already exists', () => {
    it('reads its messages back, so the next question continues it', async () => {
        const fetchImpl = vi.fn(
            async () =>
                new Response(JSON.stringify(savedThread), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
        );
        const { result } = renderHook(() =>
            useAgentConversation(
                { agentUuid: 'agent-1' },
                {
                    config: config(
                        fetchImpl as unknown as ReturnType<typeof fakeFetch>,
                    ),
                },
            ),
        );

        await act(async () => {
            await result.current.openThread('thread-7');
        });

        expect(result.current.error?.message ?? null).toBe(null);
        expect(result.current.threadUuid).toBe('thread-7');
        expect(
            result.current.messages.map((message) => [
                message.role,
                message.text,
            ]),
        ).toEqual([
            ['user', 'How is revenue?'],
            ['assistant', 'Revenue rose.'],
        ]);
    });
});
