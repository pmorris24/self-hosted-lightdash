import {
    useCallback,
    useMemo,
    useState,
    type FC,
    type PropsWithChildren,
} from 'react';
import {
    CustomWidgetsContext,
    type CustomWidgetComponent,
    type CustomWidgetRegistry,
} from './customWidgetsContext';

type ProviderProps = PropsWithChildren<{
    // Widgets known from the start, keyed by type.
    widgets?: Record<string, CustomWidgetComponent>;
}>;

/** Holds the custom widget types that `Lightdash.Widget` can draw. */
export const CustomWidgetsProvider: FC<ProviderProps> = ({
    widgets,
    children,
}) => {
    const [registered, setRegistered] = useState<
        Record<string, CustomWidgetComponent>
    >({});

    const registerCustomWidget = useCallback<CustomWidgetRegistry['registerCustomWidget']>(
        (customWidgetType, component) =>
            setRegistered((current) =>
                current[customWidgetType] === component
                    ? current
                    : { ...current, [customWidgetType]: component },
            ),
        [],
    );

    const registry = useMemo<CustomWidgetRegistry>(() => {
        const all = { ...widgets, ...registered };
        return {
            registerCustomWidget,
            hasCustomWidget: (customWidgetType) => customWidgetType in all,
            getCustomWidget: (customWidgetType) => all[customWidgetType],
        };
    }, [widgets, registered, registerCustomWidget]);

    return (
        <CustomWidgetsContext.Provider value={registry}>
            {children}
        </CustomWidgetsContext.Provider>
    );
};
