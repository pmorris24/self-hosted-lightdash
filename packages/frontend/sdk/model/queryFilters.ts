import type {
    FilterGroup,
    FilterGroupItem,
    FilterRule,
    Filters,
} from '@lightdash/common';
import { type SdkFilter } from '../../src/ee/features/embed/EmbedDashboard/types';

export type LightdashFilterOperator =
    | 'isNull'
    | 'notNull'
    | 'equals'
    | 'notEquals'
    | 'startsWith'
    | 'endsWith'
    | 'include'
    | 'doesNotInclude'
    | 'lessThan'
    | 'lessThanOrEqual'
    | 'greaterThan'
    | 'greaterThanOrEqual'
    | 'inThePast'
    | 'notInThePast'
    | 'inTheNext'
    | 'inTheCurrent'
    | 'notInTheCurrent'
    | 'inBetween'
    | 'notInBetween'
    | 'inPeriodToDate';

export type LightdashUnitOfTime =
    | 'milliseconds'
    | 'seconds'
    | 'minutes'
    | 'hours'
    | 'days'
    | 'weeks'
    | 'months'
    | 'quarters'
    | 'years';

export type LightdashFilterValue = string | number | boolean | null;

// Relative date operators: the unit, and whether only completed periods count.
export type LightdashDateFilterSettings = {
    unitOfTime: LightdashUnitOfTime;
    completed?: boolean;
};

/** The short form: one field equal, or not equal, to one value. */
export type LightdashSimpleFilter = {
    field: string;
    operator: 'equals' | 'notEquals';
    value: LightdashFilterValue;
};

/** One rule: a field, any operator Lightdash knows, and its values. */
export type LightdashFilterRule = {
    field: string;
    operator: LightdashFilterOperator;
    values: LightdashFilterValue[];
    settings?: LightdashDateFilterSettings;
};

/** Rules or groups combined with `and` or `or`; groups nest. */
export type LightdashFilterGroup =
    | { and: LightdashQueryFilter[] }
    | { or: LightdashQueryFilter[] };

/**
 * A filter a query accepts. A list of filters is combined with `and`; a
 * saved chart's filters and the filter factory produce the same shapes.
 */
export type LightdashQueryFilter =
    | LightdashSimpleFilter
    | LightdashFilterRule
    | LightdashFilterGroup;

export const isFilterGroup = (
    filter: LightdashQueryFilter,
): filter is LightdashFilterGroup => 'and' in filter || 'or' in filter;

const isSimpleFilter = (
    filter: LightdashQueryFilter,
): filter is LightdashSimpleFilter => 'value' in filter;

/** Every filter as a rule or a group: the short form becomes a rule. */
export const toFilterRule = (
    filter: LightdashSimpleFilter | LightdashFilterRule,
): LightdashFilterRule =>
    isSimpleFilter(filter)
        ? { field: filter.field, operator: filter.operator, values: [filter.value] }
        : filter;

const rule = (
    field: string,
    operator: LightdashFilterOperator,
    values: LightdashFilterValue[] = [],
    settings?: LightdashDateFilterSettings,
): LightdashFilterRule => ({
    field,
    operator,
    values,
    ...(settings ? { settings } : {}),
});

const hostFilterValues = (value: unknown): LightdashFilterValue[] => {
    if (value === undefined || value === null) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.map((item): LightdashFilterValue => {
        if (item === null) return null;
        if (item instanceof Date) return item.toISOString();
        switch (typeof item) {
            case 'string':
            case 'number':
            case 'boolean':
                return item;
            default:
                return String(item);
        }
    });
};

/**
 * Builds query filters by name, one function per operator, so a page never
 * spells out operator strings. Every function returns a rule or a group that
 * `useMetricQuery`, `QueryChart` and the drilldown accept.
 */
