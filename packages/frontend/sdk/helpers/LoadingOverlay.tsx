import { type FC, type PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
    isVisible: boolean;
    label?: string;
}>;

/**
 * Dims its children and shows a spinner while `isVisible`. The children stay
 * mounted, so a chart keeps its last result under the overlay.
 */
export const LoadingOverlay: FC<Props> = ({
    isVisible,
    label = 'Loading',
    children,
}) => (
    <div style={{ position: 'relative', height: '100%' }} aria-busy={isVisible}>
        {children}
        {isVisible && (
            <div
                role="status"
                aria-label={label}
                data-lightdash-loading-overlay=""
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(127, 127, 127, 0.18)',
                    backdropFilter: 'blur(1px)',
                }}
            >
                <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <circle
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="42 100"
                    >
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 12 12"
                            to="360 12 12"
                            dur="0.9s"
                            repeatCount="indefinite"
                        />
                    </circle>
                </svg>
            </div>
        )}
    </div>
);
