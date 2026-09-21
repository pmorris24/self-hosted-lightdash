import { ChartKind } from '@lightdash/common';
import knex from 'knex';
import { MockClient } from 'knex-mock-client';
import { ContentFilters } from '../ContentModelTypes';
import { sqlChartContentConfiguration } from './SqlChartContentConfiguration';

const db = knex({ client: MockClient, dialect: 'pg' });

const buildQuery = (filters: ContentFilters) =>
    sqlChartContentConfiguration.getSummaryQuery(db, filters).toSQL();

describe('sqlChartContentConfiguration.getSummaryQuery', () => {
    it('does not filter on chart kind or verification by default', () => {
        const { sql } = buildQuery({});
        expect(sql).not.toContain('"last_version_chart_kind" in');
        expect(sql).not.toContain('"verified_at" is not null');
    });

    it('filters on chart kind when chart.kinds is set', () => {
        const { sql, bindings } = buildQuery({
            chart: { kinds: [ChartKind.TABLE] },
        });
        expect(sql).toContain('"saved_sql"."last_version_chart_kind" in (?)');
        expect(bindings).toContain(ChartKind.TABLE);
        // Only VERTICAL_BAR absorbs unknown kinds
        expect(sql).not.toContain('"last_version_chart_kind" not in');
        expect(sql).not.toContain('"last_version_chart_kind" is null');
    });

    it('also matches unknown and null kinds for VERTICAL_BAR, which is what they are read back as', () => {
        const { sql } = buildQuery({
            chart: { kinds: [ChartKind.VERTICAL_BAR] },
        });
        expect(sql).toContain('"saved_sql"."last_version_chart_kind" in (?)');
        expect(sql).toContain(
            'or "saved_sql"."last_version_chart_kind" not in',
        );
        expect(sql).toContain(
            'or "saved_sql"."last_version_chart_kind" is null',
        );
    });

    it('groups the kind alternatives so they cannot widen other filters', () => {
        const { sql } = buildQuery({
            spaceUuids: ['space-1'],
            chart: { kinds: [ChartKind.VERTICAL_BAR] },
        });
        expect(sql).toMatch(
            /\("saved_sql"\."last_version_chart_kind" in \(\?\) or [^)]+\) or "saved_sql"\."last_version_chart_kind" is null\)/,
        );
    });

    it('keeps only verified charts when verifiedOnly is set', () => {
        const { sql } = buildQuery({ verifiedOnly: true });
        expect(sql).toContain(
            '"content_verification"."verified_at" is not null',
        );
    });
});
