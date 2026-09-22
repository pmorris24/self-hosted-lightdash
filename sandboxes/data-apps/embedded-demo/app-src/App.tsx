// Clinical Trial FP&A — data-app port of the external embed-app.
// Same layout: governed FilterPanel on the left, the FP&A dashboard on the
// right, with the Condor-style reporting-period ("as of") picker. All data
// flows through @lightdash/query-sdk — auth and RLS are inherited from
// Lightdash, so there is no token server and no REST proxy here.
import { useEffect, useMemo, useRef, useState } from 'react';
import './fpa.css';
import { FilterPanel, type FilterOptions } from './components/FilterPanel';
import { Dashboard, Skeleton } from './components/Dashboard';
import { AsOfPicker, PillSelect } from './components/ReportingPickers';
import { useIsDark, useThemePref, setThemePref, type ThemePref } from './lib/useIsDark';
import { useFpaData, DEFAULT_FILTERS, type Filters, type FpaData } from './data/useFpaData';

const PHASE_ORDER = ['Phase I', 'Phase II', 'Phase III'];
const STATUS_ORDER = ['Planned', 'Enrolling', 'Treatment', 'Close-out', 'Completed'];
// Theme switcher — Lightdash doesn't propagate its own light/dark mode into
// the app iframe, so this cycles auto (follow OS) → light → dark and persists.
function ThemeToggle() {
  const pref = useThemePref();
  const dark = useIsDark();
  const NEXT: Record<ThemePref, ThemePref> = { auto: 'light', light: 'dark', dark: 'auto' };
  const icon = pref === 'auto'
    ? <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5v11a5.5 5.5 0 0 1 0-11z" fill="currentColor" />
    : dark
      ? <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5 6 6 0 1 0 13.5 9.5z" fill="currentColor" />
      : <path d="M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM8 0v2M8 14v2M0 8h2M14 8h2M2.3 2.3l1.4 1.4M12.3 12.3l1.4 1.4M13.7 2.3l-1.4 1.4M3.7 12.3l-1.4 1.4" stroke="currentColor" strokeWidth="1.4" fill="currentColor" strokeLinecap="round" />;
  return (
    <button
      className="theme-btn"
      title={`Theme: ${pref === 'auto' ? `auto (${dark ? 'dark' : 'light'})` : pref} — click to switch`}
      onClick={() => setThemePref(NEXT[pref])}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>{icon}</svg>
      {pref === 'auto' && <span className="theme-btn__auto">auto</span>}
    </button>
  );
}

const coversAll = (selected: string[], all: string[]) =>
  selected.length === all.length && all.every((value) => selected.includes(value));

// A facet with every value selected filters nothing, so query it unfiltered:
// the default "all selected" state then reuses the first load instead of re-running it.
function withoutFullSelections(filters: Filters, options: FilterOptions | null): Filters {
  if (!options) return filters;
  return {
    ...filters,
    programs: coversAll(filters.programs, options.programs) ? [] : filters.programs,
    phases: coversAll(filters.phases, options.phases) ? [] : filters.phases,
    statuses: coversAll(filters.statuses, options.statuses) ? [] : filters.statuses,
  };
}

