import { savedChart, useLightdash } from '@lightdash/query-sdk';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/theme';

// Linked, not copied: editing the saved chart in Lightdash changes this card
// in every host without rebuilding the app.
const usageByModelChart = savedChart('poc-chart-usage-by-model').label(
    'Usage by Model (linked chart)',
);

export function ModelUsageChart() {
    const { data, columns, loading, error, lineage } =
        useLightdash(usageByModelChart);
    const dimension = columns.find((column) => column.type === 'string');
    const metric = columns.find((column) => column.type === 'number');

    return (
        <Card {...lineage}>
            <CardHeader>
                <CardTitle className="text-base">
                    {metric ? `${metric.label} by model` : 'Usage by model'}
                </CardTitle>
                <CardDescription>Linked chart</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
                {error ? (
                    <p className="text-sm text-destructive">
                        Error: {error.message}
                    </p>
                ) : loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : !dimension || !metric ? (
                    <p className="text-sm text-muted-foreground">
                        This chart needs a dimension and a metric.
                    </p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid
                                vertical={false}
                                strokeDasharray="3 3"
                            />
                            <XAxis dataKey={dimension.name} tickLine={false} />
                            <YAxis width={96} tickLine={false} />
                            <Tooltip />
                            <Bar
                                dataKey={metric.name}
                                name={metric.label}
                                fill={CHART_COLORS[0]}
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
