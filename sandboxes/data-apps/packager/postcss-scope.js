/**
 * PostCSS plugin that scopes every rule to one class, so a packaged app can't
 * restyle the page it's mounted in. Page-level selectors (`:root`, `html`,
 * `body`) and the `.dark` token block move onto the scope element itself;
 * everything else only matches inside it. `:where()` keeps specificity as-is.
 */
const PAGE_ROOT = /^(?::root|html|body)(?![\w-])/;
const DARK_ROOT = /^\.dark(?![\w-])/;

/** Split a selector list on top-level commas, skipping escapes, `()` and `[]`. */
function splitSelectorList(selectorList) {
    const selectors = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < selectorList.length; i += 1) {
        const char = selectorList[i];
        if (char === '\\') {
            i += 1;
        } else if (char === '(' || char === '[') {
            depth += 1;
        } else if (char === ')' || char === ']') {
            depth -= 1;
        } else if (char === ',' && depth === 0) {
            selectors.push(selectorList.slice(start, i));
            start = i + 1;
        }
    }
    selectors.push(selectorList.slice(start));
    return selectors.map((selector) => selector.trim()).filter(Boolean);
}

export function scopeSelector(selector, scope) {
    const where = `:where(${scope})`;
    if (selector.startsWith(where)) return selector;
    const pageRoot = selector.match(PAGE_ROOT);
    if (pageRoot) return `${where}${selector.slice(pageRoot[0].length)}`;
    if (DARK_ROOT.test(selector)) return `${where}${selector}`;
    return `${where} ${selector}`;
}

export default function scopeCss({ scope }) {
    return {
        postcssPlugin: 'lightdash-app-scope',
        Rule(rule) {
            if (
                rule.parent?.type === 'atrule' &&
                /keyframes$/i.test(rule.parent.name)
            ) {
                return;
            }
            const scoped = [
                ...new Set(
                    splitSelectorList(rule.selector).map((selector) =>
                        scopeSelector(selector, scope),
                    ),
                ),
            ].join(', ');
            if (scoped !== rule.selector) rule.selector = scoped;
        },
    };
}
scopeCss.postcss = true;
