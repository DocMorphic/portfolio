import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopArea,fitDesktopWindow,worldOverviewScale,worldReadingMode} from './responsive-layout.ts';

const sizes=[[280,568],[320,568],[390,844],[430,932],[667,375],[844,390],[768,1024],[1024,768],[1280,720],[1440,900],[2560,1440],[3840,2160],[390,350]];
test('windows fit the usable desktop at phones, tablets, landscape, 4K and keyboard heights',()=>{
  for(const [width,height] of sizes)for(const insets of [{},{top:44,bottom:34,left:16,right:16}]){
    const viewport={width,height,...insets},area=desktopArea(viewport);
    for(const maximized of [false,true])for(const position of [{x:-500,y:-800},{x:2500,y:1500}]){
      const fit=fitDesktopWindow({position,size:{width:1100,height:900}},viewport,maximized);
      assert.ok(fit.position.x>=area.x&&fit.position.y>=area.y);
      assert.ok(fit.position.x+fit.size.width<=area.x+area.width+.001);
      assert.ok(fit.position.y+fit.size.height<=area.y+area.height+.001);
      assert.ok(fit.size.width>0&&fit.size.height>0);
    }
  }
});
test('all phone windows leave the complete shortcut strip visible, even when maximized',()=>{
  for(const [width,height] of [[280,568],[320,568],[390,667],[390,844],[430,932],[667,375],[390,350]]){
    const viewport={width,height},area=desktopArea(viewport);
    assert.equal(area.y,106,'reserve the ~96px icon row plus breathing room');
    for(const maximized of [false,true]){
      const fit=fitDesktopWindow({position:{x:0,y:0},size:{width:1000,height:900}},viewport,maximized);
      assert.equal(fit.position.y,area.y);
      assert.ok(fit.position.y+fit.size.height<=height-area.menu-area.dock-6);
    }
  }
  assert.equal(desktopArea({width:768,height:700}).y,12,'leave tablet and desktop positioning unchanged');
});
test('desktop composition is preserved while portrait cameras make room for the island',()=>{
  assert.equal(worldOverviewScale(1440,900),1);
  assert.ok(worldOverviewScale(390,844)>2);
  for(const [w,h] of sizes)assert.ok(worldOverviewScale(w,h)>=1&&worldOverviewScale(w,h)<=2.8);
  assert.equal(worldReadingMode(390,844),'sheet');
  assert.equal(worldReadingMode(667,375),'compact');
  assert.equal(worldReadingMode(1440,900),'side');
});
