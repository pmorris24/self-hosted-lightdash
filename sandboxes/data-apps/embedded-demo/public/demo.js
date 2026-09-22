const $ = (id) => document.getElementById(id);
let nativeVersion = null;
let connection = null;
let connecting = false;
let mountedApp = null;
let moduleObserver = null;
let observerTimer = null;
let busy = false;
let dark = false;
let activeStep = 0;
let attempt = 0;
let nativeStart = 0;
let nativeDataStart = 0;
let iframeStart = 0;
let filterStart = 0;
let nativeDetached = false;
let iframeTimer;
let iframeRetries = 0;
let iframeAck = false;
let controlId = '';
function sharedFilters() {
  return {programs: $('host-program').value ? [$('host-program').value] : [], phases: $('host-phase').value ? [$('host-phase').value] : [], statuses: $('host-status').value ? [$('host-status').value] : []};
}
function sendIframeControls() {
  try {
    $('lightdash-frame').contentWindow.frames[0]?.postMessage({type:'fpa:controls', id:controlId, filters:sharedFilters(), theme:dark ? 'dark' : 'light'}, '*');
  } catch { /* Hosted frame has not created its app frame yet. */ }
}
function syncIframe() {
  clearInterval(iframeTimer); iframeAck = false; controlId = crypto.randomUUID();
  let ticks = 0;
  sendIframeControls();
  iframeTimer = setInterval(() => {
    if (iframeAck || ++ticks > 30) {
      clearInterval(iframeTimer);
      if (!iframeAck && iframeRetries++ < 2) {
        $('iframe-state').textContent = 'Retrying hosted app…';
        const frame = $('lightdash-frame');
        const url = new URL(frame.src); url.searchParams.set('demoRefresh', Date.now()); frame.src = url.href;
        syncIframe();
      } else if (!iframeAck) $('iframe-state').textContent = 'Host controls unavailable — reload iframe';
      return;
    }
    sendIframeControls();
  }, 500);
}
window.addEventListener('message', event => {
  let source; try { source = $('lightdash-frame').contentWindow.frames[0]; } catch { return; }
  // The hosted app sandbox has an opaque origin. Validate its exact WindowProxy.
  if (event.origin !== 'null' || !source || event.source !== source) return;
  if (event.data?.type === 'fpa:available') { syncIframe(); return; }
  if (event.data?.id !== controlId) return;
  if (event.data.type === 'fpa:ack') { iframeAck = true; clearInterval(iframeTimer); $('iframe-state').textContent = 'Shared controls connected'; }
  if (event.data.type === 'fpa:state' && event.data.ready) {
    $('iframe-state').textContent = 'Live data rendered';
    if (iframeStart) { $('iframe-timing').textContent = `${((performance.now() - iframeStart) / 1000).toFixed(2)} s`; iframeStart = 0; }
  }
});

const steps = [
  { title: 'Use the iframe as the baseline.', description: 'First confirm the same business result. Then use Fit the host and Inspect to see the native integration advantage. Match the reporting period and filters.' },
  { title: 'Ask the same question in both hosts.', description: 'Select a program in the customer controls beside the panels. The native app updates through its filter API. Both apps receive the same filter through their integration APIs.' },
  { title: 'Show shared theme control from the customer page.', description: 'Change both themes from this page. The iframe uses an explicit message bridge; the native app uses its mount API.', action: 'Toggle both themes' },
  { title: 'Show that the iframe boundary is gone.', description: 'The module renders into this page’s DOM. The hosted version renders in a separate iframe document. Both can support host controls; the integration mechanism differs.', action: 'Inspect native mount' },
];

function setStatus(message, error = false) {
  $('demo-status').textContent = message;
  $('demo-status').classList.toggle('error', error);
}

async function verifyIdentity(config) {
  let response;
  try {
    response = await fetch(`${config.baseUrl}/api/v1/embed/${config.projectUuid}/user-info`, {
      headers: { 'lightdash-embed-token': config.embedToken, 'Lightdash-App-Uuid': config.appUuid },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`Cannot reach Lightdash. Check the connection and allow ${location.origin} in the organization’s CORS settings.`);
  }
  if (!response.ok) throw new Error(`Lightdash rejected the connection (${response.status}). Check token expiry and the app’s embed settings.`);
}

function observeModule(currentAttempt) {
  moduleObserver?.disconnect();
  const check = () => {
    if (currentAttempt !== attempt) return;
    const text = $('module-app').innerText;
    if (/Couldn[’']t (load|render)|Failed to fetch/.test(text)) {
      $('module-state').textContent = 'App reported an error';
      setStatus('The native app could not load its data. Select Refresh both to retry.', true);
    } else if (/EAC/i.test(text) && /current budget/i.test(text)) {
      $('module-state').textContent = 'Live data rendered';
      setStatus('Both routes use the same connection. Match the filters and reporting period to compare results.');
      moduleObserver?.disconnect();
    }
  };
  moduleObserver = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(check, 180);
  });
  moduleObserver.observe($('module-app'), { childList: true, subtree: true, characterData: true });
  check();
}

