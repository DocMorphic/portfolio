import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {buildTramCab} from "./tram-cab.ts";
import {readFileSync} from "node:fs";

test("cab seat, controls and partition are fitted inside a single driving bay",()=>{
  const material=new THREE.MeshStandardMaterial(),p=Object.fromEntries(["steel","dark","wood","ivory","leather","red","white"].map(k=>[k,material]));
  const cab=buildTramCab(new THREE.Group(),p);cab.updateMatrixWorld(true);
  const bounds=name=>new THREE.Box3().setFromObject(cab.getObjectByName(name));
  const base=bounds("Cab / seat floor plate"),seat=bounds("Cab / supported seat cushion"),console=bounds("Cab / floor-mounted console");
  assert.ok(Math.abs(base.min.y-.935)<.001,"seat base touches finished floor");
  assert.ok(Math.abs(console.min.y-.94)<.001,"console has no floating underside");
  assert.ok(seat.min.x>console.max.x+.4,"footwell separates the seat from the console");
  assert.ok(cab.getObjectByName("Cab / supported backrest"));
  const all=new THREE.Box3().setFromObject(cab);
  assert.ok(all.min.x> -4.2&&all.max.x< -1.65&&all.min.z> -1.12&&all.max.z<1.12,"cab equipment stays inside carriage glazing");
  cab.traverse(o=>{if(o.geometry){for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));o.geometry.dispose();}});material.dispose();
});

test("rear slogans are removed and the old loose steering assembly is gone",()=>{
  const source=readFileSync(new URL("./side-quest-world-model.ts",import.meta.url),"utf8");
  assert.doesNotMatch(source,/"build cool shit"|"end of the line, or maybe the start\?"/);
  assert.doesNotMatch(source,/TAKE THE SCENIC ROUTE|END OF THE LINE · START SOMETHING|const steering=/);
});
