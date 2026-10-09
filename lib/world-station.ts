import * as THREE from "three";
import { batchRoomGeometry } from "./room-geometry";
import type { TerminalSection } from "./portfolio-terminal";
import { VENDING_POSITION, VENDING_YAW } from "./world-props";
import {HOLOGRAM_PLACEMENT} from "./hologram-timing.mjs";

export const SIGN_DESTINATIONS:{label:string;action:TerminalSection}[]=[{label:"work",action:"resume"},{label:"projects",action:"work"},{label:"about",action:"about"},{label:"blogs",action:"blogs"},{label:"photos",action:"photos"},{label:"contact",action:"contact"}];
export const SIGN_SHAPES=[{width:1.2,height:1.02,roll:-.065,yaw:-.08},{width:1.03,height:.95,roll:.075,yaw:.1},{width:.95,height:.92,roll:-.045,yaw:.025},{width:.83,height:.98,roll:.095,yaw:-.11},{width:1.06,height:1.08,roll:-.055,yaw:.08},{width:1.24,height:.96,roll:.045,yaw:-.04}];
export type StationAction=TerminalSection|"night"|"bell"|"hologram";
export function createWorldStation(scene:THREE.Scene,materials:THREE.Material[],textures:THREE.Texture[]){
  const stage=new THREE.Scene(),hits:{mesh:THREE.Mesh;action:StationAction}[]=[];
  const metal=new THREE.MeshStandardMaterial({color:0x29434b,metalness:.72,roughness:.38});
  const brass=new THREE.MeshStandardMaterial({color:0xb99256,metalness:.75,roughness:.3});
  const glass=new THREE.MeshStandardMaterial({color:0xffd7a1,emissive:0xff9f42,emissiveIntensity:.45,roughness:.22});
  materials.push(metal,brass,glass);
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:number[],parent:THREE.Object3D=stage)=>{const o=new THREE.Mesh(g,m);o.position.set(...p as [number,number,number]);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const rod=(a:number[],b:number[],r:number,parent:THREE.Object3D=stage)=>{const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);const o=mesh(new THREE.CylinderGeometry(r,r,from.distanceTo(to),10),metal,from.clone().add(to).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());return o;};
  const hit=(p:number[],size:number[],action:StationAction)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),metal);o.position.set(...p as [number,number,number]);o.updateMatrixWorld();hits.push({mesh:o,action});return o;};
  const x=-3.6,z=3.16;
  mesh(new THREE.CylinderGeometry(.23,.34,.12,8),metal,[x,.13,z]);rod([x,.15,z],[x,3.83,z],.065);
  for(const y of [.4,1.6,3.2])mesh(new THREE.TorusGeometry(.075,.021,6,16),brass,[x,y,z]).rotation.x=Math.PI/2;
  const labels:THREE.MeshBasicMaterial[]=[];
  SIGN_DESTINATIONS.forEach(({label:signLabel,action},i)=>{
    const y=3.06-i*.39,direction=i%2?-1:1,shape=new THREE.Shape();
    const variation=SIGN_SHAPES[i],sign=new THREE.Group();sign.position.set(x,y,z+.05);sign.scale.set(variation.width,variation.height,1);sign.rotation.set(0,variation.yaw,variation.roll);stage.add(sign);
    shape.moveTo(-.72,-.16);shape.lineTo(.5,-.16);shape.lineTo(.74,0);shape.lineTo(.5,.16);shape.lineTo(-.72,.16);shape.closePath();
    const board=mesh(new THREE.ExtrudeGeometry(shape,{depth:.085,bevelEnabled:true,bevelSize:.015,bevelThickness:.012,bevelSegments:2,steps:1}),metal,[0,0,0],sign);board.scale.x=direction;
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=112;const ctx=canvas.getContext("2d")!;
    const colors=["#88ecde","#f6d285","#ffc979","#e2adfc","#a6d897","#91caff"];
    ctx.fillStyle=colors[i];ctx.fillRect(0,0,512,112);ctx.fillStyle="#142e3c";ctx.font="bold 58px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(signLabel,256,59);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
    const label=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});labels.push(label);materials.push(label);
    mesh(new THREE.PlaneGeometry(1.04,.25),label,[-.055*direction,0,.1],sign);
    for(const dx of [-.62,.42])mesh(new THREE.SphereGeometry(.022,8,6),brass,[dx*direction,0,.11],sign);
    sign.updateMatrixWorld();const proxy=hit([0,0,.08],[1.5,.34,.2],action);proxy.applyMatrix4(sign.matrixWorld);proxy.updateMatrixWorld();
  });
  // Two ribbed lanterns on the sign, and a matching brass lamp on the counter.
  const lamps=[{p:[x-.62,3.7,z],power:7},{p:[x+.62,3.7,z],power:7},{p:[2.95,2.72,.75],power:12},{p:[-5.35,1.48,-1.7],power:6},{p:[5.45,1.48,2.5],power:6}];
  const lights:(THREE.PointLight|THREE.SpotLight)[]=[],halos:THREE.Sprite[]=[];
  const glowCanvas=document.createElement("canvas");glowCanvas.width=glowCanvas.height=64;const gc=glowCanvas.getContext("2d")!;
  const gradient=gc.createRadialGradient(32,32,1,32,32,32);gradient.addColorStop(0,"rgba(255,206,134,.75)");gradient.addColorStop(.22,"rgba(255,159,76,.22)");gradient.addColorStop(1,"rgba(255,135,54,0)");gc.fillStyle=gradient;gc.fillRect(0,0,64,64);
  const glowTexture=new THREE.CanvasTexture(glowCanvas);textures.push(glowTexture);
  const haloMaterial=new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,opacity:0});materials.push(haloMaterial);
  lamps.forEach(({p},i)=>{
    if(i<2){rod([x,3.76,z],[p[0],3.76,p[2]],.035);rod([p[0],3.76,p[2]],[p[0],p[1]+.26,p[2]],.035);}
    if(i>2){rod([p[0],.22,p[2]],[p[0],p[1]-.28,p[2]],.055);mesh(new THREE.CylinderGeometry(.19,.25,.09,12),brass,[p[0],.22,p[2]]);}
    mesh(new THREE.SphereGeometry(.21,16,12),glass,p).scale.set(1,1.45,1);
    for(const dy of [-.28,.28])mesh(new THREE.CylinderGeometry(.2,.23,.07,16),brass,[p[0],p[1]+dy,p[2]]);
    for(let n=0;n<8;n++){
      const a=n*Math.PI/4,r=.215;rod([p[0]+Math.cos(a)*r,p[1]-.24,p[2]+Math.sin(a)*r],[p[0]+Math.cos(a)*r,p[1]+.24,p[2]+Math.sin(a)*r],.011);
    }
    const light=i===2?new THREE.SpotLight(0xffdbad,0,8,1.22,.75,2):new THREE.PointLight(0xffdbad,0,8,2);light.position.set(...p as [number,number,number]);stage.add(light);lights.push(light);
    // Only the counter lamp casts a cached local shadow. Its light can no
    // longer shine straight through the tram, without five shadow cubemaps.
    if(light instanceof THREE.SpotLight){light.target.position.set(2.95,1.15,1.55);stage.add(light.target);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.0002;light.shadow.normalBias=.035;light.shadow.camera.near=.08;light.shadow.camera.far=8;}
    const halo=new THREE.Sprite(haloMaterial);halo.position.copy(light.position);halo.scale.setScalar(1.9);stage.add(halo);halos.push(halo);
    hit(p,[.5,.7,.5],"night");
  });
  // Festoon cables fasten directly beneath the roof/awning edges. No rooftop
  // poles: each run sags below its two attachment hooks, with bulbs below it.
  const bulbMaterial=new THREE.MeshStandardMaterial({color:0xffe5b9,emissive:0xffbf69,emissiveIntensity:.2,roughness:.25});materials.push(bulbMaterial);
  const festoon=new THREE.Group();festoon.name="Lighting / under-eave festoons";stage.add(festoon);
  const runs=[{a:[-4.28,3.72,.53],b:[-2.42,3.72,.53],count:4,sag:.1},{a:[-2.35,3.43,1.5],b:[4.02,3.43,1.5],count:11,sag:.14},{a:[-4.28,3.72,-2.2],b:[4.28,3.72,-2.2],count:13,sag:.17},{a:[-4.4,3.72,-2.05],b:[-4.4,3.72,.39],count:4,sag:.1},{a:[4.4,3.72,-2.05],b:[4.4,3.72,.39],count:4,sag:.1}];
  for(const {a,b,count,sag} of runs){
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);
    const at=(t:number)=>{
      const p=from.clone().lerp(to,t).add(new THREE.Vector3(0,-sag*Math.sin(t*Math.PI),0));
      if(p.z>1.4)p.y+=.25*Math.exp(-Math.pow((p.x+.45)/1.1,4));
      return p;
    };
    for(const p of [a,b]){
      const anchorZ=p[1]<3.5?1.475:THREE.MathUtils.clamp(p[2],-2.16,.465);
      rod([p[0],p[1]+.028,anchorZ],p,.014,festoon);
      mesh(new THREE.TorusGeometry(.033,.01,5,10),brass,p,festoon);
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:21},(_,i)=>at(i/20))),28,.012,5,false),metal,[0,0,0],festoon);
    for(let i=0;i<count;i++){
      const p=at((i+.5)/count);
      // Leave the CRT's viewing corridor clear, including the close-up camera.
      // Keep the continuous cable above it; hang bulbs on either side only.
      if(p.z>1.4&&p.x> -1.35&&p.x<.45)continue;
      rod(p.toArray(),[p.x,p.y-.055,p.z],.014,festoon);
      mesh(new THREE.CylinderGeometry(.029,.034,.047,8),brass,[p.x,p.y-.075,p.z],festoon);
      mesh(new THREE.SphereGeometry(.048,10,8),bulbMaterial,[p.x,p.y-.13,p.z],festoon).scale.y=1.3;
    }
  }
  // The lamp's entire bracket shares the vending machine's local transform.
  // Its mounting plate overlaps the metal top, so turning the kiosk cannot
  // leave a world-positioned stem floating beside it.
  const kioskLamp=new THREE.Group();kioskLamp.name="Kiosk / bolted reading lamp";kioskLamp.position.set(...VENDING_POSITION);kioskLamp.rotation.y=VENDING_YAW;stage.add(kioskLamp);
  mesh(new THREE.BoxGeometry(.22,.035,.2),metal,[0,2.405,-.27],kioskLamp);
  for(const x of [-.075,.075])for(const z of [-.33,-.21])mesh(new THREE.SphereGeometry(.016,8,6),brass,[x,2.429,z],kioskLamp);
  const lampCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,2.42,-.27),new THREE.Vector3(0,2.91,-.27),new THREE.Vector3(0,3.07,-.1),new THREE.Vector3(0,3.07,.36),new THREE.Vector3(0,3.01,.44)]);
  mesh(new THREE.TubeGeometry(lampCurve,24,.025,8,false),metal,[0,0,0],kioskLamp);
  mesh(new THREE.CylinderGeometry(.055,.19,.14,20),metal,[0,2.95,.44],kioskLamp);
  mesh(new THREE.SphereGeometry(.058,12,8),bulbMaterial,[0,2.875,.44],kioskLamp);
  kioskLamp.updateMatrixWorld(true);const lampPoint=kioskLamp.localToWorld(new THREE.Vector3(0,2.865,.44));
  const accentPowers=[12,12,9];
  const accents=[[-2.9,3.48,.65],[2.8,3.16,1.25],lampPoint.toArray()].map((p,i)=>{
    const light=new THREE.PointLight(0xffd2a0,0,i===2?4.5:7,2);light.position.set(...p as [number,number,number]);stage.add(light);return light;
  });
  // A spring-loaded service bell at the counter, with a physically moving cap.
  const bell=new THREE.Group();bell.position.set(-.25,2.27,1.03);bell.userData.dynamic=true;stage.add(bell);
  mesh(new THREE.CylinderGeometry(.15,.18,.045,20),metal,[0,0,0],bell);
  const cap=mesh(new THREE.SphereGeometry(.14,20,12,0,Math.PI*2,0,Math.PI/2),brass,[0,.025,0],bell);
  mesh(new THREE.CylinderGeometry(.025,.025,.07,10),metal,[0,.17,0],cap);
  mesh(new THREE.SphereGeometry(.045,12,8),brass,[0,.22,0],cap);
  hit([-.25,2.42,1.03],[.45,.5,.4],"bell");hit([HOLOGRAM_PLACEMENT.x,HOLOGRAM_PLACEMENT.y,HOLOGRAM_PLACEMENT.z],[2.7*HOLOGRAM_PLACEMENT.scale,1.9*HOLOGRAM_PLACEMENT.scale,2.7*HOLOGRAM_PLACEMENT.scale],"hologram");
  // The small wayfinder assembly stays in larger batches even when its lamp
  // arm crosses a paving-cell boundary; other world geometry retains 4m cells.
  batchRoomGeometry(stage,bell,8);
  const root=new THREE.Group();root.name="Station / illuminated wayfinder and lanterns";root.add(...stage.children);scene.add(root);
  let ringing=0,lastNight=-1;
  return {hits,lights,accents,root,ring:()=>{ringing=1;},update:(night:number,dt:number)=>{
    if(night!==lastNight){
      lastNight=night;lights.forEach((l,i)=>{l.intensity=lamps[i].power*night;});glass.emissiveIntensity=.2+night*1.6;haloMaterial.opacity=night*.35;
      accents.forEach((l,i)=>{l.intensity=accentPowers[i]*night;});bulbMaterial.emissiveIntensity=.2+night*5;
      labels.forEach(m=>m.color.setScalar(1-night*.12));
    }
    if(ringing>0){ringing=Math.max(0,ringing-dt*1.4);cap.position.y=.025-Math.sin((1-ringing)*24)*ringing*.035;cap.updateMatrix();bell.updateMatrixWorld(true);}
  },dispose:()=>{hits.forEach(h=>h.mesh.geometry.dispose());}};
}
