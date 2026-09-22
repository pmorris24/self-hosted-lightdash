import isEqual from 'lodash/isEqual';
import { type SdkFilter } from '../../src/ee/features/embed/EmbedDashboard/types';
import { type ComposedWidget } from './types';

type FilterTarget = Pick<SdkFilter, 'model' | 'field'>;

const isSameField = (a: FilterTarget, b: FilterTarget) =>
    a.model === b.model && a.field === b.field;

const asValues = (value: unknown): unknown[] =>
    Array.isArray(value) ? value : [value];

/** Adds a filter, or replaces the one on the same field. */
export const addFilter = (
    filters: SdkFilter[],
    filter: SdkFilter,
): SdkFilter[] => [
    ...filters.filter((current) => !isSameField(current, filter)),
    filter,
];

export const addFilters = (
    filters: SdkFilter[],
    added: SdkFilter[],
): SdkFilter[] => added.reduce(addFilter, filters);

export const removeFilter = (
    filters: SdkFilter[],
    target: FilterTarget,
): SdkFilter[] => filters.filter((current) => !isSameField(current, target));

export const removeFilters = (
    filters: SdkFilter[],
    targets: FilterTarget[],
): SdkFilter[] => targets.reduce(removeFilter, filters);

/** Replaces the filter on the same field. Leaves the list alone if none exists. */
export const replaceFilter = (
    filters: SdkFilter[],
    filter: SdkFilter,
): SdkFilter[] =>
    filters.map((current) => (isSameField(current, filter) ? filter : current));

/**
 * Cross filtering: a click sets a filter on the clicked field. A second click
 * on the same value takes that filter away again.
 */
export const toggleSelectionFilters = (
    filters: SdkFilter[],
    selected: SdkFilter[],
): SdkFilter[] =>
    selected.reduce((current, filter) => {
        const existing = current.find((item) => isSameField(item, filter));
        const isSameSelection =
            existing !== undefined &&
            existing.operator === filter.operator &&
            isEqual(asValues(existing.value), asValues(filter.value));
        return isSameSelection
            ? removeFilter(current, filter)
            : addFilter(current, filter);
    }, filters);

/** The shared filters one widget takes, after its `ignoreFilters` option. */
export const getWidgetFilters = (
    filters: SdkFilter[],
    widget: Pick<ComposedWidget, 'ignoreFilters'>,
): SdkFilter[] => {
    const { ignoreFilters } = widget;
    if (ignoreFilters === true) return [];
    if (!ignoreFilters || ignoreFilters.length === 0) return filters;
    return filters.filter(
        (filter) =>
            !ignoreFilters.includes(filter.field) &&
            !ignoreFilters.includes(`${filter.model}.${filter.field}`),
    );
};
