import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import knex from 'knex';
import path from 'path';
import pgConnectionString from 'pg-connection-string';
import { type Plugin } from 'vite';
import { decrypt } from './embedCrypto';

const { parse: parseConnectionString } = pgConnectionString;

const TOKENS_PATH = '/sdk-test-app-api/tokens';
const TOKEN_LIFETIME = '1h';

const dashboardVariants = {
    plain: {},
    filters: { dashboardFiltersInteractivity: { enabled: 'all' } },
    toolbar: {
        dashboardFiltersInteractivity: { enabled: 'all' },
        canExportCsv: true,
        canExportImages: true,
        canExportPagePdf: true,
        canDateZoom: true,
    },
} as const;

// PM2 starts this app with the base env, so the local overrides (database port,
// site URL) have to be read from the files. The local file wins.
const readRootEnv = (): Record<string, string | undefined> => {
    const rootDir = path.resolve(import.meta.dirname, '../..');
    const read = (file: string) => {
        try {
            return parse(readFileSync(path.join(rootDir, file)));
        } catch {
            return {};
        }
    };
    return {
        ...process.env,
        ...read('.env.development'),
        ...read('.env.development.local'),
    };
};

const getConnection = (env: Record<string, string | undefined>) => {
    const connectionUri = env.PGCONNECTIONURI || env.DATABASE_URL;
    return connectionUri
        ? parseConnectionString(connectionUri)
        : {
              host: env.PGHOST || 'localhost',
              port: env.PGPORT || '5432',
              user: env.PGUSER || 'postgres',
              password: env.PGPASSWORD || 'password',
              database: env.PGDATABASE || 'postgres',
          };
};

export const getTokens = async (dashboardName: string) => {
    const env = readRootEnv();
    const db = knex({ client: 'pg', connection: getConnection(env) });
    try {
        const dashboard = await db('dashboards')
            .select(
                'dashboards.dashboard_id',
                'dashboards.dashboard_uuid',
                'dashboards.name',
                'projects.project_uuid',
            )
            .join('spaces', 'dashboards.space_id', 'spaces.space_id')
            .join('projects', 'spaces.project_id', 'projects.project_id')
            .whereNull('dashboards.deleted_at')
            .where('dashboards.name', dashboardName)
            .first();
        if (!dashboard) throw new Error(`No dashboard named ${dashboardName}`);

        const embedding = await db('embedding')
            .where({ project_uuid: dashboard.project_uuid })
            .first();
        if (!embedding) {
            throw new Error(
                'This project has no embed secret. Run generate-embed-token first.',
            );
        }
        const secret = decrypt(
            embedding.encoded_secret,
            env.LIGHTDASH_SECRET || 'not very secret',
        );

        const charts = await db('dashboard_tile_charts')
            .select('saved_queries.saved_query_uuid', 'saved_queries.name')
            .select({ chartKind: 'saved_queries.last_version_chart_kind' })
            .select({
                exploreName: db('saved_queries_versions')
                    .select('explore_name')
                    .whereRaw(
                        'saved_queries_versions.saved_query_id = saved_queries.saved_query_id',
                    )
                    .orderBy('created_at', 'desc')
                    .limit(1),
            })
            .join(
                'saved_queries',
                'saved_queries.saved_query_id',
                'dashboard_tile_charts.saved_chart_id',
            )
            .where(
                'dashboard_tile_charts.dashboard_version_id',
                db('dashboard_versions')
                    .max('dashboard_version_id')
                    .where('dashboard_id', dashboard.dashboard_id),
            )
            .orderBy('saved_queries.name');

        const sign = (content: Record<string, unknown>) =>
            jwt.sign({ content, userAttributes: {} }, secret, {
                expiresIn: TOKEN_LIFETIME,
            });
        const dashboardContent = {
            type: 'dashboard',
            projectUuid: dashboard.project_uuid,
            dashboardUuid: dashboard.dashboard_uuid,
        };

        return {
            instanceUrl: env.LIGHTDASH_API_URL || env.SITE_URL,
            siteUrl: env.SITE_URL,
            projectUuid: dashboard.project_uuid,
            dashboard: {
                uuid: dashboard.dashboard_uuid,
                name: dashboard.name,
                tokens: {
                    plain: sign({
                        ...dashboardContent,
                        ...dashboardVariants.plain,
                    }),
                    filters: sign({
                        ...dashboardContent,
                        ...dashboardVariants.filters,
                    }),
                    toolbar: sign({
                        ...dashboardContent,
                        ...dashboardVariants.toolbar,
                    }),
                },
            },
            charts: charts.map((chart) => ({
                uuid: chart.saved_query_uuid,
                name: chart.name,
                chartKind: chart.chartKind,
                exploreName: chart.exploreName,
                token: sign({
                    type: 'chart',
                    projectUuid: dashboard.project_uuid,
                    contentId: chart.saved_query_uuid,
                }),
            })),
        };
    } finally {
        await db.destroy();
    }
};

// Dev server only. Signs short-lived embed tokens for the local instance, so
// example pages can ask for several tokens without a copied URL.
export const devTokens = (): Plugin => ({
    name: 'sdk-test-app-dev-tokens',
    apply: 'serve',
    configureServer(server) {
        server.middlewares.use(TOKENS_PATH, (req, res) => {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const dashboardName =
                url.searchParams.get('dashboard') ||
                process.env.DASHBOARD_NAME ||
                'Jaffle shop overview';
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            getTokens(dashboardName).then(
                (tokens) => res.end(JSON.stringify(tokens)),
                (error: unknown) => {
                    res.statusCode = 500;
                    res.end(
                        JSON.stringify({
                            error:
                                error instanceof Error
                                    ? error.message
                                    : 'Could not sign tokens',
                        }),
                    );
                },
            );
        });
    },
});
