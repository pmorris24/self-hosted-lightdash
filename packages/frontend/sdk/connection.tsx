import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type FC,
    type PropsWithChildren,
} from 'react';
import type { LightdashApiClientConfig } from './api';

export type SdkConnection = {
    instanceUrl: string;
    token: Promise<string> | string;
    theme?: 'light' | 'dark';
    styles?: {
        backgroundColor?: string;
        fontFamily?: string;
    };
};

export const SdkConnectionContext = createContext<SdkConnection | null>(null);

export type SdkProviderProps = PropsWithChildren<SdkConnection>;

/**
 * One connection for a host page. Pieces inside it can omit `instanceUrl`,
 * `token`, `theme` and `styles`; a prop on a piece still wins.
 */
export const SdkConnectionProvider: FC<SdkProviderProps> = ({
    children,
    instanceUrl,
    token,
    theme,
    styles,
}) => {
    const connection = useMemo(
        () => ({ instanceUrl, token, theme, styles }),
        [instanceUrl, token, theme, styles],
    );
    return (
        <SdkConnectionContext.Provider value={connection}>
            {children}
        </SdkConnectionContext.Provider>
    );
};

const decodeTokenPayload = (token: string): Record<string, unknown> | null => {
    const splits = token.split('.');
    if (splits.length !== 3) return null;
    try {
        return JSON.parse(atob(splits[1])) as Record<string, unknown>;
    } catch {
        return null;
    }
};

// The config of the page's connection, or null when there is no provider.
// Until a token promise resolves, the config has no project, which keeps the
// hooks idle.
const useConnectionConfig = (): LightdashApiClientConfig | null => {
    const shared = useContext(SdkConnectionContext);
    const instanceUrl = shared?.instanceUrl;
    const tokenOrTokenPromise = shared?.token;
    const [token, setToken] = useState<string | null>(
        typeof tokenOrTokenPromise === 'string' ? tokenOrTokenPromise : null,
    );

    useEffect(() => {
        if (tokenOrTokenPromise === undefined) return undefined;
        let isCurrent = true;
        void Promise.resolve(tokenOrTokenPromise).then((resolved) => {
            if (isCurrent) setToken(resolved);
        });
        return () => {
            isCurrent = false;
        };
    }, [tokenOrTokenPromise]);

    return useMemo(() => {
        if (instanceUrl === undefined) return null;
        if (!token) return { instanceUrl };
        const payload = decodeTokenPayload(token);
        const content =
            payload && typeof payload.content === 'object'
                ? (payload.content as { projectUuid?: unknown })
                : null;
        const projectUuid =
            typeof content?.projectUuid === 'string'
                ? content.projectUuid
                : undefined;
        return {
            instanceUrl,
            projectUuid,
            auth: { type: 'embedToken', token },
        };
    }, [instanceUrl, token]);
};

/**
 * The hook config of the page's `Lightdash.Provider`: the instance, the
 * project of the token and the token itself. Hooks read it on their own, so
 * a page needs this only to pass a config somewhere by hand.
 */
export const useLightdashConfig = (): LightdashApiClientConfig => {
    const config = useConnectionConfig();
    if (!config) {
        throw new Error(
            'Lightdash SDK: useLightdashConfig needs a <Lightdash.Provider> above it.',
        );
    }
    return config;
};

/**
 * The config a hook runs with: the one the caller passed, or the page's
 * `Lightdash.Provider`. Lets every hook take the config as an option rather
 * than a first argument.
 */
export const useResolvedConfig = (
    config: LightdashApiClientConfig | undefined,
): LightdashApiClientConfig => {
    const fromProvider = useConnectionConfig();
    if (config) return config;
    if (!fromProvider) {
        throw new Error(
            'Lightdash SDK: pass `config`, or wrap this in <Lightdash.Provider>.',
        );
    }
    return fromProvider;
};
