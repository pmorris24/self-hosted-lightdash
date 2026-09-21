import {
    type ApiError,
    type CreateEmbedJwt,
    assertUnreachable,
    FilterInteractivityValues,
    type DecodedEmbed,
    type EmbedUrl,
} from '@lightdash/common';
import {
    Anchor,
    Button,
    Group,
    Select,
    Stack,
    Tabs,
    Text,
    Title,
} from '@mantine/core';
import {
    IconBrandReact,
    IconCode,
    IconFrame,
    IconServer,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type FC } from 'react';
import { Link } from 'react-router';
import { lightdashApi } from '../../../../api';
import Callout from '../../../../components/common/Callout';
import CodeBlock from '../../../../components/common/CodeBlock/CodeBlock';
import MantineIcon from '../../../../components/common/MantineIcon';
import MantineModal from '../../../../components/common/MantineModal';
import useToaster from '../../../../hooks/toaster/useToaster';
import useApp from '../../../../providers/App/useApp';
import {
    CodeSnippetTabs,
    ReactSdkFrontendCodeBlock,
} from '../SettingsEmbed/EmbedCodeSnippet';
import classes from './EmbedCodeModal.module.css';

const URL_PLACEHOLDER = '{{ url }}';
// The same lifetimes Settings → Embed offers
const EXPIRY_OPTIONS = ['1 hour', '1 day', '1 week', '30 days', '1 year'];
const DEFAULT_EXPIRY = '1 hour';

const getIframeHtml = (url: string) => `<iframe
    src="${url}"
    width="100%"
    height="600"
    frameborder="0"
></iframe>`;

const SDK_INSTALL = 'npm install @lightdash/sdk';

type EmbedTab = 'iframe' | 'sdk' | 'backend';

const isEmbedTab = (value: string | null): value is EmbedTab =>
    value === 'iframe' || value === 'sdk' || value === 'backend';

const useEmbedConfig = (projectUuid: string) =>
    useQuery<DecodedEmbed, ApiError>({
        queryKey: ['embed-config', projectUuid],
        queryFn: async () =>
            lightdashApi<DecodedEmbed>({
                url: `/embed/${projectUuid}/config`,
                method: 'GET',
                body: undefined,
            }),
        retry: false,
    });

// The server signs the URL, so the embed secret never reaches the browser
const useTestEmbedUrl = (projectUuid: string) =>
    useMutation<EmbedUrl, ApiError, CreateEmbedJwt>({
        mutationKey: ['create-embed-url', projectUuid],
        mutationFn: (data) =>
            lightdashApi<EmbedUrl>({
                url: `/embed/${projectUuid}/get-embed-url`,
                method: 'POST',
                body: JSON.stringify(data),
            }),
    });

export type EmbedCodeTarget = {
    type: 'chart' | 'dashboard';
    uuid: string;
    name: string;
};

// A starting point, not a saved config: least-privilege defaults that the host
// app's backend is expected to edit.
const getEmbedContent = (
    projectUuid: string,
    type: EmbedCodeTarget['type'],
    uuid: string,
): CreateEmbedJwt['content'] => {
    switch (type) {
        case 'chart':
            return {
                type: 'chart',
                projectUuid,
                contentId: uuid,
                canExportCsv: false,
                canExportImages: false,
                canViewUnderlyingData: false,
                isPreview: false,
                scopes: undefined,
                dashboardFiltersInteractivity: undefined,
                parameterInteractivity: undefined,
            };
        case 'dashboard':
            return {
                type: 'dashboard',
                projectUuid,
                dashboardUuid: uuid,
                dashboardFiltersInteractivity: {
                    enabled: FilterInteractivityValues.none,
                    hidden: false,
                    canAddFilters: false,
                },
                parameterInteractivity: { enabled: false },
                canExportCsv: false,
                canExportDashboardCsv: false,
                canExportImages: false,
                canExportPagePdf: false,
                canDateZoom: false,
                canExplore: false,
                canViewUnderlyingData: false,
                isPreview: false,
            };
        default:
            return assertUnreachable(type, `Unknown embed target: ${type}`);
    }
};

