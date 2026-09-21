import { createContext } from 'react';

// The catalog grid's scroll viewport. Cards and the infinite-scroll sentinel
// observe against it, so their look-ahead margins apply inside the grid.
export const CatalogScrollRootContext = createContext<HTMLDivElement | null>(
    null,
);
