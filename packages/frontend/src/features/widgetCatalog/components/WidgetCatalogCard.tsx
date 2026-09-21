import {
    assertUnreachable,
    ChartKind,
    ChartSourceType,
    ContentType,
    getAppDisplayName,
    getWidgetCatalogGroup,
    WidgetCatalogGroup,
} from '@lightdash/common';
import {
    ActionIcon,
    Box,
    Center,
    Checkbox,
    Group,
    Text,
    Tooltip,
} from '@mantine/core';
import { useIntersection } from '@mantine/hooks';
import {
    IconAppWindow,
    IconCircleCheckFilled,
    IconPlus,
} from '@tabler/icons-react';
import {
    memo,
    useCallback,
    useContext,
    useEffect,
    useState,
    type FC,
    type KeyboardEvent,
    type MouseEvent,
} from 'react';
import MantineIcon from '../../../components/common/MantineIcon';
import { PolymorphicPaperButton } from '../../../components/common/PolymorphicPaperButton';
import { ChartIcon, IconBox } from '../../../components/common/ResourceIcon';
import TruncatedText from '../../../components/common/TruncatedText';
import { usePreviewQueue } from '../previewQueue/context';
import { CatalogScrollRootContext } from '../scrollRootContext';
import { type CatalogWidget } from '../types';
import classes from './WidgetCatalog.module.css';
import WidgetCatalogAppPreview from './WidgetCatalogAppPreview';
import WidgetCatalogPreview from './WidgetCatalogPreview';

const getWidgetName = (widget: CatalogWidget): string =>
    widget.contentType === ContentType.DATA_APP
        ? getAppDisplayName(widget.name, widget.uuid)
        : widget.name;

const getWidgetTypeLabel = (widget: CatalogWidget): string => {
    if (widget.contentType === ContentType.DATA_APP) return 'App';
    if (widget.source === ChartSourceType.SQL) return 'SQL chart';
    const group = getWidgetCatalogGroup(widget.chartKind);
    switch (group) {
        case WidgetCatalogGroup.KPI:
            return 'KPI';
        case WidgetCatalogGroup.CHART:
            return 'Chart';
        case WidgetCatalogGroup.TABLE:
            return 'Table';
        default:
            return assertUnreachable(group, `Unknown widget group: ${group}`);
    }
};

type Props = {
    projectUuid: string;
    widget: CatalogWidget;
    isSelected: boolean;
    // The tab's tile limit is reached
    isSelectionFull: boolean;
    isOnDashboard: boolean;
    onToggle: (widget: CatalogWidget) => void;
    onAdd: (widget: CatalogWidget) => void;
};

