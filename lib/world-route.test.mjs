import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("desktop miniature cannot build or mount the world; prefetch requires the solved secret",()=>{
  const source=read("../components/RetroComputer.tsx");
  assert.doesNotMatch(source,/import\([^)]*(?:portfolio-room|PortfolioRoom|WorldPage)/);
  assert.doesNotMatch(source,/<PortfolioRoom|warmWorld/);
  assert.match(source,/if\(terminal\)\{router\.prefetch\("\/v2"\);void prefetchWorldAssets\(\);\}/);
  assert.match(source,/if \(!terminalReady\) return/);
  assert.match(source,/navigateImmersive\("\/v2"/);
});
test("the world has its own route and exits through a ready-gated transition",()=>{
  assert.match(read("../app/v2/page.tsx"),/<WorldPage/);
  const source=read("../components/WorldPage.tsx");
  assert.match(source,/ssr: false/);
  assert.match(source,/navigateImmersive\("\/"/);
  assert.doesNotMatch(source,/Heading to the water|world-page-loading/);
  assert.doesNotMatch(source,/<Desktop|components\/desktop/);
});
test("old world URLs permanently redirect to v2",async()=>{
  const {default:config}=await import('../next.config.ts');
  assert.deepEqual(await config.redirects(),[{source:'/youmadeit',destination:'/v2',permanent:true}]);
  assert.match(read('../app/blood-water-preview/page.tsx'),/redirect\("\/v2"\)/);
});
test("SAD-ist video autoplays muted and loops throughout the live world, not only TV view",()=>{
  const source=read("../components/PortfolioRoom.tsx");
  const player=read("../components/TramTelevision.tsx");
  assert.match(source,/\{phase===\"live\"&&<TramTelevision/);
  assert.match(player,/youtube-nocookie.com/);
  assert.match(player,/autoplay:1,mute:1,loop:1,playlist:"MPiILYNStd8",controls:0/);
  assert.match(player,/target\.mute\(\);target\.playVideo\(\)/);
  assert.match(source,/@SAD_istfied/);
  assert.match(source,/Back to the lake/);
});
