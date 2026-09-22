import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Kpis, ProgramRow, StudyRow } from '../data/useFpaData';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const fullCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US');
const usd = (value: number) => currency.format(value);
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${usd(Math.abs(value))}`;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const bounded = (value: number) => Math.max(0, Math.min(100, value * 100));

function Trend({ values, label }: { values: number[]; label: string }) {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const range = Math.max(...values) - min || 1;
    const points = values.map((value, index) => `${index / (values.length - 1) * 120},${28 - (value - min) / range * 23}`).join(' ');
    return <svg className="np-trend" viewBox="0 0 120 32" role="img" aria-label={label}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>;
}

export function NativeSummary({ k, studies, spark }: {
    k: Kpis;
    studies: StudyRow[];
    spark: { spend: number[]; enroll: number[] };
}) {
    const enrolled = studies.reduce((sum, study) => sum + study.enrolled, 0);
    const target = studies.reduce((sum, study) => sum + study.target, 0);
    const spent = k.eac ? k.ltd / k.eac : 0;
    const enrollment = target ? enrolled / target : 0;
    return <div className="np-summary">
        <div className="np-summary__primary">
            <div className="np-metric-label">Estimate at completion <span className="np-metric-tag">EAC</span></div>
            <strong className="np-summary__amount" title={fullCurrency.format(k.eac)}>{usd(k.eac)}</strong>
            <div className={`np-summary__comparison ${k.variance <= 0 ? 'np-good' : 'np-bad'}`}><span aria-hidden="true">{k.variance <= 0 ? '↘' : '↗'}</span> {usd(Math.abs(k.variance))} {k.variance <= 0 ? 'under' : 'over'} budget <span>{k.budget ? percent(Math.abs(k.variance / k.budget)) : '—'}</span></div>
            <div className="np-cost-track" role="img" aria-label={`${percent(spent)} of estimated cost recognized`}><span style={{ width: `${bounded(spent)}%` }}/></div>
            <div className="np-cost-legend"><span><i/>Recognized <b>{usd(k.ltd)}</b></span><span><i/>To complete <b>{usd(k.costToComplete)}</b></span></div>
        </div>
        <div className="np-summary__metrics">
            <div className="np-metric"><span className="np-metric-label">Current budget</span><strong title={fullCurrency.format(k.budget)}>{usd(k.budget)}</strong><span className="np-metric-foot">Across {studies.length} {studies.length === 1 ? 'study' : 'studies'}</span></div>
            <div className="np-metric"><span className="np-metric-label">Life-to-date expense</span><strong title={fullCurrency.format(k.ltd)}>{usd(k.ltd)}</strong><div className="np-metric-foot"><span>{percent(spent)} recognized</span><Trend values={spark.spend} label="Monthly actual spend over the selected lookback"/></div></div>
            <div className="np-metric"><span className="np-metric-label">EAC variance</span><strong className={k.variance <= 0 ? 'np-good' : 'np-bad'} title={fullCurrency.format(k.variance)}>{signed(k.variance)}</strong><span className="np-metric-foot">vs current budget</span></div>
            <div className="np-metric"><span className="np-metric-label">CRO variance</span><strong className={k.croVariance <= 0 ? 'np-good' : 'np-bad'} title={fullCurrency.format(k.croVariance)}>{signed(k.croVariance)}</strong><span className="np-metric-foot">Invoiced vs accrued</span></div>
            <div className="np-metric np-metric--enrollment"><span className="np-metric-label">Patients enrolled</span><div className="np-enrollment-total"><strong>{number.format(enrolled)} <small>/ {number.format(target)}</small></strong><span className="np-metric-tag">{percent(enrollment)}</span></div><div className="np-metric-foot"><span>Enrollment target</span><Trend values={spark.enroll} label="Monthly actual enrollment over the selected lookback"/></div></div>
        </div>
    </div>;
}

type Sort = 'program' | 'eac' | 'variance';
function Status({ study }: { study: StudyRow }) {
    return <span className={`np-status np-status--${study.status.toLowerCase().replace(/[^a-z]/g, '-')}`}><i/>{study.status || 'Unspecified'}</span>;
}
function StudyDetail({ study }: { study: StudyRow }) {
    return <div className="np-study-detail">
        <dl className="np-study-facts">
            <div><dt>Monthly burn</dt><dd>{usd(study.burnRate)}</dd></div>
            <div><dt>To last patient visit</dt><dd>{study.monthsToLplv > 0 ? <>{study.monthsToLplv} <small>months</small></> : '—'}</dd></div>
            <div><dt>Cost recognized</dt><dd>{percent(study.pctComplete)} <small>· {usd(study.ltd)}</small></dd></div>
            <div><dt>Enrollment</dt><dd>{number.format(study.enrolled)} <small>/ {number.format(study.target)}</small></dd></div>
        </dl>
        <div className="np-vendor-heading"><span>Vendor allocation</span><span>{study.vendors.length} {study.vendors.length === 1 ? 'vendor' : 'vendors'}</span></div>
        {study.vendors.length ? <table className="np-vendor-table"><thead><tr><th scope="col">Vendor</th><th scope="col">Budget</th><th scope="col">EAC</th><th scope="col">Variance</th></tr></thead><tbody>{study.vendors.map((vendor, index) => <tr key={`${vendor.vendor}-${index}`}><th scope="row"><span className="np-vendor-initial" aria-hidden="true">{(vendor.vendor || '?').charAt(0)}</span>{vendor.vendor || 'Unassigned vendor'}</th><td title={fullCurrency.format(vendor.budget)}>{usd(vendor.budget)}</td><td title={fullCurrency.format(vendor.eac)}>{usd(vendor.eac)}</td><td className={vendor.variance <= 0 ? 'np-good' : 'np-bad'} title={fullCurrency.format(vendor.variance)}>{signed(vendor.variance)}</td></tr>)}</tbody></table> : <p className="np-empty">No vendor allocation for this study.</p>}
    </div>;
}

export function NativePortfolio({ portfolio, onStudySelect }: { portfolio: ProgramRow[]; onStudySelect: (study: StudyRow) => void }) {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<Sort>('program');
    const [selected, setSelected] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    useEffect(() => { setSelected(null); setExpanded({}); }, [portfolio]);
    const totalCount = portfolio.reduce((sum, program) => sum + program.studies.length, 0);
    const groups = useMemo(() => {
        const query = search.trim().toLowerCase();
        return portfolio.map(program => ({ ...program, studies: program.studies.filter(study => `${study.study} ${study.program} ${study.phase} ${study.status} ${study.vendors.map(vendor => vendor.vendor).join(' ')}`.toLowerCase().includes(query)).sort((a, b) => sort === 'eac' ? b.eac - a.eac : sort === 'variance' ? b.variance - a.variance : 0) })).filter(program => program.studies.length);
    }, [portfolio, search, sort]);
    const visible = groups.flatMap(program => program.studies);
    const totals = visible.reduce((sum, study) => ({ eac: sum.eac + study.eac, budget: sum.budget + study.budget, variance: sum.variance + study.variance }), { eac: 0, budget: 0, variance: 0 });
    function select(study: StudyRow) { setSelected(study.study); onStudySelect(study); }
    function toggle(study: StudyRow) { select(study); setExpanded(previous => ({ ...previous, [study.study]: !previous[study.study] })); }
    return <div className="np-portfolio">
        <div className="np-portfolio-toolbar">
            <div className="np-study-count"><strong>{visible.length}</strong> {visible.length === 1 ? 'study' : 'studies'} <span>in {groups.length} {groups.length === 1 ? 'program' : 'programs'}</span></div>
            <div className="np-portfolio-tools"><label className="np-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m12.5 12.5 4 4"/></svg><input type="search" aria-label="Search studies and vendors" placeholder="Search studies or vendors" value={search} onChange={event => setSearch(event.target.value)}/></label><select aria-label="Sort studies within each program" value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="program">Program order</option><option value="eac">Largest EAC</option><option value="variance">Highest variance</option></select></div>
        </div>
        <div className="np-table-scroll"><table className="np-study-table"><colgroup><col className="np-col-study"/><col className="np-col-status"/><col className="np-col-enrollment"/><col className="np-col-budget"/><col className="np-col-eac"/><col className="np-col-variance"/></colgroup><thead><tr><th scope="col">Study</th><th scope="col" className="np-status-cell">Status</th><th scope="col" className="np-enrollment-cell">Enrollment</th><th scope="col">Budget</th><th scope="col">EAC</th><th scope="col">Variance</th></tr></thead>
            {groups.map(program => {
                const summary = program.studies.reduce((sum, study) => ({ eac: sum.eac + study.eac, budget: sum.budget + study.budget, variance: sum.variance + study.variance }), { eac: 0, budget: 0, variance: 0 });
                return <tbody key={program.program}><tr className="np-program-row"><th scope="rowgroup" colSpan={3}><span className="np-program-marker"/>{program.program}<small>{program.studies.length}</small></th><td title={fullCurrency.format(summary.budget)}>{usd(summary.budget)}</td><td title={fullCurrency.format(summary.eac)}>{usd(summary.eac)}</td><td className={summary.variance <= 0 ? 'np-good' : 'np-bad'}>{signed(summary.variance)}</td></tr>{program.studies.map(study => <Fragment key={study.study}>
                    <tr className={`np-study-row${selected === study.study ? ' is-selected' : ''}`} onClick={() => toggle(study)}>
                        <th scope="row"><button className="np-study-button" aria-expanded={!!expanded[study.study]} onClick={event => { event.stopPropagation(); toggle(study); }}><svg className={expanded[study.study] ? 'is-expanded' : ''} viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg><span>{study.study}<small>{study.phase}</small></span></button></th>
                        <td className="np-status-cell"><Status study={study}/></td>
                        <td className="np-enrollment-cell"><span className="np-enrollment-value">{number.format(study.enrolled)} <small>/ {number.format(study.target)}</small></span><span className="np-enrollment-track"><span style={{ width: `${bounded(study.target ? study.enrolled / study.target : 0)}%` }}/></span></td>
                        <td title={fullCurrency.format(study.budget)}>{usd(study.budget)}</td><td className="np-eac-cell" title={fullCurrency.format(study.eac)}>{usd(study.eac)}</td><td title={fullCurrency.format(study.variance)}><span className={study.variance <= 0 ? 'np-good' : 'np-bad'}>{signed(study.variance)}</span><small className="np-variance-percent">{study.budget ? percent(study.variance / study.budget) : '—'}</small></td>
                    </tr>
                    {expanded[study.study] && <tr className="np-study-expansion"><td colSpan={6}><StudyDetail study={study}/></td></tr>}
                </Fragment>)}</tbody>;
            })}
            {visible.length > 0 && <tfoot><tr><th scope="row" colSpan={3}>{search ? 'Matching studies' : 'Portfolio total'}<small>{visible.length} of {totalCount} studies</small></th><td title={fullCurrency.format(totals.budget)}>{usd(totals.budget)}</td><td title={fullCurrency.format(totals.eac)}>{usd(totals.eac)}</td><td className={totals.variance <= 0 ? 'np-good' : 'np-bad'}>{signed(totals.variance)}</td></tr></tfoot>}
        </table></div>
        {!visible.length && <div className="np-search-empty"><strong>{search ? 'No studies found' : 'No studies in this selection'}</strong><p>{search ? 'Try a study, program, or vendor name.' : 'Change the filters to see more studies.'}</p>{search && <button onClick={() => setSearch('')}>Clear search</button>}</div>}
        <div className="np-portfolio-footer"><span><i/>Select a study to inspect costs and open its review.</span><span>USD · lifetime estimates</span></div>
    </div>;
}
