const origin = process.env.DEMO_URL || 'https://lightdash-portable-apps-demo.vercel.app';
if (!process.env.NATIVE_PUBLISH_SECRET) throw new Error('Set NATIVE_PUBLISH_SECRET in the publishing job environment.');
const response = await fetch(new URL('/api/publish', origin), {
  method: 'POST', headers: { Authorization: `Bearer ${process.env.NATIVE_PUBLISH_SECRET}` },
  signal: AbortSignal.timeout(65000), redirect: 'error',
});
if (!response.ok) throw new Error(`Native publication failed (${response.status}).`);
const result = await response.json();
console.log(`Native v${result.version}: ${result.built ? 'published' : 'already ready'}.`);
