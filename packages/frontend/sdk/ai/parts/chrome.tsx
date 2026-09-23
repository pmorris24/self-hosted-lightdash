import { useState, type FC, type ReactNode } from 'react';

/**
 * The Lightdash bolt as one continuous outline, so it can draw itself while
 * the agent works and sit still once it is done.
 */
export const AgentBolt: FC<{ size?: number; working?: boolean }> = ({
    size = 16,
    working = false,
}) => (
    <svg
        width={size}
        height={size * (25 / 17.5)}
        viewBox="9.5 5.5 17.5 25"
        fill="none"
        className={`ld-agent-bolt${working ? '' : ' ld-agent-bolt--still'}`}
        aria-hidden="true"
    >
        <path
            className="ld-agent-bolt__path"
            pathLength={100}
            d="M13.52 7 L20.01 7 L21.05 8.32 L19.33 13.57 L24.38 13.57 L25.31 15.15 L16.5 28.99 L15.46 27.7 L17.47 19.58 L12.08 19.58 L11.01 18.39 L12.45 7.91 Z"
        />
    </svg>
);

/**
 * The mark an empty panel leads with, and the mark a host page can hand the
 * agent in place of its avatar. `size` is the tile: the bolt is drawn to fit.
 * Pass your own logo as `children`.
 */
export const AgentMark: FC<{
    size?: number;
    working?: boolean;
    children?: ReactNode;
}> = ({ size = 64, working = false, children }) => (
    <div
        className="ld-agent-mark"
        style={{
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.28),
        }}
    >
        {children ?? (
            <AgentBolt size={Math.round(size * 0.4)} working={working} />
        )}
    </div>
);

/** A pane's title bar: a quiet label, and whatever actions the page adds. */
export const AgentPaneHeader: FC<{ title: string; children?: ReactNode }> = ({
    title,
    children,
}) => (
    <header className="ld-agent-pane-header">
        <span className="ld-agent-pane-header__title">{title}</span>
        <span className="ld-agent-pane-header__actions">{children}</span>
    </header>
);

/** A row of the same height as the header, for a picker or a status line. */
export const AgentToolbar: FC<{ children: ReactNode }> = ({ children }) => (
    <div className="ld-agent-toolbar">{children}</div>
);

export const AgentIconButton: FC<{
    label: string;
    onClick?: () => void;
    children: ReactNode;
}> = ({ label, onClick, children }) => (
    <button
        type="button"
        className="ld-agent-icon-button"
        title={label}
        aria-label={label}
        onClick={onClick}
    >
        {children}
    </button>
);

export const AgentColumnsIcon: FC = () => (
    <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
    >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M12 4v16" />
    </svg>
);

export const AgentPlusIcon: FC = () => (
    <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
    >
        <path d="M12 5v14M5 12h14" />
    </svg>
);

export type AgentOption = {
    id: string;
    label: string;
    // Shown at the end of the row: a model name, a permission, a time.
    note?: string;
};

/** Which agent — or which conversation — a panel is showing. */
export const AgentSelect: FC<{
    options: AgentOption[];
    value: string;
    onChange: (id: string) => void;
    label?: string;
    placeholder?: string;
}> = ({
    options,
    value,
    onChange,
    label = 'Agent',
    placeholder = 'Choose an agent',
}) => {
    const [open, setOpen] = useState(false);
    const current = options.find((option) => option.id === value);

    return (
        <div className="ld-agent-select">
            <button
                type="button"
                className="ld-agent-select__button"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((shown) => !shown)}
            >
                <span className="ld-agent-select__current">
                    <AgentBolt size={13} />
                    {current?.label ?? placeholder}
                </span>
                <span className="ld-agent-select__chevron" aria-hidden="true">
                    ⌄
                </span>
            </button>
            {open && (
                <div className="ld-agent-select__menu" role="listbox">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={option.id === value}
                            className={`ld-agent-select__option${option.id === value ? ' is-selected' : ''}`}
                            onClick={() => {
                                onChange(option.id);
                                setOpen(false);
                            }}
                        >
                            <span className="ld-agent-select__option-label">
                                <AgentBolt size={12} />
                                {option.label}
                            </span>
                            {option.note && (
                                <span className="ld-agent-select__note">
                                    {option.note}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Ready, Working, Error — the state of one conversation. */
export const AgentStatus: FC<{
    state: 'ready' | 'working' | 'error';
    children?: ReactNode;
}> = ({ state, children }) => (
    <span className={`ld-agent-status ld-agent-status--${state}`} role="status">
        {children ??
            (state === 'working'
                ? 'Working'
                : state === 'error'
                  ? 'Error'
                  : 'Ready')}
    </span>
);

/** The panel before anyone has asked anything. */
export const AgentWelcome: FC<{
    art?: ReactNode;
    title: string;
    accent?: string;
    children?: ReactNode;
}> = ({ art, title, accent, children }) => (
    <div className="ld-agent-welcome">
        <div className="ld-agent-welcome__inner">
            {art ?? <AgentMark />}
            <h2 className="ld-agent-welcome__title">
                {title}
                {accent && (
                    <>
                        <br />
                        <span>{accent}</span>
                    </>
                )}
            </h2>
            {children}
        </div>
    </div>
);

/** A question to start from, as a card a viewer can press. */
export const AgentSuggestion: FC<{
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
}> = ({ onClick, disabled, children }) => (
    <button
        type="button"
        className="ld-agent-suggestion ld-agent-part"
        disabled={disabled}
        onClick={onClick}
    >
        {children}
    </button>
);
