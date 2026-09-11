import { query, useLightdash } from '@lightdash/query-sdk';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/theme';

const spendByModelQuery = query('inference_usage')
    .label('Spend by Model Chart')
    .dimensions(['model'])
    .metrics(['spend'])
    .sorts([{ field: 'spend', direction: 'desc' }])
    .limit(50);

export function SpendByModelChart() {
    const { data, loading, error, lineage } = useLightdash(spendByModelQuery);

    return (
        <Card {...lineage}>
            <CardHeader>
                <CardTitle className="text-base">Spend by model</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
                {error ? (
                    <p className="text-sm text-destructive">
                        Error: {error.message}
                    </p>
                ) : loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid
                                vertical={false}
                                strokeDasharray="3 3"
                            />
                            <XAxis dataKey="model" tickLine={false} />
                            <YAxis width={72} tickLine={false} />
                            <Tooltip />
                            <Bar
                                dataKey="spend"
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
