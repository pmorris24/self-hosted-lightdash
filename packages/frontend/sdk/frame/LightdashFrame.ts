import { type SdkFilter } from '../../src/ee/features/embed/EmbedDashboard/types';

const EVENT_NAMESPACE = 'lightdash:';
const COMMAND_NAMESPACE = 'lightdash:command:';

export type LightdashFrameTheme = 'light' | 'dark';

export type LightdashFrameEventName =
    | 'ready'
    | 'error'
    | 'filterChanged'
    | 'tabChanged'
    | 'allTilesLoaded'
    | 'locationChanged'
    | 'chartSaved';

export type LightdashFrameEvent = {
    type: LightdashFrameEventName;
    payload: unknown;
    timestamp: number;
};

export type LightdashFrameOptions = {
    // Where Lightdash runs, for example `https://lightdash.example.com`.
    instanceUrl: string;
    projectUuid: string;
    // The embed token, or a function that gets one from your server.
    token: string | (() => Promise<string>);
    // An element of your page, or a selector for one.
    container: HTMLElement | string;
    // Set it when the token is signed for one chart, not for a dashboard.
    chartUuid?: string;
    theme?: LightdashFrameTheme;
    // Applied as soon as the frame reports that it is ready.
    filters?: SdkFilter[];
    title?: string;
};

type Handler = (event: LightdashFrameEvent) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

/**
 * A Lightdash embed in an iframe that the page around it can control. It needs
 * no React. Commands wait until the frame is ready, then go only to the
 * Lightdash origin; events are taken only from that origin and that frame.
 */
export class LightdashFrame {
    private readonly options: LightdashFrameOptions;

    private readonly instanceOrigin: string;

    private readonly handlers = new Map<string, Set<Handler>>();

    private iframe: HTMLIFrameElement | null = null;

    private isReady = false;

    private pending: { type: string; payload: unknown }[] = [];

    readonly filters = {
        set: (filters: SdkFilter[]) => this.send('setFilters', { filters }),
        clear: () => this.send('setFilters', { filters: [] }),
    };

    constructor(options: LightdashFrameOptions) {
        this.options = options;
        this.instanceOrigin = new URL(options.instanceUrl).origin;
    }

    async render(): Promise<HTMLIFrameElement> {
        const { container, token, theme, chartUuid } = this.options;
        const parent =
            typeof container === 'string'
                ? document.querySelector<HTMLElement>(container)
                : container;
        if (!parent) {
            throw new Error(`LightdashFrame: no element matches ${container}`);
        }
        this.destroy();

        const resolvedToken = typeof token === 'string' ? token : await token();
        const url = new URL(
            `/embed/${this.options.projectUuid}${chartUuid ? `/chart/${chartUuid}` : ''}`,
            this.instanceOrigin,
        );
        url.searchParams.set('targetOrigin', window.location.origin);
        if (theme) url.searchParams.set('theme', theme);
        // The token goes after `#`, so it is never sent in a request line.
        url.hash = resolvedToken;

        const iframe = document.createElement('iframe');
        iframe.src = url.toString();
        iframe.title = this.options.title ?? 'Lightdash';
        iframe.style.cssText = 'width:100%;height:100%;border:0;display:block';
        window.addEventListener('message', this.onMessage);
        parent.appendChild(iframe);
        this.iframe = iframe;

        if (this.options.filters) this.filters.set(this.options.filters);
        return iframe;
    }

    setTheme(theme: LightdashFrameTheme): void {
        this.send('setTheme', { theme });
    }

    on(eventName: LightdashFrameEventName, handler: Handler): () => void {
        const handlers = this.handlers.get(eventName) ?? new Set<Handler>();
        handlers.add(handler);
        this.handlers.set(eventName, handlers);
        return () => handlers.delete(handler);
    }

    destroy(): void {
        window.removeEventListener('message', this.onMessage);
        this.iframe?.remove();
        this.iframe = null;
        this.isReady = false;
        this.pending = [];
    }

    private send(command: string, payload: unknown): void {
        const message = { type: `${COMMAND_NAMESPACE}${command}`, payload };
        if (!this.isReady) {
            // Only the last value of each command matters once the frame is up.
            this.pending = [
                ...this.pending.filter((item) => item.type !== message.type),
                message,
            ];
            return;
        }
        this.iframe?.contentWindow?.postMessage(message, this.instanceOrigin);
    }

    private onMessage = (event: MessageEvent): void => {
        if (event.origin !== this.instanceOrigin) return;
        if (!this.iframe || event.source !== this.iframe.contentWindow) return;
        const { data } = event;
        if (!isRecord(data) || typeof data.type !== 'string') return;
        if (!data.type.startsWith(EVENT_NAMESPACE)) return;
        if (data.type.startsWith(COMMAND_NAMESPACE)) return;

        const type = data.type.slice(
            EVENT_NAMESPACE.length,
        ) as LightdashFrameEventName;
        if (type === 'ready' && !this.isReady) {
            this.isReady = true;
            const queued = this.pending;
            this.pending = [];
            queued.forEach((message) =>
                this.iframe?.contentWindow?.postMessage(
                    message,
                    this.instanceOrigin,
                ),
            );
        }
        this.handlers.get(type)?.forEach((handler) =>
            handler({
                type,
                payload: data.payload,
                timestamp:
                    typeof data.timestamp === 'number'
                        ? data.timestamp
                        : Date.now(),
            }),
        );
    };
}
