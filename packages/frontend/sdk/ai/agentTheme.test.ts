import { describe, expect, it } from 'vitest';
import { agentThemeVariables, mergeAgentThemes } from './agentTheme';

describe('agentThemeVariables', () => {
    it('leaves everything to Lightdash when a page sets nothing', () => {
        expect(agentThemeVariables()).toEqual({});
        expect(agentThemeVariables({})).toEqual({});
    });

    it('names a setting after its place in the theme', () => {
        expect(
            agentThemeVariables({
                accentColor: '#7262FF',
                fontFamily: 'Inter, sans-serif',
                userMessages: { backgroundColor: 'rgba(114, 98, 255, 0.08)' },
                input: { focus: { outlineColor: '#7262FF' } },
                suggestions: { hover: { backgroundColor: '#F4F2FF' } },
            }),
        ).toEqual({
            '--lightdash-agent-accent-color': '#7262FF',
            '--lightdash-agent-font-family': 'Inter, sans-serif',
            '--lightdash-agent-user-messages-background-color':
                'rgba(114, 98, 255, 0.08)',
            '--lightdash-agent-input-focus-outline-color': '#7262FF',
            '--lightdash-agent-suggestions-hover-background-color': '#F4F2FF',
        });
    });

    it('reads a number as a length in pixels', () => {
        expect(
            agentThemeVariables({
                borderRadius: 14,
                primaryFontSize: 13,
                body: { maxWidth: 820, padding: 0 },
            }),
        ).toEqual({
            '--lightdash-agent-border-radius': '14px',
            '--lightdash-agent-primary-font-size': '13px',
            '--lightdash-agent-body-max-width': '820px',
            '--lightdash-agent-body-padding': '0px',
        });
    });

    it('skips a setting that is explicitly absent', () => {
        expect(
            agentThemeVariables({
                accentColor: undefined,
                primaryTextColor: '#15161B',
            }),
        ).toEqual({ '--lightdash-agent-primary-text-color': '#15161B' });
    });
});

describe('mergeAgentThemes', () => {
    it('lays one theme over another section by section', () => {
        expect(
            mergeAgentThemes(
                {
                    accentColor: '#7262FF',
                    userMessages: {
                        backgroundColor: '#EEE',
                        textColor: '#111',
                    },
                },
                { userMessages: { backgroundColor: '#F4F2FF' } },
            ),
        ).toEqual({
            accentColor: '#7262FF',
            userMessages: { backgroundColor: '#F4F2FF', textColor: '#111' },
        });
    });

    it('keeps a section the override never mentions', () => {
        expect(
            mergeAgentThemes(
                { suggestions: { hover: { textColor: '#111' } } },
                { accentColor: '#000' },
            ),
        ).toEqual({
            accentColor: '#000',
            suggestions: { hover: { textColor: '#111' } },
        });
    });

    it('is the other theme when there is nothing to lay it over', () => {
        expect(mergeAgentThemes(undefined, { accentColor: '#000' })).toEqual({
            accentColor: '#000',
        });
        expect(mergeAgentThemes({ accentColor: '#000' }, undefined)).toEqual({
            accentColor: '#000',
        });
    });
});
