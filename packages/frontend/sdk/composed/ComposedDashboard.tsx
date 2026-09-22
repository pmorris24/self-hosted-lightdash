import { type CSSProperties, type FC, type ReactNode } from 'react';
import { DEFAULT_COMPOSED_ROW_HEIGHT } from './layout';
import {
    type ComposedDashboardResult,
    type ComposedWidgetState,
} from './types';

type Props = {
    dashboard: ComposedDashboardResult['dashboard'];
    // How to draw one widget. The host decides the frame around each chart.
    renderWidget: (widget: ComposedWidgetState) => ReactNode;
    gap?: number;
};

const rowStyle = (gap: number): CSSProperties => ({
    display: 'flex',
    gap,
    minWidth: 0,
});

/**
 * Draws the layout of a composed dashboard. It owns positions only; a host
 * that wants full control can ignore it and place the widgets itself.
 */
export const ComposedDashboard: FC<Props> = ({
    dashboard,
    renderWidget,
    gap = 16,
}) => {
    const widgetsById = new Map(
        dashboard.widgets.map((widget) => [widget.id, widget]),
    );

    return (
        <div style={rowStyle(gap)} data-lightdash-composed-dashboard="">
            {dashboard.layout.columns.map((column, columnIndex) => (
                <div
                    key={columnIndex}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap,
                        minWidth: 0,
                        flex: `${column.widthPercentage} 1 0`,
                    }}
                >
                    {column.rows.map((row, rowIndex) => (
                        <div key={rowIndex} style={rowStyle(gap)}>
                            {row.cells.map((cell) => {
                                const widget = widgetsById.get(cell.widgetId);
                                if (!widget) return null;
                                return (
                                    <div
                                        key={cell.widgetId}
                                        data-lightdash-widget={cell.widgetId}
                                        style={{
                                            flex: `${cell.widthPercentage} 1 0`,
                                            minWidth: 0,
                                            height:
                                                cell.height ??
                                                DEFAULT_COMPOSED_ROW_HEIGHT,
                                        }}
                                    >
                                        {renderWidget(widget)}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};
