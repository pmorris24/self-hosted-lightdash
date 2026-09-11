import { ErrorBoundary } from '@/lib/ErrorBoundary';
import { AppHeader } from './components/AppHeader';
import { ModelUsageChart } from './components/ModelUsageChart';
import { UsageByModelTable } from './components/UsageByModelTable';
import { UsageKpis } from './components/UsageKpis';

function App() {
    return (
        <div className="space-y-4 bg-background p-6 text-foreground">
            <AppHeader />
            <ErrorBoundary>
                <UsageKpis />
            </ErrorBoundary>
            <div className="grid gap-4 lg:grid-cols-2">
                <ErrorBoundary>
                    <ModelUsageChart />
                </ErrorBoundary>
                <ErrorBoundary>
                    <UsageByModelTable />
                </ErrorBoundary>
            </div>
        </div>
    );
}

export default App;
