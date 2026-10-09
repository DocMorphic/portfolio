import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** A real draped surface with thickness added by its double-sided cloth material. */
export function drapedCloth(width:number,depth:number,drop:number) {
  const geometry=new THREE.PlaneGeometry(width,depth,40,36);
  geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),u=x/width,v=z/depth;
    const edge=Math.max(0,(v-.08)/.42);
    const folds=Math.sin(u*43+v*5)*.024+Math.sin(u*19-v*8)*.014;
    positions.setXYZ(i,x+Math.sin(v*16)*.009,folds-drop*edge*edge,z-edge*edge*depth*.2);
  }
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Bake static props into material/spatial batches. Keep the interactive CRT separate. */
export function batchRoomGeometry(scene:THREE.Scene,protectedRoot:THREE.Object3D,cellSize=4) {
  for(const _ of batchRoomGeometrySteps(scene,protectedRoot,cellSize))void _;
}
/** The loader can yield while cloning/merging thousands of static meshes. */
export function* batchRoomGeometrySteps(scene:THREE.Scene,protectedRoot:THREE.Object3D,cellSize=4) {
  scene.updateMatrixWorld(true);
  const protectedObjects=new Set<THREE.Object3D>();protectedRoot.traverse(o=>protectedObjects.add(o));
  const batches=new Map<string,{source:THREE.Mesh[];geometry:THREE.BufferGeometry[];material:THREE.Material;cast:boolean;receive:boolean}>();
  const objects:THREE.Mesh[]=[];scene.traverse(object=>{if(object instanceof THREE.Mesh)objects.push(object);});
  let count=0;
  for(const object of objects){
    if(object instanceof THREE.InstancedMesh||protectedObjects.has(object)||Array.isArray(object.material)||object.material.transparent)continue;
    let dynamic=false;for(let node:THREE.Object3D|null=object;node;node=node.parent)if(node.userData.dynamic){dynamic=true;break;}
    if(dynamic)continue;
    // Nearby batches retain useful raycast bounds instead of one room-sized bound.
    const p=object.getWorldPosition(new THREE.Vector3());
    // Center the first cell on the tram. An origin-aligned grid needlessly
    // splits nearly every shared material at x=0 and z=0, multiplying draws.
    const key=[object.material.uuid,object.castShadow,object.receiveShadow,Math.floor((p.x+cellSize/2)/cellSize),Math.floor((p.z+cellSize/2)/cellSize)].join(":");
    let batch=batches.get(key);
    if(!batch){batch={source:[],geometry:[],material:object.material,cast:object.castShadow,receive:object.receiveShadow};batches.set(key,batch);}
    // Preserve shared vertices. Expanding every bolt/prop to triangle soup
    // costs CPU while the loader runs and triples many GPU vertex buffers.
    const geometry=object.geometry.clone();
    if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
    geometry.applyMatrix4(object.matrixWorld);
    batch.source.push(object);batch.geometry.push(geometry);
    if(++count%48===0)yield;
  }
  for(const batch of batches.values()){
    if(batch.source.length<2){batch.geometry.forEach(g=>g.dispose());continue;}
    const geometry=mergeGeometries(batch.geometry,false);
    batch.geometry.forEach(g=>g.dispose());
    if(!geometry)continue;
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,batch.material);mesh.castShadow=batch.cast;mesh.receiveShadow=batch.receive;
    mesh.name="Apartment / static detail batch";scene.add(mesh);
    for(const source of batch.source){source.removeFromParent();source.geometry.dispose();}
    yield;
  }
}
