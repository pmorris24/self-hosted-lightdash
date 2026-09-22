import {
    isExploreError,
    type CompiledDimension,
    type CompiledMetric,
    type Explore,
    type ExploreError,
} from '@lightdash/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import GlobalState from '../globalState';
import { detectProjectType } from '../lightdash/projectType';
import * as styles from '../styles';
import { compile, type CompileHandlerOptions } from './compile';

export type GenerateTypesHandlerOptions = CompileHandlerOptions & {
    output: string;
};

type EmittedField = {
    key: string;
    fieldId: string;
    comment: string;
};

type EmittedTable = {
    key: string;
    label: string;
    fields: EmittedField[];
};

type EmittedExplore = {
    name: string;
    label: string;
    namespace: string;
    fields: EmittedField[];
    joined: EmittedTable[];
};

export type GenerateTypesResult = {
    code: string;
    explores: string[];
    skipped: string[];
};

const toCamelCase = (value: string): string => {
    const words = value
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
    const joined = words
        .map((word, index) =>
            index === 0
                ? word.charAt(0).toLowerCase() + word.slice(1)
                : word.charAt(0).toUpperCase() + word.slice(1),
        )
        .join('');
    return /^[0-9]/.test(joined) ? `_${joined}` : joined || '_';
};

const toPascalCase = (value: string): string => {
    const camel = toCamelCase(value);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
};

// Keys that already mean something in the emitted namespace.
const RESERVED_KEYS = new Set(['explore']);

const uniqueKey = (wanted: string, taken: Set<string>): string => {
    let key = wanted;
    let attempt = 2;
    while (taken.has(key) || RESERVED_KEYS.has(key)) {
        key = `${wanted}${attempt}`;
        attempt += 1;
    }
    taken.add(key);
    return key;
};

const escapeComment = (text: string): string =>
    text.replace(/\*\//g, '* /').replace(/\s+/g, ' ').trim();

const describeField = (field: CompiledDimension | CompiledMetric): string => {
    const parts = [field.label, field.fieldType, field.type];
    const description = field.description ? ` ${field.description}` : '';
    return escapeComment(`${parts.join(' · ')}.${description}`);
};

const fieldsOfTable = (
    fields: (CompiledDimension | CompiledMetric)[],
    taken: Set<string>,
): EmittedField[] =>
    fields
        .filter((field) => !field.hidden)
        .map((field) => ({
            key: uniqueKey(toCamelCase(field.name), taken),
            fieldId: `${field.table}_${field.name}`,
            comment: describeField(field),
        }));

const emitExplore = (explore: Explore, namespace: string): EmittedExplore => {
    const taken = new Set<string>();
    const base = explore.tables[explore.baseTable];
    const fields = fieldsOfTable(
        [...Object.values(base.dimensions), ...Object.values(base.metrics)],
        taken,
    );
    const joined = explore.joinedTables
        .map((join) => explore.tables[join.table])
        .filter(
            (table) => table !== undefined && table.name !== explore.baseTable,
        )
        .map((table) => ({
            key: uniqueKey(toCamelCase(table.name), taken),
            label: table.label,
            fields: fieldsOfTable(
                [
                    ...Object.values(table.dimensions),
                    ...Object.values(table.metrics),
                ],
                new Set<string>(),
            ),
        }));
    return {
        name: explore.name,
        label: explore.label,
        namespace,
        fields,
        joined,
    };
};

const renderField = (field: EmittedField, indent: string): string =>
    `${indent}/** ${field.comment} */\n${indent}${field.key}: '${field.fieldId}',`;

const renderExplore = (explore: EmittedExplore): string => {
    const lines = [
        `/** ${escapeComment(explore.label)} */`,
        `export const ${explore.namespace} = {`,
        `    /** The explore these fields belong to. */`,
        `    explore: '${explore.name}',`,
        ...explore.fields.map((field) => renderField(field, '    ')),
        ...explore.joined.flatMap((table) => [
            `    /** Fields of the joined table ${escapeComment(table.label)}. */`,
            `    ${table.key}: {`,
            ...table.fields.map((field) => renderField(field, '        ')),
            `    },`,
        ]),
        `} as const;`,
    ];
    const ids = [
        ...explore.fields.map((field) => field.fieldId),
        ...explore.joined.flatMap((table) =>
            table.fields.map((field) => field.fieldId),
        ),
    ];
    lines.push(
        `export type ${explore.namespace}FieldId =${
            ids.length > 0
                ? `\n${ids.map((id) => `    | '${id}'`).join('\n')};`
                : ' never;'
        }`,
    );
    return lines.join('\n');
};

/**
 * Turns compiled explores into one TypeScript module: a constant per explore
 * whose members are the field ids, so host code writes `Orders.totalAmount`
 * instead of the string `'orders_total_amount'`.
 */
export const emitTypes = (
    explores: (Explore | ExploreError)[],
): GenerateTypesResult => {
    const namespaces = new Set<string>();
    const emitted: EmittedExplore[] = [];
    const skipped: string[] = [];
    explores.forEach((explore) => {
        if (isExploreError(explore)) {
            skipped.push(explore.name);
            return;
        }
        if (!explore.tables[explore.baseTable]) {
            skipped.push(explore.name);
            return;
        }
        emitted.push(
            emitExplore(
                explore,
                uniqueKey(toPascalCase(explore.name), namespaces),
            ),
        );
    });

    const header = [
        '// Generated by `lightdash generate-types`. Do not edit by hand.',
        '// One constant per explore; every member is a field id the SDK accepts.',
        '',
    ];
    const body = emitted.map(renderExplore).join('\n\n');
    const footer = [
        '',
        '/** Every explore, keyed by its name. */',
        'export const explores = {',
        ...emitted.map(
            (explore) => `    ${explore.name}: ${explore.namespace},`,
        ),
        '} as const;',
        '',
        `export type FieldId =${
            emitted.length > 0
                ? `\n${emitted
                      .map((explore) => `    | ${explore.namespace}FieldId`)
                      .join('\n')};`
                : ' never;'
        }`,
        '',
    ];
    return {
        code: [...header, body, ...footer].join('\n'),
        explores: emitted.map((explore) => explore.name),
        skipped,
    };
};

export const generateTypesHandler = async (
    originalOptions: GenerateTypesHandlerOptions,
) => {
    const options = { ...originalOptions };
    const projectTypeConfig = await detectProjectType({
        projectDir: options.projectDir,
        userOptions: {
            warehouseCredentials: options.warehouseCredentials,
            skipDbtCompile: options.skipDbtCompile,
            skipWarehouseCatalog: options.skipWarehouseCatalog,
        },
    });
    options.warehouseCredentials = projectTypeConfig.warehouseCredentials;
    options.skipDbtCompile = projectTypeConfig.skipDbtCompile;
    options.skipWarehouseCatalog = projectTypeConfig.skipWarehouseCatalog;
    GlobalState.setVerbose(options.verbose);

    const explores = await compile(options);
    const result = emitTypes(explores);
    const outputPath = path.resolve(options.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, result.code, 'utf8');

    console.error('');
    result.skipped.forEach((name) => {
        console.error(
            styles.warning(
                `Skipped ${name}: it did not compile, so it has no fields`,
            ),
        );
    });
    console.error(
        styles.success(
            `Wrote ${result.explores.length} explore${
                result.explores.length === 1 ? '' : 's'
            } to ${outputPath}`,
        ),
    );
};
