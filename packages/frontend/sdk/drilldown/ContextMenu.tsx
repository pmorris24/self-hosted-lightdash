import { useEffect, useRef, type CSSProperties, type FC } from 'react';
import { createPortal } from 'react-dom';

export type ContextMenuItem = {
    caption: string;
    onClick: () => void;
    disabled?: boolean;
};

export type ContextMenuSection = {
    sectionTitle?: string;
    items: ContextMenuItem[];
};

type Props = {
    // Viewport pixels, as in `selection.position`. `null` closes the menu.
    position: { left: number; top: number } | null;
    itemSections: ContextMenuSection[];
    closeContextMenu: () => void;
    style?: CSSProperties;
};

const menuStyle: CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    minWidth: 180,
    padding: 4,
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: 8,
    background: '#fff',
    color: '#111827',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
    fontSize: 13,
};

const sectionTitleStyle: CSSProperties = {
    padding: '6px 10px 2px',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    opacity: 0.6,
};

const itemStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    border: 0,
    borderRadius: 6,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
};

/**
 * A menu at the point a viewer clicked. It renders on the host page, outside
 * the style scope of the chart, so `style` sets its whole look.
 */
export const ContextMenu: FC<Props> = ({
    position,
    itemSections,
    closeContextMenu,
    style,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!position) return undefined;
        const onPointerDown = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                menuRef.current?.contains(event.target)
            ) {
                return;
            }
            closeContextMenu();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeContextMenu();
        };
        // Wait for the opening click to finish, or it would close the menu.
        const timer = window.setTimeout(() => {
            document.addEventListener('pointerdown', onPointerDown);
        });
        document.addEventListener('keydown', onKeyDown);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [position, closeContextMenu]);

    if (!position) return null;

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            data-lightdash-context-menu=""
            style={{
                ...menuStyle,
                left: position.left,
                top: position.top,
                ...style,
            }}
        >
            {itemSections.map((section, sectionIndex) => (
                <div key={section.sectionTitle ?? sectionIndex} role="group">
                    {section.sectionTitle && (
                        <div style={sectionTitleStyle}>
                            {section.sectionTitle}
                        </div>
                    )}
                    {section.items.map((item) => (
                        <button
                            key={item.caption}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            style={{
                                ...itemStyle,
                                opacity: item.disabled ? 0.45 : 1,
                            }}
                            onClick={() => {
                                item.onClick();
                                closeContextMenu();
                            }}
                        >
                            {item.caption}
                        </button>
                    ))}
                </div>
            ))}
        </div>,
        document.body,
    );
};
