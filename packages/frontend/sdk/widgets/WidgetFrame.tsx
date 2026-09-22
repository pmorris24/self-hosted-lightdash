import { type CSSProperties, type FC, type PropsWithChildren } from 'react';

export type WidgetStyleOptions = {
    backgroundColor?: string;
    border?: boolean;
    borderColor?: string;
    cornerRadius?: number;
    // Show the title bar. Default: true when there is a title.
    header?: boolean;
    padding?: number;
};

export type WidgetFrameProps = PropsWithChildren<{
    title?: string;
    description?: string;
    styleOptions?: WidgetStyleOptions;
    height?: number | string;
}>;

const headerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '10px 14px',
    borderBottom: '1px solid var(--lightdash-widget-border)',
};

/** The title bar and border that every widget shares. */
export const WidgetFrame: FC<WidgetFrameProps> = ({
    title,
    description,
    styleOptions = {},
    height = '100%',
    children,
}) => {
    const {
        backgroundColor,
        border = true,
        borderColor = 'rgba(127, 127, 127, 0.3)',
        cornerRadius = 8,
        header = !!title,
        padding = 0,
    } = styleOptions;
    const frameStyle = {
        '--lightdash-widget-border': borderColor,
        display: 'flex',
        flexDirection: 'column',
        height,
        overflow: 'hidden',
        backgroundColor,
        border: border ? `1px solid ${borderColor}` : undefined,
        borderRadius: cornerRadius,
    } as CSSProperties;

    return (
        <section style={frameStyle} data-lightdash-widget="" aria-label={title}>
            {header && (
                <header style={headerStyle}>
                    <strong style={{ fontSize: 14 }}>{title}</strong>
                    {description && (
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                            {description}
                        </span>
                    )}
                </header>
            )}
            <div style={{ flex: 1, minHeight: 0, padding }}>{children}</div>
        </section>
    );
};
