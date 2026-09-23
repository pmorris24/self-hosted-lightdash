import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReportedThread } from './useReportedThread';

const report = (
    onThreadChange: (options: { threadUuid: string | null }) => void,
) =>
    renderHook(
        ({ threadUuid }: { threadUuid: string | null | undefined }) =>
            useReportedThread(threadUuid, onThreadChange),
        { initialProps: { threadUuid: undefined } },
    );

describe('reporting the thread to the host', () => {
    it('says nothing before the viewer has started a thread', () => {
        const onThreadChange = vi.fn();
        report(onThreadChange);
        expect(onThreadChange).not.toHaveBeenCalled();
    });

    it('reports the thread the viewer enters', () => {
        const onThreadChange = vi.fn();
        const { rerender } = report(onThreadChange);
        rerender({ threadUuid: 'thread-1' });
        expect(onThreadChange).toHaveBeenCalledExactlyOnceWith({
            threadUuid: 'thread-1',
        });
    });

    it('reports null when the viewer starts a new conversation', () => {
        const onThreadChange = vi.fn();
        const { rerender } = report(onThreadChange);
        rerender({ threadUuid: 'thread-1' });
        rerender({ threadUuid: undefined });
        expect(onThreadChange).toHaveBeenLastCalledWith({ threadUuid: null });
        expect(onThreadChange).toHaveBeenCalledTimes(2);
    });

    it('does not repeat itself while the viewer stays put', () => {
        const onThreadChange = vi.fn();
        const { rerender } = report(onThreadChange);
        rerender({ threadUuid: 'thread-1' });
        rerender({ threadUuid: 'thread-1' });
        rerender({ threadUuid: 'thread-1' });
        expect(onThreadChange).toHaveBeenCalledOnce();
    });

    it('follows the viewer from one thread to another', () => {
        const onThreadChange = vi.fn();
        const { rerender } = report(onThreadChange);
        rerender({ threadUuid: 'thread-1' });
        rerender({ threadUuid: 'thread-2' });
        expect(onThreadChange.mock.calls.map(([event]) => event)).toEqual([
            { threadUuid: 'thread-1' },
            { threadUuid: 'thread-2' },
        ]);
    });

    it('reports the next thread after a new conversation', () => {
        const onThreadChange = vi.fn();
        const { rerender } = report(onThreadChange);
        rerender({ threadUuid: 'thread-1' });
        rerender({ threadUuid: undefined });
        rerender({ threadUuid: 'thread-2' });
        expect(onThreadChange.mock.calls.map(([event]) => event)).toEqual([
            { threadUuid: 'thread-1' },
            { threadUuid: null },
            { threadUuid: 'thread-2' },
        ]);
    });
});
