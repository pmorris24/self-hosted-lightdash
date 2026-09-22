import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useComparison } from './useComparison.jsx';
import { ComponentWorkspace } from './ComponentWorkspace.jsx';
import { ProposalDecision } from './ProposalNarrative.jsx';
import { SdkTab } from './SdkTab.jsx';
import { ComposeIntro } from './ComposeIntro.jsx';
import { DataAppsStep, Status } from './ladder.jsx';
import { Examples } from './Examples.jsx';
import { iframeExamples } from './examples-iframe.jsx';
import './host.css';
import './brand-refinement.css';
import './proposal-tabs.css';

export function Icon({name,size=18,...props}) {
  const paths={refresh:'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17',sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',arrow:'M5 12h14m-6-6 6 6-6 6',close:'m6 6 12 12M6 18 18 6',code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16',filter:'M4 5h16M7 12h10m-7 7h4',check:'m5 12 4 4L19 6',chevron:'m8 10 4 4 4-4'};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]||paths.arrow}/></svg>;
}
function FacetSelect({label,options,selected,onChange,disabled}) {
  const ref=useRef(null);
  useEffect(()=>{const close=event=>{if(ref.current&&!ref.current.contains(event.target))ref.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
  return <details ref={ref} className="facet-select" onKeyDown={event=>{if(event.key==='Escape')ref.current.open=false;}}><summary aria-label={label} aria-disabled={disabled} onClick={event=>{if(disabled)event.preventDefault();}}><span className="filter-name">{label}</span><span>{selected.length?selected.length===1?selected[0]:`${selected.length} selected`:'All'}</span><Icon name="chevron" size={14}/></summary><div className="facet-menu">{options.map(value=><label key={value}><input type="checkbox" disabled={disabled} checked={selected.includes(value)} onChange={event=>onChange(event.target.checked?[...selected,value]:selected.filter(item=>item!==value))}/>{value}</label>)}<button className="text-button" onClick={()=>onChange([])}>Clear selection</button></div></details>;
}
function SharedFilters({demo}) {
  const count=Object.values(demo.filters).reduce((sum,items)=>sum+items.length,0)+demo.appFilters.vendors.length;
  return <div className="shared-controls" aria-label="Portfolio filters"><span className="filter-caption"><Icon name="filter" size={15}/>Portfolio scope</span><FacetSelect label="Program" options={['Cortex Neurology','Solaris Oncology','Aegis Immunology','Orpha Rare Disease']} selected={demo.filters.programs} onChange={programs=>demo.updateFilters({...demo.filters,programs})} disabled={!demo.connected}/><FacetSelect label="Phase" options={['Phase I','Phase II','Phase III']} selected={demo.filters.phases} onChange={phases=>demo.updateFilters({...demo.filters,phases})} disabled={!demo.connected}/><FacetSelect label="Study status" options={['Planned','Enrolling','Treatment','Close-out','Completed']} selected={demo.filters.statuses} onChange={statuses=>demo.updateFilters({...demo.filters,statuses})} disabled={!demo.connected}/>{count>0&&<button className="clear-filters" onClick={demo.resetFilters}>Clear {count} <Icon name="close" size={12}/></button>}</div>;
}
const pageSections=[['overview','Overview'],['portfolio','Study reviews'],['exposure','Vendors'],['forecast','Forecast'],['spend','Budget & spend'],['sites','Sites']];
function PageIndex({visible}) {
  const [active,setActive]=useState('overview');
  useEffect(()=>{
    if(!visible)return;
    let frame=0;
    const update=()=>{frame=0;let next='overview';for(const [id] of pageSections){const element=document.getElementById(`section-${id}`);if(element&&element.getBoundingClientRect().top<=180)next=id;}setActive(next);};
    const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    window.addEventListener('scroll',onScroll,{passive:true});update();
    return()=>{window.removeEventListener('scroll',onScroll);cancelAnimationFrame(frame);};
  },[visible]);
  return <div className="section-index"><nav aria-label="Sections on this page"><span className="index-label">On this page <span aria-hidden="true">↓</span></span>{pageSections.map(([id,label])=><a key={id} href={`#section-${id}`} aria-current={active===id?'location':undefined}>{label}</a>)}</nav></div>;
}
// The three-step story (each tab: the method in general, then the same method for Data Apps)
// stays behind ?preview=sdk until it is approved for every viewer.
const sdkPreview=typeof location!=='undefined'&&new URLSearchParams(location.search).get('preview')==='sdk';
const views=sdkPreview?['iframe','sdk','native']:['iframe','native'];
export function App() {
  const demo=useComparison();
  const [view,setView]=useState('iframe'),[nativeVisited,setNativeVisited]=useState(false),[sdkVisited,setSdkVisited]=useState(false);
  const [scale,setScale]=useState(1),[switcherHeight,setSwitcherHeight]=useState(88);
  const iframePanel=useRef(null),tabs=useRef(null),switcher=useRef(null),iframeStarted=useRef(false);
  useEffect(()=>{
    const observer=new ResizeObserver(([entry])=>{if(entry.contentRect.width)setScale(Math.min(1,entry.contentRect.width/1280));});
    observer.observe(iframePanel.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const observer=new ResizeObserver(()=>setSwitcherHeight(Math.ceil(switcher.current.getBoundingClientRect().height)));
    observer.observe(switcher.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{if(demo.connected&&!iframeStarted.current){iframeStarted.current=true;demo.openIframe();}},[demo.connected,demo.openIframe]);
  function selectView(next){
    if(next==='native')setNativeVisited(true);
    if(next==='sdk')setSdkVisited(true);
    setView(next);
    requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));
  }
  function navigateTabs(event){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const step=event.key==='ArrowLeft'?-1:1,index=views.indexOf(view);
    const next=event.key==='Home'?views[0]:event.key==='End'?views[views.length-1]:views[(index+step+views.length)%views.length];
    selectView(next);tabs.current.querySelector(`#tab-${next}`)?.focus();
  }
  return <div className="product-app proposal-app" data-theme={demo.dark?'dark':'light'} style={{'--switcher-height':`${switcherHeight}px`}}>
    <header className="app-topbar">
      <a className="brand" href="#top" aria-label="Lightdash home"><img src="/assets/lightdash-wordmark.svg" width="104" height="23" alt="Lightdash"/></a>
      <span className="topbar-divider"/><span className="topbar-context">Product proposal <span>/</span> Compose SDK for Data Apps</span>
      <div className="topbar-actions"><button className="icon-button" aria-label={demo.dark?'Switch to light theme':'Switch to dark theme'} title={demo.dark?'Light theme':'Dark theme'} onClick={demo.toggleTheme}><Icon name="sun"/></button><button className="button" aria-label="Refresh data" disabled={demo.busy} onClick={demo.refresh}><Icon name="refresh" size={15}/><span>{demo.busy?'Refreshing…':'Refresh data'}</span></button></div>
    </header>
    <div id="top" ref={switcher} className="embed-switcher">
      <div ref={tabs} role="tablist" aria-label="Embedding approaches" onKeyDown={navigateTabs}>
        <button id="tab-iframe" role="tab" aria-selected={view==='iframe'} aria-controls="panel-iframe" tabIndex={view==='iframe'?0:-1} onClick={()=>selectView('iframe')}><span>Iframe</span><small>The contained app</small></button>
        {sdkPreview&&<button id="tab-sdk" role="tab" aria-selected={view==='sdk'} aria-controls="panel-sdk" tabIndex={view==='sdk'?0:-1} onClick={()=>selectView('sdk')}><span>React SDK</span><small>Content as React components</small></button>}
        <button id="tab-native" role="tab" aria-selected={view==='native'} aria-controls="panel-native" tabIndex={view==='native'?0:-1} onClick={()=>selectView('native')}><span>Compose SDK</span><small>Native React components</small><Icon name="arrow" size={18}/></button>
      </div>
      <span className="switcher-caption">One Data App. Embed it or compose with it.</span>
    </div>
    <main>
      <section id="panel-iframe" role="tabpanel" aria-labelledby="tab-iframe" hidden={view!=='iframe'} className="iframe-tab app-content" tabIndex={0}>
        {sdkPreview?<>
          <header className="iframe-intro"><div><p className="section-kicker">The iframe approach</p><h1>Any Lightdash content, inside a frame.</h1><Status released>Released today</Status></div><p>A signed URL puts a dashboard, a chart, or an explore in your page. Lightdash runs in its own document. Your product supplies the space around it and nothing else.</p></header>
          <Examples label="Iframe examples" examples={iframeExamples(demo)} active={view==='iframe'}/>
          <section className="sdk-argument" aria-labelledby="iframe-argument-title">
            <div><p className="section-kicker">Why teams start here</p><h2 id="iframe-argument-title">One URL, and it works</h2>
              <ul>
                <li><b>No build step.</b> Any page in any stack can show it. There is no package to install or keep current.</li>
                <li><b>Strong isolation.</b> Lightdash code and styles cannot touch your page, and your page cannot touch them.</li>
                <li><b>Your server keeps control.</b> It signs a token for one dashboard, with the filters and exports you allow.</li>
              </ul>
            </div>
            <div><p className="section-kicker sdk-gap-kicker">Where it stops</p><h2>It is a page inside your page</h2>
              <ul>
                <li><b>Two documents.</b> Its own scroll, its own fonts, its own loading state. You size the frame and hope it fits.</li>
                <li><b>State crosses by message.</b> Filters and theme reach the content through the URL or <code>postMessage</code> code that you write.</li>
                <li><b>All or nothing.</b> You place the whole dashboard. You cannot lift one chart into your own layout.</li>
              </ul>
            </div>
          </section>
          <DataAppsStep title="The same frame can hold a whole Data App." status={<Status released>Released today</Status>}>
            <p>A dashboard is charts on a grid. A <b>Data App</b> is a product surface built in Lightdash: custom components, forms, scenario controls, its own layout. Teams need to ship those to their customers too.</p>
            <p>The frame already does it. The same signed URL model embeds the complete app below, with the same isolation and the same limits.</p>
          </DataAppsStep>
        </>:<header className="iframe-intro"><div><p className="section-kicker">The iframe approach</p><h1>An app inside your app.</h1></div><p>The complete Lightdash app runs inside its own document. Your product provides the surrounding page; the embedded app controls its internal layout.</p></header>}
        <div className="iframe-host-shell">
          <div className="iframe-host-bar"><span>Clinical finance <span>/</span> Portfolio</span><span className="iframe-boundary-label">Embedded Lightdash app</span></div>
          <section ref={iframePanel} className="iframe-panel" style={{'--app-scale':scale}} aria-label="Live iframe example">
            <div className="panel-surface"><iframe ref={demo.iframe} onLoad={demo.iframeLoaded} title="Clinical Trial FP&A — sandboxed Lightdash iframe"/></div>
            <footer><span className="panel-state" role="status">{demo.connected?demo.iframeState:demo.error||'Connecting to Lightdash…'}</span><button className="text-button" onClick={demo.reloadIframe}>Reload iframe</button></footer>
          </section>
          <div className="iframe-host-note"><span>Separate document</span><span>App-owned layout</span><span>Sandbox boundary</span></div>
        </div>
        <div className="iframe-next"><div><p className="section-kicker">Now change the integration model</p><h2>What if the analytics<br/>were part of the product?</h2></div><button className="button primary" onClick={()=>selectView(sdkPreview?'sdk':'native')}>{sdkPreview?'See the React SDK':'Explore the Compose SDK'} <Icon name="arrow" size={20}/></button></div>
      </section>
      {sdkPreview&&<section id="panel-sdk" role="tabpanel" aria-labelledby="tab-sdk" hidden={view!=='sdk'} className="sdk-tab app-content" tabIndex={0}>
        {sdkVisited&&<SdkTab demo={demo} controls={<SharedFilters demo={demo}/>} Icon={Icon} active={view==='sdk'} onNext={()=>selectView('native')}/>}
      </section>}
      <section id="panel-native" role="tabpanel" aria-labelledby="tab-native" hidden={view!=='native'} className="native-tab app-content" tabIndex={0}>
        {nativeVisited&&<>
          {sdkPreview&&<ComposeIntro demo={demo} active={view==='native'} controls={<SharedFilters demo={demo}/>}/>}
          <header className="native-proposal-intro">
            <div className="native-thesis"><p className="section-kicker">The product proposal · Lightdash</p><h1>A Compose SDK<br/><span>for Data Apps.</span></h1><p>Create in Lightdash. Compose inside your product.</p></div>
            <div className="native-proposal-context"><p>Create a Data App in Lightdash, then use its charts, tables, filters, and views as native React components in your product.</p><p>The proposal extends Lightdash’s React and query SDKs with a supported composition model for Data Apps. Developers control layouts, shared state, and product workflows.</p></div>
            <div className="native-intro-footer"><span><i/>Working composition examples below</span><a href="#section-portfolio">Start with a study review <Icon name="arrow" size={18}/></a></div>
            <img src="/assets/purple-bar.png" className="native-brand-band" alt="" width="2304" height="320"/>
          </header>
          <PageIndex visible={view==='native'}/>
          {demo.error&&<p className="notice error" role="alert">{demo.error}</p>}
          <ComponentWorkspace demo={demo} controls={<SharedFilters demo={demo}/>}/>
          <ProposalDecision/>
        </>}
      </section>
    </main>
    <footer className="app-footer"><span>Lightdash Data Apps <span>·</span> Compose SDK proposal</span><span>{view==='iframe'?'Current approach: a sandboxed app':view==='sdk'?'Released today: the React SDK for saved content':'Proposed approach: a Compose SDK for Data Apps'}</span></footer>
  </div>;
}
if (typeof document !== 'undefined') createRoot(document.getElementById('root')).render(<App/>);
