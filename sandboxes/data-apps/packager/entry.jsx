// Library entry injected by the packager in place of main.jsx. Keep the
// provider tree in sync with template/src/main.jsx.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createClient,
    createEmbedClient,
    LightdashProvider,
    VizContextProvider,
} from '@lightdash/query-sdk';
import { FilterProvider } from '@/lib/filters';
import { ErrorBoundary } from '@/lib/ErrorBoundary';
import './index.css';
import './chart-overrides.css';
import App from './App';
import initScreenshotHandler from './screenshotHandler';

// Vite emits the app's CSS beside this module; load it from wherever the module is served.
const STYLESHEET_URL = import.meta.url.replace(/\.js(\?.*)?$/, '.css');

function ensureStylesheet() {
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

/**
 * Render the app into `el`. Without `embedOptions` the app expects the
 * Lightdash app viewer (postMessage transport); with them it queries the API
 * directly using the embed JWT. Returns an unmount function.
 */
export function mount(el, embedOptions) {
    const isEmbedded = embedOptions !== undefined;
    const lightdash = isEmbedded
        ? createEmbedClient(embedOptions)
        : createClient();

    // Both handlers act on the whole page, which a customer's host page must keep.
    if (!isEmbedded) {
        import('@/lib/globalErrorHandler');
        initScreenshotHandler();
    }

    ensureStylesheet();
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: 1,
                staleTime: 30_000,
                refetchOnWindowFocus: false,
            },
        },
    });
    const root = ReactDOM.createRoot(el);
    root.render(
        <React.StrictMode>
            <QueryClientProvider client={queryClient}>
                <LightdashProvider client={lightdash}>
                    <FilterProvider>
                        <ErrorBoundary>
                            <VizContextProvider>
                                <App />
                            </VizContextProvider>
                        </ErrorBoundary>
                    </FilterProvider>
                </LightdashProvider>
            </QueryClientProvider>
        </React.StrictMode>,
    );
    return () => root.unmount();
}
