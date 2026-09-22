import { ForbiddenError, type AnonymousAccount } from '@lightdash/common';
import { type DashboardModel } from '../../models/DashboardModel/DashboardModel';
import { PermissionsService } from './PermissionsService';

const PROJECT_UUID = 'project-uuid';
const DASHBOARD_UUID = 'dashboard-uuid';
const CHART_UUID = 'chart-uuid';

const savedChartExistsInDashboard = vi.fn();

const service = new PermissionsService({
    dashboardModel: {
        savedChartExistsInDashboard,
    } as unknown as DashboardModel,
});

type EmbedOverrides = Partial<AnonymousAccount['embed']>;

const accountWith = (
    content: Record<string, unknown>,
    embed: EmbedOverrides = {},
) =>
    ({
        embed: {
            projectUuid: PROJECT_UUID,
            dashboardUuids: [],
            allowAllDashboards: false,
            chartUuids: [],
            allowAllCharts: false,
            ...embed,
        },
        access: { content },
    }) as unknown as AnonymousAccount;

const dashboardAccount = (embed?: EmbedOverrides) =>
    accountWith(
        { type: 'dashboard', dashboardUuid: DASHBOARD_UUID, chartUuids: [] },
        embed,
    );

const chartAccount = (chartUuids: string[], embed?: EmbedOverrides) =>
    accountWith({ type: 'chart', chartUuids }, embed);

describe('PermissionsService.checkEmbedPermissions', () => {
    beforeEach(() => {
        savedChartExistsInDashboard.mockReset();
    });

    describe('dashboard token', () => {
        it('allows a chart that is on the embedded dashboard', async () => {
            savedChartExistsInDashboard.mockResolvedValue(true);

            await expect(
                service.checkEmbedPermissions(
                    dashboardAccount({ dashboardUuids: [DASHBOARD_UUID] }),
                    CHART_UUID,
                ),
            ).resolves.toBeUndefined();
            expect(savedChartExistsInDashboard).toHaveBeenCalledWith(
                PROJECT_UUID,
                DASHBOARD_UUID,
                CHART_UUID,
            );
        });

        it('allows any dashboard when the project allows all dashboards', async () => {
            savedChartExistsInDashboard.mockResolvedValue(true);

            await expect(
                service.checkEmbedPermissions(
                    dashboardAccount({ allowAllDashboards: true }),
                    CHART_UUID,
                ),
            ).resolves.toBeUndefined();
        });

        it('rejects a chart that is not on the dashboard', async () => {
            savedChartExistsInDashboard.mockResolvedValue(false);

            await expect(
                service.checkEmbedPermissions(
                    dashboardAccount({ allowAllDashboards: true }),
                    CHART_UUID,
                ),
            ).rejects.toThrow(
                `This chart does not belong to dashboard ${DASHBOARD_UUID}`,
            );
        });

        it('rejects a dashboard that is not embedded, without reading its charts', async () => {
            await expect(
                service.checkEmbedPermissions(dashboardAccount(), CHART_UUID),
            ).rejects.toThrow(`Dashboard ${DASHBOARD_UUID} is not embedded`);
            expect(savedChartExistsInDashboard).not.toHaveBeenCalled();
        });

        it('rejects a dashboard token with no dashboard in it', async () => {
            await expect(
                service.checkEmbedPermissions(
                    accountWith({ type: 'dashboard', chartUuids: [] }),
                    CHART_UUID,
                ),
            ).rejects.toThrow('Invalid access for embed permissions');
        });
    });

    describe('chart token', () => {
        it('allows its own chart when the chart is embedded', async () => {
            await expect(
                service.checkEmbedPermissions(
                    chartAccount([CHART_UUID], { chartUuids: [CHART_UUID] }),
                    CHART_UUID,
                ),
            ).resolves.toBeUndefined();
        });

        it('allows its own chart when the project allows all charts', async () => {
            await expect(
                service.checkEmbedPermissions(
                    chartAccount([CHART_UUID], { allowAllCharts: true }),
                    CHART_UUID,
                ),
            ).resolves.toBeUndefined();
        });

        it('rejects a chart the token was not signed for', async () => {
            await expect(
                service.checkEmbedPermissions(
                    chartAccount(['another-chart'], { allowAllCharts: true }),
                    CHART_UUID,
                ),
            ).rejects.toThrow(
                `Chart ${CHART_UUID} is not authorized by this token`,
            );
        });

        it('rejects its own chart when the chart is not embedded', async () => {
            await expect(
                service.checkEmbedPermissions(
                    chartAccount([CHART_UUID]),
                    CHART_UUID,
                ),
            ).rejects.toThrow(`Chart ${CHART_UUID} is not embedded`);
        });
    });

    it.each([
        ['dataApp', 'Data app embeds cannot access charts'],
        ['aiAgent', 'AI agent embeds cannot access charts'],
        ['metricsCatalog', 'Metrics catalog embeds cannot access charts'],
    ])('rejects a %s token', async (type, message) => {
        await expect(
            service.checkEmbedPermissions(accountWith({ type }), CHART_UUID),
        ).rejects.toThrow(message);
    });

    it('rejects an account with no project', async () => {
        await expect(
            service.checkEmbedPermissions(
                chartAccount([CHART_UUID], { projectUuid: undefined }),
                CHART_UUID,
            ),
        ).rejects.toBeInstanceOf(ForbiddenError);
    });
});
