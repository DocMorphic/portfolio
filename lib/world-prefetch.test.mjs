import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_PREFETCH_IMAGES} from './world-assets.mjs';

let version=0;
async function withBrowser(connection,fetcher,run){
  const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const originalFetch=globalThis.fetch;
  try{
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{connection}});
    globalThis.fetch=fetcher;
    const prefetchModule=await import(`./world-prefetch.ts?test=${++version}`);
    await run(prefetchModule.prefetchWorldAssets);
  }finally{
    if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);
    else delete globalThis.navigator;
    globalThis.fetch=originalFetch;
  }
}

test('world intent prefetches once, sequentially, at low priority and full quality',async()=>{
  const requests=[];let active=0,peak=0;
  await withBrowser({},async(url,options)=>{
    requests.push({url,options});active++;peak=Math.max(peak,active);
    return {ok:true,blob:async()=>{await Promise.resolve();active--;return new Blob();}};
  },async prefetch=>{await Promise.all([prefetch(),prefetch(),prefetch()]);});
  assert.deepEqual(requests.map(request=>request.url),WORLD_PREFETCH_IMAGES);
  assert.equal(peak,1);
  requests.forEach(({options})=>assert.deepEqual(options,{cache:'force-cache',priority:'low'}));
});

test('data saver prevents speculative texture downloads',async()=>{
  await withBrowser({saveData:true},()=>{assert.fail('must not download');},async prefetch=>{await prefetch();});
});

test('failed speculative downloads do not prevent entry or remaining downloads',async()=>{
  const requests=[];
  await withBrowser({},async url=>{
    requests.push(url);
    if(requests.length===1)throw Error('offline');
    return {ok:false};
  },async prefetch=>{await assert.doesNotReject(prefetch());});
  assert.deepEqual(requests,WORLD_PREFETCH_IMAGES);
});
