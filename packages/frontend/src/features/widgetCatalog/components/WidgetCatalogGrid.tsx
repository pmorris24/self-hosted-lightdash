import { Box, Center, Loader, ScrollArea } from '@mantine/core';
import { useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import { usePreviewQueue } from '../previewQueue/context';
import { CatalogScrollRootContext } from '../scrollRootContext';
import classes from './WidgetCatalog.module.css';

type Props = {
    children: ReactNode;
    canLoadMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    // Changes when the tab, filters or sort change: back to the top
    resetKey: string;
};

// How long the grid must be still before previews start mounting again
const SCROLL_IDLE_MS = 120;

const WidgetCatalogGrid: FC<Props> = ({
    children,
    canLoadMore,
    isLoadingMore,
    onLoadMore,
    resetKey,
}) => {
    // State, not a ref: the cards observe against it, so they need a render
    const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const { setPaused } = usePreviewQueue();

    useEffect(() => {
        viewport?.scrollTo({ top: 0 });
    }, [viewport, resetKey]);

    // Hold new previews while the grid is moving; resume once it rests
    useEffect(() => {
        if (!viewport) return;
        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        const handleScroll = () => {
            setPaused(true);
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => setPaused(false), SCROLL_IDLE_MS);
        };
        viewport.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            viewport.removeEventListener('scroll', handleScroll);
            clearTimeout(idleTimer);
            setPaused(false);
        };
    }, [viewport, setPaused]);

    // Fetch the next page a full screen before the end, so by the time the
    // user scrolls past the rows on show the next ones are already there.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!viewport || !sentinel || !canLoadMore || isLoadingMore) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) onLoadMore();
            },
            { root: viewport, rootMargin: '0px 0px 100% 0px' },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [viewport, canLoadMore, isLoadingMore, onLoadMore]);

    return (
        <Box className={classes.gridViewport}>
            <ScrollArea
                className={classes.gridScroll}
                viewportRef={setViewport}
                offsetScrollbars="present"
            >
                <CatalogScrollRootContext.Provider value={viewport}>
                    <Box className={classes.grid}>
                        {children}
                        <Box ref={sentinelRef} className={classes.gridMessage}>
                            {isLoadingMore && (
                                <Center py="md">
                                    <Loader size="sm" color="gray" />
                                </Center>
                            )}
                        </Box>
                    </Box>
                </CatalogScrollRootContext.Provider>
            </ScrollArea>
        </Box>
    );
};

export default WidgetCatalogGrid;
