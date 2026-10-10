import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('native market display has no embedded third-party logo and labels quote time',()=>{
  const ticker=read('../components/WorldMarketTicker.tsx');
  assert.doesNotMatch(ticker,/TradingView|tradingview|iframe|tv-ticker/);
  assert.match(ticker,/AS OF/);assert.match(ticker,/MARKET DATA UNAVAILABLE/);
});
test('arcade display switches credits, cabinet keeps the projects destination',()=>{
  const model=read('./side-quest-world-model.ts'),room=read('./portfolio-room.ts');
  assert.match(model,/label\(arcade,"PROJECTS"/);assert.doesNotMatch(model,/label\(arcade,"MODE"/);
  assert.match(room,/intersectObjects\(\[arcadeScreenHit\]/);
  assert.match(room,/if\("arcade" in hit\)\{switchArcade\(\);visit\("work",undefined,true\);\}/);
  assert.doesNotMatch(room,/watchArcade|moveTo\("arcade"/);
  assert.match(model,/arcadeLoop.toggle\(\);gameTex.dispose\(\);gameTex.needsUpdate=true/);
  assert.match(room,/else visit\(hit.id,hit.photo\)/);
});
test('water introduction follows the tram axes at its front-right, without diagonal yaw',()=>{
  const text=read('./water-lettering.ts');
  assert.match(text,/root.position.set\(3.4,-.455,6.4\)/);
  assert.match(text,/root.rotation.y=0/);assert.match(text,/root.rotation.z=0/);
});
test('asset camera dispatches air on the movement frame once, not directly from the input handler',()=>{
  const room=read('./portfolio-room.ts');
  assert.match(room,/if\(!travel.entrance&&!travel.airStarted&&!reduced.matches\)\{travel.airStarted=true;syncListener\(\);worldSound.play\("camera"/);
  assert.doesNotMatch(room,/!travel.entrance&&travel.elapsed===0/);
});
test('vending panel is recessed into its thin cabinet bezel',()=>{
  const props=read('./world-props.ts');
  assert.match(props,/1.38,.075,x,1.41,.525/);
  assert.match(props,/vendingScreen=mesh\(vending,new THREE.PlaneGeometry\(.9,1.26\),vendingMaterial,-.04,1.41,.533\)/);
});
