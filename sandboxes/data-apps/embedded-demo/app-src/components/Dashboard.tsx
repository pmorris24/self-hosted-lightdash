// The FP&A dashboard body — direct port of the embed app's Dashboard.tsx,
// rendering with vendored ECharts (same option builders as the embed app,
// theme-aware). KPI tiles, anomaly strip, program table and the Forecast Lab
// scenario engine are the same client-side logic over governed rows.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bvaf } from './Bvaf';
import { PivotTable } from './PivotTable';
import { EChart } from './EChart';
import SiteMap from './SiteMap';
import { chartTheme, forecastComboOption, hbarOption, milestoneOption, monthTick } from '../charts/chartOptions';
import { useIsDark } from '../lib/useIsDark';
import {
  CATEGORY_SHORT,
  type FpaData, type Kpis, type ProgramRow, type StudyRow, type MilestoneBundle, type Filters, type SiteRow,
} from '../data/useFpaData';

// ---- formatting (one system: compact in-glance, full on hover) ------------ //
const usd = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
};
const usdFull = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pct0 = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number) => (n >= 0 ? `+${usd(n)}` : `−${usd(-n)}`);
const signPct = (n: number) => `${n > 0 ? '+' : ''}${n}%`;

const GOOD = 'var(--fpa-good)', BAD = 'var(--fpa-bad)';
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

const STATUS_DOT: Record<string, string> = {
  Planned: '#B9B9C6', Enrolling: '#5B8DEF', Treatment: '#3F5BD6', 'Close-out': '#8A8A9A', Completed: '#5A5A68',
};

export function Dashboard({ data, busy, filters, onFilters }: {
  data: FpaData; busy: boolean; filters: Filters; onFilters: (f: Filters) => void;
}) {
  // Re-render (rebuilding every chart option) when the Lightdash host flips
  // between light and dark — canvas charts can't follow CSS variables.
  useIsDark();
  const toggleVendor = (v: string) => onFilters({
    ...filters, vendors: filters.vendors.includes(v) ? filters.vendors.filter((x) => x !== v) : [...filters.vendors, v],
  });

  const studies = data.portfolio.flatMap((p) => p.studies);
  const empty = studies.length === 0;

  // Lookback windows the KPI sparklines along with the charts.
  const lb = filters.lookback;
  const sparkLabels = lb ? data.combo.histLabels.slice(-lb) : data.combo.histLabels;
  const sparkOff = data.combo.histLabels.length - sparkLabels.length;

  return (
    <div style={{ opacity: busy ? 0.55 : 1, transition: 'opacity 0.15s' }}>
      <Anomalies portfolio={data.portfolio} cro={data.cro} kpis={data.kpis} onVendor={toggleVendor} />

      <SectionLabel>Portfolio overview</SectionLabel>
      <KpiRow
        k={data.kpis} studies={studies}
        spark={{
          labels: sparkLabels,
          spend: sparkLabels.map((_, i) => data.combo.cats.reduce((s, c) => s + (data.combo.actualByCat[c]?.[sparkOff + i] ?? 0), 0)),
          enroll: data.combo.enrollActual.slice(sparkOff),
        }}
      />

      <SectionLabel>Forecast Lab</SectionLabel>
      <ForecastLab data={data} lookback={filters.lookback} horizon={filters.horizon} />
      <MilestoneForecast d={data.milestone} />

      <SectionLabel>Budget vs actual vs forecast</SectionLabel>
      <Card hero title="Budget vs Actual vs Forecast" subtitle="Monthly spend vs the activity-phased budget, by trial and cost category. Forecast begins at the dashed seam.">
        <Bvaf data={data.bvaf} />
      </Card>
      <Card hero title="Spend pivot" subtitle="Build your own view — drag fields between Rows, Columns and Values to re-slice budget, actual and forecast spend.">
        <PivotTable facts={data.pivot} />
      </Card>

      <SectionLabel>Portfolio</SectionLabel>
      <div className="grid-2">
        <Card sub title="EAC vs budget by status">
          {empty ? <Empty /> : <EacByStatus portfolio={data.portfolio} />}
        </Card>
        <Card sub title="CRO variance" subtitle="Invoiced vs accrued — click a bar to filter the dashboard to that CRO.">
          {data.cro.length === 0 ? <Empty /> : <CroVariance cro={data.cro} active={filters.vendors} onVendor={toggleVendor} />}
        </Card>
      </div>
      <Card title="Program financial summary" subtitle="Programs roll up their studies; click a study to see its vendors.">
        {empty ? <Empty /> : <Portfolio portfolio={data.portfolio} />}
      </Card>

      <SectionLabel>Sites</SectionLabel>
      <Card
        title="Site performance"
        subtitle="Every activated site on the map — dot size is patients enrolled, colour is status. Scroll to zoom, drag to pan; click a site in the table to fly to it."
      >
        {data.sites.length === 0 ? <Empty /> : <SitePerformance rows={data.sites} />}
      </Card>
    </div>
  );
}

