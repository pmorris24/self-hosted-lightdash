import { describe, expect, it } from 'vitest';
import {
    AI_AGENT_FEATURE_AUTO,
    DEFAULT_SDK_AGENT_FEATURES,
    resolveAiAgentFeatures,
    resolveSdkAgentFeatures,
    toSdkAgentFeatures,
} from './sdkAgentFeatures';

describe('AI agent features', () => {
    it('leaves an embed that says nothing exactly as it renders today', () => {
        const resolved = resolveAiAgentFeatures(undefined);
        expect(resolved).toEqual(AI_AGENT_FEATURE_AUTO);
        expect(toSdkAgentFeatures(resolved)).toEqual(
            DEFAULT_SDK_AGENT_FEATURES,
        );
    });

    it('keeps a guarded feature off even when the host asks for it', () => {
        // The token carries no right for these yet, so asking for one would
        // only draw a control the server rejects.
        const asked = resolveAiAgentFeatures({
            sqlRunner: true,
            deepResearch: true,
            memories: true,
            sharing: true,
            debug: true,
        });
        expect(asked.sqlRunner).toBe(false);
        expect(asked.deepResearch).toBe(false);
        expect(asked.memories).toBe(false);
        expect(asked.sharing).toBe(false);
        expect(asked.debug).toBe(false);

        const silent = resolveAiAgentFeatures(undefined);
        expect(silent.sqlRunner).toBe(false);
        expect(silent.threadNavigation).toBe(false);
    });

    it('opens a guarded feature only when the server reports it', () => {
        expect(
            resolveAiAgentFeatures({ sqlRunner: true }, { sqlRunner: true })
                .sqlRunner,
        ).toBe(true);
        expect(
            resolveAiAgentFeatures(undefined, { sqlRunner: true }).sqlRunner,
        ).toBe(true);
    });

    it('lets a host hide a feature the server allows', () => {
        const resolved = resolveAiAgentFeatures(
            { header: false, sqlRunner: false },
            { header: true, sqlRunner: true },
        );
        expect(resolved.header).toBe(false);
        expect(resolved.sqlRunner).toBe(false);
    });

    it('does not let a host turn on a feature the server denies', () => {
        const resolved = resolveAiAgentFeatures(
            { sqlRunner: true, memories: true },
            { sqlRunner: false, memories: false },
        );
        expect(resolved.sqlRunner).toBe(false);
        expect(resolved.memories).toBe(false);
    });

    it('follows the server when a feature is auto', () => {
        expect(
            resolveAiAgentFeatures({ sqlRunner: 'auto' }, { sqlRunner: true })
                .sqlRunner,
        ).toBe(true);
        expect(
            resolveAiAgentFeatures({ header: 'auto' }, { header: false })
                .header,
        ).toBe(false);
    });

    it('treats an omitted feature as auto', () => {
        expect(resolveAiAgentFeatures({}, { sqlRunner: true }).sqlRunner).toBe(
            true,
        );
    });

    it('keeps the boolean features the SDK already published working', () => {
        expect(resolveAiAgentFeatures({ header: false }).header).toBe(false);
        expect(resolveAiAgentFeatures({ avatar: true }).avatar).toBe(true);
        expect(resolveSdkAgentFeatures({ header: false })).toEqual({
            ...DEFAULT_SDK_AGENT_FEATURES,
            header: false,
        });
    });

    it('resolves every name it publishes', () => {
        const resolved = resolveAiAgentFeatures({});
        for (const [name, value] of Object.entries(resolved)) {
            expect(typeof value, `${name} is not resolved`).toBe('boolean');
        }
        expect(Object.keys(resolved)).toHaveLength(26);
    });
});