const WidgetCatalogCard: FC<Props> = ({
    projectUuid,
    widget,
    isSelected,
    isSelectionFull,
    isOnDashboard,
    onToggle,
    onAdd,
}) => {
    const isApp = widget.contentType === ContentType.DATA_APP;
    // An app with no ready version has nothing to render in a tile
    const isUnpublishedApp = isApp && widget.latestReadyVersionNumber === null;
    const isDisabled = isUnpublishedApp || (!isSelected && isSelectionFull);
    const hasLivePreview =
        !isApp && widget.source === ChartSourceType.DBT_EXPLORE;

    // Look one row ahead inside the grid, so a preview is ready on arrival
    const scrollRoot = useContext(CatalogScrollRootContext);
    const { ref, entry } = useIntersection({
        root: scrollRoot,
        rootMargin: '0px 0px 40% 0px',
    });
    const [hasBeenSeen, setHasBeenSeen] = useState(false);
    useEffect(() => {
        if (entry?.isIntersecting) setHasBeenSeen(true);
    }, [entry?.isIntersecting]);

    // Live previews run the chart's query, so they queue for a slot. A card
    // that scrolls away before its turn gives the place up, so a fast scroll
    // leaves no backlog; one that already has its preview keeps it.
    const { granted, request, release, revoke } = usePreviewQueue();
    const { uuid } = widget;
    const isInView = entry?.isIntersecting === true;
    const isGranted = granted.has(uuid);
    useEffect(() => {
        if (!hasLivePreview || isGranted) return;
        if (isInView) request(uuid);
        else revoke(uuid);
    }, [hasLivePreview, isGranted, isInView, request, revoke, uuid]);
    useEffect(() => () => revoke(uuid), [revoke, uuid]);

    const [hasPreviewFailed, setHasPreviewFailed] = useState(false);
    const handlePreviewSettled = useCallback(
        (hasError: boolean) => {
            setHasPreviewFailed(hasError);
            release(uuid);
        },
        [release, uuid],
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget || isDisabled) return;
        if (event.key === ' ') {
            event.preventDefault();
            onToggle(widget);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            onAdd(widget);
        }
    };

    const handleAddClick = (event: MouseEvent) => {
        event.stopPropagation();
        if (!isDisabled) onAdd(widget);
    };

    const name = getWidgetName(widget);

    const renderPreview = () => {
        if (isApp) {
            return (
                <WidgetCatalogAppPreview
                    projectUuid={projectUuid}
                    appUuid={widget.uuid}
                    name={name}
                    isEnabled={hasBeenSeen && !isUnpublishedApp}
                />
            );
        }
        if (hasPreviewFailed) {
            return (
                <Center h="100%">
                    <Text fz="xs" c="dimmed">
                        Preview unavailable
                    </Text>
                </Center>
            );
        }
        if (hasLivePreview && isGranted) {
            return (
                <Box
                    className={classes.previewScaler}
                    data-kpi={
                        getWidgetCatalogGroup(widget.chartKind) ===
                        WidgetCatalogGroup.KPI
                    }
                >
                    <WidgetCatalogPreview
                        projectUuid={projectUuid}
                        savedChartUuid={widget.uuid}
                        onSettled={handlePreviewSettled}
                    />
                </Box>
            );
        }
        return (
            <Center h="100%">
                <ChartIcon
                    chartKind={widget.chartKind ?? ChartKind.VERTICAL_BAR}
                />
            </Center>
        );
    };

    return (
        <PolymorphicPaperButton
            component="div"
            ref={ref}
            role="checkbox"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            aria-label={name}
            tabIndex={0}
            className={classes.tile}
            data-selected={isSelected}
            data-disabled={isDisabled}
            onClick={() => !isDisabled && onToggle(widget)}
            onDoubleClick={() => !isDisabled && onAdd(widget)}
            onKeyDown={handleKeyDown}
        >
            <Box className={classes.preview}>
                {renderPreview()}
                {/* Selection and add stay out of the way until they matter */}
                <Checkbox
                    size="sm"
                    className={classes.selectBox}
                    checked={isSelected}
                    disabled={isDisabled}
                    readOnly
                    tabIndex={-1}
                    aria-hidden
                />
                <Tooltip label="Add to dashboard">
                    <ActionIcon
                        variant="default"
                        size="sm"
                        aria-label={`Add ${name}`}
                        className={classes.addButton}
                        disabled={isDisabled}
                        onClick={handleAddClick}
                        onDoubleClick={(event) => event.stopPropagation()}
                    >
                        <MantineIcon icon={IconPlus} />
                    </ActionIcon>
                </Tooltip>
            </Box>

            {/* One thing leads: the name. The type is its icon, as in the
                app's content lists; everything else is a quiet second line. */}
            <Box className={classes.meta}>
                <Tooltip label={getWidgetTypeLabel(widget)} openDelay={400}>
                    <Box className="ld-shrink-0" lh={0}>
                        {isApp ? (
                            <IconBox icon={IconAppWindow} color="orange.6" />
                        ) : (
                            <ChartIcon chartKind={widget.chartKind} />
                        )}
                    </Box>
                </Tooltip>
                <Box className={classes.metaText}>
                    <Group gap={4} wrap="nowrap">
                        <TruncatedText maxWidth="100%" fw={600}>
                            {name}
                        </TruncatedText>
                        {widget.verification && (
                            <Tooltip label="Verified">
                                <Box component="span" lh={0} c="green.6">
                                    <MantineIcon
                                        icon={IconCircleCheckFilled}
                                        size={14}
                                    />
                                </Box>
                            </Tooltip>
                        )}
                    </Group>
                    <Text fz="xs" c="dimmed" truncate>
                        {[
                            widget.space?.name,
                            isOnDashboard ? 'On this dashboard' : null,
                            isUnpublishedApp ? 'Not published' : null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                </Box>
            </Box>
        </PolymorphicPaperButton>
    );
};

export default memo(WidgetCatalogCard);