async function mountBoth(refresh = false, nativeOnly = false) {
  if (!connection || busy) return;
  if (connection.expiresAt <= Date.now()) {
    await connectFromServer();
    return;
  }
  busy = true;
  $('refresh-both').disabled = true;
  $('refresh-both').textContent = 'Refreshing…';
  const currentAttempt = ++attempt;
  nativeStart = performance.now();
  filterStart = 0;
  nativeDetached = false;
  $('native-timing').textContent = 'Loading…';
  $('native-assets').textContent = 'Loading…';
  $('native-data').textContent = 'Waiting for app';
  $('host-lifecycle').textContent = 'Unmount native app';
  const refreshId = Date.now().toString();
  setStatus(refresh ? 'Reloading both live panels…' : 'Loading the hosted iframe and native module…');
  $('iframe-state').textContent = 'Loading hosted frame';
  $('module-state').textContent = 'Loading module';
  const frame = $('lightdash-frame');
  if (!nativeOnly) {
  iframeStart = performance.now();
  $('iframe-timing').textContent = 'Loading…';
  iframeRetries = 0;
  frame.onload = () => { if (currentAttempt === attempt) $('iframe-state').textContent = 'Frame loaded'; };
  frame.src = `${connection.baseUrl}/embed/${connection.projectUuid}/app/${connection.appUuid}?theme=${dark ? 'dark' : 'light'}&demoRefresh=${refreshId}#${connection.embedToken}`;
  frame.hidden = false;
  $('iframe-empty').hidden = true;
  syncIframe();
  }
  try {
    setStatus('Checking the latest published Lightdash app…');
    const releaseResponse = await fetch('/api/native', { cache: 'no-store' });
    const release = await releaseResponse.json();
    if (!releaseResponse.ok) throw new Error(release.error || 'Could not load the published app.');
    nativeVersion = release.version;
    $('published-version').textContent = `Published app · v${nativeVersion}`;
    const url = new URL(release.moduleUrl, location.origin);
    const cssUrl = new URL(release.stylesheetUrl, location.origin).href;
    const stylesReady = new Promise((resolve, reject) => {
      let link = [...document.querySelectorAll('link[data-lightdash-app-styles]')].find(item => item.href === cssUrl);
      if (link?.sheet) { resolve(); return; }
      const created = !link;
      if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; link.href = cssUrl; link.dataset.lightdashAppStyles = ''; }
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', () => { link.remove(); reject(new Error('The app stylesheet could not load. Refresh both to retry.')); }, { once: true });
      if (created) document.head.appendChild(link);
    });
    const [{ mount }] = await Promise.all([import(url.href), stylesReady]);
    moduleObserver?.disconnect();
    mountedApp?.unmount();
    mountedApp = null;
    document.querySelectorAll('link[data-lightdash-app-styles]').forEach((link) => {
      if (link.href !== cssUrl) link.remove();
    });
    $('module-app').hidden = false;
    $('module-empty').hidden = true;
    nativeDataStart = performance.now();
    $('native-assets').textContent = `${((nativeDataStart - nativeStart) / 1000).toFixed(2)} s`;
    let initialFilterApplied = false;
    mountedApp = mount($('module-app'), { ...connection, initialFilters: sharedFilters(), colorScheme: dark ? 'dark' : 'light', onState(state) {
      if (currentAttempt !== attempt || nativeDetached) return;
      if (state.error) { $('host-feedback').textContent = 'The native data request failed. Use Refresh both to retry.'; return; }
      if (!state.ready) return;
      if (!initialFilterApplied) {
        initialFilterApplied = true;
        mountedApp.setFilters(sharedFilters());
      }
      initialFilterApplied = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (currentAttempt !== attempt || nativeDetached) return;
        if (nativeDataStart) { $('native-data').textContent = `${((performance.now() - nativeDataStart) / 1000).toFixed(2)} s`; nativeDataStart = 0; }
        if (nativeStart) { $('native-timing').textContent = `${((performance.now() - nativeStart) / 1000).toFixed(2)} s`; nativeStart = 0; }
        if (filterStart) { $('filter-timing').textContent = `${((performance.now() - filterStart) / 1000).toFixed(2)} s`; filterStart = 0; }
        $('module-state').textContent = 'Live data rendered';
        setStatus('Use the shared controls to update both views.');
        $('host-program').disabled = false;
        $('host-theme').disabled = false;
        $('host-lifecycle').disabled = false;
        $('host-feedback').textContent = 'Shared filters applied. Native uses direct calls; iframe uses the message bridge.';
      }));
    } });
    $('module-state').textContent = 'Mounted; querying data';
    observeModule(currentAttempt);
  } catch (error) {
    $('module-state').textContent = 'Published app unavailable';
    setStatus(error.message || 'The published app could not load. Refresh both to retry.', true);
  } finally {
    busy = false;
    $('refresh-both').disabled = false;
    $('refresh-both').innerHTML = '<span aria-hidden="true">↻</span> Refresh both';
    $('step-action').disabled = !mountedApp;
  }
}