export const filterFactory = {
    /** The field is one of the values. */
    members: (field: string, values: LightdashFilterValue[]) =>
        rule(field, 'equals', values),
    /** The field is none of the values. */
    exclude: (field: string, values: LightdashFilterValue[]) =>
        rule(field, 'notEquals', values),
    equals: (field: string, value: LightdashFilterValue) =>
        rule(field, 'equals', [value]),
    notEquals: (field: string, value: LightdashFilterValue) =>
        rule(field, 'notEquals', [value]),
    contains: (field: string, value: string) => rule(field, 'include', [value]),
    doesNotContain: (field: string, value: string) =>
        rule(field, 'doesNotInclude', [value]),
    startsWith: (field: string, value: string) =>
        rule(field, 'startsWith', [value]),
    endsWith: (field: string, value: string) =>
        rule(field, 'endsWith', [value]),
    isNull: (field: string) => rule(field, 'isNull'),
    notNull: (field: string) => rule(field, 'notNull'),
    lessThan: (field: string, value: number | string) =>
        rule(field, 'lessThan', [value]),
    lessThanOrEqual: (field: string, value: number | string) =>
        rule(field, 'lessThanOrEqual', [value]),
    greaterThan: (field: string, value: number | string) =>
        rule(field, 'greaterThan', [value]),
    greaterThanOrEqual: (field: string, value: number | string) =>
        rule(field, 'greaterThanOrEqual', [value]),
    /** Numbers or dates from `from` to `to`, both included. */
    between: (field: string, from: number | string, to: number | string) =>
        rule(field, 'inBetween', [from, to]),
    notBetween: (field: string, from: number | string, to: number | string) =>
        rule(field, 'notInBetween', [from, to]),
    /** Dates in the past `amount` units. `completed` leaves out the current unit. */
    inThePast: (
        field: string,
        amount: number,
        unitOfTime: LightdashUnitOfTime,
        completed = false,
    ) => rule(field, 'inThePast', [amount], { unitOfTime, completed }),
    notInThePast: (
        field: string,
        amount: number,
        unitOfTime: LightdashUnitOfTime,
        completed = false,
    ) => rule(field, 'notInThePast', [amount], { unitOfTime, completed }),
    inTheNext: (
        field: string,
        amount: number,
        unitOfTime: LightdashUnitOfTime,
        completed = false,
    ) => rule(field, 'inTheNext', [amount], { unitOfTime, completed }),
    /** Dates in the current unit: this week, this month, this year. */
    inTheCurrent: (field: string, unitOfTime: LightdashUnitOfTime) =>
        rule(field, 'inTheCurrent', [], { unitOfTime }),
    notInTheCurrent: (field: string, unitOfTime: LightdashUnitOfTime) =>
        rule(field, 'notInTheCurrent', [], { unitOfTime }),
    /** Dates from the start of the current unit until now. */
    inPeriodToDate: (field: string, unitOfTime: LightdashUnitOfTime) =>
        rule(field, 'inPeriodToDate', [], { unitOfTime }),
    and: (...filters: LightdashQueryFilter[]): LightdashFilterGroup => ({
        and: filters,
    }),
    or: (...filters: LightdashQueryFilter[]): LightdashFilterGroup => ({
        or: filters,
    }),
    /**
     * A host filter from a filter tile or a dashboard, as a query filter. The
     * tile names the field by model and field; a query names it by field id.
     * Pass `settings` for a relative date operator, since a host filter
     * carries none.
     */
    fromHostFilter: (
        filter: SdkFilter,
        settings?: LightdashDateFilterSettings,
    ): LightdashFilterRule =>
        rule(
            `${filter.model}_${filter.field}`,
            filter.operator as LightdashFilterOperator,
            hostFilterValues(filter.value),
            settings,
        ),
};

// --- To and from the shapes the Lightdash API uses ---

const fieldsOf = (filter: LightdashQueryFilter): string[] => {
    if (isFilterGroup(filter)) {
        const items = 'and' in filter ? filter.and : filter.or;
        return items.flatMap(fieldsOf);
    }
    return [filter.field];
};

