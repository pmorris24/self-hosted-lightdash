import {
    type ComposedLayout,
    type ComposedLayoutRow,
    type ComposedWidget,
} from './types';

const DEFAULT_WIDGETS_PER_ROW = 2;
const DEFAULT_ROW_HEIGHT = 320;

/** One column, `widgetsPerRow` widgets of equal width on each row. */
export const createDefaultLayout = (
    widgets: Pick<ComposedWidget, 'id'>[],
    widgetsPerRow: number = DEFAULT_WIDGETS_PER_ROW,
): ComposedLayout => {
    const perRow = Math.max(1, Math.floor(widgetsPerRow));
    const rows: ComposedLayoutRow[] = [];
    for (let index = 0; index < widgets.length; index += perRow) {
        const rowWidgets = widgets.slice(index, index + perRow);
        rows.push({
            cells: rowWidgets.map((widget) => ({
                widgetId: widget.id,
                widthPercentage: 100 / rowWidgets.length,
                height: DEFAULT_ROW_HEIGHT,
            })),
        });
    }
    return { columns: [{ widthPercentage: 100, rows }] };
};

/** Drops cells for unknown widgets, then puts widgets with no cell at the end. */
export const reconcileLayout = (
    layout: ComposedLayout,
    widgets: Pick<ComposedWidget, 'id'>[],
): ComposedLayout => {
    const known = new Set(widgets.map((widget) => widget.id));
    const placed = new Set<string>();
    const columns = layout.columns.map((column) => ({
        ...column,
        rows: column.rows
            .map((row) => ({
                cells: row.cells.filter((cell) => {
                    if (!known.has(cell.widgetId) || placed.has(cell.widgetId))
                        return false;
                    placed.add(cell.widgetId);
                    return true;
                }),
            }))
            .filter((row) => row.cells.length > 0),
    }));
    const missing = widgets.filter((widget) => !placed.has(widget.id));
    if (missing.length === 0) return { columns };
    if (columns.length === 0) return createDefaultLayout(missing);

    const extraRows = createDefaultLayout(missing).columns[0].rows;
    const lastIndex = columns.length - 1;
    return {
        columns: columns.map((column, index) =>
            index === lastIndex
                ? { ...column, rows: [...column.rows, ...extraRows] }
                : column,
        ),
    };
};

export const DEFAULT_COMPOSED_ROW_HEIGHT = DEFAULT_ROW_HEIGHT;
