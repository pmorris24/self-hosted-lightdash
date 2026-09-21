import { type ChartContent, type DataAppContent } from '@lightdash/common';

// Anything the catalog can add to a dashboard as a tile
export type CatalogWidget = ChartContent | DataAppContent;

export enum WidgetCatalogTab {
    ALL = 'all',
    KPI = 'kpi',
    CHART = 'chart',
    TABLE = 'table',
    APP = 'app',
}

export enum WidgetCatalogSort {
    MOST_USED = 'most_used',
    RECENTLY_UPDATED = 'recently_updated',
    NAME = 'name',
}
