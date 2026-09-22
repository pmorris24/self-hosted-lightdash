import React from 'react';
import './narrative.css';

const creationSteps = [
  ['Create in Lightdash Data Apps', 'Describe the app. The builder uses the shared component contract and governed queries from the start.'],
  ['Preview, edit, and publish', 'Validate the component contract. Release compatible versions for Lightdash and external React hosts.'],
  ['Compose inside your product', 'Use the whole app or arrange its components beside your own controls. Connect them through shared state and events.'],
];

const deliverySteps = [
  ['Publish in Lightdash', 'Start with a ready source version.'],
  ['Build the native release', 'Compile once. Store the module and scoped CSS.'],
  ['Mount in the React host', 'Download finished assets. Query live Lightdash data.'],
];

export function BuilderWorkflow() {
  return (
    <section className="narrative narrative-section" id="proposal-workflow" aria-labelledby="narrative-workflow-title">
      <div className="narrative-heading">
        <div><p className="narrative-label">Create with the same component model</p><h2 id="narrative-workflow-title">Generate it once.<br/><span>Embed it where it belongs.</span></h2></div>
        <div className="narrative-copy"><p>Make the Compose SDK contract part of Data Apps creation. Each app would declare its components, data, properties, events, and theme.</p><p>The updated starter template includes a shared provider and component exports from the first build. This branch includes the template. The hosted builder still needs to adopt it.</p></div>
      </div>
      <ol className="narrative-steps">{creationSteps.map(([title,copy],index)=><li key={title}><span className="narrative-step-number" aria-hidden="true">{index+1}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol>
      <div className="narrative-contract"><span>One publication contract</span><strong>Lightdash view</strong><span aria-hidden="true">+</span><strong>Native React exports</strong><p>The same source. A complete app or reusable parts.</p></div>
    </section>
  );
}

export function PublicationFlow() {
  return (
    <section className="narrative narrative-section narrative-delivery" id="proposal-delivery" aria-labelledby="narrative-delivery-title">
      <div className="narrative-heading">
        <div><p className="narrative-label">How delivery works</p><h2 id="narrative-delivery-title">Build before<br/>the viewer arrives.</h2></div>
        <div className="narrative-copy"><p>A separate publisher compiles the ready Lightdash version, uploads its module and styles, then marks the release complete. The viewer only reads finished files.</p><p>The publisher endpoint is ready. An automatic Lightdash publish trigger still needs an external scheduled job or a product integration.</p></div>
      </div>
      <ol className="narrative-delivery-flow">{deliverySteps.map(([title,copy],index)=><li key={title}><span className="narrative-step-number" aria-hidden="true">{index+1}</span><div><h3>{title}</h3><p>{copy}</p></div>{index<deliverySteps.length-1&&<span className="narrative-flow-arrow" aria-hidden="true">→</span>}</li>)}</ol>
    </section>
  );
}

export function ProductEvidence() {
  return (
    <section className="narrative narrative-section narrative-evidence" id="proposal-evidence" aria-labelledby="narrative-evidence-title">
      <div className="narrative-heading"><div><p className="narrative-label">From proof to product</p><h2 id="narrative-evidence-title">The core works.<br/><span>Make it a supported path.</span></h2></div><p className="narrative-copy">These examples demonstrate the proposed Compose SDK model. The next step is a supported API across Data Apps creation, publication, and React integration.</p></div>
      <div className="narrative-ledger">
        <div><div className="narrative-ledger-title"><span className="narrative-status-dot"/><h3>Built in this POC</h3></div><ul>
          <li>A whole React app and twelve independent component exports from the same Lightdash source.</li>
          <li>Embed-authenticated queries, shared filters, and shared themes.</li>
          <li>A shared React runtime, scoped styles, component selection, and a direct study-selection event.</li>
          <li>Prebuilt, versioned native releases in persistent storage.</li>
          <li>An experimental DataApp adapter in the existing React SDK, plus a starter template with an explicit component contract.</li>
        </ul></div>
        <div><div className="narrative-ledger-title"><span className="narrative-status-dot proposed"/><h3>Proposed product work</h3></div><ul>
          <li>Native artifacts as part of every Lightdash publish.</li>
          <li>Adopt the component-contract template in the hosted Data Apps builder. Connect it to the existing React SDK where token support allows.</li>
          <li>Support the composition API: shared providers, component properties, events, themes, and compatibility checks. Extend it to more component types.</li>
          <li>Managed versions, review, and rollback.</li>
        </ul></div>
      </div>
    </section>
  );
}

export function ProposalDecision() {
  return <div className="proposal-closing narrative" aria-label="The product decision">
    <section className="narrative-decision" id="proposal-decision" aria-labelledby="narrative-decision-title">
      <p className="narrative-label">The decision</p>
      <h2 id="narrative-decision-title">Build a Compose SDK<br/><span>for Data Apps.</span></h2>
      <div className="narrative-decision-body"><p>Extend our React and query SDKs with a supported composition model for Data Apps. Customers could create an app and use its parts across their product.</p><p>Use that same model in the Data Apps builder from the first build. Keep governed queries in Lightdash as developers control layouts and workflows.</p></div>
      <div className="narrative-next-step"><span>Start here</span><strong>Charts. Filters. Layouts. Selection events.</strong><p>Validate the workflow with a design partner.</p></div>
    </section>

    <details className="narrative-scope"><summary><span>Scope and tradeoffs</span><span className="narrative-disclosure" aria-hidden="true">+</span></summary><div className="narrative-scope-content">
      <p>A native module shares the host’s JavaScript environment. The host must trust its code. CSS scoping is not a security sandbox. Faster loading is a test objective, not a proven result.</p>
      <p>The POC exports a whole app and twelve reusable components from published source. The component workspace shares the host’s React runtime. A general component editor, saved-chart access through app embed tokens, and managed package releases remain product work.</p>
      <p>The category reference is Sisense’s iframe and Compose SDK distinction: developer control and composability. This POC does not claim feature parity.</p>
    </div></details>
  </div>;
}
