/**
 * PostCSS plugin that scopes every rule to one class, so a packaged app can't
 * restyle the page it's mounted in. Page-level selectors (`:root`, `html`,
 * `body`) and the `.dark` token block move onto the scope element itself;
 * everything else only matches inside it. `:where()` keeps specificity as-is.
 */
// A backslash continues the name: `.dark\:border-destructive` is Tailwind's
// `dark:border-destructive` class, not the `.dark` token block.
const PAGE_ROOT = /^(?::root|html|body)(?![\w\\-])/;
const PAGE_ROOT_COMBINATOR = /^\s*>?\s*(?=(?::root|html|body)(?![\w\\-]))/;
const DARK_ROOT = /^\.dark(?![\w\\-])/;

/** Strips a leading `:root`/`html`/`body` chain (`html body`, `html > body`); null if none. */
function stripPageRoots(selector) {
    let rest = selector;
    let matched = false;
    for (;;) {
        const root = rest.match(PAGE_ROOT);
        if (root === null) break;
        matched = true;
        rest = rest.slice(root[0].length);
        const combinator = rest.match(PAGE_ROOT_COMBINATOR);
        if (combinator === null || combinator[0] === '') break;
        rest = rest.slice(combinator[0].length);
    }
    return matched ? rest : null;
}

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
    if (selector.includes(where)) return selector;
    const afterPageRoots = stripPageRoots(selector);
    if (afterPageRoots !== null) return `${where}${afterPageRoots}`;
    if (DARK_ROOT.test(selector)) {
        // Dark from the scope element, or from an ancestor such as <html>,
        // where template apps are told to put it and host pages often do.
        const rest = selector.slice('.dark'.length);
        return `${where}.dark${rest}, :where(.dark) ${where}${rest}`;
    }
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
