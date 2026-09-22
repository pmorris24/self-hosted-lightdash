// Drag-and-drop field shelves for the Spend pivot widget — dimensions move
// between Rows/Columns, measures move into Values, everything unused sits in
// the Available tray. This is the "dynamic" half of the dynamic pivot table.
import { useState } from 'react';
import {
  ALL_DIMS, ALL_VALUES, DIM_LABEL, VAL_LABEL, DEFAULT_LAYOUT,
  type DimKey, type ValKey, type PivotLayout,
} from '../data/pivot';

type Shelf = 'available' | 'rows' | 'cols' | 'values';
type OrderShelf = 'rows' | 'cols' | 'values';

const isDim = (key: string): key is DimKey => (ALL_DIMS as string[]).includes(key);

export function PivotFieldControls({ layout, onChange }: { layout: PivotLayout; onChange: (l: PivotLayout) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const placedDims = new Set<string>([...layout.rows, ...layout.cols]);
  const placedVals = new Set<string>(layout.values);
  const available = [
    ...ALL_DIMS.filter((d) => !placedDims.has(d)),
    ...ALL_VALUES.filter((v) => !placedVals.has(v)),
  ];

  const move = (field: string, to: Shelf) => {
    const dim = isDim(field);
    if (dim && to === 'values') return;
    if (!dim && (to === 'rows' || to === 'cols')) return;
    const next: PivotLayout = {
      rows: layout.rows.filter((f) => f !== field),
      cols: layout.cols.filter((f) => f !== field),
      values: layout.values.filter((f) => f !== field),
    };
    if (to === 'rows') next.rows.push(field as DimKey);
    if (to === 'cols') next.cols.push(field as DimKey);
    if (to === 'values') next.values.push(field as ValKey);
    onChange(next);
  };

  const reorder = (shelf: OrderShelf, from: number, dir: -1 | 1) => {
    const arr = [...layout[shelf]] as string[];
    const to = from + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[from], arr[to]] = [arr[to], arr[from]];
    onChange({ ...layout, [shelf]: arr } as PivotLayout);
  };

  const label = (field: string) => (isDim(field) ? DIM_LABEL[field as DimKey] : VAL_LABEL[field as ValKey]);

  const chip = (field: string, shelf: Shelf, idx?: number, count?: number) => (
    <span
      key={field}
      className={`pv-chip pv-chip--${isDim(field) ? 'dim' : 'val'}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', field); setDragging(field); }}
      onDragEnd={() => setDragging(null)}
      title={shelf === 'available' ? `Drag ${label(field)} into Rows, Columns or Values` : label(field)}
    >
      {label(field)}
      {shelf !== 'available' && idx != null && count != null && count > 1 && (
        <span className="pv-chip__ord">
          <button type="button" disabled={idx === 0} onClick={() => reorder(shelf as OrderShelf, idx, -1)}>‹</button>
          <button type="button" disabled={idx === count - 1} onClick={() => reorder(shelf as OrderShelf, idx, 1)}>›</button>
        </span>
      )}
      {shelf !== 'available' && (
        <button type="button" className="pv-chip__x" title="Remove" onClick={() => move(field, 'available')}>×</button>
      )}
    </span>
  );

  const shelfBlock = (id: Shelf, title: string, hint: string, fields: string[]) => (
    <div
      className={`pv-shelf${dragging && !(isDim(dragging) ? id === 'values' : id === 'rows' || id === 'cols') ? ' is-target' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.getData('text/plain') || dragging; if (f) move(f, id); }}
    >
      <div className="pv-shelf__head">{title}<span className="pv-shelf__hint">{hint}</span></div>
      <div className="pv-shelf__body">
        {fields.length === 0 && <span className="pv-shelf__empty">Drop a field here</span>}
        {fields.map((f, i) => chip(f, id, i, fields.length))}
      </div>
    </div>
  );

  return (
    <div className="pv-controls">
      {shelfBlock('available', 'Available fields', 'unused', available)}
      <div className="pv-shelves">
        {shelfBlock('rows', 'Rows', 'dimensions', layout.rows)}
        {shelfBlock('cols', 'Columns', 'dimensions', layout.cols)}
        {shelfBlock('values', 'Values', 'measures', layout.values)}
      </div>
      <button type="button" className="pv-reset" onClick={() => onChange(DEFAULT_LAYOUT)}>Reset layout</button>
    </div>
  );
}
