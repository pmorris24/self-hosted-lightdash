import { createContext, useContext } from 'react';

export type LightdashTheme = {
    colorScheme?: 'light' | 'dark';
    backgroundColor?: string;
    fontFamily?: string;
    // Series colours of the charts a host feeds with rows. A saved chart keeps
    // the palette of its organization; use `paletteUuid` to change that one.
    palette?: string[];
};

export const ThemeContext = createContext<LightdashTheme>({});

export const useLightdashTheme = (): LightdashTheme => useContext(ThemeContext);
