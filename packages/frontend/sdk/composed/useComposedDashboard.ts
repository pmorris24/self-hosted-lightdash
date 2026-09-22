import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SdkChartSelection } from '../../src/ee/features/embed/EmbedChart/types';
import { type SdkFilter } from '../../src/ee/features/embed/EmbedDashboard/types';
import {
    addFilter as addFilterTo,
    getWidgetFilters,
    removeFilter as removeFilterFrom,
    toggleSelectionFilters,
} from './filters';
import { createDefaultLayout, reconcileLayout } from './layout';
import {
    type ComposedDashboardChangeEvent,
    type ComposedDashboardProps,
    type ComposedDashboardResult,
    type ComposedWidget,
    type ComposedLayout,
    type UseComposedDashboardOptions,
} from './types';

/**
 * Takes separate widgets and filters and keeps them coordinated: shared
 * filters, cross filtering from chart clicks, change events, and a layout.
 * Spread each widget's `chartProps` onto `Lightdash.Chart`.
 */
export const useComposedDashboard = (
    initialDashboard: ComposedDashboardProps,
    options: UseComposedDashboardOptions = {},
): ComposedDashboardResult => {
    const { title } = initialDashboard;
    const [widgets, setWidgetsState] = useState<ComposedWidget[]>(
        initialDashboard.widgets,
    );
    const [filters, setFiltersState] = useState<SdkFilter[]>(
        initialDashboard.filters ?? [],
    );
    const [layout, setLayoutState] = useState<ComposedLayout>(
        () => initialDashboard.layout ?? createDefaultLayout(widgets),
    );

    // Callers often pass a new function each render; events must not depend on it.
    const onChangeRef = useRef(options.onChange);
    useEffect(() => {
        onChangeRef.current = options.onChange;
    }, [options.onChange]);
    const emit = useCallback((event: ComposedDashboardChangeEvent) => {
        onChangeRef.current?.(event);
    }, []);

    const filtersRef = useRef(filters);
    const updateFilters = useCallback(
        (next: SdkFilter[]) => {
            filtersRef.current = next;
            setFiltersState(next);
            emit({ type: 'filters/updated', payload: next });
        },
        [emit],
    );

    const setFilters = useCallback(
        (next: SdkFilter[]) => updateFilters(next),
        [updateFilters],
    );
    const addFilter = useCallback(
        (filter: SdkFilter) =>
            updateFilters(addFilterTo(filtersRef.current, filter)),
        [updateFilters],
    );
    const removeFilter = useCallback(
        (target: Pick<SdkFilter, 'model' | 'field'>) =>
            updateFilters(removeFilterFrom(filtersRef.current, target)),
        [updateFilters],
    );
    const clearFilters = useCallback(() => updateFilters([]), [updateFilters]);

    const widgetsRef = useRef(widgets);
    const updateWidgets = useCallback(
        (next: ComposedWidget[]) => {
            widgetsRef.current = next;
            setWidgetsState(next);
            emit({ type: 'widgets/updated', payload: next });
        },
        [emit],
    );
    const setWidgets = useCallback(
        (next: ComposedWidget[]) => updateWidgets(next),
        [updateWidgets],
    );
    const addWidget = useCallback(
        (widget: ComposedWidget) =>
            updateWidgets([
                ...widgetsRef.current.filter((item) => item.id !== widget.id),
                widget,
            ]),
        [updateWidgets],
    );
    const removeWidget = useCallback(
        (widgetId: string) =>
            updateWidgets(
                widgetsRef.current.filter((item) => item.id !== widgetId),
            ),
        [updateWidgets],
    );

    // A dashboard read from a model arrives after the first render, so the
    // widgets it brings replace the ones held here. Callers usually build
    // that array inline, so a new array of the same widgets is not a change:
    // comparing by content is what keeps `addWidget` from being undone on
    // the next render.
    const initialWidgets = initialDashboard.widgets;
    const incoming = JSON.stringify(initialWidgets);
    const syncedRef = useRef(incoming);
    useEffect(() => {
        if (syncedRef.current === incoming) return;
        syncedRef.current = incoming;
        widgetsRef.current = initialWidgets;
        setWidgetsState(initialWidgets);
    }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

    const setLayout = useCallback(
        (next: ComposedLayout) => {
            setLayoutState(next);
            emit({ type: 'layout/updated', payload: next });
        },
        [emit],
    );

    const handleSelect = useCallback(
        (
            widgetId: string,
            crossFilter: boolean,
            selection: SdkChartSelection,
        ) => {
            emit({
                type: 'selection/changed',
                payload: { widgetId, selection },
            });
            if (crossFilter && selection.filters.length > 0) {
                updateFilters(
                    toggleSelectionFilters(
                        filtersRef.current,
                        selection.filters,
                    ),
                );
            }
        },
        [emit, updateFilters],
    );

    const widgetStates = useMemo(
        () =>
            widgets.map((widget) => ({
                ...widget,
                chartProps: {
                    id: widget.chartUuid,
                    filters: getWidgetFilters(filters, widget),
                    onSelect: (selection: SdkChartSelection) =>
                        handleSelect(
                            widget.id,
                            widget.crossFilter !== false,
                            selection,
                        ),
                },
            })),
        [widgets, filters, handleSelect],
    );

    const reconciledLayout = useMemo(
        () => reconcileLayout(layout, widgets),
        [layout, widgets],
    );

    return {
        dashboard: {
            title,
            widgets: widgetStates,
            filters,
            layout: reconciledLayout,
        },
        setFilters,
        addFilter,
        removeFilter,
        clearFilters,
        setLayout,
        setWidgets,
        addWidget,
        removeWidget,
    };
};
