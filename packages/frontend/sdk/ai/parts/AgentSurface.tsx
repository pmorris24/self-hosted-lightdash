import { useMemo, type CSSProperties, type FC, type ReactNode } from 'react';
import { SDK_SCOPE_CLASS } from '../../styles/scope.json';
import { useLightdashTheme } from '../../theme/themeContext';
import {
    agentThemeVariables,
    defaultAgentTheme,
    mergeAgentThemes,
    type AgentThemeSettings,
} from '../agentTheme';

export type AgentSurfaceProps = {
    /**
     * What this surface looks like, over the `agent` section of the
     * surrounding `ThemeProvider` and the SDK's own defaults.
     */
    styleOptions?: AgentThemeSettings;
    // A column of this width, or `grow` to take the room left beside one.
    width?: number | string;
    grow?: boolean;
    height?: number | string;
    // The card's border and corners. Off for a surface inside your own frame.
    bordered?: boolean;
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
};

/**
 * The container every agent part lives in. It resolves the theme — the SDK's
 * defaults, the page's `agent` section, then this surface's own
 * `styleOptions` — and puts the result on itself as custom properties, so the
 * parts inside read the same look without being passed anything.
 *
 * It stands alone: a page needs no Lightdash provider above it for the parts
 * to render correctly, and surfaces can nest, so a dock inside a page-wide
 * theme with its own narrower column is two surfaces.
 */
export const AgentSurface: FC<AgentSurfaceProps> = ({
    styleOptions,
    width,
    grow = false,
    height,
    bordered = true,
    className,
    style,
    children,
}) => {
    const { agent, colorScheme } = useLightdashTheme();
    // Defaults first, so every part has a complete theme even on a page with
    // no Lightdash provider above it.
    const settings = useMemo(
        () =>
            mergeAgentThemes(
                mergeAgentThemes(defaultAgentTheme(colorScheme), agent),
                styleOptions,
            ),
        [agent, colorScheme, styleOptions],
    );
    const variables = useMemo(() => agentThemeVariables(settings), [settings]);

    return (
        <div
            className={[
                SDK_SCOPE_CLASS,
                'ld-agent-surface',
                bordered ? 'ld-agent-surface--bordered' : null,
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            data-agent-max-width={
                settings.body?.maxWidth === undefined ? undefined : ''
            }
            data-agent-padding={
                settings.body?.padding === undefined ? undefined : ''
            }
            style={{
                ...variables,
                ...(grow ? { flex: 1, minWidth: 0 } : {}),
                ...(width === undefined ? {} : { width, flex: 'none' }),
                ...(height === undefined ? {} : { height }),
                ...style,
            }}
        >
            {children}
        </div>
    );
};
