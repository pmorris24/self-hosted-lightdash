import { useContext, useMemo, type FC, type PropsWithChildren } from 'react';
import { ThemeContext, type LightdashTheme } from './themeContext';

type Props = PropsWithChildren<{ theme: LightdashTheme }>;

/**
 * One look for every Lightdash piece inside it. A nested provider changes only
 * the keys it sets. A prop on a piece still wins.
 */
export const ThemeProvider: FC<Props> = ({ theme, children }) => {
    const parent = useContext(ThemeContext);
    const merged = useMemo(() => ({ ...parent, ...theme }), [parent, theme]);
    return (
        <ThemeContext.Provider value={merged}>{children}</ThemeContext.Provider>
    );
};
