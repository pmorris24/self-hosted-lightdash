import { formatColorIndicator } from './tooltipStyles';

describe('formatColorIndicator', () => {
    test.each([
        ['circle', 'border-radius:50%'],
        ['rect', 'border-radius:0'],
        ['roundRect', 'border-radius:2px'],
        ['triangle', 'clip-path:polygon(50% 0, 100% 100%, 0 100%)'],
        ['diamond', 'clip-path:polygon(50% 0, 100% 50%, 50% 100%, 0 50%)'],
    ])('draws a %s marker with the series color', (symbol, shape) => {
        const html = formatColorIndicator('#abcdef', symbol);
        expect(html.replace(/: /g, ':')).toContain(shape);
        expect(html).toContain('#abcdef');
    });

    test('keeps rounded squares when no symbol is configured', () => {
        expect(formatColorIndicator('red')).toBe(
            formatColorIndicator('red', 'roundRect'),
        );
    });
});
