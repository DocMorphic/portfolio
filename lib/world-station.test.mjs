import test from "node:test";
import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import * as THREE from "three";
registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith("./")&&!/\.[a-z]+$/i.test(specifier)&&context.parentURL?.includes("/lib/"))return next(specifier+".ts",context);
  return next(specifier,context);
}});
const {createWorldStation,SIGN_DESTINATIONS,SIGN_SHAPES}=await import("./world-station.ts");

test("varied wayfinder signs keep transformed hit targets and one bounded local lamp shadow",()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>new Proxy({
    createRadialGradient:()=>({addColorStop(){}}),
  },{get:(target,key)=>key in target?target[key]:()=>{}})})};
  const scene=new THREE.Scene(),materials=[],textures=[];
  let station;
  try{station=createWorldStation(scene,materials,textures);}finally{globalThis.document=previous;}
  assert.deepEqual(station.hits.slice(0,5).map(h=>h.action),SIGN_DESTINATIONS);
  assert.equal(new Set(SIGN_SHAPES.map(s=>s.width)).size,5);
  assert.equal(new Set(SIGN_SHAPES.map(s=>s.roll)).size,5);
  station.hits.slice(0,5).forEach((h,i)=>{assert.ok(Math.abs(h.mesh.rotation.z-SIGN_SHAPES[i].roll)<.001);assert.ok(Math.abs(h.mesh.scale.x-SIGN_SHAPES[i].width)<.001);});
  assert.equal(station.lights.length,5);
  assert.equal(station.lights[0].position.z,station.lights[1].position.z,"paired lanterns share the same mounting plane");
  assert.equal(station.lights[0].position.y,station.lights[1].position.y);
  assert.ok(Math.abs((station.lights[0].position.x+station.lights[1].position.x)/2+3.6)<1e-8);
  assert.equal(station.accents.length,3,"two eave pools and a kiosk downlight, without extra shadows");
  // Cast through the screen corridor where hanging bulbs used to obscure it.
  scene.updateMatrixWorld(true);
  const fixtures=[];station.root.traverse(o=>{if(o.isMesh)fixtures.push(o);});
  for(let x=-.85;x<=-.05;x+=.08)for(let y=2.9;y<=3.35;y+=.05){
    const ray=new THREE.Raycaster(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1),0,.65);
    assert.equal(ray.intersectObjects(fixtures,false).length,0,"no hanging fixtures in front of the CRT");
  }
  assert.ok(station.accents.every(l=>l.position.y<3.6),"lights follow the under-eave fixtures, not floating above the roof");
  assert.ok(station.accents.every(l=>!l.castShadow));
  assert.equal(station.lights.filter(l=>l.castShadow).length,1);
  assert.equal(station.lights[2].shadow.mapSize.x,512);
  station.update(0,0);assert.ok(station.lights.every(l=>l.intensity===0));
  station.update(.5,0);assert.deepEqual(station.lights.map(l=>l.intensity),[3.5,3.5,6,3,3]);
  station.update(1,0);assert.deepEqual(station.lights.map(l=>l.intensity),[7,7,12,6,6]);
  const bell=station.root.children.find(o=>o.userData.dynamic);
  assert.ok(bell);const cap=bell.children[1];
  bell.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
  const before=cap.matrix.clone();station.ring();station.update(1,.1);
  assert.ok(!before.equals(cap.matrix),"bell animates even after static scene matrices freeze");
  let draws=0;
  scene.traverse(o=>{if(o.isMesh){draws++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));o.geometry.dispose();}});
  assert.ok(draws<32,`${draws} batched station and festoon draws`);
  station.dispose();materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
});
