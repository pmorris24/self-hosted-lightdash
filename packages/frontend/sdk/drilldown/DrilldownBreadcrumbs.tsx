import { type CSSProperties, type FC } from 'react';
import { type DrilldownStep } from './useDrilldown';

type Props = {
    steps: DrilldownStep[];
    // The dimension shown now, after the last step.
    currentDimension: string;
    // Display names for dimensions. Default: the dimension name.
    labels?: Record<string, string>;
    onSelect: (level: number) => void;
    allLabel?: string;
    style?: CSSProperties;
};

const listStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: 13,
};

const crumbStyle: CSSProperties = {
    padding: '3px 8px',
    border: '1px solid currentColor',
    borderRadius: 999,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    opacity: 0.85,
};

/**
 * The picks of a drill down as a trail. It is plain markup with inherited
 * colours, so it takes the look of the host page.
 */
export const DrilldownBreadcrumbs: FC<Props> = ({
    steps,
    currentDimension,
    labels = {},
    onSelect,
    allLabel = 'All',
    style,
}) => (
    <nav aria-label="Drill down" data-lightdash-drilldown-breadcrumbs="">
        <ol style={{ ...listStyle, ...style }}>
            <li>
                <button
                    type="button"
                    style={crumbStyle}
                    onClick={() => onSelect(0)}
                    disabled={steps.length === 0}
                >
                    {allLabel}
                </button>
            </li>
            {steps.map((step, index) => (
                <li key={`${step.dimension}-${index}`}>
                    <span aria-hidden="true">› </span>
                    <button
                        type="button"
                        style={crumbStyle}
                        onClick={() => onSelect(index + 1)}
                        disabled={index === steps.length - 1}
                    >
                        {labels[step.dimension] ?? step.dimension}:{' '}
                        {String(step.value)}
                    </button>
                </li>
            ))}
            <li aria-current="step">
                <span aria-hidden="true">› </span>
                {labels[currentDimension] ?? currentDimension}
            </li>
        </ol>
    </nav>
);
