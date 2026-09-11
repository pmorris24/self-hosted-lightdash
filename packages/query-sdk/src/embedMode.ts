/**
 * Set by `createEmbedClient()`: the bundle is running inside a customer's own
 * page. The page URL, `<html>` and `window.parent` belong to that page, so
 * modules that would otherwise touch them check this first.
 */
let embedded = false;

export function markEmbedded(): void {
    embedded = true;
}

export function isEmbedded(): boolean {
    return embedded;
}
