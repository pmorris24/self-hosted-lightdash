// Library entry injected by the packager in place of main.jsx. Keep the
// provider tree in sync with template/src/main.jsx.
import React, { useLayoutEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createClient,
    createEmbedClient,
    LightdashProvider,
    setColorScheme,
    useColorScheme,
    VizContextProvider,
} from '@lightdash/query-sdk';
import { FilterProvider } from '@/lib/filters';
import { ErrorBoundary } from '@/lib/ErrorBoundary';
import './index.css';
import './chart-overrides.css';
import App from './App';
import initScreenshotHandler from './screenshotHandler';
import {
    registerScopeElement,
    releasePortalRoot,
    retainPortalRoot,
    scopePage,
    setScopeColorScheme,
} from './__lightdash_packager/scope';

const FILE_BASE = __LIGHTDASH_APP_FILE_BASE__;
const MODULE_FILE = new URL(import.meta.url).pathname.split('/').pop();
// Served as built (CDN, static host), the module loads the stylesheet beside
// it. Bundled into a host app, the host imports '<package>/style.css' instead.
const SERVED_AS_BUILT =
    MODULE_FILE === `${FILE_BASE}.js` ||
    MODULE_FILE === `${FILE_BASE}.standalone.js`;
const STYLESHEET_URL = import.meta.url.replace(/[^/]*$/, `${FILE_BASE}.css`);

function ensureStylesheet() {
    if (!SERVED_AS_BUILT) return;
    const alreadyLoaded = [
        ...document.querySelectorAll('link[data-lightdash-app-styles]'),
    ].some((link) => link.href === STYLESHEET_URL);
    if (alreadyLoaded) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLESHEET_URL;
    link.dataset.lightdashAppStyles = '';
    document.head.appendChild(link);
}

function ScopeColorScheme() {
    const colorScheme = useColorScheme();
    useLayoutEffect(() => setScopeColorScheme(colorScheme), [colorScheme]);
    return null;
}

function AppTree({ lightdash }) {
    const [queryClient] = React.useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: 1,
                        staleTime: 30_000,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
    );
    return (
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <LightdashProvider client={lightdash}>
                    <ScopeColorScheme />
                    <FilterProvider>
                        <ErrorBoundary>
                            <VizContextProvider>
                                <App />
                            </VizContextProvider>
                        </ErrorBoundary>
                    </FilterProvider>
                </LightdashProvider>
            </QueryClientProvider>
        </React.StrictMode>
    );
}

/**
 * Render the app into `el`. Without `embedOptions` the app expects the
 * Lightdash app viewer (postMessage transport); with them it queries the API
 * directly using the embed JWT and stays inside `el`.
 */
export function mount(el, embedOptions) {
    ensureStylesheet();
    const root = ReactDOM.createRoot(el);

    if (embedOptions === undefined) {
        const lightdash = createClient();
        // The page is the app's, exactly as with main.jsx.
        import('@/lib/globalErrorHandler');
        initScreenshotHandler();
        const releasePage = scopePage();
        root.render(<AppTree lightdash={lightdash} />);
        return {
            unmount: () => {
                root.unmount();
                releasePage();
            },
            setColorScheme,
        };
    }

    const { colorScheme, ...clientOptions } = embedOptions;
    const lightdash = createEmbedClient(clientOptions);
    if (colorScheme !== undefined) setColorScheme(colorScheme);
    retainPortalRoot();
    root.render(
        <div ref={registerScopeElement}>
            <AppTree lightdash={lightdash} />
        </div>,
    );
    return {
        unmount: () => {
            root.unmount();
            releasePortalRoot();
        },
        setColorScheme,
    };
}
