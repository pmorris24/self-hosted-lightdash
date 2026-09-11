import { query, useLightdash } from '@lightdash/query-sdk';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const totalsQuery = query('inference_usage')
    .label('Usage KPIs')
    .metrics(['spend', 'tokens'])
    .limit(1);

const KPIS = [
    { field: 'spend', label: 'Total spend' },
    { field: 'tokens', label: 'Tokens consumed' },
];

export function UsageKpis() {
    const { data, format, loading, error, lineage } =
        useLightdash(totalsQuery);

    if (error) {
        return (
            <p className="text-sm text-destructive">Error: {error.message}</p>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2" {...lineage}>
            {KPIS.map((kpi) => (
                <Card key={kpi.field}>
                    <CardHeader className="pb-4">
                        <CardDescription>{kpi.label}</CardDescription>
                        <CardTitle className="text-2xl tabular-nums">
                            {loading ? (
                                <Skeleton className="h-8 w-32" />
                            ) : data.length > 0 ? (
                                format(data[0], kpi.field)
                            ) : (
                                '—'
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>
            ))}
        </div>
    );
}
