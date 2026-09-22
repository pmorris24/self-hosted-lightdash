import { useEffect, useState } from 'react';

/** Reports the natural content height for an opt-in, page-sized embed. */
export const useEmbedContentHeight = () => {
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const enabled =
        window.parent !== window &&
        new URLSearchParams(window.location.search).get('fitContent') ===
            'true';

    useEffect(() => {
        if (!enabled || !element || !document.referrer) return undefined;

        let parentOrigin: string;
        try {
            parentOrigin = new URL(document.referrer).origin;
        } catch {
            return undefined;
        }

        let lastHeight = 0;
        const reportHeight = () => {
            const style = window.getComputedStyle(element);
            const height = Math.ceil(
                element.getBoundingClientRect().height +
                    (parseFloat(style.marginTop) || 0) +
                    (parseFloat(style.marginBottom) || 0),
            );
            if (height <= 0 || height === lastHeight) return;
            lastHeight = height;
            window.parent.postMessage(
                { type: 'lightdash:contentHeight', height },
                parentOrigin,
            );
        };

        const observer = new ResizeObserver(reportHeight);
        observer.observe(element);
        reportHeight();
        return () => observer.disconnect();
    }, [element, enabled]);

    return { enabled, ref: setElement };
};
