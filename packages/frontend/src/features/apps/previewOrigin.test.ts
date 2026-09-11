import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreviewOrigin } from './previewOrigin';

type HealthMock = {
    data: { dataApps: { previewOrigin: string | null } } | undefined;
    error: { status: 'error'; error: { statusCode: number } } | null;
};

const mocks = vi.hoisted(() => ({
    health: { data: undefined, error: null } as HealthMock,
}));

vi.mock('../../providers/App/useApp', () => ({
    default: () => ({ health: mocks.health }),
}));

const SDK_INSTANCE_URL_KEY = '__lightdash_sdk_instance_url';

const renderPreviewOrigin = () =>
    renderHook(() => usePreviewOrigin()).result.current;

describe('usePreviewOrigin', () => {
    beforeEach(() => {
        sessionStorage.clear();
        mocks.health = { data: undefined, error: null };
    });

    it('returns null while the health query is still loading', () => {
        sessionStorage.setItem(
            SDK_INSTANCE_URL_KEY,
            'https://acme.lightdash.cloud/',
        );

        expect(renderPreviewOrigin()).toBeNull();
    });

    it('uses the backend preview origin once health has loaded', () => {
        sessionStorage.setItem(
            SDK_INSTANCE_URL_KEY,
            'https://acme.lightdash.cloud/',
        );
        mocks.health = {
            data: { dataApps: { previewOrigin: 'https://app.lightdash.app' } },
            error: null,
        };

        expect(renderPreviewOrigin()).toBe('https://app.lightdash.app');
    });

    it('falls back to the page origin when health has no preview origin', () => {
        mocks.health = {
            data: { dataApps: { previewOrigin: null } },
            error: null,
        };

        expect(renderPreviewOrigin()).toBe(window.location.origin);
    });

    it('strips the trailing slash from the SDK instance URL', () => {
        sessionStorage.setItem(
            SDK_INSTANCE_URL_KEY,
            'https://acme.lightdash.cloud/',
        );
        mocks.health = {
            data: { dataApps: { previewOrigin: null } },
            error: null,
        };

        expect(renderPreviewOrigin()).toBe('https://acme.lightdash.cloud');
    });

    it('falls back to the page origin when the health query errored', () => {
        mocks.health = {
            data: undefined,
            error: { status: 'error', error: { statusCode: 500 } },
        };

        expect(renderPreviewOrigin()).toBe(window.location.origin);
    });
});