// ---- Site performance (map + leaderboard) ---------------------------------- //
// A leaderboard-row click sets `focus` (with a bumping nonce so re-clicking the
// same site re-flies), which SiteMap watches to zoom the map to the site.
const SITE_DOT: Record<string, string> = {
  Active: '#3FBFA3', Enrolling: '#5B8DEF', Pending: '#B9B9C6', Closed: '#8A8A9A', Suspended: '#EC6E52',
};

export function SitePerformance({ rows }: { rows: SiteRow[] }) {
  const nonce = useRef(0);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  return (
    <>
      <SiteMap rows={rows} focus={focus} />
      <Sites rows={rows} onSelect={(id) => setFocus({ id, n: (nonce.current += 1) })} />
    </>
  );
}

function Sites({ rows, onSelect }: { rows: SiteRow[]; onSelect?: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const top = rows.slice(0, showAll ? 25 : 10);
  const max = Math.max(1, ...rows.map((s) => s.enrolled));
  return (
    <div className="sites">
      <div className="sites__head">
        <span>Site</span><span>Status</span><span className="r">Enrolled</span>
        <span className="sites__barhead" /><span className="r">Visits</span><span className="r">Payments</span>
      </div>
      {top.map((s, i) => (
        <div
          className="sites__row" key={s.id}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
          title={onSelect ? 'Fly to this site on the globe' : undefined}
          onClick={() => onSelect?.(s.id)}
          onKeyDown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(s.id); } }}
        >
          <span className="sites__main">
            <span className="sites__rank" style={num}>{i + 1}</span>
            <span className="sites__id">
              <span className="sites__name">{s.site}</span>
              <span className="sites__sub">{s.pi} · {s.city}, {s.country} · {s.study}</span>
            </span>
          </span>
          <span className="stat-chip">
            <span className="stat-chip__dot" style={{ background: SITE_DOT[s.status] ?? '#B9B9C6' }} />
            {s.status}
          </span>
          <span className="r" style={num}>{s.enrolled}</span>
          <span className="sites__bar"><span style={{ width: `${(s.enrolled / max) * 100}%` }} /></span>
          <span className="r" style={num}>{s.visits.toLocaleString()}</span>
          <span className="r" style={num} title={usdFull(s.payments)}>{usd(s.payments)}</span>
        </div>
      ))}
      <div className="sites__foot">
        <span>{rows.length.toLocaleString()} sites with activity</span>
        {rows.length > 10 && (
          <button className="sites__more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show top 10' : 'Show top 25'}
          </button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
export function Card({ title, subtitle, hero, sub, right, children }: {
  title: string; subtitle?: string; hero?: boolean; sub?: boolean; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className={`card${hero ? ' card--hero' : ''}${sub ? ' card--sub' : ''}`}>
      <div className="card__head"><h3>{title}</h3>{right}</div>
      {subtitle && <p className="card__caption" style={{ marginBottom: 14 }}>{subtitle}</p>}
      {children}
    </section>
  );
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => <div className="section-label">{children}</div>;
const Empty = () => <div className="fc-empty">No studies match these filters.</div>;

export function Skeleton() {
  return (
    <div className="skeleton">
      <div className="sk sk--strip" />
      <div className="sk-row">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk--kpi" />)}</div>
      <div className="sk sk--chart" />
      <div className="sk sk--chart sk--short" />
    </div>
  );
}

// ---- Anomalies — the "so what" strip -------------------------------------- //
export function Anomalies({ portfolio, cro, kpis, onVendor }: {
  portfolio: ProgramRow[]; cro: FpaData['cro']; kpis: Kpis; onVendor: (v: string) => void;
}) {
  const overStudy = portfolio.flatMap((p) => p.studies).filter((s) => s.variance > 0)
    .sort((a, b) => b.variance - a.variance)[0];
  const overVendor = cro.filter((v) => v.variance > 0).sort((a, b) => b.variance - a.variance)[0];

  const items: { tone: 'bad' | 'warn' | 'info'; head: string; sub: string; onClick?: () => void }[] = [];
  if (overVendor) items.push({
    tone: 'bad', head: `${overVendor.vendor} over-billed ${usd(overVendor.variance)}`,
    sub: 'Invoiced above accrued activity — recoverable', onClick: () => onVendor(overVendor.vendor),
  });
  if (overStudy) items.push({
    tone: 'warn', head: `${overStudy.study} ${pct(overStudy.variance / (overStudy.budget || 1))} over budget`,
    sub: `EAC ${usd(overStudy.eac)} vs budget ${usd(overStudy.budget)}`,
  });
  if (kpis.visitsPending > 0) items.push({
    tone: 'info', head: `${kpis.visitsPending.toLocaleString()} visits awaiting EDC entry`,
    sub: 'Accrued on completion, not yet booked in source',
  });
  if (!items.length) return null;

  return (
    <div className="alerts">
      {items.map((it) => (
        <button key={it.head} className={`alert alert--${it.tone}${it.onClick ? ' is-clickable' : ''}`}
          onClick={it.onClick} disabled={!it.onClick}>
          <span className="alert__dot" />
          <span className="alert__body">
            <span className="alert__head">{it.head}</span>
            <span className="alert__sub">{it.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* Small progress ring, Condor's "% recognized" motif. */
function Ring({ value, size = 18, color = '#3FBFA3' }: { value: number; size?: number; color?: string }) {
  const r = (size - 4) / 2, c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fpa-border-soft)" strokeWidth={3.4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3.4}
        strokeDasharray={`${c * filled} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/* Micro area sparkline for KPI tiles. */
function Spark({ data, labels, color = '#7262FF', fmt = usd }: {
  data: number[]; labels: string[]; color?: string; fmt?: (v: number) => string;
}) {
  const gradId = useId();
  const [hov, setHov] = useState<number | null>(null);
  if (data.length < 2) return null;
  const W = 100, H = 24, PAD = 2;
  const max = Math.max(...data), min = Math.min(0, ...data);
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - PAD - ((v - min) / (max - min || 1)) * (H - PAD * 2);
  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHov(Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)))));
  };
  return (
    <div className="kpi__spark" onMouseMove={move} onMouseLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gradId})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {hov != null && <line x1={x(hov)} x2={x(hov)} y1={0} y2={H} stroke={color} strokeOpacity="0.3" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hov != null && <span className="kpi__spark-dot" style={{ left: `${x(hov)}%`, top: `${(y(data[hov]) / H) * 100}%`, borderColor: color }} />}
      {hov != null && (
        <div className="kpi__spark-tip" style={{ ...num, left: `clamp(55px, ${x(hov)}%, calc(100% - 55px))` }}>
          {monthTick(labels[hov] ?? '')} · <b>{fmt(data[hov])}</b>
        </div>
      )}
    </div>
  );
}

/* Soft red/green percentage pill next to a variance amount, Condor-style. */
function VarPill({ v, base }: { v: number; base: number }) {
  const p = (v / (base || 1)) * 100;
  return (
    <span className={`var-pill ${v > 0 ? 'var-pill--bad' : 'var-pill--good'}`} style={num}>
      {p > 0 ? '+' : ''}{p.toFixed(1)}%
    </span>
  );
}

export function KpiRow({ k, studies, spark }: {
  k: Kpis; studies: StudyRow[];
  spark: { labels: string[]; spend: number[]; enroll: number[] };
}) {
  const complete = k.ltd / (k.eac || 1);
  const enrolled = studies.reduce((s, x) => s + x.enrolled, 0);
  const target = studies.reduce((s, x) => s + x.target, 0);
  const enrollPct = enrolled / (target || 1);
  return (
    <div className="kpi-row">
      <div className="kpi kpi--primary">
        <div className="kpi__label">EAC</div>
        <div className="kpi__value" style={num} title={usdFull(k.eac)}>{usd(k.eac)}</div>
        <div className="kpi__sub" style={num}>Cost to complete {usd(k.costToComplete)}</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Current budget</div>
        <div className="kpi__value" style={num} title={usdFull(k.budget)}>{usd(k.budget)}</div>
        <div className="kpi__sub" style={num}>FY26 approved</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">LTD expensed</div>
        <div className="kpi__value-row">
          <span className="kpi__value" style={num} title={usdFull(k.ltd)}>{usd(k.ltd)}</span>
          <span className="kpi__chip" style={num}>{pct0(complete)}</span>
        </div>
        <Spark data={spark.spend} labels={spark.labels} />
      </div>
      <div className="kpi">
        <div className="kpi__label">EAC variance</div>
        <div className="kpi__value-row">
          <span className="kpi__value" style={{ ...num, color: k.variance <= 0 ? GOOD : BAD }} title={usdFull(k.variance)}>{signed(k.variance)}</span>
          <VarPill v={k.variance} base={k.budget} />
        </div>
        <div className="kpi__sub">vs current budget</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">CRO variance</div>
        <div className="kpi__value" style={{ ...num, color: k.croVariance > 0 ? BAD : GOOD }} title={usdFull(k.croVariance)}>{signed(k.croVariance)}</div>
        <div className="kpi__sub">Invoiced vs accrued</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Patients enrolled</div>
        <div className="kpi__value-row">
          <span className="kpi__value" style={num}>{enrolled.toLocaleString()}/{target.toLocaleString()}</span>
          <span className="kpi__chip" style={num}>{pct0(enrollPct)}</span>
        </div>
        <Spark data={spark.enroll} labels={spark.labels} color="#3FBFA3" fmt={(v) => `${Math.round(v).toLocaleString()} patients`} />
      </div>
    </div>
  );
}

function StatusChip({ status, phase }: { status: string; phase: string }) {
  return (
    <span className="stat-chip">
      <span className="stat-chip__dot" style={{ background: STATUS_DOT[status] ?? '#B9B9C6' }} />
      {status}<span className="stat-chip__phase">{phase.replace('Phase ', 'Ph ')}</span>
    </span>
  );
}

export function Portfolio({ portfolio, onStudySelect }: { portfolio: ProgramRow[]; onStudySelect?: (study: StudyRow) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const tot = portfolio.reduce(
    (a, p) => ({ eac: a.eac + p.eac, budget: a.budget + p.budget, ltd: a.ltd + p.ltd, variance: a.variance + p.variance }),
    { eac: 0, budget: 0, ltd: 0, variance: 0 },
  );
  return (
    <div className="ptbl">
      <div className="ptbl__head">
        <span>Program / study</span><span>Stage</span><span className="ptbl__enrhead">Enrollment</span>
        <span className="r ptbl__ops">To LPLV</span><span className="r">Budget</span><span className="r ptbl__ops">Burn/mo</span>
        <span className="r">EAC</span><span className="r">Recognized</span><span className="r">Variance</span>
      </div>
      <div className="ptbl__body">
        {portfolio.map((p) => (
          <div key={p.program}>
            <div className="ptbl__prog">
              <span className="ptbl__span-desc">
                <span className="ptbl__prog-name">{p.program}</span>
                <span className="ptbl__prog-sub">{p.studies.length} {p.studies.length === 1 ? 'study' : 'studies'}</span>
              </span>
              <span className="r" style={num}>{usd(p.budget)}</span>
              <span className="r ptbl__ops" />
              <span className="r" style={num}>{usd(p.eac)}</span>
              <span className="r ptbl__ring" style={num}><Ring value={p.ltd / (p.eac || 1)} /><span className="ptbl__ring-pct">{pct0(p.ltd / (p.eac || 1))}</span></span>
              <span className="r ptbl__var">
                <span style={{ ...num, color: p.variance <= 0 ? GOOD : BAD }}>{signed(p.variance)}</span>
                <VarPill v={p.variance} base={p.budget} />
              </span>
            </div>
            {p.studies.map((s) => <StudyRowView key={s.study} s={s} open={!!open[s.study]} onToggle={() => { setOpen((o) => ({ ...o, [s.study]: !o[s.study] })); onStudySelect?.(s); }} />)}
          </div>
        ))}
        <div className="ptbl__total">
          <span className="ptbl__span-desc">Total</span>
          <span className="r" style={num}>{usd(tot.budget)}</span>
          <span className="r ptbl__ops" />
          <span className="r" style={num}>{usd(tot.eac)}</span>
          <span className="r ptbl__ring" style={num}><Ring value={tot.ltd / (tot.eac || 1)} /><span className="ptbl__ring-pct">{pct0(tot.ltd / (tot.eac || 1))}</span></span>
          <span className="r ptbl__var">
            <span style={{ ...num, color: tot.variance <= 0 ? GOOD : BAD }}>{signed(tot.variance)}</span>
            <VarPill v={tot.variance} base={tot.budget} />
          </span>
        </div>
      </div>
    </div>
  );
}

function StudyRowView({ s, open, onToggle }: { s: StudyRow; open: boolean; onToggle: () => void }) {
  const enrPct = s.target ? Math.min(100, (s.enrolled / s.target) * 100) : 0;
  return (
    <>
      <div className={`ptbl__study${open ? ' is-open' : ''}`} onClick={onToggle} role="button" tabIndex={0} aria-expanded={open} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(); } }}>
        <span className="ptbl__study-name">
          <span className="ptbl__chev">{open ? '▾' : '▸'}</span>
          <span className="ptbl__title">{s.study}</span>
        </span>
        <StatusChip status={s.status} phase={s.phase} />
        <span className="ptbl__enrcell">
          <span style={num}>{s.enrolled}/{s.target}</span>
          <span className="ptbl__enr"><span style={{ width: `${enrPct}%` }} /></span>
        </span>
        <span className="r ptbl__ops" style={num}>{s.monthsToLplv > 0 ? `${s.monthsToLplv} mo` : '—'}</span>
        <span className="r" style={num}>{usd(s.budget)}</span>
        <span className="r ptbl__ops" style={num}>{usd(s.burnRate)}</span>
        <span className="r" style={num}>{usd(s.eac)}</span>
        <span className="r ptbl__ring" style={num}><Ring value={s.pctComplete} size={16} /><span className="ptbl__ring-pct">{pct(s.pctComplete)}</span></span>
        <span className="r" style={{ ...num, color: s.variance <= 0 ? GOOD : BAD }}>{signed(s.variance)}</span>
      </div>
      {open && s.vendors.map((v) => (
        <div key={v.vendor} className="ptbl__vendor">
          <span className="ptbl__span-desc ptbl__vendor-name">{v.vendor}</span>
          <span className="r" style={num}>{usd(v.budget)}</span>
          <span className="r ptbl__ops" />
          <span className="r" style={num}>{usd(v.eac)}</span>
          <span className="r" />
          <span className="r" style={{ ...num, color: v.variance <= 0 ? GOOD : BAD }}>{signed(v.variance)}</span>
        </div>
      ))}
    </>
  );
}

// ---- Milestone forecast ---------------------------------------------------- //
type Gran = 'M' | 'Q' | 'Y';

export function MilestoneForecast({ d }: { d: MilestoneBundle }) {
  const [gran, setGran] = useState<Gran>('M');

  const view = useMemo(() => {
    const bucketOf = (m: string) =>
      gran === 'M' ? m : gran === 'Q' ? `${m.slice(0, 4)}-Q${Math.ceil(+m.slice(5, 7) / 3)}` : m.slice(0, 4);
    const labels: string[] = [];
    const lastIdx: number[] = [];
    d.months.forEach((m, i) => {
      const b = bucketOf(m);
      if (labels[labels.length - 1] !== b) { labels.push(b); lastIdx.push(i); }
      else lastIdx[lastIdx.length - 1] = i;
    });
    const seam = d.histCount - 1;
    const bucketAt = (mi: number) => lastIdx.findIndex((last) => mi <= last);
    const histIdx = seam >= 0 ? bucketAt(seam) : -1;

    const actual = labels.map((_, bi) =>
      bi <= histIdx ? d.cumActual[Math.min(lastIdx[bi], seam)] : null);
    const forecast = labels.map((_, bi) =>
      bi < histIdx ? null : bi === histIdx ? actual[bi] : d.cumForecast[lastIdx[bi]]);
    const budget = labels.map((_, bi) => d.cumBudget[lastIdx[bi]] ?? null);

    const milestones = d.milestones.map((m) => {
      const mi = d.months.indexOf(m.month);
      return { label: m.label, x: labels[bucketAt(mi)], past: mi < d.histCount, proj: m.proj };
    }).filter((m) => m.x != null);

    return { labels, histIdx, actual, forecast, budget, milestones };
  }, [d, gran]);

  if (!d.months.length) return null;

  return (
    <Card
      hero title="Milestone forecast"
      subtitle="Cumulative actuals and forecast to LPLV against the phased budget. Purple chips are planned milestones; amber, projected slips."
      right={
        <div className="seg">
          {(['M', 'Q', 'Y'] as Gran[]).map((g) => (
            <button key={g} className={gran === g ? 'is-active' : ''} onClick={() => setGran(g)}>{g}</button>
          ))}
        </div>
      }
    >
      <EChart option={milestoneOption({ ...view, eac: d.eac, budgetTotal: d.budgetTotal, yearRow: gran !== 'Y' })} height={380} />
    </Card>
  );
}

export function EacByStatus({ portfolio }: { portfolio: ProgramRow[] }) {
  const byStatus = useMemo(() => {
    const m = new Map<string, { eac: number; budget: number }>();
    for (const p of portfolio) for (const s of p.studies) {
      const c = m.get(s.status) ?? { eac: 0, budget: 0 };
      c.eac += s.eac; c.budget += s.budget; m.set(s.status, c);
    }
    return ['Enrolling', 'Treatment', 'Close-out', 'Completed', 'Planned'].filter((s) => m.has(s)).map((s) => ({ status: s, ...m.get(s)! }));
  }, [portfolio]);
  const T = chartTheme();
  const option = hbarOption(
    byStatus.map((r) => r.status),
    [
      { name: 'Current budget', color: T.budgetBar, data: byStatus.map((r) => r.budget), barWidth: 20 },
      { name: 'EAC', color: T.catPrimary, data: byStatus.map((r) => r.eac), barWidth: 9 },
    ],
  );
  (option.series as { barGap?: string }[])[1].barGap = '-100%';
  return <EChart option={option} height={300} />;
}

export function CroVariance({ cro, active, onVendor }: { cro: FpaData['cro']; active: string[]; onVendor: (v: string) => void }) {
  const top = cro.filter((v) => Math.abs(v.variance) > 1000).slice(0, 10);
  const option = hbarOption(top.map((v) => v.vendor), [{ name: 'Variance', color: '#EC6E52', data: top.map((v) => v.variance) }], { signed: true });
  (option.series as { data: unknown[]; label?: unknown }[])[0].data = top.map((v) => ({
    value: v.variance,
    itemStyle: {
      color: v.variance > 0 ? '#EC6E52' : '#3FBFA3', borderRadius: 3,
      opacity: active.length && !active.includes(v.vendor) ? 0.35 : 1,
    },
  }));
  (option.series as { label?: unknown }[])[0].label = {
    show: true, position: 'right',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formatter: (p: any) => signed(Number(p.value ?? 0)), fontSize: 10, color: chartTheme().muted, fontFamily: 'Inter, sans-serif',
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <EChart option={option} height={300} onClick={(p: any) => p?.name && onVendor(String(p.name))} />;
}

// ---- Forecast Lab ----------------------------------------------------------- //
// A saved what-if: just the driver settings. EAC is re-valued live from the
// current (filtered) data, so scenarios stay comparable when filters change.
type Drivers = {
  mode: 'plan' | 'stat'; model: string;
  enrollAdj: number; patientAdj: number; rateAdj: number; link: boolean;
};
type Scenario = Drivers & { id: string; name: string };
const BASE_DRIVERS: Drivers = { mode: 'plan', model: 'auto', enrollAdj: 0, patientAdj: 0, rateAdj: 0, link: true };
const SCEN_KEY = 'tsfc-scenarios-v1';
// Enrollment changes phase in over ~6 months — an unramped scale puts a
// vertical step in the line at the forecast seam.
const rampIn = (i: number) => Math.min(1, (i + 1) / 6);
// How hard each category flexes with enrollment.
const ENROLL_SENS: Record<string, number> = { Investigator: 1, 'Pass-throughs': 1, 'Direct fees': 0.4, OCC: 0 };
const PATIENT_SENS: Record<string, number> = { Investigator: 1, 'Pass-throughs': 1, 'Direct fees': 0, OCC: 0 };
const adjFactor = (d: Drivers, cat: string, i: number) =>
  (1 + (d.link ? (d.enrollAdj / 100) * rampIn(i) * (ENROLL_SENS[cat] ?? 1) : 0))
  * (1 + (d.patientAdj / 100) * (PATIENT_SENS[cat] ?? 0))
  * (1 + d.rateAdj / 100);

export function ForecastLab({ data, lookback, horizon }: { data: FpaData; lookback: number | null; horizon: number | null }) {
  const c = data.combo;
  const [mode, setMode] = useState<'plan' | 'stat'>('plan');
  const [model, setModel] = useState('auto');
  const [enrollAdj, setEnrollAdj] = useState(0);
  const [patientAdj, setPatientAdj] = useState(0);
  const [rateAdj, setRateAdj] = useState(0);
  const [link, setLink] = useState(true);
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    try {
      const raw: Scenario[] = JSON.parse(localStorage.getItem(SCEN_KEY) ?? '[]');
      return raw.map((s) => ({ ...BASE_DRIVERS, ...s }));
    } catch { return []; }
  });
  const [activeId, setActiveId] = useState('base');
  useEffect(() => { try { localStorage.setItem(SCEN_KEY, JSON.stringify(scenarios)); } catch { /* sandboxed */ } }, [scenarios]);

  const cur: Drivers = { mode, model, enrollAdj, patientAdj, rateAdj, link };

  // Statistical projections for ALL models, so saved scenarios can be valued
  // without switching the UI to their model.
  const statAll = useMemo(() => {
    const idx = new Map(c.futureLabels.map((m, i) => [m, i] as const));
    const byModel: Record<string, Record<string, number[]>> = {};
    for (const f of data.forecast) {
      if (f.metric !== 'expense') continue;
      const mi = idx.get(f.month); if (mi == null) continue;
      const cat = CATEGORY_SHORT[f.category] ?? f.category;
      const cats = (byModel[f.model] ??= {});
      (cats[cat] ??= c.futureLabels.map(() => 0))[mi] += f.mean;
    }
    return byModel;
  }, [data.forecast, c]);
  const statByCat = statAll[model] ?? {};
  const statMonths = useMemo(() => new Set(data.forecast.map((p) => p.month)), [data.forecast]);
  const statVal = (byCat: Record<string, number[]>, cat: string, i: number) =>
    statMonths.has(c.futureLabels[i]) ? (byCat[cat]?.[i] ?? 0) : (c.planForecastByCat[cat]?.[i] ?? 0);

  const eacOf = (d: Drivers) => {
    const stat = d.mode === 'stat' ? (statAll[d.model] ?? {}) : null;
    let togo = 0;
    for (const cat of c.cats) {
      for (let i = 0; i < c.futureLabels.length; i++) {
        const base = stat ? statVal(stat, cat, i) : (c.planForecastByCat[cat]?.[i] ?? 0);
        togo += base * adjFactor(d, cat, i);
      }
    }
    return data.kpis.ltd + togo;
  };

  const apply = (d: Drivers, id: string) => {
    setMode(d.mode); setModel(d.model);
    setEnrollAdj(d.enrollAdj); setPatientAdj(d.patientAdj); setRateAdj(d.rateAdj); setLink(d.link);
    setActiveId(id);
  };
  const saveScenario = () => {
    const used = new Set(scenarios.map((s) => s.name));
    let n = 0; while (used.has(`Scenario ${String.fromCharCode(65 + n)}`)) n++;
    const s: Scenario = { ...cur, id: crypto.randomUUID(), name: `Scenario ${String.fromCharCode(65 + n)}` };
    setScenarios([...scenarios, s]); setActiveId(s.id);
  };
  const removeScenario = (id: string) => {
    setScenarios(scenarios.filter((s) => s.id !== id));
    if (activeId === id) setActiveId('custom');
  };

  const forecastByCat: Record<string, number[]> = {};
  for (const cat of c.cats) {
    forecastByCat[cat] = c.futureLabels.map((_, i) =>
      (mode === 'stat' ? statVal(statByCat, cat, i) : (c.planForecastByCat[cat]?.[i] ?? 0)) * adjFactor(cur, cat, i));
  }
  const enrollForecast = c.enrollForecastPlan.map((v, i) => v * (1 + (enrollAdj / 100) * rampIn(i)));
  const bandWiden = (i: number) => Math.min(0.3, 0.05 + 0.02 * i);
  const enrollBand = {
    lower: enrollForecast.map((v, i) => v * (1 - bandWiden(i))),
    upper: enrollForecast.map((v, i) => v * (1 + bandWiden(i))),
  };

  const stackAt = (by: Record<string, number[]>, i: number) => c.cats.reduce((s, cat) => s + Math.max(0, by[cat]?.[i] ?? 0), 0);
  const peaks = [
    ...c.histLabels.map((_, i) => stackAt(c.actualByCat, i)),
    ...c.futureLabels.map((_, i) => stackAt(c.planForecastByCat, i)),
    ...c.futureLabels.map((_, i) => stackAt(statByCat, i)),
  ];
  const spendMaxFixed = Math.max(200_000, Math.ceil((Math.max(1, ...peaks) * 1.05) / 200_000) * 200_000);
  const patBasePeak = Math.max(1, ...c.enrollActual, ...c.enrollForecastPlan.map((v, i) => v * (1 + 0.3 * rampIn(i)) * (1 + bandWiden(i))));
  const patMaxFixed = Math.max(20, Math.ceil((patBasePeak * 1.05) / 50) * 50);

  // Lookback/Horizon window the DISPLAYED months only — EAC valuation above
  // always runs over the full to-go span so the scenario numbers don't change
  // with the viewing window.
  const histW = lookback ? c.histLabels.slice(-lookback) : c.histLabels;
  const offH = c.histLabels.length - histW.length;
  const futW = horizon ? c.futureLabels.slice(0, horizon) : c.futureLabels;
  const winByCat = (by: Record<string, number[]>, off: number, len: number) =>
    Object.fromEntries(c.cats.map((cat) => [cat, (by[cat] ?? []).slice(off, off + len)]));

  const option = forecastComboOption({
    cats: c.cats, histLabels: histW, futureLabels: futW,
    actualByCat: winByCat(c.actualByCat, offH, histW.length),
    forecastByCat: winByCat(forecastByCat, 0, futW.length),
    enrollActual: c.enrollActual.slice(offH),
    enrollForecast: enrollForecast.slice(0, futW.length),
    enrollBand: { lower: enrollBand.lower.slice(0, futW.length), upper: enrollBand.upper.slice(0, futW.length) },
    spendMaxFixed, patMaxFixed,
  });

  const scenarioEac = eacOf(cur);
  const scenarioVar = scenarioEac - data.kpis.budget;
  const fillPct = Math.min(100, (scenarioEac / (data.kpis.budget || 1)) * 100);
  const dirty = enrollAdj !== 0 || patientAdj !== 0 || rateAdj !== 0 || !link;
  const dir = (n: number) => (n > 0 ? 'is-up' : n < 0 ? 'is-down' : '');
  const trackBg = (v: number) => {
    const p = ((v + 30) / 60) * 100;
    const [lo, hi] = p < 50 ? [p, 50] : [50, p];
    return { background: `linear-gradient(to right, var(--fpa-border-soft) ${lo}%, #7262FF ${lo}%, #7262FF ${hi}%, var(--fpa-border-soft) ${hi}%)` };
  };
  const activeName = activeId === 'base' ? 'Base plan'
    : activeId === 'custom' ? 'Custom what-if'
    : scenarios.find((s) => s.id === activeId)?.name ?? 'Custom what-if';

  const chip = (id: string, name: string, d: Drivers, removable: boolean) => {
    const eac = eacOf(d);
    const v = eac - data.kpis.budget;
    return (
      <div
        key={id} role="button" tabIndex={0}
        className={`fc-chip${activeId === id ? ' is-active' : ''}`}
        title={`${d.mode === 'plan' ? 'Plan-based' : `Statistical · ${d.model}`} · Enrollment ${signPct(d.enrollAdj)}${d.link ? ' (drives patient costs)' : ' (line only)'} · Patient costs ${signPct(d.patientAdj)} · Vendor rate ${signPct(d.rateAdj)}`}
        onClick={() => apply(d, id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') apply(d, id); }}
      >
        <span className="fc-chip__name">{name}</span>
        <span className="fc-chip__eac" style={num}>{usd(eac)}</span>
        <span className={`fc-chip__delta ${v <= 0 ? 'pos' : 'neg'}`} style={num}>{signed(v)}</span>
        {removable && <span className="fc-chip__x" title="Delete scenario" onClick={(e) => { e.stopPropagation(); removeScenario(id); }}>×</span>}
      </div>
    );
  };

  return (
    <div>
      <Card hero title="Estimate at Completion">
        <div className={`budget-impact${scenarioVar > 0 ? ' is-over' : ''}`}>
          <div className="budget-impact__top">
            <div>
              <div className="budget-impact__label">Scenario EAC · {activeName} · {mode === 'plan' ? 'plan-based' : `statistical · ${model}`}</div>
              <div className="budget-impact__value" style={num}>{usd(scenarioEac)}</div>
            </div>
            <span className={`budget-impact__pill ${scenarioVar <= 0 ? 'pos' : 'neg'}`} style={num}>{signed(scenarioVar)} vs budget</span>
          </div>
          <div className="budget-impact__track"><span className="budget-impact__fill" style={{ width: `${fillPct}%` }} /><span className="budget-impact__cap" /></div>
          <div className="budget-impact__foot" style={num}><span>LTD {usd(data.kpis.ltd)}</span><span>Budget {usd(data.kpis.budget)}</span></div>
        </div>

        <div className="fc-scen">
          <span className="fc-controls__label">Scenarios</span>
          {chip('base', 'Base plan', BASE_DRIVERS, false)}
          {scenarios.map((s) => chip(s.id, s.name, s, true))}
          {activeId === 'custom' && (
            <button className="fc-chip fc-chip--save" onClick={saveScenario}>+ Save scenario</button>
          )}
        </div>
        <div className="fc-controls">
          <div className="fc-field">
            <span className="fc-controls__label">Basis</span>
            <div className="seg">
              <button className={mode === 'plan' ? 'is-active' : ''} onClick={() => { setMode('plan'); setActiveId('custom'); }}>Plan-based</button>
              <button className={mode === 'stat' ? 'is-active' : ''} onClick={() => { setMode('stat'); setActiveId('custom'); }}>Statistical</button>
            </div>
          </div>
          {mode === 'stat' && (
            <div className="fc-field">
              <span className="fc-controls__label">Model</span>
              <select className="fc-select" value={model} onChange={(e) => { setModel(e.target.value); setActiveId('custom'); }}>
                {['auto', 'arima', 'holt_winters', 'prophet'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          <div className="fc-field">
            <span className="fc-controls__label">Enrollment</span>
            <div className="fc-horizon">
              <input type="range" min={-30} max={30} value={enrollAdj} style={trackBg(enrollAdj)} onChange={(e) => { setEnrollAdj(Number(e.target.value)); setActiveId('custom'); }} />
              <span className={`fc-horizon__val ${dir(enrollAdj)}`} style={num}>{signPct(enrollAdj)}</span>
            </div>
            <button
              className={`fc-link${link ? ' is-on' : ''}`}
              title="On: enrollment changes flow through to patient-driven costs (activity-based). Off: forecast the enrollment line only."
              onClick={() => { setLink(!link); setActiveId('custom'); }}
            >
              <span className="fc-link__dot" />→ patient costs
            </button>
          </div>
          <div className="fc-field">
            <span className="fc-controls__label">Patient costs</span>
            <div className="fc-horizon">
              <input type="range" min={-30} max={30} value={patientAdj} style={trackBg(patientAdj)} onChange={(e) => { setPatientAdj(Number(e.target.value)); setActiveId('custom'); }} />
              <span className={`fc-horizon__val ${dir(patientAdj)}`} style={num}>{signPct(patientAdj)}</span>
            </div>
          </div>
          <div className="fc-field">
            <span className="fc-controls__label">Vendor rate</span>
            <div className="fc-horizon">
              <input type="range" min={-30} max={30} value={rateAdj} style={trackBg(rateAdj)} onChange={(e) => { setRateAdj(Number(e.target.value)); setActiveId('custom'); }} />
              <span className={`fc-horizon__val ${dir(rateAdj)}`} style={num}>{signPct(rateAdj)}</span>
            </div>
          </div>
          {dirty && <button className="fc-reset" onClick={() => apply(BASE_DRIVERS, 'base')}>Reset</button>}
        </div>

        <EChart option={option} height={400} />
      </Card>
    </div>
  );
}
