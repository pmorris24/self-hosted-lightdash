import {
    Fragment,
    useEffect,
    useRef,
    useState,
    type FC,
    type ReactNode,
} from 'react';
import { type DataChartType } from '../../data/types';
import {
    agentChartTranslator,
    type AgentArtifact,
} from '../agentChartTranslator';
import { type AgentMessage, type AgentStep } from '../useAgentConversation';
import { AgentBolt } from './chrome';
import {
    AgentCopyButton,
    AgentDayDivider,
    AgentScrollToBottom,
    AgentTimestamp,
    AgentTypingDots,
} from './feedback';
import { agentHighlightJson, agentMarkdown, agentStepLabel } from './text';

/** One tool call: the step, then the request and what came back. */
export const AgentStepRow: FC<{ step: AgentStep }> = ({ step }) => (
    <>
        <div className="ld-agent-row ld-agent-row--step">
            <span className="ld-agent-row__marker">
                <AgentBolt size={13} working={step.isRunning} />
            </span>
            <span className="ld-agent-row__label">{agentStepLabel(step)}</span>
        </div>
        {(step.input !== null || step.output) && (
            <div className="ld-agent-row ld-agent-row--detail">
                <span className="ld-agent-row__marker" aria-hidden="true" />
                <div className="ld-agent-io">
                    {step.input !== null && (
                        <div className="ld-agent-io__row">
                            <span className="ld-agent-io__tag">IN</span>
                            <pre>
                                <code
                                    dangerouslySetInnerHTML={{
                                        __html: agentHighlightJson(
                                            JSON.stringify(step.input, null, 2),
                                        ),
                                    }}
                                />
                            </pre>
                        </div>
                    )}
                    {step.output && (
                        <div className="ld-agent-io__row">
                            <span className="ld-agent-io__tag">OUT</span>
                            <pre>
                                <code>{step.output}</code>
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        )}
    </>
);

const CHART_TYPES: { type: DataChartType; glyph: string }[] = [
    { type: 'column', glyph: '▮' },
    { type: 'bar', glyph: '▬' },
    { type: 'line', glyph: '⟋' },
    { type: 'pie', glyph: '◕' },
];

/**
 * A chart the agent made, in a card: its title, a chart-type switcher that
 * overrides what the agent chose, and the chart itself running the governed
 * query the agent wrote. `renderChart` draws it, so a page can use an SDK
 * chart, its own chart library, or anything else.
 */
export const AgentChartCard: FC<{
    chart: AgentArtifact;
    renderChart: (
        props: ReturnType<typeof agentChartTranslator.toChartProps>,
    ) => ReactNode;
    height?: number;
    chartTypes?: DataChartType[];
}> = ({ chart, renderChart, height = 260, chartTypes }) => {
    const [chartType, setChartType] = useState<DataChartType | null>(null);
    const props = agentChartTranslator.toChartProps(
        chart,
        chartType ? { chartType } : {},
    );
    const types = CHART_TYPES.filter(
        ({ type }) => !chartTypes || chartTypes.includes(type),
    );

    return (
        <div className="ld-agent-chart-card">
            <div className="ld-agent-chart-card__head">
                <span className="ld-agent-chart-card__title">
                    {chart.title}
                </span>
                {types.length > 1 && (
                    <span className="ld-agent-chart-card__types">
                        {types.map(({ type, glyph }) => (
                            <button
                                key={type}
                                type="button"
                                title={type}
                                className={
                                    props.chartType === type
                                        ? 'is-selected'
                                        : ''
                                }
                                onClick={() => setChartType(type)}
                            >
                                {glyph}
                            </button>
                        ))}
                    </span>
                )}
            </div>
            <div className="ld-agent-chart-card__body" style={{ height }}>
                {renderChart(props)}
            </div>
        </div>
    );
};

export type AgentTurnProps = {
    message: AgentMessage;
    // What the agent is doing right now, shown under the last step.
    status?: string | null;
    // Draws a chart the agent made. Leave it out to hide charts.
    renderChart?: (
        props: ReturnType<typeof agentChartTranslator.toChartProps>,
    ) => ReactNode;
    chartHeight?: number;
    // Hide the tool calls to show only what the agent wrote.
    showSteps?: boolean;
    // Hide the times each turn happened.
    showTimes?: boolean;
};

/** One turn: a question, or an answer with the work that produced it. */
export const AgentTurn: FC<AgentTurnProps> = ({
    message,
    status,
    renderChart,
    chartHeight,
    showSteps = true,
    showTimes = true,
}) => {
    if (message.role === 'user') {
        return (
            <div className="ld-agent-question-turn">
                {showTimes && <AgentTimestamp at={message.createdAt} />}
                <div className="ld-agent-question">{message.text}</div>
            </div>
        );
    }

    const isWorking = message.isStreaming && !!status;
    return (
        <div className="ld-agent-answer ld-agent-part">
            {showSteps &&
                message.steps.map((step) => (
                    <AgentStepRow key={step.id} step={step} />
                ))}
            {isWorking && (
                <div className="ld-agent-row ld-agent-row--step">
                    <span className="ld-agent-row__marker">
                        <AgentBolt size={16} working />
                    </span>
                    <span className="ld-agent-shimmer">{status}</span>
                </div>
            )}
            {message.isStreaming && !status && !message.text && (
                <div className="ld-agent-row ld-agent-row--step">
                    <span className="ld-agent-row__marker">
                        <AgentBolt size={16} working />
                    </span>
                    <AgentTypingDots />
                </div>
            )}
            {(message.text || message.charts.length > 0) && (
                <div className="ld-agent-row ld-agent-row--answer">
                    <span className="ld-agent-row__marker">
                        <span className="ld-agent-badge">
                            <AgentBolt size={13} />
                        </span>
                    </span>
                    <div className="ld-agent-answer__content">
                        {message.text && !message.isStreaming && (
                            <AgentCopyButton text={message.text} />
                        )}
                        {message.text && (
                            <div
                                className="ld-agent-markdown"
                                dangerouslySetInnerHTML={{
                                    __html: agentMarkdown(message.text),
                                }}
                            />
                        )}
                        {renderChart &&
                            message.charts.map((chart) => (
                                <AgentChartCard
                                    key={chart.versionUuid}
                                    chart={chart}
                                    renderChart={renderChart}
                                    height={chartHeight}
                                />
                            ))}
                    </div>
                </div>
            )}
            {message.isStopped && (
                <div className="ld-agent-row ld-agent-row--step">
                    <span className="ld-agent-row__marker">
                        <AgentBolt size={13} />
                    </span>
                    <span className="ld-agent-row__label ld-agent-stopped">
                        Generation stopped
                    </span>
                </div>
            )}
        </div>
    );
};

/**
 * The conversation: every turn, in order, in a column that follows the answer
 * as it is written. `empty` is what a viewer sees before the first question.
 */
const isNewDay = (message: AgentMessage, previous?: AgentMessage) =>
    !previous ||
    new Date(message.createdAt).toDateString() !==
        new Date(previous.createdAt).toDateString();

export const AgentTranscript: FC<
    Omit<AgentTurnProps, 'message'> & {
        messages: AgentMessage[];
        empty?: ReactNode;
        // Show the day each turn happened, above the first turn of that day.
        showDays?: boolean;
        children?: ReactNode;
    }
> = ({ messages, status, empty, showDays = true, children, ...turnProps }) => {
    const viewport = useRef<HTMLDivElement>(null);

    // Follow the answer while it is written, and only then. `scrollTop` and
    // not `scrollTo`, which a host's test environment may not implement.
    useEffect(() => {
        const element = viewport.current;
        if (element) element.scrollTop = element.scrollHeight;
    }, [messages, status]);

    return (
        <div className="ld-agent-transcript" ref={viewport}>
            {messages.length === 0 && empty ? (
                empty
            ) : (
                <div className="ld-agent-messages ld-agent-part">
                    {messages.map((message, index) => (
                        <Fragment key={message.id}>
                            {showDays &&
                                isNewDay(message, messages[index - 1]) && (
                                    <AgentDayDivider at={message.createdAt} />
                                )}
                            <AgentTurn
                                message={message}
                                status={status}
                                {...turnProps}
                            />
                        </Fragment>
                    ))}
                </div>
            )}
            {children}
            <AgentScrollToBottom viewport={viewport} />
        </div>
    );
};
