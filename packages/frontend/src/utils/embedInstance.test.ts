import { JWT_HEADER_NAME } from '@lightdash/common';
import { QueryObserver } from '@tanstack/react-query';
import nock from 'nock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BASE_API_URL, lightdashApi } from '../api';
import { EMBED_KEY } from '../ee/providers/Embed/types';
import { pollForResults } from '../features/queryRunner/executeQuery';
import { createQueryClient } from '../providers/ReactQuery/createQueryClient';
import {
    getCurrentEmbedInstanceId,
    registerEmbedInstance,
    resolveEmbedScope,
    runInEmbedInstance,
    unregisterEmbedInstance,
} from './embedInstance';
import { clearInMemoryStorage, setToInMemoryStorage } from './inMemoryStorage';

const registerPiece = (id: string, token: string) =>
    registerEmbedInstance(id, {
        embed: { token, projectUuid: 'project-uuid' },
        instanceUrl: null,
    });

const expectToken = (token: string, path = '/api/v1/test') =>
    nock(BASE_API_URL)
        .matchHeader(JWT_HEADER_NAME, token)
        .get(path)
        .query(true)
        .reply(200, { status: 'ok', results: token });

describe('embedInstance', () => {
    beforeEach(() => {
        clearInMemoryStorage();
        registerPiece('piece-a', 'token a');
        registerPiece('piece-b', 'token b');
    });

    afterEach(() => {
        unregisterEmbedInstance('piece-a');
        unregisterEmbedInstance('piece-b');
        nock.cleanAll();
    });

    it('sends the token of the piece whose scope the request starts in', async () => {
        // The default slot holds the last piece to mount, as it does today.
        setToInMemoryStorage(EMBED_KEY, { token: 'token b' });
        const scopeA = expectToken('token a');
        const scopeB = expectToken('token b');

        const [resultA, resultB] = await Promise.all([
            runInEmbedInstance('piece-a', () =>
                lightdashApi({ method: 'GET', url: '/test', body: null }),
            ),
            runInEmbedInstance('piece-b', () =>
                lightdashApi({ method: 'GET', url: '/test', body: null }),
            ),
        ]);

        expect(resultA).toEqual('token a');
        expect(resultB).toEqual('token b');
        expect(scopeA.isDone()).toBe(true);
        expect(scopeB.isDone()).toBe(true);
    });

    it('keeps the scope to the synchronous part and restores the previous one', () => {
        expect(getCurrentEmbedInstanceId()).toBeUndefined();
        runInEmbedInstance('piece-a', () => {
            expect(getCurrentEmbedInstanceId()).toBe('piece-a');
            runInEmbedInstance('piece-b', () => {
                expect(getCurrentEmbedInstanceId()).toBe('piece-b');
            });
            expect(getCurrentEmbedInstanceId()).toBe('piece-a');
        });
        expect(getCurrentEmbedInstanceId()).toBeUndefined();
    });

    it('lets an explicit instance id win over the current scope', async () => {
        const scope = expectToken('token b');

        await runInEmbedInstance('piece-a', () =>
            lightdashApi({
                method: 'GET',
                url: '/test',
                body: null,
                embedInstanceId: 'piece-b',
            }),
        );

        expect(scope.isDone()).toBe(true);
    });

    it('falls back to the default slot outside any piece', async () => {
        setToInMemoryStorage(EMBED_KEY, { token: 'default token' });
        const scope = expectToken('default token');

        await lightdashApi({ method: 'GET', url: '/test', body: null });

        expect(scope.isDone()).toBe(true);
        expect(
            resolveEmbedScope('unknown-piece').embedInstanceId,
        ).toBeUndefined();
    });

    it('keeps the piece across the rounds of a poll', async () => {
        setToInMemoryStorage(EMBED_KEY, { token: 'token b' });
        const path = '/api/v2/projects/project-uuid/query/query-uuid';
        const pending = nock(BASE_API_URL)
            .matchHeader(JWT_HEADER_NAME, 'token a')
            .get(path)
            .query(true)
            .reply(200, { status: 'ok', results: { status: 'pending' } });
        const ready = nock(BASE_API_URL)
            .matchHeader(JWT_HEADER_NAME, 'token a')
            .get(path)
            .query(true)
            .reply(200, { status: 'ok', results: { status: 'ready' } });

        const results = await runInEmbedInstance('piece-a', () =>
            pollForResults('project-uuid', 'query-uuid', 1),
        );

        expect(results.status).toBe('ready');
        expect(pending.isDone()).toBe(true);
        expect(ready.isDone()).toBe(true);
    });

    it('runs the query functions of a scoped query client inside its piece', async () => {
        const queryClient = createQueryClient(undefined, 'piece-a');
        const seen: (string | undefined)[] = [];
        const observer = new QueryObserver(queryClient, {
            queryKey: ['scoped'],
            queryFn: () => {
                seen.push(getCurrentEmbedInstanceId());
                return 'done';
            },
        });

        const unsubscribe = observer.subscribe(() => {});
        await queryClient.fetchQuery({
            queryKey: ['scoped-fetch'],
            queryFn: () => {
                seen.push(getCurrentEmbedInstanceId());
                return 'done';
            },
        });
        unsubscribe();

        expect(seen).toEqual(['piece-a', 'piece-a']);
        expect(getCurrentEmbedInstanceId()).toBeUndefined();
    });
});
