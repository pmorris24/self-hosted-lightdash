import { createContext, useContext } from 'react';

export type EmbedInstance = {
    embedInstanceId: string;
    instanceUrl: string | null;
};

// Set by each SDK component. Absent in the main app and in direct iframe embeds.
export const EmbedInstanceContext = createContext<EmbedInstance | null>(null);

export const useEmbedInstance = (): EmbedInstance | null =>
    useContext(EmbedInstanceContext);
