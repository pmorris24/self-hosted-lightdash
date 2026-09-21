import {
    assertUnreachable,
    ContentType,
    DashboardTileTypes,
    FeatureFlags,
    type Dashboard,
} from '@lightdash/common';
import {
    Anchor,
    Box,
    Button,
    Group,
    Paper,
    Popover,
    Select,
    Stack,
    Switch,
    Tabs,
    Text,
    TextInput,
    Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
    IconChevronDown,
    IconFolder,
    IconLayoutGrid,
    IconSearch,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState, type FC } from 'react';
import Callout from '../../../components/common/Callout';
import EmptyStateLoader from '../../../components/common/EmptyStateLoader';
import MantineIcon from '../../../components/common/MantineIcon';
import MantineModal from '../../../components/common/MantineModal';
import SpaceSelector from '../../../components/common/SpaceSelector/SpaceSelector';
import {
    buildChartTile,
    buildDataAppTile,
} from '../../../components/DashboardTiles/TileForms/utils';
import { useServerFeatureFlag } from '../../../hooks/useServerOrClientFeatureFlag';
import { useSpaceSummaries } from '../../../hooks/useSpaces';
import useDashboardContext from '../../../providers/Dashboard/useDashboardContext';
import { useWidgetCatalogContent } from '../hooks/useWidgetCatalogContent';
import { PreviewQueueProvider } from '../previewQueue/PreviewQueueProvider';
import {
    WidgetCatalogSort,
    WidgetCatalogTab,
    type CatalogWidget,
} from '../types';
import classes from './WidgetCatalog.module.css';
import WidgetCatalogCard from './WidgetCatalogCard';
import WidgetCatalogGrid from './WidgetCatalogGrid';

const TAB_LABELS: Record<WidgetCatalogTab, string> = {
    [WidgetCatalogTab.ALL]: 'All',
    [WidgetCatalogTab.KPI]: 'KPIs',
    [WidgetCatalogTab.CHART]: 'Charts',
    [WidgetCatalogTab.TABLE]: 'Tables',
    [WidgetCatalogTab.APP]: 'Apps',
};

const SORT_OPTIONS: { value: WidgetCatalogSort; label: string }[] = [
    { value: WidgetCatalogSort.MOST_USED, label: 'Most used' },
    { value: WidgetCatalogSort.RECENTLY_UPDATED, label: 'Recently updated' },
    { value: WidgetCatalogSort.NAME, label: 'Name A–Z' },
];

const isCatalogTab = (value: string | null): value is WidgetCatalogTab =>
    value !== null && Object.values<string>(WidgetCatalogTab).includes(value);

const isCatalogSort = (value: string | null): value is WidgetCatalogSort =>
    value !== null && Object.values<string>(WidgetCatalogSort).includes(value);

const NOT_LISTED_NOTE = 'Charts built inside a dashboard are not listed.';

const getEmptyTabMessage = (tab: WidgetCatalogTab): string => {
    switch (tab) {
        case WidgetCatalogTab.ALL:
            return `No widgets saved in spaces yet. ${NOT_LISTED_NOTE}`;
        case WidgetCatalogTab.KPI:
            return `No KPIs saved in spaces yet. ${NOT_LISTED_NOTE}`;
        case WidgetCatalogTab.CHART:
            return `No charts saved in spaces yet. ${NOT_LISTED_NOTE}`;
        case WidgetCatalogTab.TABLE:
            return `No tables saved in spaces yet. ${NOT_LISTED_NOTE}`;
        case WidgetCatalogTab.APP:
            return 'No data apps in spaces yet. Apps must be moved to a space before they can be added.';
        default:
            return assertUnreachable(tab, `Unknown catalog tab: ${tab}`);
    }
};

const buildWidgetTile = (widget: CatalogWidget): Dashboard['tiles'][number] =>
    widget.contentType === ContentType.DATA_APP
        ? buildDataAppTile(widget)
        : buildChartTile(widget);

type Props = {
    projectUuid: string;
    // How many more tiles the active tab can take.
    remainingTileCapacity: number;
    onAddTiles: (tiles: Dashboard['tiles'][number][]) => void;
    onClose: () => void;
};

