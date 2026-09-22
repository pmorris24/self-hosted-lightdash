import { createContext, useContext, useEffect, useMemo, useState, type ComponentType, type PropsWithChildren, type ReactNode } from 'react';
import { defineDataApp } from './lib/dataApp';
import { useFpaData, useFilterOptions, DEFAULT_FILTERS, type Filters, type FpaData, type MonthRange, type StudyRow } from './data/useFpaData';
import { Dashboard, ForecastLab, MilestoneForecast, Skeleton, Anomalies, EacByStatus, CroVariance, SitePerformance, Card } from './components/Dashboard';
import { Bvaf } from './components/Bvaf';
import { PivotTable } from './components/PivotTable';
import { AsOfPicker, PillSelect } from './components/ReportingPickers';
import { NativePortfolio, NativeSummary } from './components/NativePortfolio';
import { useIsDark } from './lib/useIsDark';
import './fpa.css';
import './native-workspace.css';

export type FpaProps = {
    filters: Partial<Filters>;
    onStudySelect: (study: StudyRow) => void;
    onState: (state: { ready: boolean; error: boolean }) => void;
    onFiltersChange?: (filters: Filters) => void;
};
type Controls = { filters: Filters; onFilters: (filters: Filters) => void; onStudySelect: FpaProps['onStudySelect']; vendors: string[]; monthRange: MonthRange };
type DataState = { data: FpaData | null; loading: boolean; error: Error | null };
type State = Controls & { data: FpaData };
const ControlsContext = createContext<Controls | null>(null);
const DataContext = createContext<DataState | null>(null);
function useControls() {
    useIsDark();
    const controls = useContext(ControlsContext);
    if (!controls) throw new Error('Place FP&A components inside DataAppProvider');
    return controls;
}
function useFpa(): State {
    const controls = useControls();
    const state = useContext(DataContext);
    if (!state?.data) throw new Error('FP&A data components must render through gated()');
    return { ...controls, data: state.data };
}
/** Controls stay interactive while each data component shows its own loading state. */
function gated(Component: ComponentType, fallback: ReactNode = <div className="sk sk--chart" />): ComponentType {
    function Gated() {
        const state = useContext(DataContext);
        if (!state) throw new Error('Place FP&A components inside DataAppProvider');
        if (!state.data) return state.error ? <p role="alert">The FP&A data request failed. Refresh to retry.</p> : <div role="status">{fallback}</div>;
        return <div aria-busy={state.loading} inert={state.loading || !!state.error} className={state.loading ? 'portable-updating' : undefined}><Component /></div>;
    }
    Gated.displayName = `Gated(${Component.displayName ?? Component.name})`;
    return Gated;
}
function Provider({ children, filters: input, onStudySelect, onState, onFiltersChange }: PropsWithChildren<FpaProps>) {
    const [local, setLocal] = useState<Filters>(DEFAULT_FILTERS);
    const filters = useMemo(() => ({ ...local, ...input }), [input, local]);
    const { data, loading, error } = useFpaData(filters);
    const options = useFilterOptions();
    const [snapshot, setSnapshot] = useState<FpaData | null>(null);
    const [seenVendors, setSeenVendors] = useState<string[]>([]);
    useEffect(() => {
        if (!data) return;
        setSnapshot(data);
        setSeenVendors(previous => [...new Set([...previous, ...data.cro.map(row => row.vendor).filter(Boolean)])]);
    }, [data]);
    useEffect(() => onState({ ready: !!data && !loading && !error, error: !!error }), [data, loading, error, onState]);
    const current = data ?? snapshot;
    const vendors = useMemo(() => [...new Set([...options.vendors, ...seenVendors])].sort(), [options.vendors, seenVendors]);
    const monthRange = options.monthRange.anchor ? options.monthRange : current?.monthRange ?? options.monthRange;
    function onFilters(next: Filters) { setLocal(next); onFiltersChange?.(next); }
    return <ControlsContext.Provider value={{ filters, onFilters, onStudySelect, vendors, monthRange }}>
        <DataContext.Provider value={{ data: current, loading, error }}>
            {current && error && <p className="portable-notice" role="alert">Data could not update. The previous results remain visible. Refresh to retry.</p>}
            {current && loading && <p className="portable-notice" role="status">Updating governed data…</p>}
            {children}
        </DataContext.Provider>
    </ControlsContext.Provider>;
}
function toggleVendor(state: State, vendor: string) {
    state.onFilters({ ...state.filters, vendors: state.filters.vendors.includes(vendor) ? state.filters.vendors.filter(value => value !== vendor) : [...state.filters.vendors, vendor] });
}
export function ReportingControls() {
    const { filters, onFilters, vendors, monthRange } = useControls();
    return <div className="portable-reporting">
        <div className="portable-period"><span className="portable-control-label">Reporting period</span><AsOfPicker range={monthRange} value={filters.asOf} onChange={asOf => onFilters({ ...filters, asOf })}/><PillSelect label="Lookback" value={filters.lookback} options={[6,12,24,36,null]} format={value => value ? `${value} mo` : 'All'} onChange={lookback => onFilters({ ...filters, lookback })}/><PillSelect label="Horizon" value={filters.horizon} options={[6,12,18,24,36,null]} format={value => value ? `${value} mo` : 'All'} onChange={horizon => onFilters({ ...filters, horizon })}/></div>
        <div className="portable-vendors"><label>Vendor<select aria-label="Add vendor filter" value="" onChange={event => { if (event.target.value) onFilters({ ...filters, vendors: [...filters.vendors, event.target.value] }); }}><option value="">{filters.vendors.length ? 'Add vendor…' : 'All vendors'}</option>{vendors.filter(vendor => !filters.vendors.includes(vendor)).map(vendor => <option key={vendor}>{vendor}</option>)}</select></label>{filters.vendors.map(vendor => <button key={vendor} aria-label={`Remove vendor ${vendor}`} onClick={() => onFilters({ ...filters, vendors: filters.vendors.filter(value => value !== vendor) })}>{vendor} ×</button>)}{filters.vendors.length > 0 && <button onClick={() => onFilters({ ...filters, vendors: [] })}>Clear vendors</button>}</div>
    </div>;
}
export const PortfolioSummary = gated(function PortfolioSummary() {
    const { data, filters } = useFpa();
    const labels = filters.lookback ? data.combo.histLabels.slice(-filters.lookback) : data.combo.histLabels;
    const offset = data.combo.histLabels.length - labels.length;
    return <div className="portable-summary-full"><NativeSummary k={data.kpis} studies={data.portfolio.flatMap(program => program.studies)} spark={{ spend: labels.map((_, i) => data.combo.cats.reduce((sum, category) => sum + (data.combo.actualByCat[category]?.[offset + i] ?? 0), 0)), enroll: data.combo.enrollActual.slice(offset) }}/></div>;
});
export const AttentionItems = gated(function AttentionItems() {
    const state = useFpa();
    return <Anomalies portfolio={state.data.portfolio} cro={state.data.cro} kpis={state.data.kpis} onVendor={vendor => toggleVendor(state, vendor)}/>;
});
export const Forecast = gated(function Forecast() {
    const { data, filters } = useFpa();
    return <ForecastLab data={data} lookback={filters.lookback} horizon={filters.horizon} />;
});
export const Milestones = gated(function Milestones() {
    const { data } = useFpa();
    return <MilestoneForecast d={data.milestone} />;
});
export const BudgetActualForecast = gated(function BudgetActualForecast() {
    const { data } = useFpa();
    return <Card hero title="Budget vs Actual vs Forecast" subtitle="Monthly spend against the activity-phased budget, by trial and cost category."><Bvaf data={data.bvaf}/></Card>;
});
export const SpendPivot = gated(function SpendPivot() {
    const { data } = useFpa();
    return <Card hero title="Spend pivot" subtitle="Arrange rows, columns, and values to compare budget, actual, and forecast spend."><PivotTable facts={data.pivot}/></Card>;
});
export const BudgetByStatus = gated(function BudgetByStatus() {
    const { data } = useFpa();
    return <Card sub title="EAC vs budget by status"><EacByStatus portfolio={data.portfolio}/></Card>;
});
export const VendorVariance = gated(function VendorVariance() {
    const state = useFpa();
    return <Card sub title="CRO variance" subtitle="Select a vendor to filter the workspace."><CroVariance cro={state.data.cro} active={state.filters.vendors} onVendor={vendor => toggleVendor(state, vendor)}/></Card>;
});
export const ProgramFinancials = gated(function ProgramFinancials() {
    const { data, onStudySelect } = useFpa();
    return <NativePortfolio portfolio={data.portfolio} onStudySelect={onStudySelect}/>;
});
export const Sites = gated(function Sites() {
    const { data } = useFpa();
    return <Card title="Site performance" subtitle="Explore the map, then choose a site to see its location, enrollment, visits, and payments.">{data.sites.length ? <div className="portable-site-surface"><SitePerformance rows={data.sites}/></div> : <p>No sites match these filters.</p>}</Card>;
});
const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
export const StudyList = gated(function StudyList() {
    const { data, onStudySelect } = useFpa();
    const studies = data.portfolio.flatMap(program => program.studies);
    return <div className="portable-studies"><h3>Study directory</h3><p>Open a study in the review panel.</p>{studies.length ? studies.map(study => <button key={study.study} onClick={() => onStudySelect(study)}><span>{study.study}<small>{study.program} · {study.phase}</small></span><strong>{usd(study.eac)} <span aria-hidden="true">↗</span></strong></button>) : <p>No studies match these filters.</p>}</div>;
});
const DashboardView = gated(function DashboardView() {
    const { data, filters, onFilters } = useFpa();
    return <Dashboard data={data} busy={false} filters={filters} onFilters={onFilters}/>;
}, <Skeleton />);
function WholeApp() {
    return <><ReportingControls/><DashboardView/></>;
}
export const dataApp = defineDataApp({
    contractVersion: 1,
    id: 'clinical-trial-fp-a',
    Provider,
    App: WholeApp,
    components: { ReportingControls, PortfolioSummary, AttentionItems, Forecast, Milestones, BudgetActualForecast, SpendPivot, BudgetByStatus, VendorVariance, ProgramFinancials, Sites, StudyList },
});
