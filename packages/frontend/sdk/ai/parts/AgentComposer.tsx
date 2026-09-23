import {
    useRef,
    useState,
    type FC,
    type FormEvent,
    type PointerEvent as ReactPointerEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from 'react';

export type AgentComposerProps = {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    // Shown as a stop button while the agent is writing.
    onStop?: () => void;
    isStreaming?: boolean;
    placeholder?: string;
    rows?: number;
    // The longest question the agent takes. The counter appears near it.
    maxLength?: number;
    // Files riding along with the next question, by name. Leave `onFiles` out
    // and the attach control never appears.
    files?: string[];
    onFiles?: (files: string[]) => void;
    // The hint under the box. `null` removes it.
    hint?: ReactNode;
    // Your own controls on the bar, beside the attach button.
    children?: ReactNode;
};

const DEFAULT_HINT = (
    <>
        <kbd>⏎</kbd> send · <kbd>⇧⏎</kbd> new line
    </>
);

// How tall the box can be dragged, and the step the arrow keys take.
const MIN_BOX_HEIGHT = 44;
const MAX_BOX_HEIGHT = 480;
const KEY_STEP = 24;

const clampHeight = (height: number) =>
    Math.min(MAX_BOX_HEIGHT, Math.max(MIN_BOX_HEIGHT, Math.round(height)));

/**
 * The box a viewer types in: a draft, the files that ride along with it, send,
 * and stop while the agent is writing. Enter sends; shift-enter is a new line.
 */
export const AgentComposer: FC<AgentComposerProps> = ({
    value,
    onChange,
    onSend,
    onStop,
    isStreaming = false,
    placeholder = 'Ask about your data…',
    rows = 2,
    maxLength = 4000,
    files,
    onFiles,
    hint = DEFAULT_HINT,
    children,
}) => {
    const fileInput = useRef<HTMLInputElement>(null);
    const box = useRef<HTMLTextAreaElement>(null);
    // The handle above the box sets its height: null until a viewer drags it,
    // so `rows` decides the height until then.
    const [boxHeight, setBoxHeight] = useState<number | null>(null);
    const drag = useRef<{ from: number; height: number } | null>(null);
    const currentHeight = () =>
        boxHeight ??
        box.current?.getBoundingClientRect().height ??
        MIN_BOX_HEIGHT;

    const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { from: event.clientY, height: currentHeight() };
    };
    const onDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!drag.current) return;
        // Up is taller: the box grows towards the conversation.
        setBoxHeight(
            clampHeight(
                drag.current.height + (drag.current.from - event.clientY),
            ),
        );
    };
    const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!drag.current) return;
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
    };
    const onGripKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        setBoxHeight(
            clampHeight(
                currentHeight() +
                    (event.key === 'ArrowUp' ? KEY_STEP : -KEY_STEP),
            ),
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (value.trim()) onSend();
    };

    return (
        <form className="ld-agent-composer ld-agent-part" onSubmit={submit}>
            {/* Drag it, or take it with the keyboard and use the arrows. */}
            <div
                className="ld-agent-composer__grip"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize the message box"
                aria-valuenow={Math.round(currentHeight())}
                aria-valuemin={MIN_BOX_HEIGHT}
                aria-valuemax={MAX_BOX_HEIGHT}
                tabIndex={0}
                onPointerDown={startDrag}
                onPointerMove={onDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onGripKeyDown}
                onDoubleClick={() => setBoxHeight(null)}
            />
            <div className="ld-agent-composer__shell">
                {files && files.length > 0 && (
                    <div className="ld-agent-composer__files">
                        {files.map((file) => (
                            <span
                                key={file}
                                className="ld-agent-composer__file"
                            >
                                {file}
                                <button
                                    type="button"
                                    aria-label={`Remove ${file}`}
                                    onClick={() =>
                                        onFiles?.(
                                            files.filter(
                                                (other) => other !== file,
                                            ),
                                        )
                                    }
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <textarea
                    ref={box}
                    className="ld-agent-composer__input"
                    rows={rows}
                    style={
                        boxHeight === null ? undefined : { height: boxHeight }
                    }
                    value={value}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    onChange={(event) =>
                        onChange(event.target.value.slice(0, maxLength))
                    }
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            if (value.trim()) onSend();
                        }
                    }}
                />
                <div className="ld-agent-composer__bar">
                    {onFiles && (
                        <>
                            <input
                                ref={fileInput}
                                type="file"
                                multiple
                                hidden
                                onChange={(event) => {
                                    onFiles([
                                        ...(files ?? []),
                                        ...[...(event.target.files ?? [])].map(
                                            (file) => file.name,
                                        ),
                                    ]);
                                    event.target.value = '';
                                }}
                            />
                            <button
                                type="button"
                                className="ld-agent-composer__attach"
                                onClick={() => fileInput.current?.click()}
                            >
                                + Add files
                            </button>
                        </>
                    )}
                    {children}
                    {isStreaming && onStop ? (
                        <button
                            type="button"
                            className="ld-agent-send ld-agent-send--stop"
                            onClick={onStop}
                            aria-label="Stop generating"
                        >
                            <span className="ld-agent-send__stop" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            className="ld-agent-send"
                            disabled={!value.trim() || isStreaming}
                            aria-label="Send"
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.25"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M12 19V5m-6 6 6-6 6 6" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            {hint && (
                <span
                    className={`ld-agent-composer__hint${
                        value.length > maxLength * 0.85 ? ' is-near-limit' : ''
                    }`}
                >
                    {value.length > maxLength * 0.85
                        ? `${value.length.toLocaleString()} / ${maxLength.toLocaleString()}`
                        : hint}
                </span>
            )}
        </form>
    );
};
