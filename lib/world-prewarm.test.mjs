import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('./')&&!/\.[a-z]+$/i.test(specifier)&&context.parentURL?.includes('/lib/'))return next(specifier+'.ts',context);return next(specifier,context);}});
const {captureWorldEnvironment,warmWorldTextures}=await import('./world-prewarm.ts');
// The loading scheduler still yields a task between each fake animation frame.
globalThis.requestAnimationFrame=fn=>setTimeout(()=>fn(performance.now()),0);
globalThis.cancelAnimationFrame=clearTimeout;

function harness(fail=-1){
  const scene=new THREE.Scene(),water=new THREE.Object3D(),lettering=new THREE.Object3D();
  scene.add(water,lettering);lettering.visible=false;
  const target=new THREE.WebGLCubeRenderTarget(16),probe=new THREE.CubeCamera(.1,100,target);
  const original=new THREE.WebGLRenderTarget(8,8);let current=original,face=2,mip=1;
  const faces=[];
  const renderer={coordinateSystem:THREE.WebGLCoordinateSystem,xr:{enabled:true},
    getRenderTarget:()=>current,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,
    setRenderTarget:(next,f=0,m=0)=>{current=next;face=f;mip=m;},
    render:(world,camera)=>{
      assert.equal(current,target);assert.equal(water.visible,false);assert.equal(lettering.visible,false);
      assert.equal(renderer.xr.enabled,false);assert.equal(camera,probe.children[face]);
      if(face===fail)throw Error('test capture failure');faces.push(face);
    }};
  return {scene,water,lettering,probe,renderer,faces,original};
}
test('environment capture renders six yielded faces and restores renderer/visibility state',async()=>{
  const h=harness();
  assert.equal(await captureWorldEnvironment(h.renderer,h.scene,h.probe,[h.water,h.lettering],()=>false),true);
  assert.deepEqual(h.faces,[0,1,2,3,4,5]);assert.equal(h.renderer.getRenderTarget(),h.original);
  assert.equal(h.renderer.getActiveCubeFace(),2);assert.equal(h.renderer.getActiveMipmapLevel(),1);
  assert.equal(h.renderer.xr.enabled,true);assert.equal(h.water.visible,true);assert.equal(h.lettering.visible,false);
});
test('a cancelled or failed capture never strands a hidden object or render target',async()=>{
  const h=harness();
  assert.equal(await captureWorldEnvironment(h.renderer,h.scene,h.probe,[h.water],()=>h.faces.length===2),false);
  assert.deepEqual(h.faces,[0,1]);assert.equal(h.renderer.getRenderTarget(),h.original);assert.equal(h.water.visible,true);
  const failed=harness(1);
  await assert.rejects(captureWorldEnvironment(failed.renderer,failed.scene,failed.probe,[failed.water],()=>false));
  assert.equal(failed.renderer.getRenderTarget(),failed.original);assert.equal(failed.water.visible,true);assert.equal(failed.renderer.xr.enabled,true);
});
test('texture warm-up deduplicates maps and excludes render-target textures',async()=>{
  const scene=new THREE.Scene(),map=new THREE.Texture({width:8,height:8});
  const target=new THREE.WebGLRenderTarget(8,8);
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({map})));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.ShaderMaterial({uniforms:{shared:{value:map},reflection:{value:target.texture}}})));
  const uploaded=[];await warmWorldTextures({initTexture:t=>uploaded.push(t)},scene,()=>false);
  assert.deepEqual(uploaded,[map]);
});
test('startup does not draw before asynchronous shader preparation',()=>{
  const source=readFileSync(new URL('./portfolio-room.ts',import.meta.url),'utf8');
  const prepare=source.slice(source.indexOf('prepare:async()=>'),source.indexOf('},setActive:'));
  assert.ok(prepare.indexOf('await renderer.compileAsync')<prepare.indexOf('await captureRoofEnvironment'));
  assert.ok(prepare.indexOf('await warmWorldTextures')<prepare.indexOf('preparing=true'));
  assert.match(prepare,/await Promise\.all\(\[landscape\.ready,lettering\.ready,shopSign\.ready,photosReady\]\)/);
  assert.match(prepare,/try\{showNightLights\(true\);await renderer\.compileAsync\(scene,camera\);\}\s*finally\{showNightLights\(false\);\}/);
});
