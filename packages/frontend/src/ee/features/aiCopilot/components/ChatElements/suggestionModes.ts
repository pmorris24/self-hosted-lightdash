import { type AgentSuggestion } from '@lightdash/common';

type AgentSuggestionModeArgs = {
    disabled: boolean;
    isMinimalMode: boolean;
    loading: boolean;
    messageCount: number;
    latestAssistantMessageUuid?: string;
    suggestionsEnabled: boolean;
    threadUuid?: string;
};

export const getAgentSuggestionModes = ({
    disabled,
    isMinimalMode,
    loading,
    messageCount,
    latestAssistantMessageUuid,
    suggestionsEnabled,
    threadUuid,
}: AgentSuggestionModeArgs) => {
    const canFetchSuggestions = !disabled && suggestionsEnabled;

    return {
        emptyStateMode:
            !isMinimalMode && messageCount === 0 && canFetchSuggestions,
        postResponseMode:
            messageCount > 0 &&
            !loading &&
            !!threadUuid &&
            !!latestAssistantMessageUuid &&
            canFetchSuggestions,
    };
};

export const resolveAgentSuggestionChips = (
    chips: AgentSuggestion[] | undefined,
    initialQuestions: string[] | undefined,
): AgentSuggestion[] => {
    if (chips?.length) return chips;
    return (initialQuestions ?? [])
        .filter((label) => label.trim())
        .map((label) => ({
            kind: 'prompt',
            label,
            tool: 'generateVisualization',
            defaults: {
                explore: null,
                dimensions: [],
                metrics: [],
                timeframe: null,
            },
        }));
};
