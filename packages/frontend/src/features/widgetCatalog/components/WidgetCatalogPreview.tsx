import { type SavedChart } from '@lightdash/common';
import { Box, Center, Loader } from '@mantine/core';
import { memo, useEffect, useMemo, useState, type FC } from 'react';
import { Provider } from 'react-redux';
import LightdashVisualization from '../../../components/LightdashVisualization';
import VisualizationProvider from '../../../components/LightdashVisualization/VisualizationProvider';
import MetricQueryDataProvider from '../../../components/MetricQueryData/MetricQueryDataProvider';
import { useExplorerQueryEffects } from '../../../hooks/useExplorerQueryEffects';
import { useExplorerQueryManager } from '../../../hooks/useExplorerQueryManager';
import { SuppressQueryErrorToastsContext } from '../../../hooks/useQueryError';
import { useResizeObserver } from '../../../hooks/useResizeObserver';
import { useSavedQuery } from '../../../hooks/useSavedQuery';
import { ExplorerSection } from '../../../providers/Explorer/types';
import {
    buildInitialExplorerState,
    createExplorerStore,
    explorerActions,
} from '../../explorer/store';

type ContentProps = {
    projectUuid: string;
    savedChart: SavedChart;
    onSettled: (hasError: boolean) => void;
};

const PreviewContent: FC<ContentProps> = ({
    projectUuid,
    savedChart,
    onSettled,
}) => {
    useExplorerQueryEffects({
        minimal: true,
        projectUuid,
        savedQueryUuid: savedChart.uuid,
    });

    const [measureRef, { width: containerWidth, height: containerHeight }] =
        useResizeObserver<HTMLDivElement>();

    const { query, queryResults, explore } = useExplorerQueryManager({
        projectUuid,
        savedQueryUuid: savedChart.uuid,
    });

    const resultsData = useMemo(
        () => ({
            ...queryResults,
            metricQuery: query.data?.metricQuery,
            fields: query.data?.fields,
            resolvedTimezone: query.data?.resolvedTimezone ?? undefined,
        }),
        [queryResults, query.data],
    );

    const isLoading =
        query.isFetching ||
        queryResults.isFetchingRows ||
        !query.data?.queryUuid ||
        queryResults.queryUuid !== query.data.queryUuid;

    const hasError = !!query.error || !!queryResults.error;
    const hasSettled = hasError || !isLoading;
    useEffect(() => {
        if (hasSettled) onSettled(hasError);
    }, [hasSettled, hasError, onSettled]);

    // The card shows the failure, outside the scaled preview box
    if (hasError) return null;

    return (
        <MetricQueryDataProvider
            metricQuery={query.data?.metricQuery}
            tableName={savedChart.tableName ?? ''}
            explore={explore}
            queryUuid={query.data?.queryUuid}
            parameters={query.data?.usedParametersValues}
            resolvedTimezone={query.data?.resolvedTimezone}
        >
            <VisualizationProvider
                minimal
                chartConfig={savedChart.chartConfig}
                initialPivotDimensions={savedChart.pivotConfig?.columns}
                initialPivotRows={savedChart.pivotConfig?.rows}
                resultsData={resultsData}
                isLoading={isLoading}
                columnOrder={savedChart.tableConfig.columnOrder}
                savedChartUuid={savedChart.uuid}
                colorPalette={savedChart.colorPalette}
                parameters={query.data?.usedParametersValues}
                containerWidth={containerWidth}
                containerHeight={containerHeight}
            >
                <Box h="100%" mih="inherit">
                    <LightdashVisualization
                        ref={measureRef}
                        className="sentry-block ph-no-capture"
                        data-testid="widget-catalog-preview"
                    />
                </Box>
            </VisualizationProvider>
        </MetricQueryDataProvider>
    );
};

const PreviewStore: FC<ContentProps> = ({
    projectUuid,
    savedChart,
    onSettled,
}) => {
    const [store] = useState(() => createExplorerStore());

    useEffect(() => {
        store.dispatch(
            explorerActions.reset(
                buildInitialExplorerState({
                    savedChart,
                    minimal: true,
                    expandedSections: [ExplorerSection.VISUALIZATION],
                }),
            ),
        );
    }, [savedChart, store]);

    return (
        <Provider store={store}>
            <PreviewContent
                projectUuid={projectUuid}
                savedChart={savedChart}
                onSettled={onSettled}
            />
        </Provider>
    );
};

type Props = {
    projectUuid: string;
    savedChartUuid: string;
    // Called once the preview has rendered or failed
    onSettled: (hasError: boolean) => void;
};

const WidgetCatalogPreview: FC<Props> = ({
    projectUuid,
    savedChartUuid,
    onSettled,
}) => {
    const {
        data: savedChart,
        isInitialLoading,
        isError,
    } = useSavedQuery({ uuidOrSlug: savedChartUuid, projectUuid });

    useEffect(() => {
        if (isError) onSettled(true);
    }, [isError, onSettled]);

    if (isError) return null;

    if (isInitialLoading || !savedChart) {
        return (
            <Center h="100%">
                <Loader type="dots" color="gray" />
            </Center>
        );
    }

    return (
        // A broken chart reports inline here instead of raising a global toast
        <SuppressQueryErrorToastsContext.Provider value>
            <PreviewStore
                key={savedChart.uuid}
                projectUuid={projectUuid}
                savedChart={savedChart}
                onSettled={onSettled}
            />
        </SuppressQueryErrorToastsContext.Provider>
    );
};

// Memoised: the card re-renders whenever any preview's queue slot changes, and
// the chart tree under here is far too heavy to re-render along with it.
export default memo(WidgetCatalogPreview);
