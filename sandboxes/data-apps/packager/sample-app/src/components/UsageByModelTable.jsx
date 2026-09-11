import { query, useLightdash } from '@lightdash/query-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

const usageByModelQuery = query('inference_usage')
    .label('Usage by Model Table')
    .dimensions(['model'])
    .metrics(['spend', 'tokens'])
    .sorts([{ field: 'tokens', direction: 'desc' }])
    .limit(50);

export function UsageByModelTable() {
    const { data, format, loading, error, lineage } =
        useLightdash(usageByModelQuery);

    return (
        <Card {...lineage}>
            <CardHeader>
                <CardTitle className="text-base">Usage by model</CardTitle>
            </CardHeader>
            <CardContent>
                {error ? (
                    <p className="text-sm text-destructive">
                        Error: {error.message}
                    </p>
                ) : loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Model</TableHead>
                                <TableHead className="text-right">
                                    Tokens
                                </TableHead>
                                <TableHead className="text-right">
                                    Spend
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row) => (
                                <TableRow key={row.model}>
                                    <TableCell className="font-medium">
                                        {format(row, 'model')}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {format(row, 'tokens')}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {format(row, 'spend')}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
