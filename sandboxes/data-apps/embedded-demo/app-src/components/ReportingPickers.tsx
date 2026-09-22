import { useEffect, useRef, useState } from 'react';
import type { MonthRange } from '../data/useFpaData';

const asOfNow = () => new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date());
const fmtMonth = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(y, mm - 1, 1));
};

// Condor-style reporting-period control: pick a close month and the whole
// dashboard re-renders as it stood at that close — actuals through the month,
// forecast after it. Forward months replay the plan as if it had landed.
export function AsOfPicker({ range, value, onChange }: {
  range: MonthRange | null; value: string | null; onChange: (m: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('.is-on')?.scrollIntoView({ block: 'center' });
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!range || !range.anchor) return <span className="asof__date">As of {asOfNow()}</span>;
  const current = value ?? range.anchor;
  const timeTravel = current !== range.anchor;

  return (
    <div className={`asof-pick dsel${timeTravel ? ' is-tt' : ''}`} ref={ref}>
      <button
        className="dpill"
        title="Reporting period — view the portfolio as it stood at any month-end close"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dpill__label">As of</span>
        <span className="dpill__value">
          {fmtMonth(current)}
          <svg className={`dpill__chev${open ? ' is-open' : ''}`} width="10" height="6" viewBox="0 0 10 6">
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {timeTravel && (
        <button className="asof-pick__reset" title="Return to the live close" onClick={() => onChange(null)}>
          ↺ Current close
        </button>
      )}
      {open && (
        <div className="asof-pick__menu" ref={menuRef}>
          {[...range.months].reverse().map((m) => (
            <button
              key={m}
              className={`asof-pick__opt${m === current ? ' is-on' : ''}`}
              onClick={() => { onChange(m === range.anchor ? null : m); setOpen(false); }}
            >
              {fmtMonth(m)}
              {m === range.anchor
                ? <span className="asof-pick__opt-tag">current close</span>
                : m > range.anchor
                  ? <span className="asof-pick__opt-tag">projected</span>
                  : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact header dropdown matching the AS OF pill — used for the Lookback and
// Horizon window controls.
export function PillSelect({ label, value, options, format, onChange }: {
  label: string; value: number | null; options: (number | null)[];
  format: (v: number | null) => string; onChange: (v: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="dsel" ref={ref}>
      <button className="dpill" onClick={() => setOpen((o) => !o)} title={`${label} — months shown around the reporting close`}>
        <span className="dpill__label">{label}</span>
        <span className="dpill__value">
          {format(value)}
          <svg className={`dpill__chev${open ? ' is-open' : ''}`} width="10" height="6" viewBox="0 0 10 6">
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="dsel__menu">
          {options.map((o) => (
            <button key={String(o)} className={`dsel__opt${o === value ? ' is-on' : ''}`}
              onClick={() => { onChange(o); setOpen(false); }}>
              {format(o)}{o === value ? <span>✓</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