$('refresh-both').addEventListener('click', () => connection ? mountBoth(true) : connectFromServer());

document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
  activeStep = Number(button.dataset.step);
  document.querySelectorAll('[data-step]').forEach((item) => {
    item.classList.toggle('selected', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  const step = steps[activeStep];
  $('step-title').textContent = step.title;
  $('step-description').textContent = step.description;
  $('step-action').hidden = !step.action;
  $('step-action').textContent = step.action || '';
  $('step-action').disabled = !mountedApp;
  $('inspection-result').hidden = true;
  $('module-app').classList.remove('inspect-highlight');
}));
$('step-action').addEventListener('click', () => {
  if (!mountedApp) return;
  if (activeStep === 2) {
    $('host-theme').click();
    $('step-action').textContent = dark ? 'Set both to light' : 'Set both to dark';
  } else if (activeStep === 3) {
    const title = $('module-app').querySelector('h1')?.textContent || 'App content';
    const frames = $('module-app').querySelectorAll('iframe').length;
    $('inspection-result').textContent = `Found “${title}” directly inside this page’s #module-app element. Iframes inside the native mount: ${frames}. The Lightdash panel has a separate document and origin.`;
    $('inspection-result').hidden = false;
    $('module-app').classList.add('inspect-highlight');
  }
});
$('focus-layout').addEventListener('click', () => {
  const expanded = document.body.classList.toggle('expanded');
  $('focus-layout').textContent = expanded ? 'Return to proposal' : 'Expand comparison';
  $('focus-layout').setAttribute('aria-pressed', String(expanded));
  $('comparison').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

async function connectFromServer() {
  if (connecting) return;
  connecting = true;
  $('refresh-both').disabled = true;
  setStatus('Loading the live demo…');
  try {
    const response = await fetch('/api/connection', { cache: 'no-store' });
    if (!response.ok) throw new Error('Server connection unavailable');
    const config = await response.json();
    await verifyIdentity(config);
    connection = config;
    $('connection-dot').classList.add('connected');
    $('connection-label').textContent = 'Connected to Lightdash';
    await mountBoth();
  } catch {
    setStatus('The live demo could not load. Select Refresh both to retry.', true);
  } finally {
    connecting = false;
    $('refresh-both').disabled = false;
  }
}
connectFromServer();

function updateScale() {
  const selected = $('app-zoom').value;
  const panels = [...document.querySelectorAll('.demo-panel')].filter(p => p.getBoundingClientRect().width > 0);
  const scale = selected === 'fit' ? Math.min(1, Math.max(.25, Math.min(...panels.map(p => p.clientWidth)) / 1600)) : Number(selected);
  document.querySelectorAll('.panel-surface').forEach(p => p.style.setProperty('--app-scale', scale));
}
$('app-zoom').addEventListener('change', updateScale);
$('panel-view').addEventListener('change', () => { $('panels').dataset.view = $('panel-view').value; updateScale(); });
new ResizeObserver(updateScale).observe($('panels'));
$('presentation-toggle').addEventListener('click', () => {
  const compact = document.body.classList.toggle('presentation');
  $('presentation-toggle').textContent = compact ? 'Read the product case' : 'Present the live demo';
  if (!compact) $('proposal').scrollIntoView({behavior:'smooth'});
  else $('comparison').scrollIntoView({behavior:'smooth'});
});
function applySharedFilters() {
  if (mountedApp) {
    filterStart = performance.now();
    $('filter-timing').textContent = 'Updating…';
    mountedApp.setFilters(sharedFilters());
  }
  syncIframe();
  $('host-feedback').textContent = 'Updating both apps with the shared filters…';
}
for (const id of ['host-program','host-phase','host-status']) $(id).addEventListener('change', applySharedFilters);
$('reset-shared').addEventListener('click', () => { for(const id of ['host-program','host-phase','host-status']) $(id).value = ''; applySharedFilters(); });
$('host-theme').addEventListener('click', () => {
  dark = !dark;
  mountedApp?.setColorScheme(dark ? 'dark' : 'light');
  syncIframe();
  $('host-theme').textContent = `Theme: ${dark ? 'dark' : 'light'}`;
});
$('host-lifecycle').addEventListener('click', async () => {
  if (!mountedApp) { await mountBoth(false, true); return; }
  mountedApp.unmount(); mountedApp = null; nativeDetached = true;
  moduleObserver?.disconnect();
  $('module-state').textContent = 'Unmounted by the host';
  $('host-lifecycle').textContent = 'Mount native app';
  $('step-action').disabled = true;
  $('host-feedback').textContent = 'The customer app removed the native view through its lifecycle API. The iframe remains mounted.';
});

$('retry-iframe').addEventListener('click', () => {
  iframeRetries = 0;
  if (!connection) return;
  const frame = $('lightdash-frame');
  frame.src = `${connection.baseUrl}/embed/${connection.projectUuid}/app/${connection.appUuid}?theme=${dark ? 'dark' : 'light'}&demoRefresh=${Date.now()}#${connection.embedToken}`;
  $('iframe-state').textContent = 'Reloading hosted frame';
  syncIframe();
});
