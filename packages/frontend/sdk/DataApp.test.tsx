import { createContext, useContext, type PropsWithChildren } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataApp, DataAppComponent, type NativeDataAppModule } from './DataApp';

const Filters = createContext('');
function Provider({
    program,
    children,
}: PropsWithChildren<{ program: string }>) {
    return <Filters.Provider value={program}>{children}</Filters.Provider>;
}
function Forecast() {
    return <>{useContext(Filters)}</>;
}
const module: NativeDataAppModule<{ program: string }> = {
    contract: { version: 1, id: 'trial-app', components: ['Forecast'] },
    DataAppProvider: Provider,
    AppComponent: Forecast,
    components: { Forecast },
};

describe('native Data Apps', () => {
    it('renders the whole app with host-provided filters', () => {
        expect(
            renderToStaticMarkup(
                <DataApp
                    module={module}
                    providerProps={{ program: 'Cortex' }}
                />,
            ),
        ).toBe('Cortex');
    });
    it('renders selected components under the same provider', () => {
        expect(
            renderToStaticMarkup(
                <DataApp module={module} providerProps={{ program: 'Solaris' }}>
                    <DataAppComponent module={module} name="Forecast" />
                </DataApp>,
            ),
        ).toBe('Solaris');
    });
    it('rejects an unknown export instead of rendering an unrelated component', () => {
        expect(() =>
            renderToStaticMarkup(
                <DataAppComponent module={module} name="constructor" />,
            ),
        ).toThrow('Unknown native Data App component');
    });
    it('preserves an intentionally empty host layout', () => {
        expect(
            renderToStaticMarkup(
                <DataApp module={module} providerProps={{ program: 'Cortex' }}>
                    {null}
                </DataApp>,
            ),
        ).toBe('');
    });
});
