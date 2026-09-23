import { describe, expect, it } from 'vitest';
import {
    agentChartTranslator,
    type AgentArtifact,
} from './agentChartTranslator';

const artifact: AgentArtifact = {
    artifactUuid: 'artifact-1',
    versionUuid: 'version-1',
    title: 'Total Revenue by Payment Method',
    description: 'Sum of all payments broken down by payment method',
    chartConfig: {
        config: {
            chartConfig: {
                defaultVizType: 'bar',
                xAxisDimension: 'payments_payment_method',
                yAxisMetrics: ['payments_total_revenue'],
                groupBy: null,
                xAxisLabel: 'Payment Method',
                yAxisLabel: 'Total Revenue',
            },
            queryConfig: {
                exploreName: 'payments',
                dimensions: ['payments_payment_method'],
                metrics: ['payments_total_revenue'],
                sorts: [
                    { fieldId: 'payments_total_revenue', descending: true },
                ],
                limit: null,
            },
        },
    },
};

describe('agentChartTranslator', () => {
    it('turns an artifact into the props an SDK chart takes', () => {
        expect(agentChartTranslator.toChartProps(artifact)).toEqual({
            exploreName: 'payments',
            dimensions: ['payments_payment_method'],
            metrics: ['payments_total_revenue'],
            sorts: [{ field: 'payments_total_revenue', descending: true }],
            chartType: 'column',
            dataOptions: {
                category: 'payments_payment_method',
                value: ['payments_total_revenue'],
            },
        });
    });

    it('reads the agent chart types in the SDK vocabulary', () => {
        expect(agentChartTranslator.toChartType('bar')).toBe('column');
        expect(agentChartTranslator.toChartType('horizontal_bar')).toBe('bar');
        expect(agentChartTranslator.toChartType('line')).toBe('line');
        // A type nobody recognises still draws something.
        expect(agentChartTranslator.toChartType('sunburst')).toBe('column');
        expect(agentChartTranslator.toChartType(null)).toBe('column');
    });

    it('lets the page override the agent, and splits by a group', () => {
        const grouped: AgentArtifact = {
            ...artifact,
            chartConfig: {
                config: {
                    ...artifact.chartConfig!.config,
                    chartConfig: {
                        ...artifact.chartConfig!.config.chartConfig,
                        groupBy: 'payments_status',
                    },
                },
            },
        };
        const props = agentChartTranslator.toChartProps(grouped, {
            chartType: 'line',
            limit: 20,
        });
        expect(props.chartType).toBe('line');
        expect(props.limit).toBe(20);
        expect(props.dataOptions.breakBy).toBe('payments_status');
    });

    it('titles a frame from what the agent wrote', () => {
        const framed = agentChartTranslator.toFramedChartProps(artifact);
        expect(framed.frame.title).toBe('Total Revenue by Payment Method');
        expect(framed.frame.description).toBe(
            'Sum of all payments broken down by payment method',
        );
        expect(framed.exploreName).toBe('payments');
    });

    it('says so when an artifact carries no chart', () => {
        expect(() =>
            agentChartTranslator.toChartProps({
                artifactUuid: 'a',
                versionUuid: 'v',
                title: 'A written answer',
                chartConfig: null,
            }),
        ).toThrow(/carries no chart/);
    });
});
