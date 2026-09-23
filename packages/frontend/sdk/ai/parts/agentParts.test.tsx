import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AgentSuggestion } from './chrome';

describe('composable agent styles', () => {
    it('keeps native suggestion chips separate from custom question cards', () => {
        const style = document.createElement('style');
        style.textContent = readFileSync('sdk/styles/agentParts.css', 'utf8');
        document.head.append(style);
        try {
            render(
                <>
                    <button className="ld-agent-suggestion">Native chip</button>
                    <AgentSuggestion onClick={() => undefined}>
                        Custom card
                    </AgentSuggestion>
                </>,
            );
            expect(
                getComputedStyle(screen.getByText('Custom card')).width,
            ).toBe('100%');
            expect(
                getComputedStyle(screen.getByText('Native chip')).width,
            ).not.toBe('100%');
        } finally {
            style.remove();
        }
    });
});
