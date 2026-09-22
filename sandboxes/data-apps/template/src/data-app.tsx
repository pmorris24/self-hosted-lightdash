import type { PropsWithChildren } from 'react';
import { defineDataApp } from './lib/dataApp';

function Provider({ children }: PropsWithChildren) { return <>{children}</>; }
function Overview() {
    return <div className="p-6"><h1>Lightdash Data App Placeholder</h1></div>;
}
function App() { return <Overview />; }

export const dataApp = defineDataApp({
    contractVersion: 1,
    id: 'new-data-app',
    Provider,
    App,
    components: { Overview },
});
