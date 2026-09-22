import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const emptyFilters = { programs: [], phases: [], statuses: [] };
const initialAnalysis = { vendors: [], asOf: null, lookback: 24, horizon: 24 };
export function useComparison() {
  const iframe = useRef(null), iframeEnabled = useRef(false);
  const config = useRef(null), current = useRef({ filters: emptyFilters, analysis: initialAnalysis, dark: false });
  const generation = useRef(0), timer = useRef(null), control = useRef(''), retries = useRef(0);
  const awaitingIframe = useRef(false), navigatingIframe = useRef(false);
  const alive = useRef(true), busyRef = useRef(false);
  const [filters, setFilters] = useState(emptyFilters), [dark, setDark] = useState(false);
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const appFilters = useMemo(() => ({ ...filters, ...analysis }), [filters, analysis]);
  const [busy, setBusy] = useState(true), [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(null);
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState('');
  const [iframeState, setIframeState] = useState('Open the iframe example to load it.');
  const [reactApp, setReactApp] = useState(null);
  const send = useCallback(() => {
    try { iframe.current?.contentWindow.frames[0]?.postMessage({ type:'fpa:controls', id:control.current,
      filters:{...current.current.filters,...current.current.analysis}, theme:current.current.dark ? 'dark' : 'light' }, '*'); } catch { /* Nested frame is not ready. */ }
  }, []);
  const sync = useCallback(() => {
    if (!iframeEnabled.current || !iframe.current?.getAttribute('src')) return;
    clearInterval(timer.current); control.current = crypto.randomUUID(); let ticks = 0;
    send();
    timer.current = setInterval(() => {
      if (++ticks > 30) {
        clearInterval(timer.current);
        if (retries.current++ < 2 && iframe.current?.src) {
          setIframeState('Retrying hosted app…');
          const url = new URL(iframe.current.src); url.searchParams.set('demoRefresh', Date.now());
          navigatingIframe.current = true; awaitingIframe.current = true; iframe.current.src = url.href; sync();
        } else setIframeState('Hosted app unavailable. Reload to retry.');
      } else send();
    }, 500);
  }, [send]);
  const loadIframe = useCallback(() => {
    if (!config.current || !iframeEnabled.current) return;
    retries.current = 0; setIframeState('Loading hosted app…');
    navigatingIframe.current = true; awaitingIframe.current = true;
    const c = config.current;
    iframe.current.src = `${c.baseUrl}/embed/${c.projectUuid}/app/${c.appUuid}?theme=${current.current.dark?'dark':'light'}&demoRefresh=${Date.now()}#${c.embedToken}`;
    sync();
  }, [sync]);
  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const run = ++generation.current;
    try {
      if (!config.current || config.current.expiresAt <= Date.now() + 60000) {
        const response = await fetch('/api/connection', {cache:'no-store', signal:AbortSignal.timeout(20000)});
        if (!response.ok) throw new Error('The demo connection is unavailable. Refresh to retry.');
        config.current = await response.json();
        setConnection(config.current);
        if (!alive.current) return;
        setConnected(true);
      }
      loadIframe();
      const response = await fetch('/api/native', {cache:'no-store', signal:AbortSignal.timeout(20000)});
      const release = await response.json();
      if (!response.ok) throw new Error(release.error || 'The published native app is unavailable.');
      const cssUrl = new URL(release.stylesheetUrl, location.origin).href;
      const styles = new Promise((resolve,reject) => {
        let link = [...document.querySelectorAll('link[data-lightdash-app-styles]')].find(item=>item.href===cssUrl);
        if (link?.sheet) return resolve();
        const created = !link;
        if (!link) {link=document.createElement('link');link.rel='stylesheet';link.href=cssUrl;link.dataset.lightdashAppStyles='';}
        const timeout = setTimeout(()=>{link.remove();reject(new Error('The stylesheet request timed out. Refresh to retry.'));},20000);
        link.addEventListener('load',()=>{clearTimeout(timeout);resolve();},{once:true});
        link.addEventListener('error',()=>{clearTimeout(timeout);link.remove();reject(new Error('The app stylesheet could not load.'));},{once:true});
        if(created)document.head.appendChild(link);
      });
      const [module] = await Promise.all([import(new URL(release.moduleUrl,location.origin).href),styles]);
      if (!alive.current || generation.current !== run) return;
      if (module.contract?.version !== 1 || typeof module.DataAppProvider !== 'function') throw new Error('This release has no supported component contract.');
      document.querySelectorAll('link[data-lightdash-app-styles]').forEach(link=>{if(link.href!==cssUrl)link.remove();});
      setVersion(release.version);
      setReactApp({ module, connection: config.current, version: release.version, generation: run });
    } catch (failure) {
      if (alive.current) setError(failure.message);
    } finally {
      busyRef.current=false;
      if(alive.current)setBusy(false);
    }
  },[loadIframe]);
  useEffect(()=>{
    alive.current=true;
    function onMessage(event){
      let source;try{source=iframe.current?.contentWindow.frames[0];}catch{return;}
      // The app sandbox has an opaque origin; only accept the exact nested WindowProxy.
      if(event.origin!=='null'||!source||event.source!==source||navigatingIframe.current)return;
      if(event.data?.type==='fpa:available'){sync();return;}
      if(event.data?.id!==control.current)return;
      if(event.data.type==='fpa:ack'){if(!awaitingIframe.current)clearInterval(timer.current);setIframeState(awaitingIframe.current?'Querying Lightdash…':'Shared controls connected');}
      if(event.data.type==='fpa:state'&&event.data.ready){awaitingIframe.current=false;clearInterval(timer.current);setIframeState('Live data ready');}
    }
    window.addEventListener('message',onMessage);refresh();
    return()=>{alive.current=false;generation.current++;clearInterval(timer.current);window.removeEventListener('message',onMessage);};
  },[refresh,sync]);
  function updateFilters(next){
    current.current.filters=next;setFilters(next);retries.current=0;
    sync();
  }
  function updateAnalysisFilters(next) {
    const value = { vendors: next.vendors, asOf: next.asOf, lookback: next.lookback, horizon: next.horizon };
    current.current.analysis = value; setAnalysis(value); retries.current = 0; sync();
  }
  function resetFilters() {
    current.current.filters = emptyFilters; setFilters(emptyFilters);
    updateAnalysisFilters({ ...current.current.analysis, vendors: [] });
  }
  function toggleTheme(){
    const next=!current.current.dark;current.current.dark=next;setDark(next);
    retries.current=0;sync();
  }
  function openIframe() {
    if (iframeEnabled.current) return;
    iframeEnabled.current = true;
    loadIframe();
  }
  return {connection,iframe,filters,appFilters,updateAnalysisFilters,resetFilters,dark,busy,connected,version,error,iframeState,reactApp,openIframe,
    iframeLoaded:()=>{if(config.current && iframeEnabled.current){navigatingIframe.current=false;awaitingIframe.current=true;setIframeState('Loading hosted app…');sync();}},
    refresh,reloadIframe:loadIframe,updateFilters,toggleTheme};
}
