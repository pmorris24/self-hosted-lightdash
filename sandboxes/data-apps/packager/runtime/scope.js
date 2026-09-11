// Runtime half of the packager's CSS scoping. The build scopes every rule to
// SCOPE_CLASS; this module puts that class on the elements the app renders in.
export const SCOPE_CLASS = __LIGHTDASH_APP_SCOPE__;

const scopeElements = new Set();
let dark = false;
let pageOwned = false;
let portalRoot = null;
let embeddedMounts = 0;

/** Scope an element; returns a cleanup, so it also works as a React 19 ref. */
export function registerScopeElement(element) {
    if (element === null) return undefined;
    element.classList.add(SCOPE_CLASS);
    element.classList.toggle('dark', dark);
    scopeElements.add(element);
    return () => {
        scopeElements.delete(element);
        element.classList.remove(SCOPE_CLASS, 'dark');
    };
}

export function setScopeColorScheme(colorScheme) {
    dark = colorScheme === 'dark';
    for (const element of scopeElements) element.classList.toggle('dark', dark);
}

/** App viewer: the page belongs to the app, so <body> is the scope. */
export function scopePage() {
    pageOwned = true;
    return registerScopeElement(document.body);
}

/** Where portals render: inside the scope, so scoped CSS reaches them. */
export function getPortalRoot() {
    if (pageOwned) return document.body;
    if (portalRoot === null) {
        portalRoot = document.createElement('div');
        portalRoot.dataset.lightdashAppPortals = '';
        registerScopeElement(portalRoot);
        document.body.appendChild(portalRoot);
    }
    return portalRoot;
}

export function retainPortalRoot() {
    embeddedMounts += 1;
}

export function releasePortalRoot() {
    embeddedMounts -= 1;
    if (embeddedMounts === 0 && portalRoot !== null) {
        scopeElements.delete(portalRoot);
        portalRoot.remove();
        portalRoot = null;
    }
}
