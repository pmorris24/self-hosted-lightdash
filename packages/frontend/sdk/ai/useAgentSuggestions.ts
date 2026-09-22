import { useCallback } from 'react';
import {
    createLightdashApiClient,
    type LightdashApiClientConfig,
} from '../api';
import { useLightdashApiQuery, type UseLightdashApiResult } from '../hooks';

type SuggestionChips = { chips: { kind: string; label: string }[] };

/**
 * Questions the agent proposes, as plain text. The server returns none for an
 * embed token today, so `fallback` is what a viewer sees until it does.
 */
export const useAgentSuggestions = (
    config: LightdashApiClientConfig,
    args: { agentUuid: string; projectUuid?: string; fallback?: string[] },
): UseLightdashApiResult<string[]> => {
    const projectUuid = args.projectUuid ?? config.projectUuid;
    const { agentUuid, fallback } = args;
    const fallbackKey = (fallback ?? []).join('\u0000');
    const key = JSON.stringify([
        'agent-suggestions',
        config.instanceUrl,
        config.auth ?? null,
        projectUuid ?? null,
        agentUuid,
        fallbackKey,
    ]);

    return useLightdashApiQuery(
        key,
        agentUuid.length > 0 && !!projectUuid,
        useCallback(
            async (signal: AbortSignal) => {
                const client = createLightdashApiClient(config);
                const { chips } = await client.request<SuggestionChips>({
                    path: `/api/v1/projects/${projectUuid}/aiAgents/${agentUuid}/suggestions`,
                    signal,
                });
                const prompts = chips
                    .filter((chip) => chip.kind === 'prompt')
                    .map((chip) => chip.label);
                return prompts.length > 0
                    ? prompts
                    : fallbackKey.split('\u0000').filter(Boolean);
            },
            [agentUuid, fallbackKey, key, projectUuid], // eslint-disable-line react-hooks/exhaustive-deps
        ),
    );
};
