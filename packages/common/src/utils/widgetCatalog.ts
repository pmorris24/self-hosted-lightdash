import { ChartKind } from '../types/savedCharts';
import assertUnreachable from './assertUnreachable';

// How the widget catalog groups saved charts. Data apps are a content type of
// their own, not a chart kind, so they are not a group here.
export enum WidgetCatalogGroup {
    KPI = 'kpi',
    CHART = 'chart',
    TABLE = 'table',
}

export const getWidgetCatalogGroup = (kind: ChartKind): WidgetCatalogGroup => {
    switch (kind) {
        case ChartKind.BIG_NUMBER:
        case ChartKind.GAUGE:
            return WidgetCatalogGroup.KPI;
        case ChartKind.TABLE:
            return WidgetCatalogGroup.TABLE;
        // DATA_APP_VIZ is a saved chart drawn by a custom viz, not a data app
        case ChartKind.LINE:
        case ChartKind.HORIZONTAL_BAR:
        case ChartKind.VERTICAL_BAR:
        case ChartKind.SCATTER:
        case ChartKind.AREA:
        case ChartKind.MIXED:
        case ChartKind.PIE:
        case ChartKind.FUNNEL:
        case ChartKind.CUSTOM:
        case ChartKind.TREEMAP:
        case ChartKind.MAP:
        case ChartKind.SANKEY:
        case ChartKind.DATA_APP_VIZ:
            return WidgetCatalogGroup.CHART;
        default:
            return assertUnreachable(kind, `Unknown chart kind: ${kind}`);
    }
};

export const getChartKindsForWidgetCatalogGroup = (
    group: WidgetCatalogGroup,
): ChartKind[] =>
    Object.values(ChartKind).filter(
        (kind) => getWidgetCatalogGroup(kind) === group,
    );
