import { describe, expect, it, vi } from 'vitest';
import { createLightdashApiClient } from '../api';
import { askAgent } from './agentApi';

const json = (results: unknown) =>
    new Response(JSON.stringify({ status: 'ok', results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

// Each entry is one network chunk, so a test can split a line across two.
const streamOf = (chunks: string[]) =>
    new Response(
        new ReadableStream({
            start(controller) {
                chunks.forEach((chunk) =>
                    controller.enqueue(new TextEncoder().encode(chunk)),
                );
                controller.close();
            },
        }),
        { status: 200 },
    );

const delta = (text: string) =>
    `data: ${JSON.stringify({ type: 'text-delta', id: 'm', delta: text })}\n\n`;

const setup = (responses: Response[]) => {
    const fetcher = vi.fn<typeof fetch>();
    responses.forEach((response) => fetcher.mockResolvedValueOnce(response));
    const client = createLightdashApiClient({
        instanceUrl: 'https://ld.test/',
        projectUuid: 'p',
        auth: { type: 'embedToken', token: 'jwt' },
        fetch: fetcher,
    });
    return { fetcher, client };
};

const options = { agentUuid: 'a', prompt: 'Revenue?', projectUuid: 'p' };
const connection = { instanceUrl: 'https://ld.test/', token: 'jwt' };

describe('askAgent', () => {
    it('makes a thread, streams, then returns the saved answer', async () => {
        const { fetcher, client } = setup([
            json({ uuid: 't1' }),
            streamOf([
                delta('Revenue '),
                'data: {"type":"tool-input-start","toolCallId":"1"}\n\n',
                // One event split across two chunks.
                delta('is up').slice(0, 20),
                delta('is up').slice(20),
                'data: [DONE]\n\n',
            ]),
            json({
                messages: [
                    { role: 'user', message: 'Revenue?' },
                    { role: 'assistant', status: 'idle', message: 'Revenue is up 4%.' },
                ],
            }),
        ]);
        const onProgress = vi.fn();

        const answer = await askAgent(client, fetcher, connection, {
            ...options,
            onProgress,
        });

        expect(answer).toEqual({ threadUuid: 't1', text: 'Revenue is up 4%.' });
        expect(onProgress).toHaveBeenLastCalledWith('Revenue is up');
        const [createUrl, createInit] = fetcher.mock.calls[0];
        expect(createUrl).toBe(
            'https://ld.test/api/v1/projects/p/aiAgents/a/threads',
        );
        expect(createInit?.body).toBe(JSON.stringify({ prompt: 'Revenue?' }));
        const [streamUrl, streamInit] = fetcher.mock.calls[1];
        expect(streamUrl).toBe(
            'https://ld.test/api/v1/projects/p/aiAgents/a/threads/t1/stream',
        );
        expect(streamInit?.headers).toMatchObject({
            'lightdash-embed-token': 'jwt',
        });
    });

    it('falls back to the streamed text when no answer was saved', async () => {
        const { fetcher, client } = setup([
            json({ uuid: 't1' }),
            streamOf([delta('Partial')]),
            json({ messages: [{ role: 'user', message: 'Revenue?' }] }),
        ]);
        await expect(
            askAgent(client, fetcher, connection, options),
        ).resolves.toEqual({ threadUuid: 't1', text: 'Partial' });
    });

    it('throws when the stream is refused or the agent saved an error', async () => {
        const refused = setup([
            json({ uuid: 't1' }),
            new Response('nope', { status: 403 }),
        ]);
        await expect(
            askAgent(refused.client, refused.fetcher, connection, options),
        ).rejects.toThrow(/status 403/);

        const failed = setup([
            json({ uuid: 't1' }),
            streamOf([]),
            json({
                messages: [
                    {
                        role: 'assistant',
                        status: 'error',
                        message: null,
                        errorMessage: 'Model is not set up',
                    },
                ],
            }),
        ]);
        await expect(
            askAgent(failed.client, failed.fetcher, connection, options),
        ).rejects.toThrow('Model is not set up');
    });
});
