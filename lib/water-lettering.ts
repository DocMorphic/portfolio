import * as THREE from "three";
import {FontLoader,type Font} from "three/addons/loaders/FontLoader.js";
import {TextGeometry} from "three/addons/geometries/TextGeometry.js";
import {yieldLoadingWork} from "./loading-work";

export const WATER_INTRO=["Dharmay Dave","Student","Developer","Game enthusiast"] as const;
export function waterLetterGeometry(text:string,font:Font,heading=false){
  const geometry=new TextGeometry(text,{font,size:heading?.69:.38,depth:heading?.055:.022,curveSegments:5,bevelEnabled:heading,bevelSize:.006,bevelThickness:.005,bevelSegments:1});
  geometry.computeBoundingBox();const bounds=geometry.boundingBox!;
  geometry.translate(-(bounds.max.x+bounds.min.x)/2,0,0);geometry.rotateX(-Math.PI/2);
  // Only the upward faces are ivory. Dark undersides keep the reflection from
  // becoming a second equally bright line of type beneath every role.
  const top:number[]=[],sides:number[]=[],normal=geometry.attributes.normal;
  for(let i=0;i<normal.count;i+=3){const target=normal.getY(i)>.5?top:sides;target.push(i,i+1,i+2);}
  geometry.setIndex([...top,...sides]);geometry.clearGroups();geometry.addGroup(0,top.length,0);geometry.addGroup(top.length,sides.length,1);
  return geometry;
}
/** Actual raised letters, not a camera-facing caption or rectangular decal. */
export function createWaterLettering(scene:THREE.Scene){
  let disposed=false;
  const root=new THREE.Group();root.name="Lake / floating introduction";root.position.set(2.2,-.455,7);root.rotation.y=0;root.userData.dynamic=true;scene.add(root);
  // Just the name rests on three weathered floating planks. The roles still
  // meet the water directly, avoiding a huge, flat oval behind the typography.
  const driftwood=new THREE.MeshStandardMaterial({color:0x6a6252,roughness:.88});
  const raftGeometry=new THREE.BoxGeometry(5.3,.06,.21);
  for(let i=0;i<3;i++){
    const plank=new THREE.Mesh(raftGeometry,driftwood);plank.position.set((i-1)*.045,-.045,(i-1)*.235);plank.rotation.y=(i-1)*.012;plank.receiveShadow=true;root.add(plank);
  }
  const panelMaterial=new THREE.MeshPhysicalMaterial({color:0xe9ece4,metalness:.08,roughness:.18,transparent:true,opacity:.7,depthWrite:false,clearcoat:1,clearcoatRoughness:.13});
  const panelGeometry=new THREE.BoxGeometry(5.55,2.45,.06);
  const panel=new THREE.Mesh(panelGeometry,panelMaterial);panel.position.set(0,1.2,-.11);panel.castShadow=false;root.add(panel);
  const supportMaterial=new THREE.MeshStandardMaterial({color:0x615b4c,roughness:.55,metalness:.45});
  const supportGeometry=new THREE.CylinderGeometry(.037,.048,2.45,8);
  for(const x of [-2.52,2.52]){const support=new THREE.Mesh(supportGeometry,supportMaterial);support.position.set(x,1.2,-.13);root.add(support);}
  // Frosted, translucent lettering: real specular/environment highlights,
  // without an expensive full-scene transmission pass for a few small letters.
  const face=new THREE.MeshPhysicalMaterial({color:0x10171b,roughness:.18,metalness:.08,transparent:true,opacity:.88,depthWrite:false,ior:1.45,clearcoat:1,clearcoatRoughness:.08});
  const edge=new THREE.MeshStandardMaterial({color:0x172126,roughness:.24,metalness:.18,transparent:true,opacity:.38,depthWrite:false});
  const dayColor=new THREE.Color(0x10171b),nightColor=new THREE.Color(0xf3f5f4),dayEdge=new THREE.Color(0x172126),nightEdge=new THREE.Color(0xbac9cf);
  const dayPanel=new THREE.Color(0xe9ece4),nightPanel=new THREE.Color(0x172127);
  const meshes:THREE.Mesh[]=[];
  const loader=new FontLoader();
  const ready=Promise.all([loader.loadAsync('/fonts/helvetiker_bold.typeface.json'),loader.loadAsync('/fonts/helvetiker_regular.typeface.json')]).then(async([bold,regular])=>{
    if(disposed)return;
    let left=0;
    for(const [i,text] of WATER_INTRO.entries()){
      await yieldLoadingWork();if(disposed)return;
      const geometry=waterLetterGeometry(text,i?regular:bold,i===0),mesh=new THREE.Mesh(geometry,[face,edge]);
      geometry.rotateX(Math.PI/2);
      geometry.computeBoundingBox();const width=geometry.boundingBox!.max.x-geometry.boundingBox!.min.x;
      if(i===0)left=-width/2;else mesh.position.x=left+width/2;
      mesh.position.y=i===0?1.72:1.23-(i-1)*.43;mesh.position.z=.02;mesh.name=`Lake lettering / ${text}`;root.add(mesh);meshes.push(mesh);
      mesh.updateMatrix();mesh.matrixAutoUpdate=false;
    }
    root.updateMatrix();root.updateMatrixWorld(true);
  }).catch(()=>{});
  return {root,ready,update:(seconds:number,night:number,reduced=false)=>{
    root.position.y=-.455+(reduced?0:Math.sin(seconds*.75)*.006);
    root.rotation.z=0;
    face.color.copy(dayColor).lerp(nightColor,night);edge.color.copy(dayEdge).lerp(nightEdge,night);
    panelMaterial.color.copy(dayPanel).lerp(nightPanel,night);
    // Low neutral fill preserves pale glass at night, without coloured neon
    // tubes, halos or a second luminous outline in the water reflection.
    face.emissive.set(0xffffff);face.emissiveIntensity=night*.13;
    root.updateMatrix();root.updateMatrixWorld(true);
  },dispose:()=>{disposed=true;meshes.forEach(m=>m.geometry.dispose());raftGeometry.dispose();panelGeometry.dispose();supportGeometry.dispose();driftwood.dispose();panelMaterial.dispose();supportMaterial.dispose();face.dispose();edge.dispose();}};
}
