import React, { useEffect, useState } from 'react';
import { DataApp } from '../runtime/vendor/lightdash-sdk-data-app.js';
import { ActionComposer, VendorAction, ReviewQueue } from './WorkflowActions.jsx';
import './proof.css';
import { BuilderWorkflow, PublicationFlow, ProductEvidence } from './ProposalNarrative.jsx';

const componentNames=['PortfolioSummary','AttentionItems','BudgetByStatus','VendorVariance','ProgramFinancials','StudyList','Forecast','Milestones','BudgetActualForecast','SpendPivot','Sites'];
const labels={PortfolioSummary:'Portfolio metrics',AttentionItems:'Attention items',BudgetByStatus:'Budget exposure',VendorVariance:'Vendor variance',ProgramFinancials:'Study financials',StudyList:'Study directory',Forecast:'Scenario planning',Milestones:'Milestone forecast',BudgetActualForecast:'Budget and actuals',SpendPivot:'Spend pivot',Sites:'Site performance'};
const dollars=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
function SectionHeading({label,title,description,children}) {
  return <header className="section-heading">
    <div className="section-intro">
      <p className="section-kicker">{label}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
    {children}
  </header>;
}
function ProposalProof({source,state,target,children,pattern,signal,active=false}) {
  return <div className={`proposal-proof ${active?'has-context':''}`}>
    <div className="proof-rail" aria-label="How the native components connect">
      <div className="proof-node">
        <span className="proof-label">Lightdash component</span>
        <strong>{source}</strong>
      </div>
      <div className="proof-node proof-state">
        <span className="proof-label">Shared React state</span>
        <strong>{state}</strong>
      </div>
      <div className="proof-node">
        <span className="proof-label">Your product</span>
        <strong>{target}</strong>
      </div>
    </div>
    <div className="proof-context">
      <p>{children}</p>
      {signal&&<span className="proof-signal" role="status"><i aria-hidden="true"/>{signal}</span>}
    </div>
    <details>
      <summary>View React pattern <span aria-hidden="true">+</span></summary>
      <pre><code>{pattern}</code></pre>
    </details>
  </div>;
}
function WorkspaceProvider({release,providerProps,children}) {
  return release?<DataApp key={release.generation} module={release.module} providerProps={providerProps}>{children}</DataApp>:children;
}
function goToStudies(){document.getElementById('section-portfolio')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
export function ComponentWorkspace({demo,controls}) {
  const [excluded,setExcluded]=useState([]),[customize,setCustomize]=useState(false),[copied,setCopied]=useState(false);
  const [selected,setSelected]=useState(null),[dataState,setDataState]=useState({ready:false,error:false});
  const [actions,setActions]=useState(()=>{try{const saved=JSON.parse(sessionStorage.getItem('lightdash-demo-reviews')||sessionStorage.getItem('meridian-reviews')||'[]');return Array.isArray(saved)?saved.filter(item=>item&&typeof item.id==='string'&&typeof item.subject==='string'):[];}catch{return [];}});
  useEffect(()=>{try{sessionStorage.setItem('lightdash-demo-reviews',JSON.stringify(actions));}catch{/* Reviews remain available in memory. */}},[actions]);
  useEffect(()=>setSelected(null),[demo.appFilters,demo.reactApp]);
  function saveAction(action){setActions(previous=>[{...action,id:crypto.randomUUID(),done:false},...previous.filter(item=>!(item.subject===action.subject&&item.kind===action.kind))]);}
  const release=demo.reactApp,widgets=release?.module.components;
  const compatible=widgets&&['ReportingControls',...componentNames].every(name=>typeof widgets[name]==='function');
  function widget(name){if(excluded.includes(name))return null;const Widget=widgets[name];return <div className={`native-widget widget-${name}`} data-component={name}><Widget/></div>;}
  const queue=<ReviewQueue actions={actions} onToggle={id=>setActions(previous=>previous.map(action=>action.id===id?{...action,done:!action.done}:action))} onRemove={id=>setActions(previous=>previous.filter(action=>action.id!==id))} onPortfolio={goToStudies}/>;
  const code=`import { DataApp } from '@lightdash/sdk/data-app';

const { ProgramFinancials, VendorVariance } = publishedApp.components;

<DataApp module={publishedApp} providerProps={{
  connection, filters, colorScheme: theme,
  onFiltersChange: setFilters,
  onStudySelect: setSelectedStudy, onState: setDataState
}}>
  <div className="study-workspace">
    <ProgramFinancials />
    <StudyReview study={selectedStudy} onSave={saveReview} />
  </div>
  <VendorVariance />
  <VendorFollowUp vendors={filters.vendors} onSave={saveReview} />
</DataApp>`;
  return <section className="native-workspace" id="components" aria-label="Clinical finance workspace">
    {!release&&<div className="workspace-skeleton" role="status"><span>Preparing your portfolio…</span><div/><div/><div/></div>}
    {release&&!compatible&&<p className="notice error" role="alert">This release is missing workspace components. Refresh after publication completes.</p>}
    <WorkspaceProvider release={compatible?release:null} providerProps={{connection:release?.connection,filters:demo.appFilters,colorScheme:demo.dark?'dark':'light',onStudySelect:setSelected,onState:setDataState,onFiltersChange:demo.updateAnalysisFilters}}>
      {compatible&&<div className="workspace-controls">{controls}<widgets.ReportingControls/></div>}
      {compatible&&<section id="section-overview" className="finance-section overview-section" aria-label="Portfolio overview">
        <div className="section-status"><span className="section-kicker">Clinical trial FP&A · Live product case</span><span className="data-status" role="status"><i className={dataState.ready?'ready':''}/>{dataState.error?'Data request failed':dataState.ready?'Live portfolio data':'Updating portfolio…'}</span></div>
        {widget('PortfolioSummary')}
        {widget('AttentionItems')}
      </section>}
      <BuilderWorkflow/>
      {compatible&&<section id="section-portfolio" className="finance-section" aria-label="Programs and studies">
        <SectionHeading label="Customer workflow" title="Put the chart beside the decision." description="A trial page can put governed financial data beside its own review controls. Select a study, assign an owner, and save the follow-up."><span className="section-detail">Try it: select a study <span aria-hidden="true">↓</span></span></SectionHeading>
        <ProposalProof source="Study financials" state="Selected study" target="Review & assign" active={Boolean(selected)} signal={selected?`${selected.study} linked to the review`:'Select a study to connect its financial context'} pattern={'<ProgramFinancials />\n<StudyReview study={selectedStudy} />\n\n// Provider callback\nonStudySelect: setSelectedStudy'}>Lightdash supplies the financial context. Your product connects that context to a decision, with its own fields, actions, and layout.</ProposalProof>
        <div className="study-layout"><div className="study-data">{widget('ProgramFinancials')}<details className="study-directory"><summary>Browse the study directory</summary>{widget('StudyList')}</details></div><aside className="study-review-panel" aria-label="Host study review"><div className="review-panel-heading"><span className="section-kicker">Study review</span><span className={`selection-indicator ${selected?'selected':''}`}>{selected?'Study linked':'Awaiting selection'}</span></div>
          {selected?<><h3>{selected.study}</h3><p className="review-program">{selected.program}</p><div className="study-tags"><span>{selected.phase}</span><span>{selected.status}</span></div><div className="review-financials"><div><span>Estimate at completion</span><strong>{dollars(selected.eac)}</strong></div><div><span>Current budget</span><strong>{dollars(selected.budget)}</strong></div><div className="review-enrollment"><span>Enrollment <b>{selected.enrolled} / {selected.target}</b></span><div><i style={{width:`${Math.min(100,selected.target?selected.enrolled/selected.target*100:0)}%`}}/></div></div></div><ActionComposer key={selected.study} subject={selected.study} kind="study" onSave={saveAction}/></>:<div className="review-start"><div className="review-illustration" aria-hidden="true"><span/><span/><span/><i>↗</i></div><h3>Every decision starts<br/>with the study.</h3><p>Select a row to bring its budget, forecast, and enrollment into this review.</p><div className="review-start-steps"><span><b>1</b>Select a study</span><span><b>2</b>Assign and add context</span><span><b>3</b>Track the follow-up</span></div></div>}
        </aside></div>
        <div className="review-queue-wrap">{queue}</div>
      </section>}
      <section className="integration-details integration-chapter" id="proposal-compose" aria-labelledby="integration-title"><div className="integration-content"><div><p className="section-kicker">The Compose SDK model</p><h2 id="integration-title">Analytics and actions,<br/>in the same React tree.</h2><p>Choose components from a published Data App. Put them beside your own React controls. A shared provider connects queries, filters, themes, and selection events.</p><button className="button" onClick={()=>setCustomize(!customize)} aria-expanded={customize}>Customize components</button>{customize&&<div className="composition-checkboxes">{componentNames.map(name=><label key={name}><input type="checkbox" checked={!excluded.includes(name)} onChange={event=>setExcluded(previous=>event.target.checked?previous.filter(value=>value!==name):[...previous,name])}/>{labels[name]}</label>)}<button className="text-button" onClick={()=>setExcluded([])}>Restore all components</button></div>}<p className="sdk-note">This POC uses an experimental adapter in the existing React SDK. The Compose SDK is the product proposal. Saved reviews stay in this browser tab.</p></div><div className="code-example"><div className="code-heading"><span>Study review · integration excerpt</span><button onClick={async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);}catch{setCopied(false);}}}>{copied?'Copied':'Copy code'}</button></div><pre aria-label="React integration code"><code>{code}</code></pre></div></div></section>
      {compatible&&<section id="section-exposure" className="finance-section" aria-label="Budget and vendor exposure"><SectionHeading label="Developer control" title="Connect analytics to product state." description="A chart selection can update the rest of your product. Select a vendor to connect the chart, portfolio filters, and follow-up form."/>
        <ProposalProof source="Vendor variance" state="Vendor filter" target="Create a follow-up" active={demo.appFilters.vendors.length===1} signal={demo.appFilters.vendors.length===1?`${demo.appFilters.vendors[0]} linked to the follow-up`:'Select one vendor to connect the follow-up'} pattern={'<VendorVariance />\n<VendorFollowUp vendors={filters.vendors} />\n\n// Provider callback\nonFiltersChange: setFilters'}>The chart and your form share React state through a defined event. Your product controls what happens after a selection.</ProposalProof>
        <div className="exposure-layout"><div className="analysis-surface">{widget('BudgetByStatus')}</div><div className="connected-surface"><div className="vendor-analysis">{widget('VendorVariance')}</div><VendorAction vendors={demo.appFilters.vendors} onSave={saveAction}/></div></div>
      </section>}
      <ProductEvidence/>
      {compatible&&<section id="section-forecast" className="finance-section" aria-label="Forecast Lab"><SectionHeading label="Reuse and governance" title="Build more screens from the same metrics." description="These forecast and milestone components come from the same published Data App. Explore forecast scenarios and milestone timing in one planning workflow."/><ProposalProof source="Forecast & milestones" state="Reporting period" target="A planning workflow" pattern={'const { Forecast, Milestones } = app.components;\n\n<Forecast />\n<Milestones />'}>Reuse the published components across portfolio, trial, and vendor pages. Lightdash keeps the metric definitions and permissions; your product controls the layout.</ProposalProof><div className="analysis-surface forecast-surface">{widget('Forecast')}</div><div className="analysis-surface milestone-surface">{widget('Milestones')}</div></section>}
      <PublicationFlow/>
      {compatible&&<section id="section-spend" className="finance-section" aria-label="Budget and spend analysis"><SectionHeading label="Budget & spend" title="Keep the analytical depth." description="Expand the budget and pivot the spend. Each is a separate React component, with its full interactions inside the same product workflow."/><div className="analysis-surface">{widget('BudgetActualForecast')}</div><div className="analysis-surface pivot-surface">{widget('SpendPivot')}</div></section>}
      {compatible&&<section id="section-sites" className="finance-section" aria-label="Site performance"><SectionHeading label="Site operations" title="Take the same components further." description="Location, enrollment, and payment detail complete this finance view. Reuse the same Sites export on a dedicated operations page."/><div className="analysis-surface site-surface">{widget('Sites')}</div></section>}
    </WorkspaceProvider>

  </section>;
}
