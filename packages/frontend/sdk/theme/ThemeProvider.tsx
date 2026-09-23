import { useContext, useMemo, type FC, type PropsWithChildren } from 'react';
import { mergeAgentThemes } from '../ai/agentTheme';
import { ThemeContext, type LightdashTheme } from './themeContext';

type Props = PropsWithChildren<{ theme: LightdashTheme }>;

/**
 * One look for every Lightdash piece inside it. A nested provider changes only
 * the keys it sets, and a surface's own section — the agent's — is laid over
 * the outer one section by section rather than replacing it. A prop on a piece
 * still wins.
 */
export const ThemeProvider: FC<Props> = ({ theme, children }) => {
    const parent = useContext(ThemeContext);
    const merged = useMemo(
        () => ({
            ...parent,
            ...theme,
            ...(parent.agent || theme.agent
                ? { agent: mergeAgentThemes(parent.agent, theme.agent) }
                : {}),
        }),
        [parent, theme],
    );
    return (
        <ThemeContext.Provider value={merged}>{children}</ThemeContext.Provider>
    );
};
