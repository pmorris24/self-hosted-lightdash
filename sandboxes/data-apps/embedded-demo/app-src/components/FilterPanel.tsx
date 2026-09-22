// Left governed-filter panel — direct port of the embed app's FilterPanel.
// Condor-style multi-select: a bordered box showing the selected values as
// removable chips (first few + "+ N more"), with a clear-× and a chevron that
// opens a checkbox dropdown. Selections become server-side Lightdash filters.
import { useEffect, useRef, useState } from 'react';
import type { Filters } from '../data/useFpaData';

export type FilterOptions = { programs: string[]; phases: string[]; statuses: string[] };

const CHIP_LIMIT = 5;

function MultiSelect({ label, options, selected, placeholder, onToggle, onClear, onSelectAll }: {
  label: string;
  options: string[];
  selected: string[];
  placeholder: string;
  onToggle: (v: string) => void;
  onClear: () => void;
  onSelectAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const shown = expanded ? selected : selected.slice(0, CHIP_LIMIT);
  const extra = selected.length - shown.length;

  return (
    <div className="fsel" ref={ref}>
      <div className="fsel__labelrow">
        <span className="fsel__label">{label}</span>
        <span className="fsel__count">{selected.length}/{options.length}</span>
      </div>
      <div className={`fsel__box${open ? ' is-open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <div className="fsel__chips">
          {selected.length === 0 && <span className="fsel__placeholder">{placeholder}</span>}
          {shown.map((v) => (
            <span key={v} className="fsel__chip">
              {v}
              <button
                className="fsel__chip-x"
                aria-label={`Remove ${v}`}
                onClick={(e) => { e.stopPropagation(); onToggle(v); }}
              >×</button>
            </span>
          ))}
          {extra > 0 && (
            <button className="fsel__more" onClick={(e) => { e.stopPropagation(); setExpanded(true); }}>
              + {extra} more
            </button>
          )}
        </div>
        <div className="fsel__ctrls">
          {selected.length > 0 && (
            <button
              className="fsel__clear"
              aria-label={`Clear ${label}`}
              onClick={(e) => { e.stopPropagation(); setExpanded(false); onClear(); }}
            >×</button>
          )}
          <svg className={`fsel__chev${open ? ' is-open' : ''}`} width="10" height="6" viewBox="0 0 10 6">
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {open && (
        <div className="fsel__menu">
          <div className="fsel__menu-actions">
            <button onClick={onSelectAll}>Select all</button>
            <button onClick={() => { setExpanded(false); onClear(); }}>Clear</button>
          </div>
          {options.map((v) => {
            const on = selected.includes(v);
            return (
              <button key={v} className={`fsel__opt${on ? ' is-on' : ''}`} onClick={() => onToggle(v)}>
                <span className="fsel__check">{on ? '✓' : ''}</span>
                {v}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FilterPanel({ filters, options, onChange }: {
  filters: Filters;
  options: FilterOptions;
  onChange: (f: Filters) => void;
}) {
  type FacetKey = 'programs' | 'phases' | 'statuses' | 'vendors';
  const toggle = (key: FacetKey, val: string) => {
    const cur = filters[key];
    onChange({ ...filters, [key]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] });
  };
  const clearKey = (key: FacetKey) => onChange({ ...filters, [key]: [] });
  const atDefault =
    filters.programs.length === options.programs.length &&
    filters.phases.length === options.phases.length &&
    filters.statuses.length === options.statuses.length &&
    filters.vendors.length === 0;

  return (
    <aside className="filters">
      <div className="filters__head">
        <div className="filters__title">Filters</div>
        <button
          className="filters__clear"
          disabled={atDefault}
          onClick={() => onChange({
            ...filters, // keeps the reporting period — resetting facets isn't leaving time travel
            programs: [...options.programs],
            phases: [...options.phases],
            statuses: [...options.statuses],
            vendors: [],
          })}
        >
          Reset filters
        </button>
      </div>
      <div className="filters__body">
        <MultiSelect
          label="Programs" options={options.programs} selected={filters.programs}
          placeholder="All programs" onToggle={(v) => toggle('programs', v)} onClear={() => clearKey('programs')}
          onSelectAll={() => onChange({ ...filters, programs: [...options.programs] })}
        />
        <MultiSelect
          label="Phases" options={options.phases} selected={filters.phases}
          placeholder="All phases" onToggle={(v) => toggle('phases', v)} onClear={() => clearKey('phases')}
          onSelectAll={() => onChange({ ...filters, phases: [...options.phases] })}
        />
        <MultiSelect
          label="Study status" options={options.statuses} selected={filters.statuses}
          placeholder="All statuses" onToggle={(v) => toggle('statuses', v)} onClear={() => clearKey('statuses')}
          onSelectAll={() => onChange({ ...filters, statuses: [...options.statuses] })}
        />
        {filters.vendors.length > 0 && (
          <MultiSelect
            label="Vendors" options={filters.vendors} selected={filters.vendors}
            placeholder="All vendors" onToggle={(v) => toggle('vendors', v)} onClear={() => clearKey('vendors')}
            onSelectAll={() => {}}
          />
        )}
      </div>
      <div className="filters__foot">
        <span className="filters__foot-dot" /> Governed · filters applied server-side
      </div>
    </aside>
  );
}
