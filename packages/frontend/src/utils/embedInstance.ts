import { EMBED_KEY, type InMemoryEmbed } from '../ee/providers/Embed/types';
import { getFromInMemoryStorage } from './inMemoryStorage';

const LIGHTDASH_SDK_INSTANCE_URL_LOCAL_STORAGE_KEY =
    '__lightdash_sdk_instance_url';

type EmbedInstanceScope = {
    embed: InMemoryEmbed;
    instanceUrl: string | null;
};

export type ResolvedEmbedScope = {
    embed: InMemoryEmbed | undefined;
    instanceUrl: string | null;
    embedInstanceId: string | undefined;
};

// One entry per mounted SDK component, so several pieces on a host page can
// each send their own token. Pages with one piece keep using the default slot.
const embedInstances = new Map<string, EmbedInstanceScope>();

let currentEmbedInstanceId: string | undefined;

export const registerEmbedInstance = (
    embedInstanceId: string,
    scope: EmbedInstanceScope,
): void => {
    embedInstances.set(embedInstanceId, scope);
};

export const unregisterEmbedInstance = (embedInstanceId: string): void => {
    embedInstances.delete(embedInstanceId);
};

export const getEmbedInstance = (
    embedInstanceId: string,
): EmbedInstanceScope | undefined => embedInstances.get(embedInstanceId);

export const getCurrentEmbedInstanceId = (): string | undefined =>
    currentEmbedInstanceId;

// Marks the instance for the synchronous part of `fn` only. A fetcher reads it
// when it starts; code that fetches again after an await must pass the id on.
export const runInEmbedInstance = <T>(
    embedInstanceId: string | undefined,
    fn: () => T,
): T => {
    const previous = currentEmbedInstanceId;
    currentEmbedInstanceId = embedInstanceId;
    try {
        return fn();
    } finally {
        currentEmbedInstanceId = previous;
    }
};

export const resolveEmbedScope = (
    embedInstanceId?: string,
): ResolvedEmbedScope => {
    const id = embedInstanceId ?? currentEmbedInstanceId;
    const scope = id ? embedInstances.get(id) : undefined;
    if (id && scope) {
        return { ...scope, embedInstanceId: id };
    }
    return {
        embed: getFromInMemoryStorage<InMemoryEmbed>(EMBED_KEY),
        instanceUrl: sessionStorage.getItem(
            LIGHTDASH_SDK_INSTANCE_URL_LOCAL_STORAGE_KEY,
        ),
        embedInstanceId: undefined,
    };
};
