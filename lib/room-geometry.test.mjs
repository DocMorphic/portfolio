import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { batchRoomGeometry, drapedCloth } from "./room-geometry.ts";

test("draped fabric has finite normals, visible folds and a hanging edge",()=>{
  for(const [w,d,drop] of [[1.25,1.98,.67],[3.35,2,.47]]){
    const geometry=drapedCloth(w,d,drop);
    for(const attribute of Object.values(geometry.attributes))assert.ok(Array.from(attribute.array).every(Number.isFinite));
    assert.ok(geometry.boundingBox.min.y<-drop*.9);
    assert.ok(geometry.boundingBox.max.y>.01);
    assert.ok(Math.abs(geometry.boundingBox.max.x-geometry.boundingBox.min.x-w)<.03);
    geometry.dispose();
  }
});

test("static detail batches preserve world-space vertices and shadow settings",()=>{
  const scene=new THREE.Scene(),parent=new THREE.Group(),protectedRoot=new THREE.Group();
  parent.position.set(.8,1,1);parent.rotation.y=.4;scene.add(parent,protectedRoot);
  const material=new THREE.MeshStandardMaterial();
  for(let i=0;i<3;i++){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.3,.2),material);mesh.position.set(i*.3,0,0);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);
  }
  scene.updateMatrixWorld(true);
  const originalBounds=new THREE.Box3().setFromObject(parent);
  batchRoomGeometry(scene,protectedRoot);
  const batch=scene.children.find(o=>o.name==="Apartment / static detail batch");
  assert.ok(batch);assert.equal(parent.children.length,0);
  const bounds=new THREE.Box3().setFromObject(batch);
  assert.ok(bounds.min.distanceTo(originalBounds.min)<1e-6);assert.ok(bounds.max.distanceTo(originalBounds.max)<1e-6);
  assert.equal(batch.castShadow,true);assert.equal(batch.receiveShadow,true);
  assert.ok(batch.geometry.index,'batches keep shared vertices');
  assert.equal(batch.geometry.attributes.position.count,72,'three cubes retain 24 vertices each, not 36');
  assert.equal(batch.geometry.index.count,108,'all original triangles are retained');
});

test("batching leaves the computer hit targets, transparent glass and instances intact",()=>{
  const scene=new THREE.Scene(),computer=new THREE.Group();scene.add(computer);
  const material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(.2,.2,.2);
  const screen=new THREE.Mesh(geometry,material),key=screen.clone();computer.add(screen,key);
  const glass=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({transparent:true,opacity:.2}));
  const instances=new THREE.InstancedMesh(geometry,material,2);scene.add(glass,instances);
  batchRoomGeometry(scene,computer);
  assert.equal(screen.parent,computer);assert.equal(key.parent,computer);assert.equal(glass.parent,scene);assert.equal(instances.parent,scene);
});

test("the centered tram cell merges matching parts across both world axes",()=>{
  const scene=new THREE.Scene(),protectedRoot=new THREE.Group(),material=new THREE.MeshStandardMaterial();scene.add(protectedRoot);
  for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),material);mesh.position.set(x,0,z);scene.add(mesh);
  }
  batchRoomGeometry(scene,protectedRoot,8);
  assert.equal(scene.children.filter(o=>o.name==="Apartment / static detail batch").length,1);
});

test("opaque room batches still occlude the CRT when raycasting",()=>{
  const scene=new THREE.Scene(),computer=new THREE.Group();scene.add(computer);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());computer.add(screen);
  const material=new THREE.MeshStandardMaterial();
  for(let i=0;i<2;i++){const wall=new THREE.Mesh(new THREE.BoxGeometry(1,1,.1),material);wall.position.set(i,0,1);scene.add(wall);}
  batchRoomGeometry(scene,computer);scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,0,3),new THREE.Vector3(0,0,-1));
  assert.notEqual(ray.intersectObjects(scene.children,true)[0].object,screen);
});
