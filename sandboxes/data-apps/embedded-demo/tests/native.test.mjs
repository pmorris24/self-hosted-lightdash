import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeHandler } from '../api/native.js';
import { createPublisher } from '../runtime/publisher.js';
import { createPublishHandler } from '../api/publish.js';
import { runtimeId } from '../runtime/build-id.js';
Object.assign(process.env, { DEMO_CONNECTION_ENABLED: 'true', LIGHTDASH_URL: 'https://example.test', LIGHTDASH_PROJECT_UUID: 'project', LIGHTDASH_APP_UUID: 'app', LIGHTDASH_SOURCE_TOKEN: 'test-only', NATIVE_PUBLISH_SECRET: 'test-publisher' });
function request(handler, query = {}, method = 'GET', headers = {}) {
  const result = { headers: {} };
  return handler({ method, query, headers }, { setHeader(k,v){result.headers[k]=v;},status(code){result.status=code;return this;},json(body){result.body=body;},send(body){result.body=body;} }).then(() => result);
}
test('viewer reads prebuilt files; missing new versions do not build or return old source', async () => {
  let latest = 27;
  const handler = createNativeHandler({ published: async path => {assert.match(path,/\?limit=1$/);return {latestReadyVersion:latest};}, read: async path => path.includes('/v27/') ? (path.endsWith('ready.json') ? '{}' : 'module') : null });
  const first = await request(handler);
  assert.equal(first.body.version,27);
  const js = await request(handler,{asset:'js',version:'27',runtime:runtimeId});
  assert.equal(js.body,'module'); assert.match(js.headers['Cache-Control'],/immutable/);
  latest=28;
  const next=await request(handler); assert.equal(next.status,503); assert.equal(next.body.version,28);
  assert.match(next.headers['Cache-Control'],/no-store/);
  assert.equal((await request(handler,{asset:'js',version:'28',runtime:runtimeId})).status,503);
  assert.equal((await request(handler,{asset:'js',version:'27',runtime:'old'})).status,409);
});
test('publisher shares a job, writes the ready marker last, and skips existing releases', async () => {
  const objects = new Map(); const writes=[]; let builds=0;
  const publish=createPublisher({published:async path=>path.endsWith('/download')?{manifest:{version:28}}:{latestReadyVersion:28},
    read:async path=>objects.get(path)??null,
    write:async(path,body)=>{writes.push(path);objects.set(path,body);},
    compile:async()=>{builds++;return {version:28,js:'module',css:'styles'};}});
  await Promise.all([publish(),publish()]);
  assert.equal(builds,1);assert.match(writes.at(-1),/ready.json$/);assert.equal(writes.length,3);
  assert.equal((await publish()).built,false);assert.equal(builds,1);
});
test('failed uploads and version races never publish a ready marker', async () => {
  const writes=[];
  const options={read:async()=>null,published:async path=>path.endsWith('/download')?{manifest:{version:28}}:{latestReadyVersion:28},compile:async()=>({version:28,js:'module',css:'styles'}),write:async path=>{writes.push(path);throw new Error('storage unavailable');}};
  await assert.rejects(createPublisher(options)());
  assert.ok(writes.every(path=>!path.endsWith('ready.json')));
  await assert.rejects(createPublisher({...options,published:async path=>path.endsWith('/download')?{manifest:{version:29}}:{latestReadyVersion:28},compile:()=>assert.fail('must not compile a version race')})());
});
test('publisher requires its own secret and does not accept public or GET requests', async()=>{
  let calls=0;const handler=createPublishHandler({publish:async()=>{calls++;return {version:28};}});
  assert.equal((await request(handler,{},'GET')).status,405);
  assert.equal((await request(handler,{},'POST')).status,401);
  assert.equal((await request(handler,{},'POST',{authorization:'Bearer wrong'})).status,401);
  assert.equal(calls,0);
  assert.equal((await request(handler,{},'POST',{authorization:'Bearer test-publisher'})).status,200);assert.equal(calls,1);
});

test('an absent Blob is a missing release, not a failed storage service', async()=>{
  const {BlobNotFoundError}=await import('@vercel/blob');
  const {createArtifactReader}=await import('../runtime/releases.js');
  const read=createArtifactReader({headImpl:async()=>{throw new BlobNotFoundError();},fetchImpl:()=>assert.fail('must not fetch a missing blob')});
  assert.equal(await read('missing/ready.json'),null);
  await assert.rejects(createArtifactReader({headImpl:async()=>{throw new Error('Unauthorized');}})('missing/ready.json'),/Unauthorized/);
});
