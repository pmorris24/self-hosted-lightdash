import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EMBED_CLASS_CONTRACT, embedContractClass } from './embedClassContract';

// Every `embedContractClass(...)` call site lives in the embed wrappers, the
// SDK (which owns the `ld-sdk-*` containers and the agent's own root) or the
// agent chat components the SDK renders inline.
const testDir = dirname(fileURLToPath(import.meta.url));
const sdkDir = join(testDir, '../../../../../sdk');
const componentDirs = [
    join(testDir, '../EmbedDashboard/components'),
    join(testDir, '../../aiCopilot/components/ChatElements'),
    join(testDir, '../../aiCopilot/components/AiAgentPageLayout'),
    join(sdkDir, 'ai'),
];
const componentSource = [
    ...componentDirs.flatMap((dir) =>
        readdirSync(dir)
            .filter((file) => file.endsWith('.tsx'))
            .map((file) => join(dir, file)),
    ),
    join(sdkDir, 'index.tsx'),
]
    .map((file) => readFileSync(file, 'utf-8'))
    .join('\n');

describe('embed class contract', () => {
    // Frozen public vocabulary: renaming/removing a class breaks customer CSS.
    it('exposes exactly the published classnames', () => {
        expect([...EMBED_CLASS_CONTRACT]).toEqual([
            'ld-dashboard-header',
            'ld-dashboard-filters',
            'ld-dashboard-filter',
            'ld-dashboard-add-filter',
            'ld-dashboard-date-zoom',
            'ld-dashboard-parameters',
            'ld-dashboard-parameter',
            'ld-dashboard-filter-dropdown',
            'ld-dashboard-add-filter-dropdown',
            'ld-dashboard-date-zoom-dropdown',
            'ld-dashboard-parameter-dropdown',
            'ld-dashboard-guided-setup',
            'ld-dashboard-export-all',
            'ld-sdk-root',
            'ld-sdk-portal',
            'ld-agent-root',
            'ld-agent-workspace',
            'ld-agent-thread',
            'ld-agent-messages',
            'ld-agent-message-list',
            'ld-agent-user-message',
            'ld-agent-answer',
            'ld-agent-chart',
            'ld-agent-composer',
            'ld-agent-suggestion',
        ]);
    });

    // Every registered class must actually be applied to an element.
    it.each([...EMBED_CLASS_CONTRACT])(
        'applies "%s" in an embed component',
        (className) => {
            expect(componentSource).toContain(`'${className}'`);
        },
    );

    describe('embedContractClass', () => {
        it('joins the public class with module classes', () => {
            expect(
                embedContractClass('ld-dashboard-header', 'mod_abc123'),
            ).toBe('ld-dashboard-header mod_abc123');
        });

        it('drops falsy module classes', () => {
            expect(
                embedContractClass(
                    'ld-dashboard-filters',
                    false,
                    undefined,
                    null,
                ),
            ).toBe('ld-dashboard-filters');
        });
    });
});
