import { ChartKind } from '../types/savedCharts';
import {
    getChartKindsForWidgetCatalogGroup,
    getWidgetCatalogGroup,
    WidgetCatalogGroup,
} from './widgetCatalog';

describe('widgetCatalog groups', () => {
    it('puts single-value displays in KPIs and tables in Tables', () => {
        expect(getWidgetCatalogGroup(ChartKind.BIG_NUMBER)).toBe(
            WidgetCatalogGroup.KPI,
        );
        expect(getWidgetCatalogGroup(ChartKind.GAUGE)).toBe(
            WidgetCatalogGroup.KPI,
        );
        expect(getWidgetCatalogGroup(ChartKind.TABLE)).toBe(
            WidgetCatalogGroup.TABLE,
        );
    });

    it('treats a data app viz as a chart, not an app', () => {
        expect(getWidgetCatalogGroup(ChartKind.DATA_APP_VIZ)).toBe(
            WidgetCatalogGroup.CHART,
        );
    });

    it('partitions every chart kind into exactly one group', () => {
        const grouped = Object.values(WidgetCatalogGroup).flatMap(
            getChartKindsForWidgetCatalogGroup,
        );
        expect([...grouped].sort()).toEqual(Object.values(ChartKind).sort());
    });
});
