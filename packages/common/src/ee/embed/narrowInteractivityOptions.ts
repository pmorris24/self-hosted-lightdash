import {
    FilterInteractivityValues,
    type DashboardFilterInteractivityOptions,
    type InteractivityOptions,
} from './index';

const isFilterInteractivityOn = (
    options: DashboardFilterInteractivityOptions | undefined,
): options is DashboardFilterInteractivityOptions =>
    options !== undefined &&
    options.enabled !== false &&
    options.enabled !== FilterInteractivityValues.none;

const narrowBoolean = (
    granted: boolean | undefined,
    requested: boolean | undefined,
): boolean | undefined =>
    requested === undefined ? granted : Boolean(granted) && requested;

const narrowFilterInteractivity = (
    granted: DashboardFilterInteractivityOptions | undefined,
    requested: DashboardFilterInteractivityOptions | undefined,
): DashboardFilterInteractivityOptions | undefined => {
    if (requested === undefined || !isFilterInteractivityOn(granted)) {
        return granted;
    }
    if (!isFilterInteractivityOn(requested)) {
        return { enabled: false };
    }
    const grantedAll =
        granted.enabled === true ||
        granted.enabled === FilterInteractivityValues.all;
    const requestedAll =
        requested.enabled === true ||
        requested.enabled === FilterInteractivityValues.all;
    let allowedFilters: string[] | null | undefined;
    if (grantedAll) {
        allowedFilters = requestedAll ? undefined : requested.allowedFilters;
    } else if (requestedAll) {
        allowedFilters = granted.allowedFilters;
    } else {
        const grantedFilters = new Set(granted.allowedFilters ?? []);
        allowedFilters = (requested.allowedFilters ?? []).filter((filter) =>
            grantedFilters.has(filter),
        );
    }
    return {
        enabled:
            grantedAll && requestedAll
                ? FilterInteractivityValues.all
                : FilterInteractivityValues.some,
        ...(allowedFilters === undefined ? {} : { allowedFilters }),
        hidden: requested.hidden ?? granted.hidden,
        canAddFilters: narrowBoolean(
            granted.canAddFilters,
            requested.canAddFilters,
        ),
    };
};

/**
 * The rights of a content token minted from a project token: what the project
 * token grants, less anything the request leaves out. A request can only
 * narrow; asking for a right the project token lacks does not grant it.
 */
export const narrowInteractivityOptions = (
    granted: InteractivityOptions,
    requested: InteractivityOptions | undefined,
): InteractivityOptions => {
    if (requested === undefined) {
        return {
            dashboardFiltersInteractivity:
                granted.dashboardFiltersInteractivity,
            parameterInteractivity: granted.parameterInteractivity,
            canExportCsv: granted.canExportCsv,
            canExportDashboardCsv: granted.canExportDashboardCsv,
            canExportImages: granted.canExportImages,
            canExportPagePdf: granted.canExportPagePdf,
            canDateZoom: granted.canDateZoom,
            canExplore: granted.canExplore,
            canViewUnderlyingData: granted.canViewUnderlyingData,
            canViewDataApps: granted.canViewDataApps,
            stickyHeader: granted.stickyHeader,
        };
    }
    return {
        dashboardFiltersInteractivity: narrowFilterInteractivity(
            granted.dashboardFiltersInteractivity,
            requested.dashboardFiltersInteractivity,
        ),
        parameterInteractivity:
            requested.parameterInteractivity === undefined
                ? granted.parameterInteractivity
                : {
                      enabled:
                          Boolean(granted.parameterInteractivity?.enabled) &&
                          requested.parameterInteractivity.enabled,
                  },
        canExportCsv: narrowBoolean(
            granted.canExportCsv,
            requested.canExportCsv,
        ),
        canExportDashboardCsv: narrowBoolean(
            granted.canExportDashboardCsv,
            requested.canExportDashboardCsv,
        ),
        canExportImages: narrowBoolean(
            granted.canExportImages,
            requested.canExportImages,
        ),
        canExportPagePdf: narrowBoolean(
            granted.canExportPagePdf,
            requested.canExportPagePdf,
        ),
        canDateZoom: narrowBoolean(granted.canDateZoom, requested.canDateZoom),
        canExplore: narrowBoolean(granted.canExplore, requested.canExplore),
        canViewUnderlyingData: narrowBoolean(
            granted.canViewUnderlyingData,
            requested.canViewUnderlyingData,
        ),
        canViewDataApps: narrowBoolean(
            granted.canViewDataApps,
            requested.canViewDataApps,
        ),
        // Layout, not a right: the request decides.
        stickyHeader: requested.stickyHeader ?? granted.stickyHeader,
    };
};
