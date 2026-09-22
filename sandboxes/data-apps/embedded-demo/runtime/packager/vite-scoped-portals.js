import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSync } from 'oxc-parser';

const PORTAL_ROOT_IDENTIFIER = '__lightdashPortalRoot';

function walk(node, visit) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        for (const child of node) walk(child, visit);
        return;
    }
    if (typeof node.type === 'string') visit(node);
    for (const key of Object.keys(node)) {
        if (key !== 'parent') walk(node[key], visit);
    }
}

const isDocumentBody = (node) =>
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.object?.type === 'Identifier' &&
    node.object.name === 'document' &&
    node.property?.name === 'body';

const isCreatePortal = (callee) =>
    (callee.type === 'Identifier' && callee.name === 'createPortal') ||
    (callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property?.name === 'createPortal');

/**
 * Rewrite `createPortal(children, document.body)` to target the app's scoped
 * portal root, the pattern template/skill.md prescribes for floating menus.
 * Returns null when the file has nothing to rewrite.
 */
export function redirectBodyPortals(code, filename, portalRootModule) {
    if (!code.includes('createPortal') || !code.includes('document.body')) {
        return null;
    }
    const lang = filename.endsWith('.tsx')
        ? 'tsx'
        : filename.endsWith('.ts')
          ? 'ts'
          : 'jsx';
    const result = parseSync(filename, code, { sourceType: 'module', lang });
    if (result.errors?.length) return null;

    const targets = [];
    walk(result.program, (node) => {
        if (
            node.type === 'CallExpression' &&
            isCreatePortal(node.callee) &&
            isDocumentBody(node.arguments[1])
        ) {
            targets.push(node.arguments[1]);
        }
    });
    if (targets.length === 0) return null;

    let out = code;
    for (const target of targets.sort((a, b) => b.start - a.start)) {
        out = `${out.slice(0, target.start)}${PORTAL_ROOT_IDENTIFIER}()${out.slice(target.end)}`;
    }
    return `import { getPortalRoot as ${PORTAL_ROOT_IDENTIFIER} } from ${JSON.stringify(portalRootModule)};\n${out}`;
}

/**
 * Applies `redirectBodyPortals` to app sources. Runs in `load` and delegates to
 * the template's JSX source-loc plugin first: Vite 8 skips `transform` for user
 * JSX, and only one `load` result is used.
 */
export function scopedPortalsPlugin({ templatePlugins, srcDir, portalRootModule }) {
    const sourceLoc = templatePlugins.find(
        (plugin) => plugin?.name === 'lightdash-jsx-source-loc',
    );
    const runtimeDir = path.dirname(portalRootModule);

    return {
        name: 'lightdash-packager-scoped-portals',
        async load(id) {
            const filename = id.split('?')[0];
            if (
                !/\.(jsx|tsx|js|ts)$/.test(filename) ||
                !filename.startsWith(srcDir + path.sep) ||
                filename.startsWith(runtimeDir + path.sep)
            ) {
                return null;
            }
            const annotated = sourceLoc
                ? await sourceLoc.load.call(this, id)
                : null;
            const code = annotated ?? (await fs.readFile(filename, 'utf-8'));
            return (
                redirectBodyPortals(code, filename, portalRootModule) ??
                annotated
            );
        },
    };
}
