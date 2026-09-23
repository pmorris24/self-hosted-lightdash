import { useEffect, useRef, useState, type FC, type RefObject } from 'react';
import { agentTimeAgo } from './text';

/** When a turn was written. */
export const AgentTimestamp: FC<{ at: string }> = ({ at }) => (
    <time className="ld-agent-timestamp" dateTime={at}>
        {agentTimeAgo(at)}
    </time>
);

/** The rule between one day's turns and the next. */
export const AgentDayDivider: FC<{ at: string }> = ({ at }) => (
    <div className="ld-agent-day">
        <span>
            {new Date(at).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
            })}
        </span>
    </div>
);

/** Copy an answer, with the tick the product shows on success. */
export const AgentCopyButton: FC<{ text: string; label?: string }> = ({
    text,
    label = 'Copy answer',
}) => {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(false), 1400);
        return () => clearTimeout(timer);
    }, [copied]);

    return (
        <button
            type="button"
            className="ld-agent-copy"
            title={label}
            aria-label={label}
            onClick={() => {
                void navigator.clipboard
                    ?.writeText(text)
                    .then(() => setCopied(true))
                    .catch(() => undefined);
            }}
        >
            {copied ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            )}
        </button>
    );
};

/** The wait before the first word arrives. */
export const AgentTypingDots: FC = () => (
    <span className="ld-agent-typing" role="status" aria-label="The agent is writing">
        <span />
        <span />
        <span />
    </span>
);

/** A failed or stopped turn, asked again. */
export const AgentRetry: FC<{ onRetry: () => void; children?: string }> = ({
    onRetry,
    children = 'Try again',
}) => (
    <button type="button" className="ld-agent-retry" onClick={onRetry}>
        {children}
    </button>
);

/**
 * The control the product shows when a viewer has scrolled up mid-answer:
 * it appears only then, and takes them back to the newest turn.
 */
export const AgentScrollToBottom: FC<{
    viewport: RefObject<HTMLElement | null>;
    label?: string;
}> = ({ viewport, label = 'Jump to the latest' }) => {
    const [away, setAway] = useState(false);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        const element = viewport.current;
        if (!element) return undefined;
        const onScroll = () => {
            if (frame.current !== null) return;
            frame.current = requestAnimationFrame(() => {
                frame.current = null;
                const distance =
                    element.scrollHeight - element.scrollTop - element.clientHeight;
                setAway(distance > 120);
            });
        };
        onScroll();
        element.addEventListener('scroll', onScroll);
        return () => {
            element.removeEventListener('scroll', onScroll);
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, [viewport]);

    if (!away) return null;

    return (
        <button
            type="button"
            className="ld-agent-jump"
            title={label}
            aria-label={label}
            onClick={() => {
                const element = viewport.current;
                if (element) element.scrollTop = element.scrollHeight;
            }}
        >
            ↓
        </button>
    );
};