const isTargetAllowed = (
    config: DecodedEmbed,
    target: EmbedCodeTarget,
): boolean => {
    switch (target.type) {
        case 'chart':
            return (
                config.allowAllCharts === true ||
                config.chartUuids?.includes(target.uuid) === true
            );
        case 'dashboard':
            return (
                config.allowAllDashboards === true ||
                config.dashboardUuids.includes(target.uuid)
            );
        default:
            return assertUnreachable(
                target.type,
                `Unknown embed target: ${target.type}`,
            );
    }
};

type Props = {
    projectUuid: string;
    target: EmbedCodeTarget;
    onClose: () => void;
};

const EmbedCodeModal: FC<Props> = ({ projectUuid, target, onClose }) => {
    const { health } = useApp();
    const { showToastSuccess, showToastApiError } = useToaster();
    const testEmbedUrl = useTestEmbedUrl(projectUuid);
    const [tab, setTab] = useState<EmbedTab>('iframe');
    const [expiresIn, setExpiresIn] = useState(DEFAULT_EXPIRY);
    const handleCopy = useCallback(
        () => showToastSuccess({ title: 'Code snippet copied to clipboard!' }),
        [showToastSuccess],
    );
    const embedConfig = useEmbedConfig(projectUuid);
    const settingsUrl = `/generalSettings/projectManagement/${projectUuid}/embed`;

    const embedJwt = useMemo<CreateEmbedJwt>(
        () => ({
            expiresIn,
            content: getEmbedContent(projectUuid, target.type, target.uuid),
            userAttributes: {},
            user: { externalId: undefined, email: undefined },
        }),
        // Callers pass a fresh target object each render
        [projectUuid, target.type, target.uuid, expiresIn],
    );

    const renderStatus = () => {
        if (embedConfig.isInitialLoading) return null;
        if (embedConfig.isError || !embedConfig.data) {
            return (
                <Callout variant="warning" title="Embedding is not set up yet">
                    Create an embed secret in{' '}
                    <Anchor component={Link} to={settingsUrl} fz="sm">
                        Settings → Embed
                    </Anchor>{' '}
                    before using this code.
                </Callout>
            );
        }
        if (!isTargetAllowed(embedConfig.data, target)) {
            return (
                <Callout
                    variant="warning"
                    title={`This ${target.type} is not allowed for embedding yet`}
                >
                    Add it to the allowed {target.type}s in{' '}
                    <Anchor component={Link} to={settingsUrl} fz="sm">
                        Settings → Embed
                    </Anchor>
                    , or the embed will be rejected.
                </Callout>
            );
        }
        return null;
    };

    if (!health.data) return null;

    return (
        <MantineModal
            opened
            onClose={onClose}
            title="Embed code"
            subtitle={target.name}
            icon={IconCode}
            size="xl"
            cancelLabel="Close"
            actions={<></>}
        >
            <Stack gap="md" className={classes.content}>
                {renderStatus()}
                <Select
                    size="xs"
                    w={200}
                    label="Token signed for"
                    data={EXPIRY_OPTIONS}
                    value={expiresIn}
                    allowDeselect={false}
                    onChange={(value) => {
                        if (value === null) return;
                        setExpiresIn(value);
                        // A generated URL was signed for the old lifetime
                        testEmbedUrl.reset();
                    }}
                />
                <Tabs
                    value={tab}
                    onChange={(value) => {
                        if (isEmbedTab(value)) setTab(value);
                    }}
                    keepMounted={false}
                >
                    <Tabs.List>
                        <Tabs.Tab
                            value="iframe"
                            leftSection={<MantineIcon icon={IconFrame} />}
                        >
                            iframe
                        </Tabs.Tab>
                        <Tabs.Tab
                            value="sdk"
                            leftSection={<MantineIcon icon={IconBrandReact} />}
                        >
                            React SDK
                        </Tabs.Tab>
                        <Tabs.Tab
                            value="backend"
                            leftSection={<MantineIcon icon={IconServer} />}
                        >
                            Backend
                        </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="iframe" pt="md">
                        <Stack gap="xs">
                            <Text c="dimmed" fz="sm">
                                Point an iframe at the signed <code>url</code>{' '}
                                your backend returns.{' '}
                                <Anchor
                                    component="button"
                                    fz="sm"
                                    onClick={() => setTab('backend')}
                                >
                                    See the backend code
                                </Anchor>
                                {' · '}
                                <Anchor
                                    href="https://docs.lightdash.com/references/iframe-embedding"
                                    target="_blank"
                                    fz="sm"
                                >
                                    iframe embed docs
                                </Anchor>
                            </Text>
                            <CodeBlock
                                code={getIframeHtml(
                                    testEmbedUrl.data?.url ?? URL_PLACEHOLDER,
                                )}
                                language="html"
                                onCopy={handleCopy}
                            />
                            {testEmbedUrl.data ? (
                                <Callout
                                    variant="warning"
                                    title="Test URL — do not ship this"
                                >
                                    This URL is signed for {expiresIn} and
                                    carries no viewer identity. In production
                                    your backend must sign a fresh URL for each
                                    viewer.
                                </Callout>
                            ) : (
                                <Group gap="sm">
                                    <Button
                                        size="xs"
                                        variant="default"
                                        loading={testEmbedUrl.isLoading}
                                        onClick={() =>
                                            testEmbedUrl.mutate(embedJwt, {
                                                onError: ({ error }) =>
                                                    showToastApiError({
                                                        title: 'Could not generate a test URL',
                                                        apiError: error,
                                                    }),
                                            })
                                        }
                                    >
                                        Generate test URL
                                    </Button>
                                    <Text c="dimmed" fz="xs">
                                        Fills the snippet with a working URL
                                        that expires in {expiresIn}.
                                    </Text>
                                </Group>
                            )}
                        </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="sdk" pt="md">
                        <Stack gap="xs">
                            <Text c="dimmed" fz="sm">
                                Install the SDK, then mount the {target.type}{' '}
                                with the signed <code>token</code> your backend
                                returns.{' '}
                                <Anchor
                                    component="button"
                                    fz="sm"
                                    onClick={() => setTab('backend')}
                                >
                                    See the backend code
                                </Anchor>
                                {' · '}
                                <Anchor
                                    href="https://docs.lightdash.com/references/react-sdk#embedding-with-react-sdk"
                                    target="_blank"
                                    fz="sm"
                                >
                                    React SDK docs
                                </Anchor>
                            </Text>
                            <CodeBlock
                                code={SDK_INSTALL}
                                language="bash"
                                onCopy={handleCopy}
                            />
                            <ReactSdkFrontendCodeBlock
                                data={embedJwt}
                                siteUrl={health.data.siteUrl}
                                onCopySnippet={handleCopy}
                            />
                        </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="backend" pt="md">
                        <Stack gap="xs">
                            <Title order={6}>Sign the embed token</Title>
                            <Text c="dimmed" fz="sm">
                                Run this on your server. It produces a{' '}
                                <code>token</code> for the React SDK and a{' '}
                                <code>url</code> for the iframe. Your embed
                                secret is in{' '}
                                <Anchor
                                    component={Link}
                                    to={settingsUrl}
                                    fz="sm"
                                >
                                    Settings → Embed
                                </Anchor>
                                . Never ship it to the browser.
                            </Text>
                            <CodeSnippetTabs
                                data={embedJwt}
                                mode="iframe"
                                onCopySnippet={handleCopy}
                                projectUuid={projectUuid}
                                siteUrl={health.data.siteUrl}
                            />
                        </Stack>
                    </Tabs.Panel>
                </Tabs>
            </Stack>
        </MantineModal>
    );
};

export default EmbedCodeModal;
