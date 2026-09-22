import {
    FilterOperator,
    getFilterOperatorOptions,
    getFilterTypeFromItem,
    getItemId,
    getItemLabelWithoutTableName,
    getItemMap,
    isFilterableField,
    type FilterRule,
} from '@lightdash/common';
import { Select, Stack, Text } from '@mantine/core';
import { useMemo, type FC } from 'react';
import FilterInputComponent from '../../src/components/common/Filters/FilterInputs';
import FiltersProvider from '../../src/components/common/Filters/FiltersProvider';
import { type SdkFilter } from '../../src/ee/features/embed/EmbedDashboard/types';
import useEmbed from '../../src/ee/providers/Embed/useEmbed';
import { useUiStrings } from '../../src/ee/providers/Embed/useUiStrings';
import { useExploreByProjectUuid } from '../../src/hooks/useExplore';

export type FilterTileFieldProps = {
    model: string;
    field: string;
    label?: string;
    // The operators a viewer may pick. Default: all operators of the field type.
    operators?: `${FilterOperator}`[];
    // The operator used before the viewer picks one.
    defaultOperator?: `${FilterOperator}`;
    filter: SdkFilter | undefined;
    // `null` means the tile holds no filter.
    onChange: (filter: SdkFilter | null) => void;
};

const OPERATORS_WITHOUT_VALUE: string[] = [
    FilterOperator.NULL,
    FilterOperator.NOT_NULL,
];

const asValues = (value: unknown): unknown[] =>
    value === undefined || value === null
        ? []
        : Array.isArray(value)
          ? value
          : [value];

export const FilterTileContent: FC<FilterTileFieldProps> = ({
    model,
    field,
    label,
    operators,
    defaultOperator,
    filter,
    onChange,
}) => {
    const { projectUuid } = useEmbed();
    const getUiString = useUiStrings();
    const { data: explore } = useExploreByProjectUuid(model, projectUuid, {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    const fieldId = getItemId({ table: model, name: field });
    const item = useMemo(() => {
        if (!explore) return undefined;
        const candidate = getItemMap(explore)[fieldId];
        return candidate && isFilterableField(candidate)
            ? candidate
            : undefined;
    }, [explore, fieldId]);

    const filterType = item ? getFilterTypeFromItem(item) : undefined;
    const operatorOptions = useMemo(() => {
        if (!filterType) return [];
        const all = getFilterOperatorOptions(filterType, item, getUiString);
        return operators
            ? all.filter((option) =>
                  (operators as string[]).includes(option.value),
              )
            : all;
    }, [filterType, item, getUiString, operators]);

    const requestedOperator = filter?.operator ?? defaultOperator;
    // An operator the field type does not support falls back to the first
    // supported one, so a wrong operator from the host cannot break the input.
    const isSupported =
        operatorOptions.length === 0 ||
        operatorOptions.some((option) => option.value === requestedOperator);
    // Without a request, start from "is" rather than the first listed option.
    const fallbackOperator = operatorOptions.some(
        (option) => option.value === FilterOperator.EQUALS,
    )
        ? FilterOperator.EQUALS
        : (operatorOptions[0]?.value ?? FilterOperator.EQUALS);
    const operator = (requestedOperator && isSupported
        ? requestedOperator
        : fallbackOperator) as FilterOperator;

    const rule = useMemo<FilterRule>(
        () => ({
            id: `sdk-filter-tile-${fieldId}`,
            target: { fieldId },
            operator,
            values: asValues(filter?.value),
        }),
        [fieldId, operator, filter?.value],
    );

    const emit = (next: FilterRule) => {
        const values = next.values ?? [];
        const hasFilter =
            values.length > 0 ||
            OPERATORS_WITHOUT_VALUE.includes(next.operator);
        onChange(
            hasFilter
                ? { model, field, operator: next.operator, value: values }
                : null,
        );
    };

    if (!item || !filterType) {
        return (
            <Text fz="xs" c="dimmed">
                {label ?? field}
            </Text>
        );
    }

    return (
        <FiltersProvider
            projectUuid={projectUuid}
            itemsMap={{ [fieldId]: item }}
            baseTable={model}
            startOfWeek={undefined}
        >
            <Stack gap={6} data-lightdash-filter-tile={fieldId}>
                <Text fz="sm" fw={500}>
                    {label ?? getItemLabelWithoutTableName(item)}
                </Text>
                {operatorOptions.length > 1 && (
                    <Select
                        size="xs"
                        data={operatorOptions}
                        value={operator}
                        allowDeselect={false}
                        onChange={(value) => {
                            if (!value) return;
                            emit({
                                ...rule,
                                operator: value as FilterOperator,
                                values: OPERATORS_WITHOUT_VALUE.includes(value)
                                    ? []
                                    : rule.values,
                            });
                        }}
                    />
                )}
                <FilterInputComponent
                    filterType={filterType}
                    field={item}
                    rule={rule}
                    onChange={emit}
                />
            </Stack>
        </FiltersProvider>
    );
};