const toApiItem = (filter: LightdashQueryFilter, id: string): FilterGroupItem => {
    if (isFilterGroup(filter)) {
        const items = ('and' in filter ? filter.and : filter.or).map(
            (item, index) => toApiItem(item, `${id}-${index}`),
        );
        return 'and' in filter ? { id, and: items } : { id, or: items };
    }
    const { field, operator, values, settings } = toFilterRule(filter);
    const item: FilterRule = {
        id,
        target: { fieldId: field },
        operator: (values.length === 1 && values[0] === null
            ? operator === 'equals'
                ? 'isNull'
                : operator === 'notEquals'
                  ? 'notNull'
                  : operator
            : operator) as FilterRule['operator'],
        values: values.filter((value) => value !== null),
        ...(settings ? { settings } : {}),
    };
    return item;
};

/**
 * The `filters` of a metric query request. Filters on the query's metrics go
 * in the metrics group, every other filter in the dimensions group; a group
 * goes with the metrics only when every field in it is a metric.
 */
export const toApiFilters = (
    filters: LightdashQueryFilter[],
    metricIds: string[],
): Filters => {
    const metrics = new Set(metricIds);
    const isMetricFilter = (filter: LightdashQueryFilter) => {
        const fields = fieldsOf(filter);
        return fields.length > 0 && fields.every((field) => metrics.has(field));
    };
    const toGroup = (
        items: LightdashQueryFilter[],
        id: string,
    ): FilterGroup | undefined =>
        items.length > 0
            ? {
                  id,
                  and: items.map((item, index) =>
                      toApiItem(item, `${id}-${index}`),
                  ),
              }
            : undefined;
    return {
        dimensions: toGroup(
            filters.filter((filter) => !isMetricFilter(filter)),
            'sdk-query-dimensions',
        ),
        metrics: toGroup(
            filters.filter((filter) => isMetricFilter(filter)),
            'sdk-query-metrics',
        ),
    };
};

const isApiGroup = (item: unknown): item is FilterGroup =>
    typeof item === 'object' &&
    item !== null &&
    ('and' in item || 'or' in item) &&
    Array.isArray('and' in item ? item.and : item.or);

const fromApiItem = (item: FilterGroupItem): LightdashQueryFilter | null => {
    if (isApiGroup(item)) {
        const items = ('and' in item ? item.and : item.or)
            .map(fromApiItem)
            .filter((filter): filter is LightdashQueryFilter => filter !== null);
        if (items.length === 0) return null;
        return 'and' in item ? { and: items } : { or: items };
    }
    if (item.disabled) return null;
    const settings = item.settings as LightdashDateFilterSettings | undefined;
    return {
        field: item.target.fieldId,
        operator: item.operator as LightdashFilterOperator,
        values: ((item.values ?? []) as unknown[]).map((value) =>
            value instanceof Date ? value.toISOString() : value,
        ) as LightdashFilterValue[],
        ...(settings?.unitOfTime
            ? {
                  settings: {
                      unitOfTime: settings.unitOfTime,
                      ...(settings.completed !== undefined
                          ? { completed: settings.completed }
                          : {}),
                  },
              }
            : {}),
    };
};

/**
 * The filters of a saved chart as query filters. The top-level `and` of each
 * group is flattened into the list, so plain saved filters read as a plain
 * list; an `or` group, or a nested group, stays a group. Disabled rules are
 * left out, as the saved chart leaves them out of its own query.
 */
export const fromApiFilters = (filters: Filters | undefined): LightdashQueryFilter[] =>
    [filters?.dimensions, filters?.metrics, filters?.tableCalculations].flatMap(
        (group) => {
            if (!isApiGroup(group)) return [];
            if ('and' in group) {
                return group.and
                    .map(fromApiItem)
                    .filter(
                        (filter): filter is LightdashQueryFilter =>
                            filter !== null,
                    );
            }
            const converted = fromApiItem(group);
            return converted ? [converted] : [];
        },
    );
