import {
    assertUnreachable,
    ContentSortByColumns,
    ContentType,
    getChartKindsForWidgetCatalogGroup,
    WidgetCatalogGroup,
} from '@lightdash/common';
import { useMemo } from 'react';
import {
    useInfiniteContent,
    type ContentArgs,
} from '../../../hooks/useContent';
import {
    WidgetCatalogSort,
    WidgetCatalogTab,
    type CatalogWidget,
} from '../types';

// One screenful: 4 columns × 3 rows
const PAGE_SIZE = 12;

type Args = {
    projectUuid: string;
    tab: WidgetCatalogTab;
    search: string;
    spaceUuid: string | null;
    verifiedOnly: boolean;
    sort: WidgetCatalogSort;
    isDataAppsEnabled: boolean;
};

type TabArgs = Pick<
    ContentArgs,
    | 'contentTypes'
    | 'chartKinds'
    | 'dataAppVizsFilter'
    | 'interleaveContentTypes'
>;

const chartTabArgs = (group: WidgetCatalogGroup): TabArgs => ({
    contentTypes: [ContentType.CHART],
    chartKinds: getChartKindsForWidgetCatalogGroup(group),
});

const getTabArgs = (
    tab: WidgetCatalogTab,
    isDataAppsEnabled: boolean,
): TabArgs => {
    switch (tab) {
        case WidgetCatalogTab.ALL:
            return isDataAppsEnabled
                ? {
                      contentTypes: [ContentType.CHART, ContentType.DATA_APP],
                      dataAppVizsFilter: 'exclude',
                      // Otherwise every app sorts after every chart
                      interleaveContentTypes: true,
                  }
                : { contentTypes: [ContentType.CHART] };
        case WidgetCatalogTab.KPI:
            return chartTabArgs(WidgetCatalogGroup.KPI);
        case WidgetCatalogTab.CHART:
            return chartTabArgs(WidgetCatalogGroup.CHART);
        case WidgetCatalogTab.TABLE:
            return chartTabArgs(WidgetCatalogGroup.TABLE);
        case WidgetCatalogTab.APP:
            return {
                contentTypes: [ContentType.DATA_APP],
                dataAppVizsFilter: 'exclude',
            };
        default:
            return assertUnreachable(tab, `Unknown catalog tab: ${tab}`);
    }
};

const getSortArgs = (
    sort: WidgetCatalogSort,
): Pick<ContentArgs, 'sortBy' | 'sortDirection'> => {
    switch (sort) {
        case WidgetCatalogSort.MOST_USED:
            return {
                sortBy: ContentSortByColumns.VIEWS,
                sortDirection: 'desc',
            };
        case WidgetCatalogSort.RECENTLY_UPDATED:
            return {
                sortBy: ContentSortByColumns.LAST_UPDATED_AT,
                sortDirection: 'desc',
            };
        case WidgetCatalogSort.NAME:
            return { sortBy: ContentSortByColumns.NAME, sortDirection: 'asc' };
        default:
            return assertUnreachable(sort, `Unknown catalog sort: ${sort}`);
    }
};

export const useWidgetCatalogContent = ({
    projectUuid,
    tab,
    search,
    spaceUuid,
    verifiedOnly,
    sort,
    isDataAppsEnabled,
}: Args) => {
    const query = useInfiniteContent(
        {
            projectUuids: [projectUuid],
            pageSize: PAGE_SIZE,
            search,
            ...getTabArgs(tab, isDataAppsEnabled),
            ...getSortArgs(sort),
            ...(spaceUuid
                ? { spaceUuids: [spaceUuid], includeDescendantSpaces: true }
                : {}),
            ...(verifiedOnly ? { verifiedOnly: true } : {}),
        },
        { keepPreviousData: true },
    );

    const widgets = useMemo<CatalogWidget[]>(
        () =>
            (query.data?.pages ?? []).flatMap((page) =>
                page.data.filter(
                    (item): item is CatalogWidget =>
                        item.contentType === ContentType.CHART ||
                        item.contentType === ContentType.DATA_APP,
                ),
            ),
        [query.data?.pages],
    );

    return {
        widgets,
        totalResults: query.data?.pages[0]?.pagination?.totalResults ?? null,
        isInitialLoading: query.isInitialLoading,
        isError: query.isError,
        isFetchingNextPage: query.isFetchingNextPage,
        hasNextPage: query.hasNextPage === true,
        fetchNextPage: query.fetchNextPage,
    };
};
