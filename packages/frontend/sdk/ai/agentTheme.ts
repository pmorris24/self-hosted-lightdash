import { type CSSProperties } from 'react';

/**
 * How the agent's conversation looks, laid out in sections: the whole chat
 * first, then the parts of it. Every setting is optional, and one that a page
 * leaves out keeps what Lightdash uses — so a page can change the accent, or
 * just the question bubbles, without inheriting a theme it did not ask for.
 *
 * A number is a length in pixels. A colour is any CSS colour.
 */
export type AgentThemeSettings = {
    /** Surface the conversation sits on. */
    backgroundColor?: string;
    /** Colour of the agent's answers and the viewer's questions. */
    primaryTextColor?: string;
    /** Colour of timestamps, hints and the agent's status line. */
    secondaryTextColor?: string;
    /** Size of the conversation's text. */
    primaryFontSize?: number;
    fontFamily?: string;
    /** Send button, links, focus rings and the agent's own marks. */
    accentColor?: string;
    /** Text and icons drawn on the accent. */
    accentTextColor?: string;
    borderColor?: string;
    /** Corner radius of the bubbles and cards. */
    borderRadius?: number;
    /** The column the conversation is laid out in. */
    body?: {
        /** How wide the column may grow. */
        maxWidth?: number;
        /** Space either side of the column. */
        padding?: number;
        gapBetweenMessages?: number;
    };
    /** A question the viewer asked. */
    userMessages?: {
        backgroundColor?: string;
        textColor?: string;
        borderRadius?: number;
    };
    /** An answer the agent gave, its tool work included. */
    systemMessages?: {
        backgroundColor?: string;
        textColor?: string;
    };
    /** The box the viewer types in. */
    input?: {
        backgroundColor?: string;
        borderColor?: string;
        borderRadius?: number;
        focus?: {
            outlineColor?: string;
        };
    };
    /** The suggested questions offered before the first message. */
    suggestions?: {
        textColor?: string;
        backgroundColor?: string;
        borderColor?: string;
        borderRadius?: number;
        hover?: {
            textColor?: string;
            backgroundColor?: string;
        };
    };
    /** A chart the agent made, shown in the conversation. */
    charts?: {
        backgroundColor?: string;
        borderColor?: string;
        borderRadius?: number;
    };
};

type Settings = { [key: string]: string | number | Settings | undefined };

const isSection = (value: unknown): value is Settings =>
    typeof value === 'object' && value !== null;

const kebab = (name: string) =>
    name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * The settings as custom properties, to put on the agent's container. The name
 * of each one follows its place in the theme, so `userMessages.backgroundColor`
 * becomes `--lightdash-agent-user-messages-background-color`. A setting a page
 * did not make is absent, and the stylesheet's fallback — what Lightdash itself
 * uses — stands.
 */
export const agentThemeVariables = (
    settings: AgentThemeSettings = {},
): CSSProperties => {
    const variables: Record<string, string> = {};

    const walk = (section: Settings, path: string[]) => {
        Object.entries(section).forEach(([name, value]) => {
            if (value === undefined) return;
            const here = [...path, kebab(name)];
            if (isSection(value)) {
                walk(value, here);
                return;
            }
            variables[`--lightdash-agent-${here.join('-')}`] =
                typeof value === 'number' ? `${value}px` : value;
        });
    };

    walk(settings as Settings, []);
    return variables as CSSProperties;
};

/**
 * One theme laid over another, section by section: a page's `styleOptions` over
 * what the surrounding `ThemeProvider` set. A section the override does not
 * mention is kept whole, rather than replaced by nothing.
 */
export const mergeAgentThemes = (
    base: AgentThemeSettings = {},
    override: AgentThemeSettings = {},
): AgentThemeSettings => {
    const merge = (left: Settings, right: Settings): Settings =>
        Object.entries(right).reduce<Settings>(
            (merged, [name, value]) => {
                if (value === undefined) return merged;
                const current = merged[name];
                return {
                    ...merged,
                    [name]:
                        isSection(value) && isSection(current)
                            ? merge(current, value)
                            : value,
                };
            },
            { ...left },
        );

    return merge(base as Settings, override as Settings) as AgentThemeSettings;
};

/**
 * What every setting is when a page sets nothing. The parts render on a host
 * page that may have no Lightdash provider around them, so they cannot borrow
 * a colour from one: the surface always resolves a complete theme, and this is
 * its floor. `colorScheme` picks the pair.
 */
export const defaultAgentTheme = (
    colorScheme: 'light' | 'dark' = 'light',
): Required<
    Pick<
        AgentThemeSettings,
        | 'backgroundColor'
        | 'primaryTextColor'
        | 'secondaryTextColor'
        | 'primaryFontSize'
        | 'fontFamily'
        | 'accentColor'
        | 'accentTextColor'
        | 'borderColor'
        | 'borderRadius'
    >
> =>
    colorScheme === 'dark'
        ? {
              backgroundColor: '#16171f',
              primaryTextColor: '#eceaf6',
              secondaryTextColor: '#9a99ad',
              primaryFontSize: 13,
              fontFamily:
                  'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
              accentColor: '#7262ff',
              accentTextColor: '#ffffff',
              borderColor: '#2c2d3a',
              borderRadius: 12,
          }
        : {
              backgroundColor: '#ffffff',
              primaryTextColor: '#15161b',
              secondaryTextColor: '#7a7a8c',
              primaryFontSize: 13,
              fontFamily:
                  'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
              accentColor: '#7262ff',
              accentTextColor: '#ffffff',
              borderColor: '#ecebf3',
              borderRadius: 12,
          };
