import {
    DEFAULT_SDK_AGENT_FEATURES,
    type UiStringKey,
} from '@lightdash/common';
import { createContext } from 'react';
import { type EmbedContext, type EmbedExploreChart } from './types';

const EmbedProviderContext = createContext<EmbedContext>({
    embedToken: undefined,
    filters: undefined,
    hasHostFilters: false,
    projectUuid: undefined,
    content: undefined,
    writeActions: undefined,
    embedWriteContext: undefined,
    paletteUuid: undefined,
    languageMap: undefined,
    t: (_input: UiStringKey) => undefined,
    agentFeatures: DEFAULT_SDK_AGENT_FEATURES,
    agentAvatar: undefined,
    onExplore: (_options: { chart: EmbedExploreChart }) => {},
    savedChart: undefined,
    onBackToDashboard: undefined,
    mode: 'direct',
    theme: 'light',
    backgroundColor: null,
    timezone: null,
});

export default EmbedProviderContext;
