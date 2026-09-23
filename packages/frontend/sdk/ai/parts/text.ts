import { type AgentStep } from '../useAgentConversation';

const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A tool name as a viewer reads it: `runMetricQuery` becomes `Run metric query`. */
export const agentStepLabel = (step: AgentStep): string =>
    (step.label || step.toolName)
        .replace(/([a-z])([A-Z])/g, (_, before: string, capital: string) =>
            `${before} ${capital.toLowerCase()}`,
        )
        .replace(/^./, (letter) => letter.toUpperCase());

/** Keys, strings, numbers and keywords, coloured on the dark panel. */
export const agentHighlightJson = (source: string): string =>
    escapeHtml(source).replace(
        /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?/g,
        (match, text?: string, colon?: string, keyword?: string) => {
            if (text) {
                return colon
                    ? `<span class="ld-agent-json-key">${text}</span>${colon}`
                    : `<span class="ld-agent-json-string">${text}</span>`;
            }
            if (keyword) {
                return `<span class="ld-agent-json-keyword">${keyword}</span>`;
            }
            return `<span class="ld-agent-json-number">${match}</span>`;
        },
    );

/**
 * Enough Markdown for an answer: paragraphs, bullets, bold, inline code and
 * fenced blocks. Everything is escaped first, so an answer cannot inject HTML.
 */
export const agentMarkdown = (source: string): string => {
    const inline = (text: string) =>
        escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+?)`/g, '<code>$1</code>');
    const out: string[] = [];
    let list: string[] | null = null;
    let code: string[] | null = null;
    const flushList = () => {
        if (list) {
            out.push(`<ul>${list.join('')}</ul>`);
            list = null;
        }
    };
    const flushCode = () => {
        if (code) {
            out.push(`<pre><code>${code.join('\n')}</code></pre>`);
            code = null;
        }
    };

    source.split('\n').forEach((raw) => {
        if (/^```/.test(raw.trim())) {
            if (code) flushCode();
            else {
                flushList();
                code = [];
            }
            return;
        }
        if (code) {
            code.push(escapeHtml(raw));
            return;
        }
        const bullet = /^\s*[-*]\s+(.*)$/.exec(raw);
        if (bullet) {
            (list ??= []).push(`<li>${inline(bullet[1])}</li>`);
            return;
        }
        if (raw.trim() === '') {
            flushList();
            return;
        }
        flushList();
        out.push(`<p>${inline(raw)}</p>`);
    });
    flushList();
    flushCode();
    return out.join('');
};


/** How long ago, the way the product writes it: 4m, 3h, 2d. */
export const agentTimeAgo = (iso: string, now: Date = new Date()): string => {
    const seconds = (now.getTime() - new Date(iso).getTime()) / 1000;
    if (!Number.isFinite(seconds) || seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