const WidgetCatalogModal: FC<Props> = ({
    projectUuid,
    remainingTileCapacity,
    onAddTiles,
    onClose,
}) => {
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebouncedValue(search, 300);
    const [tab, setTab] = useState(WidgetCatalogTab.ALL);
    const [spaceUuid, setSpaceUuid] = useState<string | null>(null);
    const [isSpacePickerOpen, setIsSpacePickerOpen] = useState(false);
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [sort, setSort] = useState(WidgetCatalogSort.MOST_USED);
    const [isReviewingSelection, setIsReviewingSelection] = useState(false);
    // Holds the widget itself, not just its uuid, so a selection survives
    // being filtered out of the loaded list.
    const [selected, setSelected] = useState<
        ReadonlyMap<string, CatalogWidget>
    >(new Map());

    const dataAppsFlag = useServerFeatureFlag(FeatureFlags.EnableDataApps);
    const isDataAppsEnabled = dataAppsFlag.data?.enabled === true;
    const isAppsTab = tab === WidgetCatalogTab.APP;

    const dashboardTiles = useDashboardContext((c) => c.dashboardTiles);
    const { data: spaces } = useSpaceSummaries(projectUuid, true);
    const selectedSpaceName =
        spaces?.find((space) => space.uuid === spaceUuid)?.name ?? null;

    const {
        widgets,
        totalResults,
        isInitialLoading,
        isError,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useWidgetCatalogContent({
        projectUuid,
        tab,
        search: debouncedSearch,
        spaceUuid,
        // Data apps cannot be verified
        verifiedOnly: verifiedOnly && !isAppsTab,
        sort,
        isDataAppsEnabled,
    });

    const handleLoadMore = useCallback(() => {
        void fetchNextPage();
    }, [fetchNextPage]);

    const widgetUuidsOnDashboard = useMemo(
        () =>
            new Set(
                (dashboardTiles ?? []).flatMap((tile) => {
                    if (tile.type === DashboardTileTypes.SAVED_CHART)
                        return tile.properties.savedChartUuid ?? [];
                    if (tile.type === DashboardTileTypes.SQL_CHART)
                        return tile.properties.savedSqlUuid ?? [];
                    if (tile.type === DashboardTileTypes.DATA_APP)
                        return tile.properties.appUuid;
                    return [];
                }),
            ),
        [dashboardTiles],
    );

    const tabs = Object.values(WidgetCatalogTab)
        .filter((value) => value !== WidgetCatalogTab.APP || isDataAppsEnabled)
        .map((value) => ({ value, label: TAB_LABELS[value] }));

    const hasActiveFilters =
        debouncedSearch !== '' || spaceUuid !== null || verifiedOnly;
    const clearFilters = () => {
        setSearch('');
        setSpaceUuid(null);
        setVerifiedOnly(false);
    };

    const isSelectionFull = selected.size >= remainingTileCapacity;
    const showSelection = isReviewingSelection && selected.size > 0;
    const visibleWidgets = showSelection ? [...selected.values()] : widgets;
    const visibleUuids = new Set(visibleWidgets.map((widget) => widget.uuid));
    const hiddenSelectedCount = [...selected.keys()].filter(
        (uuid) => !visibleUuids.has(uuid),
    ).length;

    const handleToggle = useCallback(
        (widget: CatalogWidget) =>
            setSelected((current) => {
                const next = new Map(current);
                if (!next.delete(widget.uuid)) next.set(widget.uuid, widget);
                return next;
            }),
        [],
    );

    const addWidgets = useCallback(
        (widgetsToAdd: CatalogWidget[]) => {
            onAddTiles(widgetsToAdd.map(buildWidgetTile));
            onClose();
        },
        [onAddTiles, onClose],
    );
    // Stable handlers, so memoised cards skip re-rendering
    const handleAdd = useCallback(
        (widget: CatalogWidget) => addWidgets([widget]),
        [addWidgets],
    );

    const renderGridMessage = () => {
        if (showSelection) return null;
        if (isError) {
            return (
                <Box className={classes.gridMessage}>
                    <Callout variant="danger" title="Could not load widgets">
                        Something went wrong loading the catalog. Close it and
                        try again.
                    </Callout>
                </Box>
            );
        }
        if (isInitialLoading) {
            return (
                <Box className={classes.gridMessage}>
                    <EmptyStateLoader />
                </Box>
            );
        }
        if (widgets.length > 0) return null;
        return (
            <Paper variant="dotted" p="xl" className={classes.gridMessage}>
                <Text fz="sm" c="dimmed" ta="center">
                    {hasActiveFilters ? (
                        <>
                            No widgets match.{' '}
                            <Anchor
                                component="button"
                                fz="sm"
                                onClick={clearFilters}
                            >
                                Clear filters
                            </Anchor>
                        </>
                    ) : (
                        getEmptyTabMessage(tab)
                    )}
                </Text>
            </Paper>
        );
    };

    const selectionSummary =
        selected.size === 0 ? undefined : (
            <Text fz="sm" c="dimmed">
                {selected.size} selected
                {hiddenSelectedCount > 0 &&
                    ` · ${hiddenSelectedCount} not shown`}
                {' · '}
                <Anchor
                    component="button"
                    fz="sm"
                    onClick={() =>
                        setIsReviewingSelection((reviewing) => !reviewing)
                    }
                >
                    {showSelection ? 'Back to catalog' : 'Review selected'}
                </Anchor>
                {' · '}
                <Anchor
                    component="button"
                    fz="sm"
                    onClick={() => setSelected(new Map())}
                >
                    Clear
                </Anchor>
            </Text>
        );

    return (
        <MantineModal
            opened
            onClose={onClose}
            title="Widget catalog"
            icon={IconLayoutGrid}
            size="min(100rem, 92vw)"
            modalRootProps={{ closeOnClickOutside: false }}
            // The grid scrolls, not the body
            bodyScrollAreaMaxHeight="calc(100vh - 10rem)"
            leftActions={selectionSummary}
            actions={
                <Button
                    disabled={selected.size === 0}
                    onClick={() => addWidgets([...selected.values()])}
                >
                    {selected.size > 0
                        ? `Add ${selected.size} to dashboard`
                        : 'Add to dashboard'}
                </Button>
            }
        >
            <Stack gap="md">
                {/* Search leads; the filters beside it are quieter */}
                <Group justify="space-between" gap="sm" wrap="nowrap">
                    <TextInput
                        size="sm"
                        w={360}
                        aria-label="Search widgets"
                        placeholder="Search widgets..."
                        leftSection={<MantineIcon icon={IconSearch} />}
                        value={search}
                        onChange={(event) =>
                            setSearch(event.currentTarget.value)
                        }
                        data-autofocus
                    />
                    <Group gap="sm">
                        <Popover
                            opened={isSpacePickerOpen}
                            onChange={setIsSpacePickerOpen}
                            position="bottom-end"
                            width={340}
                            withinPortal
                        >
                            <Popover.Target>
                                <Button
                                    size="xs"
                                    variant="default"
                                    leftSection={
                                        <MantineIcon icon={IconFolder} />
                                    }
                                    rightSection={
                                        <MantineIcon icon={IconChevronDown} />
                                    }
                                    onClick={() =>
                                        setIsSpacePickerOpen((open) => !open)
                                    }
                                >
                                    {selectedSpaceName ?? 'All spaces'}
                                </Button>
                            </Popover.Target>
                            <Popover.Dropdown>
                                <Box className={classes.spacePicker}>
                                    <SpaceSelector
                                        projectUuid={projectUuid}
                                        spaces={spaces}
                                        selectedSpaceUuid={spaceUuid}
                                        onSelectSpace={(uuid) => {
                                            setSpaceUuid(uuid);
                                            setIsSpacePickerOpen(false);
                                        }}
                                        itemType={undefined}
                                        isRootSelectionEnabled={false}
                                    />
                                </Box>
                                {spaceUuid !== null && (
                                    <Button
                                        size="xs"
                                        variant="subtle"
                                        fullWidth
                                        mt="xs"
                                        onClick={() => {
                                            setSpaceUuid(null);
                                            setIsSpacePickerOpen(false);
                                        }}
                                    >
                                        Show all spaces
                                    </Button>
                                )}
                            </Popover.Dropdown>
                        </Popover>
                        <Tooltip
                            label="Data apps cannot be verified"
                            disabled={!isAppsTab}
                        >
                            <Box>
                                <Switch
                                    size="xs"
                                    label="Verified"
                                    disabled={isAppsTab}
                                    checked={verifiedOnly && !isAppsTab}
                                    onChange={(event) =>
                                        setVerifiedOnly(
                                            event.currentTarget.checked,
                                        )
                                    }
                                />
                            </Box>
                        </Tooltip>
                        <Select
                            size="xs"
                            w={160}
                            aria-label="Sort widgets"
                            data={SORT_OPTIONS}
                            value={sort}
                            allowDeselect={false}
                            onChange={(value) => {
                                if (isCatalogSort(value)) setSort(value);
                            }}
                        />
                    </Group>
                </Group>

                {/* The type tabs are the catalog's navigation, and the count
                    sits with the results it describes */}
                <Tabs
                    value={tab}
                    onChange={(value) => {
                        if (isCatalogTab(value)) setTab(value);
                    }}
                >
                    <Tabs.List>
                        {tabs.map(({ value, label }) => (
                            <Tabs.Tab key={value} value={value}>
                                {label}
                            </Tabs.Tab>
                        ))}
                        <Text
                            fz="xs"
                            c="dimmed"
                            ml="auto"
                            className="ld-self-center"
                        >
                            {totalResults !== null &&
                                `${totalResults} ${
                                    totalResults === 1 ? 'widget' : 'widgets'
                                }`}
                        </Text>
                    </Tabs.List>
                </Tabs>

                <PreviewQueueProvider>
                    <WidgetCatalogGrid
                        canLoadMore={hasNextPage && !showSelection}
                        isLoadingMore={isFetchingNextPage}
                        onLoadMore={handleLoadMore}
                        resetKey={[
                            tab,
                            debouncedSearch,
                            spaceUuid,
                            verifiedOnly,
                            sort,
                            showSelection,
                        ].join('|')}
                    >
                        {visibleWidgets.map((widget) => (
                            <WidgetCatalogCard
                                key={widget.uuid}
                                projectUuid={projectUuid}
                                widget={widget}
                                isSelected={selected.has(widget.uuid)}
                                isSelectionFull={isSelectionFull}
                                isOnDashboard={widgetUuidsOnDashboard.has(
                                    widget.uuid,
                                )}
                                onToggle={handleToggle}
                                onAdd={handleAdd}
                            />
                        ))}
                        {renderGridMessage()}
                    </WidgetCatalogGrid>
                </PreviewQueueProvider>
            </Stack>
        </MantineModal>
    );
};

export default WidgetCatalogModal;
