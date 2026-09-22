import { type ApiError } from '@lightdash/common';
import {
    QueryClient,
    type DefaultedQueryObserverOptions,
    type DefaultOptions,
    type MutationOptions,
    type QueryClientConfig,
    type QueryKey,
    type QueryObserverOptions,
} from '@tanstack/react-query';
import { runInEmbedInstance } from '../../utils/embedInstance';

const MAX_QUERY_RETRIES = 5;

// Retry transient transport failures (dropped/misrouted requests during
// rollouts, brief gateway timeouts) so a single blip doesn't surface an error.
// Real API errors and synthesized terminal query failures still surface at once.
export const shouldRetryQuery = (
    failureCount: number,
    error: unknown,
): boolean =>
    (error as Partial<ApiError>)?.error?.name === 'NetworkError' &&
    failureCount < MAX_QUERY_RETRIES;

export const getQueryRetryDelay = (attemptIndex: number): number =>
    Math.min(1000 * 2 ** attemptIndex, 8000);

type AnyFetcher = (...args: never[]) => unknown;

// Runs every query and mutation function of one SDK piece inside that piece's
// embed instance, so its requests carry its own token.
class EmbedInstanceQueryClient extends QueryClient {
    private readonly scopedFetchers = new WeakSet<AnyFetcher>();

    constructor(
        config: QueryClientConfig,
        private readonly embedInstanceId: string,
    ) {
        super(config);
    }

    private scope<T extends AnyFetcher>(fetcher: T): T {
        if (this.scopedFetchers.has(fetcher)) return fetcher;
        const { embedInstanceId } = this;
        const scoped = ((...args: never[]) =>
            runInEmbedInstance(embedInstanceId, () => fetcher(...args))) as T;
        this.scopedFetchers.add(scoped);
        return scoped;
    }

    defaultQueryOptions<
        TQueryFnData,
        TError,
        TData,
        TQueryData,
        TQueryKey extends QueryKey,
    >(
        options?:
            | QueryObserverOptions<
                  TQueryFnData,
                  TError,
                  TData,
                  TQueryData,
                  TQueryKey
              >
            | DefaultedQueryObserverOptions<
                  TQueryFnData,
                  TError,
                  TData,
                  TQueryData,
                  TQueryKey
              >,
    ) {
        const defaulted = super.defaultQueryOptions(options);
        if (typeof defaulted.queryFn === 'function') {
            defaulted.queryFn = this.scope(defaulted.queryFn);
        }
        return defaulted;
    }

    defaultMutationOptions<T extends MutationOptions<any, any, any, any>>(
        options?: T,
    ): T {
        const defaulted = super.defaultMutationOptions(options);
        if (typeof defaulted?.mutationFn === 'function') {
            defaulted.mutationFn = this.scope(defaulted.mutationFn);
        }
        return defaulted;
    }
}

export const createQueryClient = (
    options?: DefaultOptions,
    embedInstanceId?: string,
) => {
    const config: QueryClientConfig = {
        defaultOptions: {
            queries: {
                retry: shouldRetryQuery,
                retryDelay: getQueryRetryDelay,
                staleTime: 30000, // 30 seconds
                refetchOnWindowFocus: false,
                onError: async (result) => {
                    // @ts-ignore
                    const { error: { statusCode } = {} } = result;
                    if (statusCode === 401) {
                        await queryClient.invalidateQueries(['health']);
                    }
                },
                networkMode: 'always',
                ...options?.queries,
            },
            mutations: {
                networkMode: 'always',
                ...options?.mutations,
            },
        },
    };
    const queryClient: QueryClient = embedInstanceId
        ? new EmbedInstanceQueryClient(config, embedInstanceId)
        : new QueryClient(config);

    return queryClient;
};
