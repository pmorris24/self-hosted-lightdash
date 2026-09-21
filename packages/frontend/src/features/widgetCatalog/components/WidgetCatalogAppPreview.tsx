import { Box, Center } from '@mantine/core';
import { IconAppWindow } from '@tabler/icons-react';
import { memo, useState, type FC } from 'react';
import MantineIcon from '../../../components/common/MantineIcon';
import { useAppThumbnailUrl } from '../../apps/hooks/useAppThumbnail';
import classes from './WidgetCatalog.module.css';

type Props = {
    projectUuid: string;
    appUuid: string;
    name: string;
    // Only published apps have a thumbnail to fetch
    isEnabled: boolean;
};

const WidgetCatalogAppPreview: FC<Props> = ({
    projectUuid,
    appUuid,
    name,
    isEnabled,
}) => {
    const thumbnail = useAppThumbnailUrl(projectUuid, appUuid, isEnabled);
    // react-query keeps stale data when a refetch errors, so an error means
    // "no thumbnail" even with data. A signed URL can also expire under us.
    const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
    const thumbnailUrl = thumbnail.isError
        ? undefined
        : thumbnail.data?.thumbnailUrl;

    if (!thumbnailUrl || thumbnailUrl === brokenUrl) {
        return (
            <Center h="100%">
                <MantineIcon icon={IconAppWindow} size="xl" color="dimmed" />
            </Center>
        );
    }

    return (
        <Box
            component="img"
            src={thumbnailUrl}
            alt={`${name} thumbnail`}
            className={classes.appThumbnail}
            onError={() => setBrokenUrl(thumbnailUrl)}
        />
    );
};

export default memo(WidgetCatalogAppPreview);
