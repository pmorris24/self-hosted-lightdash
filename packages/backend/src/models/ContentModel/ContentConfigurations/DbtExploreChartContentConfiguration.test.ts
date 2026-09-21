import { ChartKind, ContentType } from '@lightdash/common';
import knex from 'knex';
import { MockClient } from 'knex-mock-client';
import { ContentFilters } from '../ContentModelTypes';
import { dbtExploreChartContentConfiguration } from './DbtExploreChartContentConfiguration';

const db = knex({ client: MockClient, dialect: 'pg' });

const buildQuery = (filters: ContentFilters) =>
    dbtExploreChartContentConfiguration.getSummaryQuery(db, filters).toSQL();

describe('dbtExploreChartContentConfiguration.getSummaryQuery', () => {
    it('does not filter on chart kind or verification by default', () => {
        const { sql } = buildQuery({});
        expect(sql).not.toContain('"last_version_chart_kind" in');
        expect(sql).not.toContain('"verified_at" is not null');
    });

    it('filters on chart kind when chart.kinds is set', () => {
        const { sql, bindings } = buildQuery({
            chart: { kinds: [ChartKind.BIG_NUMBER, ChartKind.GAUGE] },
        });
        expect(sql).toContain(
            '"saved_queries"."last_version_chart_kind" in (?, ?)',
        );
        expect(bindings).toEqual(
            expect.arrayContaining([ChartKind.BIG_NUMBER, ChartKind.GAUGE]),
        );
    });

    it('keeps only verified charts when verifiedOnly is set', () => {
        const { sql } = buildQuery({ verifiedOnly: true });
        expect(sql).toContain(
            '"content_verification"."verified_at" is not null',
        );
    });
});

describe('dbtExploreChartContentConfiguration.shouldQueryBeIncluded', () => {
    it('is included for a chart kind filter', () => {
        expect(
            dbtExploreChartContentConfiguration.shouldQueryBeIncluded({
                contentTypes: [ContentType.CHART],
                chart: { kinds: [ChartKind.TABLE] },
            }),
        ).toBe(true);
    });

    it('is excluded when only data apps are requested', () => {
        expect(
            dbtExploreChartContentConfiguration.shouldQueryBeIncluded({
                contentTypes: [ContentType.DATA_APP],
            }),
        ).toBe(false);
    });
});