export default function App({ hostControls }: { hostControls?: { initialFilters?: Partial<Filters>; subscribe: (listener: (patch: Partial<Filters>) => void) => () => void; report: (state: { ready: boolean; error: boolean }) => void } } = {}) {
  const [externallyControlled, setExternallyControlled] = useState(!!hostControls);
  const requestId = useRef<string | null>(null);
  const dark = useIsDark();

  const [filters, setFilters] = useState<Filters>(() => ({ ...DEFAULT_FILTERS, ...hostControls?.initialFilters }));
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const queryFilters = useMemo(() => externallyControlled ? filters : withoutFullSelections(filters, options), [filters, options, externallyControlled]);
  const { data, loading, error } = useFpaData(queryFilters);

  // Keep the last loaded snapshot so filter changes dim the dashboard instead
  // of unmounting it while the governed queries re-run.
  const [snap, setSnap] = useState<FpaData | null>(null);
  useEffect(() => { if (data) setSnap(data); }, [data]);

  // Derive the filter facets from the FIRST (unfiltered) load, then start with
  // every value selected — Condor-style, the panel shows the full portfolio as
  // chips rather than empty "All …" placeholders.
  useEffect(() => {
    if (!data || options) return;
    const programs = data.portfolio.map((p) => p.program);
    const phases = new Set<string>(), statuses = new Set<string>();
    for (const p of data.portfolio) for (const s of p.studies) { phases.add(s.phase); statuses.add(s.status); }
    const opts: FilterOptions = {
      programs,
      phases: PHASE_ORDER.filter((x) => phases.has(x)),
      statuses: STATUS_ORDER.filter((x) => statuses.has(x)),
    };
    setOptions(opts);
    if (!externallyControlled) setFilters((prev) => ({ ...prev, programs: [...opts.programs], phases: [...opts.phases], statuses: [...opts.statuses], vendors: [] }));
  }, [data, options, externallyControlled]);

  useEffect(() => hostControls?.subscribe((patch) => setFilters(prev => ({ ...prev, ...patch }))), [hostControls]);
  useEffect(() => {
    if (hostControls || window.top === window) return;
    const origin = 'https://lightdash-portable-apps-demo.vercel.app';
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== window.top || event.data?.type !== 'fpa:controls') return;
      const { filters: patch, theme, id } = event.data;
      if (typeof id !== 'string' || !patch || !['programs','phases','statuses'].every(key => Array.isArray(patch[key]) && patch[key].length <= 20 && patch[key].every((v: unknown) => typeof v === 'string' && v.length < 100))) return;
      if (patch.vendors !== undefined && (!Array.isArray(patch.vendors) || patch.vendors.length > 100 || !patch.vendors.every((v: unknown) => typeof v === 'string' && v.length < 200))) return;
      if (patch.asOf !== undefined && patch.asOf !== null && (typeof patch.asOf !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(patch.asOf))) return;
      if (['lookback','horizon'].some(key => patch[key] !== undefined && ![null,6,12,18,24,36].includes(patch[key]))) return;
      requestId.current = id;
      setExternallyControlled(true);
      if (theme === 'light' || theme === 'dark') setThemePref(theme);
      setFilters(prev => ({ ...prev, programs: patch.programs, phases: patch.phases, statuses: patch.statuses, ...(patch.vendors !== undefined ? {vendors: patch.vendors} : {}), ...(patch.asOf !== undefined ? {asOf: patch.asOf} : {}), ...(patch.lookback !== undefined ? {lookback: patch.lookback} : {}), ...(patch.horizon !== undefined ? {horizon: patch.horizon} : {}) }));
      window.top?.postMessage({ type: 'fpa:ack', id }, origin);
    };
    window.addEventListener('message', receive);
    window.top?.postMessage({ type: 'fpa:available' }, origin);
    return () => window.removeEventListener('message', receive);
  }, [hostControls]);
  useEffect(() => {
    const state = { ready: !!snap && !!options && !loading && !error, error: !!error };
    hostControls?.report(state);
    if (!hostControls && externallyControlled) window.top?.postMessage({ type: 'fpa:state', id: requestId.current, ...state }, 'https://lightdash-portable-apps-demo.vercel.app');
  }, [hostControls, externallyControlled, snap, options, loading, error]);

  return (
    <div className={`app${dark ? ' dark' : ''}`}>
      <div className="app__body">
        {options && !externallyControlled && <FilterPanel filters={filters} options={options} onChange={setFilters} />}
        <main className="app__main">
          <div className="app__main-head">
            <h1>Clinical Trial FP&amp;A</h1>
            <div className="asof">
              <span className="asof__fy">FY26</span>
              <div className="hdr-pills">
                <AsOfPicker
                  range={snap?.monthRange ?? null}
                  value={filters.asOf}
                  onChange={(m) => setFilters((prev) => ({ ...prev, asOf: m }))}
                />
                <PillSelect
                  label="Lookback" value={filters.lookback} options={[6, 12, 24, 36, null]}
                  format={(v) => (v ? `${v} mo` : 'All')}
                  onChange={(v) => setFilters((prev) => ({ ...prev, lookback: v }))}
                />
                <PillSelect
                  label="Horizon" value={filters.horizon} options={[6, 12, 18, 24, 36, null]}
                  format={(v) => (v ? `${v} mo` : 'All')}
                  onChange={(v) => setFilters((prev) => ({ ...prev, horizon: v }))}
                />
              </div>
              <span className="asof__gov"><i /> Governed</span>
              {!externallyControlled && <ThemeToggle />}
            </div>
          </div>

          {error && (
            <div className="embed-loading">Couldn’t load data. {error.message}</div>
          )}
          {!error && !snap && <Skeleton />}
          {!error && snap && (
            <div className="dash-scroll">
              <Dashboard data={snap} busy={loading} filters={filters} onFilters={setFilters} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
