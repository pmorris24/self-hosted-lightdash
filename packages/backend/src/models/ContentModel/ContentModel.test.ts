import { ContentSortByColumns, ContentType } from '@lightdash/common';
import knex from 'knex';
import { getTracker, MockClient, Tracker } from 'knex-mock-client';
import { ContentModel } from './ContentModel';

const db = knex({ client: MockClient, dialect: 'pg' });
const model = new ContentModel({ database: db });

const filters = { contentTypes: [ContentType.CHART, ContentType.DATA_APP] };

describe('ContentModel.findSummaryContents ordering', () => {
    let tracker: Tracker;

    beforeAll(() => {
        tracker = getTracker();
    });

    beforeEach(() => {
        tracker.on.select(/.*/).response([]);
    });

    afterEach(() => {
        tracker.reset();
    });

    const lastOrderBy = (): string => {
        const { sql } =
            tracker.history.select[tracker.history.select.length - 1];
        return sql.slice(sql.lastIndexOf('order by'));
    };

    it('groups by content type before the sort column by default', async () => {
        await model.findSummaryContents(filters, {
            sortBy: ContentSortByColumns.VIEWS,
        });
        expect(lastOrderBy()).toBe(
            'order by "content_type_rank" ASC, "views" DESC, "uuid" ASC',
        );
    });

    it('orders purely by the sort column when interleaveContentTypes is set', async () => {
        await model.findSummaryContents(filters, {
            sortBy: ContentSortByColumns.VIEWS,
            interleaveContentTypes: true,
        });
        expect(lastOrderBy()).toBe('order by "views" DESC, "uuid" ASC');
    });

    it('interleaves on the default last_updated_at sort too', async () => {
        await model.findSummaryContents(filters, {
            interleaveContentTypes: true,
        });
        expect(lastOrderBy()).toBe(
            'order by "last_updated_at" DESC, "uuid" ASC',
        );
    });
});
