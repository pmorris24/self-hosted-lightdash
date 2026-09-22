import React, { useState } from 'react';
import { DataAppsStep, Status } from './ladder.jsx';
import { useSdk } from './useSdk.jsx';
import { Examples } from './Examples.jsx';
import { composeExamples } from './examples-compose.jsx';
import './compose-intro.css';

const built = [
  ['Released', 'Lightdash.Chart', 'One saved chart as one React component. Its token reads that chart and nothing else.'],
  ['Released', 'useLightdashContent', 'An SDK hook that lists the charts, dashboards, and spaces a viewer can use, so a product can offer a picker.'],
  ['This branch', 'Embed code on every chart tile', 'A tile menu item opens the iframe, React SDK, and server signing code for that chart, filled in. It warns when the chart is not on the allow list.'],
  ['This branch', 'Widget catalog', 'Browse saved charts by type, space, and verification, with live previews, and add them as tiles.'],
  ['This branch', 'Content API filters', 'chartKinds, verifiedOnly, and descendant spaces on the content API. They make the catalog and any host picker correct across pages.'],
];

export function ReviewNotes() {
  const [notes, setNotes] = useState([{ id: 1, text: 'Ask Atlas Clinical for the Q3 invoice backup.', done: false }]);
  const [draft, setDraft] = useState('');
  return <section className="compose-host-panel" aria-label="Review notes, a host component">
    <header><span>Review notes</span><code>Your component</code></header>
    <ul>{notes.map(note => <li key={note.id}><label><input type="checkbox" checked={note.done} onChange={() => setNotes(all => all.map(item => item.id === note.id ? { ...item, done: !item.done } : item))}/><span data-done={note.done || undefined}>{note.text}</span></label></li>)}</ul>
    <form onSubmit={event => { event.preventDefault(); if (!draft.trim()) return; setNotes(all => [...all, { id: Date.now(), text: draft.trim(), done: false }]); setDraft(''); }}>
      <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Add a note for the budget owner" aria-label="New review note"/><button className="button" type="submit">Add</button>
    </form>
  </section>;
}

export function BudgetDecision() {
  const [decision, setDecision] = useState('open');
  const options = [['open', 'Open'], ['hold', 'Hold spend'], ['approve', 'Approve reforecast']];
  return <section className="compose-host-panel" aria-label="Budget decision, a host component">
    <header><span>Budget decision</span><code>Your component</code></header>
    <div className="compose-decision" role="radiogroup" aria-label="Decision">{options.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={decision === value} onClick={() => setDecision(value)}>{label}</button>)}</div>
    <p className="compose-decision-note">{decision === 'open' ? 'No decision recorded.' : decision === 'hold' ? 'Spend is on hold until the variance review.' : 'Reforecast approved for the next cycle.'}</p>
  </section>;
}

export function ComposeIntro({ demo, active, controls }) {
  const { sdk, error } = useSdk();
  return <>
    <header className="iframe-intro compose-intro-head"><div><p className="section-kicker">The composition approach</p><h1>Lightdash charts, placed by your product.</h1><Status released>Released today</Status></div><p>A dashboard is one block. Composition is smaller: <code>Lightdash.Chart</code> renders one saved chart, and your product builds the page around it. The layout, the navigation, and the panels between the charts are yours.</p></header>
    {error && <p className="notice error" role="alert">{error}</p>}
    <Examples label="Compose examples" examples={composeExamples(demo, sdk, controls)} active={active}/>

    <section className="sdk-argument" aria-labelledby="compose-benefits-title">
      <div><p className="section-kicker">Why compose</p><h2 id="compose-benefits-title">The page is yours. The numbers are governed.</h2>
        <ul>
          <li><b>Your layout.</b> A chart goes where the decision is made, beside your own notes, forms, and navigation.</li>
          <li><b>One definition of each metric.</b> The chart is the saved chart: the same query, the same permissions, the same figures as in Lightdash.</li>
          <li><b>Take only what you need.</b> One token reads one chart. A page asks for the chart it needs, not a whole dashboard.</li>
          <li><b>Analysts keep ownership.</b> They change the chart in Lightdash, and every page that places it follows.</li>
        </ul>
      </div>
      <div><p className="section-kicker sdk-gap-kicker">Where it stops</p><h2>Each chart is an island</h2>
        <ul>
          <li><b>One token for the page.</b> The released SDK keeps one embed token for the whole page. A second chart with its own token overwrites the first, so this example places one chart. We found this while we built this page.</li>
          <li><b>No shared state or events.</b> <code>Lightdash.Chart</code> takes no <code>filters</code> prop, and a selection in the chart cannot update your own panels.</li>
          <li><b>Charts only.</b> Tables of actions, forms, and scenario controls are not saved charts. Your team builds them again for each product.</li>
        </ul>
      </div>
    </section>

    <section className="compose-built" aria-labelledby="compose-built-title">
      <p className="section-kicker">What we built</p><h2 id="compose-built-title">What makes Lightdash content composable.</h2>
      <ol>{built.map(([status, name, text]) => <li key={name}><span className="compose-built-status" data-released={status === 'Released' || undefined}>{status}</span><h3>{name}</h3><p>{text}</p></li>)}</ol>
    </section>

    <DataAppsStep title="Compose with the app's own components." status={<Status>Proposed · runs from a branch</Status>}>
      <p>A <b>Data App</b> already has what single charts lack. Its components share one provider, so one filter drives all of them and a selection in one can update another. Its forms and controls are components too.</p>
      <p>The natural next step is to let a product place those components one by one, in its own layout, the way it places charts today. That is the Compose SDK for Data Apps. Everything below runs live from the published app.</p>
    </DataAppsStep>
  </>;
}
