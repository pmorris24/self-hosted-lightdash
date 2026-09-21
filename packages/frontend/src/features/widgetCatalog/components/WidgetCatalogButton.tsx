import { FeatureFlags, type Dashboard } from '@lightdash/common';
import { Button, Tooltip, type ButtonProps } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutGrid } from '@tabler/icons-react';
import { type FC } from 'react';
import MantineIcon from '../../../components/common/MantineIcon';
import { useProjectUuid } from '../../../hooks/useProjectUuid';
import { useServerFeatureFlag } from '../../../hooks/useServerOrClientFeatureFlag';
import useApp from '../../../providers/App/useApp';
import useDashboardContext from '../../../providers/Dashboard/useDashboardContext';
import WidgetCatalogModal from './WidgetCatalogModal';

type Props = {
    onAddTiles: (tiles: Dashboard['tiles'][number][]) => void;
    activeTabUuid: string | undefined;
} & Pick<ButtonProps, 'disabled' | 'radius'>;

const WidgetCatalogButton: FC<Props> = ({
    onAddTiles,
    activeTabUuid,
    disabled,
    radius,
}) => {
    const [isOpen, { open, close }] = useDisclosure(false);
    const projectUuid = useProjectUuid();
    const { health } = useApp();
    const dashboardTiles = useDashboardContext((c) => c.dashboardTiles);
    const catalogFlag = useServerFeatureFlag(FeatureFlags.WidgetCatalog);

    const maxTilesPerTab = health.data?.dashboard?.maxTilesPerTab || 50;
    const tilesInActiveTab = (dashboardTiles ?? []).filter(
        (tile) => !activeTabUuid || tile.tabUuid === activeTabUuid,
    ).length;
    const remainingTileCapacity = Math.max(
        0,
        maxTilesPerTab - tilesInActiveTab,
    );

    if (catalogFlag.data?.enabled !== true) return null;

    return (
        <>
            <Tooltip
                label={`This tab has reached the ${maxTilesPerTab}-tile limit`}
                disabled={remainingTileCapacity > 0}
            >
                <Button
                    size="xs"
                    variant="default"
                    radius={radius}
                    disabled={disabled || remainingTileCapacity === 0}
                    leftSection={<MantineIcon icon={IconLayoutGrid} />}
                    onClick={open}
                >
                    Widget catalog
                </Button>
            </Tooltip>

            {isOpen && projectUuid && (
                <WidgetCatalogModal
                    projectUuid={projectUuid}
                    remainingTileCapacity={remainingTileCapacity}
                    onAddTiles={onAddTiles}
                    onClose={close}
                />
            )}
        </>
    );
};

export default WidgetCatalogButton;
