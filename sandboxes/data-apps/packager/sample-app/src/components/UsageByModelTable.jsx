import { useMemo } from 'react';
import { query, useLightdash, useUrlState } from '@lightdash/query-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

const SORT_LABELS = { tokens: 'Tokens', spend: 'Spend' };

const usageByModelQuery = query('inference_usage')
    .label('Usage by Model Table')
    .dimensions(['model'])
    .metrics(['spend', 'tokens'])
    .limit(50);

export function UsageByModelTable() {
    const [sortParam, setSortParam] = useUrlState('tableSort', 'tokens');
    // URL state is untrusted: fall back when it isn't a known sort.
    const sortField = Object.hasOwn(SORT_LABELS, sortParam)
        ? sortParam
        : 'tokens';
    const sortedQuery = useMemo(
        () => usageByModelQuery.sorts([{ field: sortField, direction: 'desc' }]),
        [sortField],
    );
    const { data, format, loading, error, lineage } = useLightdash(sortedQuery);

    return (
        <Card {...lineage}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Usage by model</CardTitle>
                <Select value={sortField} onValueChange={setSortParam}>
                    <SelectTrigger className="w-40" aria-label="Sort by">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(SORT_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                Sort by {label.toLowerCase()}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
