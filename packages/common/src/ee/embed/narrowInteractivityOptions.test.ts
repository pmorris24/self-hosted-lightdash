import { FilterInteractivityValues } from './index';
import { narrowInteractivityOptions } from './narrowInteractivityOptions';

const granted = {
    dashboardFiltersInteractivity: {
        enabled: FilterInteractivityValues.all,
        canAddFilters: true,
    },
    canExportCsv: true,
    canDateZoom: true,
    canExportPagePdf: false,
};

describe('narrowInteractivityOptions', () => {
    it('keeps every granted right when nothing is requested', () => {
        expect(narrowInteractivityOptions(granted, undefined)).toMatchObject(
            granted,
        );
    });

    it('drops rights the request turns off', () => {
        const result = narrowInteractivityOptions(granted, {
            canExportCsv: false,
            dashboardFiltersInteractivity: { enabled: false },
        });
        expect(result.canExportCsv).toBe(false);
        expect(result.canDateZoom).toBe(true);
        expect(result.dashboardFiltersInteractivity).toEqual({
            enabled: false,
        });
    });

    it('never grants a right the project token lacks', () => {
        const result = narrowInteractivityOptions(granted, {
            canExportPagePdf: true,
            canExplore: true,
            parameterInteractivity: { enabled: true },
        });
        expect(result.canExportPagePdf).toBe(false);
        expect(result.canExplore).toBe(false);
        expect(result.parameterInteractivity).toEqual({ enabled: false });
    });

    it('cannot turn filters on when the project token has them off', () => {
        const result = narrowInteractivityOptions(
            { dashboardFiltersInteractivity: { enabled: false } },
            {
                dashboardFiltersInteractivity: {
                    enabled: FilterInteractivityValues.all,
                },
            },
        );
        expect(result.dashboardFiltersInteractivity).toEqual({
            enabled: false,
        });
    });

    it('narrows "all" filters to the requested subset', () => {
        const result = narrowInteractivityOptions(granted, {
            dashboardFiltersInteractivity: {
                enabled: FilterInteractivityValues.some,
                allowedFilters: ['status'],
                canAddFilters: false,
            },
        });
        expect(result.dashboardFiltersInteractivity).toEqual({
            enabled: FilterInteractivityValues.some,
            allowedFilters: ['status'],
            hidden: undefined,
            canAddFilters: false,
        });
    });

    it('intersects two "some" filter lists', () => {
        const result = narrowInteractivityOptions(
            {
                dashboardFiltersInteractivity: {
                    enabled: FilterInteractivityValues.some,
                    allowedFilters: ['status', 'region'],
                },
            },
            {
                dashboardFiltersInteractivity: {
                    enabled: FilterInteractivityValues.some,
                    allowedFilters: ['region', 'method'],
                },
            },
        );
        expect(result.dashboardFiltersInteractivity?.allowedFilters).toEqual([
            'region',
        ]);
    });
});
