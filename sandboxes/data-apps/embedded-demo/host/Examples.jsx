import React, { useState } from 'react';
import { SdkBoundary } from './useSdk.jsx';
import './examples.css';

const statusLabel = { available: 'Available today', proposed: 'Proposed · runs from a branch', gap: 'Gap · not possible today' };

export function ExampleStatus({ status }) {
  return <span className="example-status" data-status={status}><i/>{statusLabel[status]}</span>;
}

// One example is mounted at a time. The released SDK keeps one embed token for
// the page, so two live SDK examples cannot share it.
export function Examples({ label, examples, active }) {
  const [selected, setSelected] = useState(examples[0].id);
  const example = examples.find(item => item.id === selected) || examples[0];
  return <section className="examples" aria-label={label}>
    <nav className="examples-list" aria-label={`${label} list`}>
      <p className="examples-list-title">{label}</p>
      {examples.map(item => <button key={item.id} type="button" aria-current={item.id === example.id ? 'true' : undefined} onClick={() => setSelected(item.id)}>
        <i data-status={item.status}/><span>{item.name}</span></button>)}
    </nav>
    <div className="examples-body">
      <header className="examples-head"><div><h3>{example.name}</h3><p>{example.summary}</p></div><ExampleStatus status={example.status}/></header>
      <div className="examples-panes">
        <div className="code-example examples-code"><div className="code-heading"><span>{example.file}</span><span>{example.source}</span></div><pre aria-label={`${example.name} code`}>{example.code}</pre></div>
        <div className="examples-preview" data-status={example.status}>
          {example.status === 'gap'
            ? <div className="examples-gap"><p className="examples-gap-title">Why this does not run</p><p>{example.why}</p><p className="examples-gap-title">What to build</p><p>{example.build}</p></div>
            : active ? <SdkBoundary key={example.id} label={example.name}>{example.render()}</SdkBoundary> : null}
        </div>
      </div>
    </div>
  </section>;
}
