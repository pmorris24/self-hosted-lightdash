import { createContext, useContext } from 'react';
import { type AgentThemeSettings } from '../ai/agentTheme';

export type LightdashTheme = {
    colorScheme?: 'light' | 'dark';
    backgroundColor?: string;
    fontFamily?: string;
    // Series colours of the charts a host feeds with rows. A saved chart keeps
    // the palette of its organization; use `paletteUuid` to change that one.
    palette?: string[];
    // The look of one surface, in sections of its own. A piece's own
    // `styleOptions` still wins over what is set here.
    agent?: AgentThemeSettings;
};

export const ThemeContext = createContext<LightdashTheme>({});

export const useLightdashTheme = (): LightdashTheme => useContext(ThemeContext);
