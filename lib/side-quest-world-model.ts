import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildRetroComputer } from "./retro-computer-model";
import { batchRoomGeometrySteps } from "./room-geometry";
import {yieldLoadingWork} from "./loading-work";
import { TRAM_POSTCARDS,createIndigoPostcard } from "./tram-postcards";
import { createMarioArcade } from "./tram-arcade";
import { createTramGarden, FLOWER_BEDS } from "./tram-garden";
import { createTramWindows } from "./tram-windows";
import { buildTramInterior } from "./tram-interior";
import { buildWorldProps, VENDING_POSITION, VENDING_YAW } from "./world-props";
import { buildCoffeeCup } from "./tram-coffee";
import {createQuestBoard} from './tram-quest-board';

export type WorldStop = "home" | "work" | "resume" | "photos" | "blogs" | "contact";
export const WORLD_STOPS: {id:WorldStop;label:string;description:string}[] = [
  {id:"home",label:"The counter",description:"Use the original portfolio terminal"},
  {id:"work",label:"Arcade",description:"Projects & experiments"},
  {id:"resume",label:"The case board",description:"Experience & education"},
  {id:"photos",label:"Postcards",description:"Photographs from my travels"},
  {id:"blogs",label:"Journal vending machine",description:"Notes & writing"},
  {id:"contact",label:"Mailbox",description:"Get in touch"},
];
export type WorldLandmark = {id:WorldStop;hit:THREE.Mesh;target:THREE.Vector3;camera:THREE.Vector3};

/** An original miniature, modeled in real geometry. No flat concept-art backdrop. */
export function buildSideQuestWorld(scene:THREE.Scene) {
  const steps=buildSideQuestWorldSteps(scene);let next=steps.next();
  while(!next.done)next=steps.next();return next.value;
}
export async function buildSideQuestWorldAsync(scene:THREE.Scene){
  const steps=buildSideQuestWorldSteps(scene);let slice=performance.now(),next=steps.next();
  while(!next.done){
    if(performance.now()-slice>=6){await yieldLoadingWork();slice=performance.now();}
    next=steps.next();
  }return next.value;
}
function* buildSideQuestWorldSteps(scene:THREE.Scene) {
  const materials:THREE.Material[]=[],textures:THREE.Texture[]=[];
  const tramWindows=createTramWindows(materials);
  const mat=(color:number,roughness=.72,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness});materials.push(m);return m;};
  const cream=mat(0xe9d9b5),red=mat(0xa84c35),redLight=mat(0xc96a45),navy=mat(0x294951),dark=mat(0x253637),brass=mat(0xb99151,.4,.55),wood=mat(0x916244),woodLight=mat(0xc79861),stone=mat(0xa9a28e),mortar=mat(0x666c64),soil=mat(0x494b36),rubber=mat(0x303532),paper=mat(0xffe4b4),green=mat(0x526d43),lightGreen=mat(0x87a05c),gold=mat(0xe3b44d);
  const glow=mat(0xffe2a4);glow.emissive.set(0xffb958);glow.emissiveIntensity=1.2;
  const glass=mat(0x93b5aa,.22,.12);glass.transparent=true;glass.opacity=.38;glass.depthWrite=false;
  glass.emissive.set(0x5d3c18);glass.emissiveIntensity=.2;
  let seed=78;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const group=(name:string,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);scene.add(g);return g;};
  const mesh=(parent:THREE.Object3D,geo:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(p:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,r=.025)=>mesh(p,r?new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const cyl=(p:THREE.Object3D,r:number,h:number,x:number,y:number,z:number,m:THREE.Material,r2=r,segments=16)=>mesh(p,new THREE.CylinderGeometry(r2,r,h,segments),m,x,y,z);
  const ball=(p:THREE.Object3D,r:number,x:number,y:number,z:number,m:THREE.Material)=>mesh(p,new THREE.SphereGeometry(r,12,8),m,x,y,z);
  const rod=(p:THREE.Object3D,a:number[],b:number[],r:number,m:THREE.Material)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const o=cyl(p,r,delta.length(),0,0,0,m);o.position.copy(start.add(end).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
  const label=(p:THREE.Object3D,text:string,w:number,h:number,x:number,y:number,z:number,bg="#e9d9b5",fg="#293d40")=>{
    const c=document.createElement("canvas");c.width=1024;c.height=Math.max(96,Math.round(1024*h/w));const ctx=c.getContext("2d")!;
    ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle=fg;ctx.lineWidth=5;ctx.strokeRect(12,12,c.width-24,c.height-24);
    ctx.fillStyle=fg;ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`bold ${Math.min(c.height*.57,900/Math.max(text.length,1)*1.45)}px monospace`;ctx.fillText(text,c.width/2,c.height/2+2);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;textures.push(tex);const m=new THREE.MeshBasicMaterial({map:tex});materials.push(m);
    return mesh(p,new THREE.PlaneGeometry(w,h),m,x,y,z);
  };
  // Subtle original surface wear: tonal variation, not noisy photo overlays.
  const surfaceTexture=(grain:boolean)=>{
    const c=document.createElement("canvas");c.width=c.height=256;const ctx=c.getContext("2d")!;ctx.fillStyle="#f8f4e9";ctx.fillRect(0,0,256,256);
    for(let i=0;i<(grain?150:1800);i++){
      ctx.fillStyle=`rgba(74,63,47,${grain?.04+random()*.09:.015+random()*.055})`;
      ctx.fillRect(random()*256,random()*256,grain?10+random()*80:1+random()*3,grain?.6:1+random()*2);
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;textures.push(t);return t;
  };
  const paintTexture=surfaceTexture(false),woodTexture=surfaceTexture(true);
  for(const m of [cream,red,redLight,navy,stone])m.map=paintTexture;
  for(const m of [wood,woodLight]){m.map=woodTexture;m.bumpMap=woodTexture;m.bumpScale=.008;}
  const windowFrame=(p:THREE.Object3D,x:number,y:number,z:number,w:number,h:number)=>{
    for(const dx of [-w/2,w/2])box(p,.085,h+.13,.13,x+dx,y,z,cream,.025);
    for(const dy of [-h/2,h/2])box(p,w+.08,.085,.13,x,y+dy,z,cream,.025);
    for(const dx of [-w/2+.06,w/2-.06])box(p,.023,h-.035,.145,x+dx,y,z,brass,.005);
    tramWindows.add(p,x,y,z,w,h);
  };
  // Island-like platform: layered stone edging, staggered paving, inset track.
  const platform=group("Platform / raised garden station");
  box(platform,13.5,.48,9.1,0,-.24,0,mortar,.24);
  for(let x=0;x<18;x++){for(let z=0;z<12;z++){
    const tile=box(platform,.73,.16,.72,-6.35+x*.75+(z%2)*.02,.04,-4.1+z*.75,stone,.035);tile.rotation.y=(random()-.5)*.035;
  }if(x%3===2)yield;}
  for(const z of [-4.47,4.47])for(let i=0;i<22;i++)box(platform,.59,.6,.22,-6.3+i*.6,-.18,z,i%4?stone:mortar,.035);
  for(const x of [-6.67,6.67])for(let i=0;i<14;i++)box(platform,.22,.6,.62,x,-.18,-4.12+i*.635,stone,.03);
  for(let x=-5.7;x<5.9;x+=.5)box(platform,.18,.11,1.55,x,.09,-.72,wood,.015);
  for(const z of [-1.23,-.24]){box(platform,12,.09,.085,0,.19,z,dark,.012);box(platform,12,.025,.12,0,.245,z,brass,.006);}
  // Main body runs along X; counter and front-facing details face positive Z.
  yield;
  const tram=group("Tram / converted garden arcade",0,0,-.85);
  box(tram,8.7,.3,2.55,0,.67,0,dark,.13);
  for(const z of [-1.165,1.165])box(tram,8.65,1.42,.12,0,1.43,z,red,.045);
  for(const x of [-4.265,4.265])box(tram,.12,1.42,2.25,x,1.43,0,red,.045);
  box(tram,8.4,.09,2.2,0,.86,0,dark,.015);
  box(tram,8.72,.12,2.49,0,2.13,0,brass,.04);
  box(tram,8.7,.19,2.47,0,3.72,0,cream,.065);
  box(tram,8.9,.56,2.65,0,4.02,0,navy,.27);
  box(tram,8.5,.045,2.55,0,3.78,0,brass,.02);
  // Roof seams, vent caps, rain gutters and rivets give the silhouette some age.
  for(const x of [-3.45,-2.1,0,2.1,3.45])box(tram,.035,.022,2.15,x,4.303,0,brass,.009);
  for(const x of [-2.5,1.8]){
    cyl(tram,.3,.17,x,4.36,-.17,dark);cyl(tram,.36,.065,x,4.48,-.17,brass);
    for(let n=0;n<3;n++)box(tram,.41,.025,.055,x,4.37+n*.045,.124,rubber,.008);
  }
  // Working-tram hardware: ceramic insulators and the articulated roof collector.
  yield;
  const collector=group("Tram / diamond pantograph",-.7,4.34,-1.02);
  for(const x of [-.62,.62])for(const z of [-.26,.26]){
    box(collector,.24,.09,.22,x,-.025,z,navy,.012);
    for(const dx of [-.085,.085])cyl(collector,.018,.025,x+dx,.031,z,brass);
    cyl(collector,.07,.16,x,.08,z,paper);
    for(let n=0;n<3;n++)cyl(collector,.092,.018,x,.035+n*.045,z,cream);
  }
  box(collector,1.55,.055,.71,0,.2,0,dark,.016);
  for(const z of [-.22,.22]){
    rod(collector,[-.58,.23,z],[.63,.68,z],.023,navy);
    rod(collector,[.58,.23,z],[-.63,.68,z],.023,navy);
    rod(collector,[-.63,.68,z],[0,1.12,z],.022,brass);
    rod(collector,[.63,.68,z],[0,1.12,z],.022,brass);
    for(const x of [-.63,.63])ball(collector,.04,x,.68,z,brass);
  }
  box(collector,1.18,.055,.12,0,1.15,0,rubber,.024);
  for(const x of [-.52,.52])rod(collector,[x,1.17,0],[x*1.25,1.09,0],.016,brass);
  for(const z of [-1.255,1.255])for(let i=0;i<40;i++)ball(tram,.018,-4.1+i*.21,2.06,z,brass);
  for(const x of [-3.1,2.95])for(const z of [-1.04,1.04]){
    const tire=cyl(tram,.47,.2,x,.54,z,rubber);tire.rotation.x=Math.PI/2;
    const hub=cyl(tram,.27,.22,x,.54,z,brass);hub.rotation.x=Math.PI/2;
    const cap=cyl(tram,.12,.24,x,.54,z,dark);cap.rotation.x=Math.PI/2;
    box(tram,1.1,.18,.16,x,.73,z,dark,.04);
    // Exposed spring, axle cover and brake hanger retain detail at grazing angles.
    for(const sx of [-.39,.39]){
      for(let n=0;n<5;n++)mesh(tram,new THREE.TorusGeometry(.057,.012,4,10),brass,x+sx,.58+n*.031,z*1.09).rotation.x=Math.PI/2;
      rod(tram,[x+sx,.78,z*1.12],[x+sx,.43,z*1.12],.019,navy);
    }
    for(let n=0;n<6;n++)ball(tram,.021,x+Math.cos(n*Math.PI/3)*.2,.54+Math.sin(n*Math.PI/3)*.2,z*1.13,cream);
  }
  for(const x of [-4.54,4.54]){
    const side=Math.sign(x);
    // The drawbar overlaps both the chassis mounting plate and coupler head.
    // Two diagonal stays carry the load back into the underframe; the old
    // isolated head had no attachment below the rounded body corner.
    box(tram,.14,.28,.66,side*4.22,.64,0,dark,.012);
    box(tram,.66,.15,.19,side*4.32,.535,0,navy,.014);
    for(const z of [-.2,.2]){
      rod(tram,[side*4.18,.72,z],[side*4.48,.515,z*.6],.032,navy);
      const bolt=cyl(tram,.036,.035,side*4.301,.655,z,brass,undefined,12);bolt.rotation.z=Math.PI/2;
    }
    box(tram,.43,.1,.33,x,.48,0,dark,.025);
    mesh(tram,new THREE.TorusGeometry(.11,.025,5,16),brass,x+(x>0?.13:-.13),.48,0).rotation.y=Math.PI/2;
  }
  for(const x of [-1.6,1.55]){
    box(tram,.85,.11,.4,x,.67,1.34,dark,.03);box(tram,.86,.07,.43,x,.51,1.48,brass,.02);
    for(let i=0;i<6;i++)box(tram,.035,.016,.34,x-.32+i*.13,.556,1.48,rubber,.002);
    for(const dx of [-.32,.32])rod(tram,[x+dx,.71,1.18],[x+dx,.53,1.54],.023,dark);
  }
  // Access hardware belongs on the front; keep the rear advertising band clear.
  yield;
  for(const z of [1.258])for(const x of [-2.8,0,2.8]){
    for(const dy of [-.29,.29])box(tram,1.77,.018,.014,x,1.44+dy,z,brass,.003);
    for(const dx of [-.89,.89])box(tram,.018,.59,.014,x+dx,1.44,z,brass,.003);
    box(tram,.2,.043,.045,x+.55,1.55,z,cream,.012);
    for(let n=0;n<6;n++)box(tram,.42,.023,.022,x-.3,1.26+n*.052,z+(z>0?.007:-.007),dark,.006);
  }
  // Rear wall is finished too: tall framed windows, advertising and bench seats.
  for(let i=0;i<7;i++){
    const x=-3.55+i*1.17;
    windowFrame(tram,x,2.94,-1.2,.99,1.36);
  }
  // Cab with three glazed panels and a round, lit headlamp.
  yield;
  for(const x of [-3.75,-2.68]){
    windowFrame(tram,x,2.94,1.2,.86,1.36);
    box(tram,.72,.027,.025,x,3.06,1.286,brass,.006);
    rod(tram,[x-.25,2.44,1.3],[x+.16,2.87,1.3],.018,dark);
  }
  for(const x of [-4.28,4.28]){
    for(const z of [-1.11,0,1.11])box(tram,.12,1.55,.095,x,2.92,z,cream,.025);
    for(const y of [2.18,3.66])box(tram,.12,.095,2.25,x,y,0,cream,.025);
    for(const z of [-.56,.56])tramWindows.add(tram,x,2.96,z,.97,1.34,Math.PI/2);
    box(tram,.2,.21,2.66,x,.94,0,dark,.05);
  }
  // All cab equipment is fitted together in buildTramInterior; no separate
  // floating steering wheel or orphaned seat back lives in the shell.
  const headlight=cyl(tram,.24,.14,-3.75,1.45,1.29,brass);headlight.rotation.x=Math.PI/2;
  const lens=cyl(tram,.185,.15,-3.75,1.45,1.34,glow);lens.rotation.x=Math.PI/2;
  for(const x of [-4.04,3.95]){const o=cyl(tram,.08,.05,x,1.02,1.25,glow);o.rotation.x=Math.PI/2;}
  // Open serving hatch, timber counter, paneled door and lit interior shelves.
  yield;
  for(const x of [-2.1,3.9])box(tram,.16,1.58,.23,x,2.93,1.05,woodLight,.035);
  box(tram,6.3,.16,.96,.92,2.12,1.35,woodLight,.045);
  box(tram,6.1,.055,.78,.92,2.22,1.35,wood,.02);
  for(let i=0;i<14;i++){box(tram,.025,1.1,.025,-1.96+i*.435,1.49,1.247,redLight,.005);}
  box(tram,4.8,.08,.42,.7,3.2,-.65,woodLight,.025);
  for(let i=0;i<5;i++){
    const x=-1.38+i*.36;const m=i%3===0?gold:i%3===1?green:cream;
    cyl(tram,.09,.26,x,3.37,-.6,m);cyl(tram,.06,.05,x,3.54,-.6,brass);
  }
  for(const x of [-1.4,.8,3]){
    rod(tram,[x,3.72,.6],[x,3.37,.6],.014,dark);
    cyl(tram,.17,.08,x,3.35,.6,brass,.075);ball(tram,.095,x,3.26,.6,glow);
  }
  box(tram,7.8,.028,.08,0,3.62,-.75,glow,.009);
  // Striped fabric awning with individual hanging scallops and support brackets.
  for(let i=0;i<20;i++){
    const x=-2.23+i*.323;
    const stripe=box(tram,.325,.045,1.28,x,3.64,1.69,i%2?paper:gold,.01);stripe.rotation.x=.16;
    box(tram,.324,.2,.065,x,3.445,2.31,i%2?paper:gold,.035);
  }
  // Woven edge seams and turnbuckles: details read as fabric rather than solid slabs.
  rod(tram,[-2.37,3.45,2.34],[4.03,3.45,2.34],.016,wood);
  for(const x of [-2.25,-.35,1.55,3.85]){
    rod(tram,[x,3.63,1.1],[x,3.53,2.26],.012,cream);
    ball(tram,.036,x,3.43,2.33,brass);
  }
  for(const x of [-2.32,4.02])rod(tram,[x,2.94,1.3],[x,3.53,2.29],.025,brass);
  // The roof title is built as separately mounted, extruded letters.
  // Shared real CRT, not a replacement toy model.
  yield;
  const computer=buildRetroComputer({keyFeedback:false});computer.rig.scale.setScalar(.49);computer.rig.position.set(-.45,2.23,.69);scene.add(computer.rig);
  materials.push(...computer.materials);textures.push(...computer.textures);
  // Desk peripherals project beyond the original serving counter. A cantilevered
  // tray supports their exact model bounds without moving the shared CRT.
  computer.rig.updateMatrixWorld(true);const keyboardBounds=new THREE.Box3().setFromObject(computer.keyboard);
  const trayTop=keyboardBounds.min.y;
  const tray=box(scene,2.05,.085,1.17,-.35,trayTop-.0425,1.12,woodLight,.035);tray.name="Computer / supported keyboard tray";
  const keyboardSupport=new THREE.Box3().setFromObject(tray);
  const baseTop=2.23+.14*.49,counterTop=2.2475;
  box(scene,1.13,baseTop-counterTop,.72,-.45,(baseTop+counterTop)/2,.749,wood,.016).name="Computer / fitted base plinth";
  for(const x of [-1.22,.48]){
    box(scene,.045,.045,.98,x,trayTop-.095,1.06,brass,.008);
    rod(scene,[x,1.81,.48],[x,trayTop-.11,1.56],.025,navy);
  }
  buildTramInterior(tram,materials,textures);
  // Ticket dispenser with a torn paper ticket, crank and numbered face.
  yield;
  const ticket=group("Counter / brass ticket machine",1.15,2.25,.72);
  box(ticket,.49,.46,.39,0,.22,0,brass,.13);box(ticket,.32,.055,.035,0,.24,.215,dark,.008);
  box(ticket,.23,.2,.009,0,.14,.247,paper,.006);label(ticket,"017",.2,.095,0,.165,.256);
  const crank=cyl(ticket,.09,.07,.28,.26,.025,dark);crank.rotation.z=Math.PI/2;rod(ticket,[.31,.27,.025],[.31,.12,.08],.025,brass);
  // A coffee cup, a little film camera and game cartridges, not repeated jars.
  const keepsakes=group("Counter / coffee camera and cartridges",0,2.23,0);
  buildCoffeeCup(keepsakes,materials,[1.78,.012,.7]);
  box(keepsakes,.42,.25,.21,-1.72,.14,.66,navy,.035);
  const cameraLens=cyl(keepsakes,.085,.09,-1.72,.14,.81,brass);cameraLens.rotation.x=Math.PI/2;
  const lensGlass=cyl(keepsakes,.057,.095,-1.72,.14,.82,dark);lensGlass.rotation.x=Math.PI/2;
  for(const r of [.069,.083])mesh(keepsakes,new THREE.TorusGeometry(r,.004,6,32),brass,-1.72,.14,.873);
  const glassCoating=new THREE.MeshPhysicalMaterial({color:0x233b48,metalness:.18,roughness:.1,clearcoat:1});materials.push(glassCoating);
  const optical=mesh(keepsakes,new THREE.CircleGeometry(.052,32),glassCoating,-1.72,.14,.873);optical.name="Camera / coated optical glass";
  box(keepsakes,.084,.034,.06,-1.6,.283,.64,dark,.01);cyl(keepsakes,.026,.013,-1.75,.282,.64,brass);
  box(keepsakes,.12,.035,.08,-1.84,.28,.66,brass,.015);
  for(let i=0;i<3;i++){
    box(keepsakes,.2,.32,.11,2.31+i*.24,.18,.48,i===0?navy:i===1?red:green,.012);
    label(keepsakes,["01","02","03"][i],.15,.16,2.31+i*.24,.21,.54);
  }
  // Arcade side silhouette is an extruded profile, not a stack of cubes.
  yield;
  const arcade=group("Arcade / projects",3.36,.12,1.42);
  const profile=new THREE.Shape();profile.moveTo(-.53,0);profile.lineTo(.59,0);profile.lineTo(.59,1.02);profile.lineTo(.95,1.08);profile.lineTo(.95,1.16);profile.lineTo(.47,1.25);profile.lineTo(.27,2.03);profile.lineTo(.48,2.12);profile.lineTo(.48,2.39);profile.lineTo(-.53,2.39);profile.closePath();
  // One closed volume, not overlapping side sheets and boxes. Decorations sit
  // outside it, with explicit clearance, so there are no coplanar surfaces.
  const cabinetGeo=new THREE.ExtrudeGeometry(profile,{depth:1.28,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.016,bevelThickness:.016,curveSegments:1});
  const cabinet=mesh(arcade,cabinetGeo,redLight,.64,0,0);cabinet.rotation.y=-Math.PI/2;cabinet.name="Arcade / closed cabinet shell";
  box(arcade,1.15,.93,.04,0,.49,.614,navy,.014);
  box(arcade,1.14,.24,.032,0,2.255,.507,navy,.012);
  label(arcade,"PROJECTS",1.05,.19,0,2.255,.526,"#a84c35","#ffe4b4");
  const bezel=box(arcade,1.11,.86,.075,0,1.65,.39,dark,.04);bezel.rotation.x=-.23;
  const game=document.createElement("canvas");game.width=256;game.height=240;const gc=game.getContext("2d")!;
  const arcadeLoop=createMarioArcade(gc);
  const gameTex=new THREE.CanvasTexture(game);gameTex.colorSpace=THREE.SRGBColorSpace;gameTex.magFilter=THREE.NearestFilter;textures.push(gameTex);
  const gameMat=new THREE.MeshBasicMaterial({map:gameTex,toneMapped:false});materials.push(gameMat);const gameScreen=mesh(arcade,new THREE.PlaneGeometry(.94,.72),gameMat,0,1.66,.438);gameScreen.rotation.x=-.23;
  const deck=box(arcade,1.16,.07,.55,0,1.255,.73,navy,.025);deck.rotation.x=.1;
  cyl(arcade,.1,.04,-.32,1.31,.76,dark);rod(arcade,[-.32,1.32,.76],[-.32,1.5,.76],.025,brass);ball(arcade,.075,-.32,1.51,.76,redLight);
  for(let i=0;i<4;i++)cyl(arcade,.049,.035,.12+(i%2)*.16,1.31-Math.floor(i/2)*.019,.61+Math.floor(i/2)*.19,i%2?gold:green);
  arcade.updateMatrixWorld(true);
  const arcadeModeHit=new THREE.Mesh(new THREE.BoxGeometry(.24,.19,.23),dark);arcadeModeHit.position.set(.45,1.35,.84);arcadeModeHit.applyMatrix4(arcade.matrixWorld);arcadeModeHit.updateMatrixWorld();
  const arcadeScreenHit=new THREE.Mesh(new THREE.BoxGeometry(1.08,.82,.1),dark);arcadeScreenHit.position.set(0,1.66,.48);arcadeScreenHit.rotation.x=-.23;arcadeScreenHit.applyMatrix4(arcade.matrixWorld);arcadeScreenHit.updateMatrixWorld();
  box(arcade,.29,.33,.055,0,.63,.663,dark,.025);box(arcade,.035,.13,.016,-.045,.64,.7,brass,.005);
  label(arcade,"INSERT CURIOSITY",.76,.16,0,.25,.642,"#294951","#e9d9b5");
  // Cabinet T-molding follows its actual shaped side; vents and screws finish the shell.
  for(const x of [-.676,.676]){
    const path=[[.55,.04],[.55,1.02],[.91,1.1],[.91,1.14],[.43,1.25],[.23,2.04],[.44,2.15],[.44,2.35],[-.49,2.35],[-.49,.04]];
    for(let i=0;i<path.length;i++){
      const a=path[i],b=path[(i+1)%path.length];rod(arcade,[x,a[1],a[0]],[x,b[1],b[0]],.018,cream);
    }
    for(let i=0;i<5;i++)box(arcade,.009,.027,.32,x,.35+i*.062,-.12,dark,.003);
  }
  for(const x of [-.49,.49])for(const y of [1.31,1.98])ball(arcade,.012,x,y,.442-(y-1.66)*.234,brass);
  for(let i=0;i<11;i++)box(arcade,.024,.052,.009,-.3+i*.06,2.15,.524,dark,.003);
  // Platform furniture: slatted bench, real open pages and sports keepsakes.
  yield;
  const bench=group("Bench / field notes",-.95,.1,2.28);
  for(const x of [-1.23,1.23]){
    rod(bench,[x,.03,-.29],[x,.69,-.32],.055,dark);rod(bench,[x,.03,.31],[x,.52,.24],.055,dark);
    rod(bench,[x,.51,-.32],[x,1.1,-.48],.045,dark);
    rod(bench,[x,.72,.27],[x,.72,-.36],.04,dark);
  }
  for(let i=0;i<4;i++)box(bench,2.83,.065,.145,0,.51,-.28+i*.17,i%2?wood:woodLight,.02);
  for(let i=0;i<3;i++){const o=box(bench,2.85,.18,.07,0,.77+i*.205,-.39-i*.034,woodLight,.015);o.rotation.x=-.15;}
  for(const x of [-1.2,1.2])for(let i=0;i<3;i++)ball(bench,.02,x,.78+i*.205,-.338-i*.034,brass);
  const volleyball=group("Keepsake / volleyball",-1.78,.36,2.83);volleyball.rotation.set(.4,0,.45);
  for(let i=0;i<6;i++)mesh(volleyball,new THREE.SphereGeometry(.255,8,12,i*Math.PI/3,Math.PI/3),[paper,gold,navy][i%3],0,0,0);
  const racket=group("Keepsake / squash racket",-2.55,.74,1.45);racket.rotation.z=.25;
  const hoop=mesh(racket,new THREE.TorusGeometry(.23,.026,6,28),brass,0,.34,0);hoop.scale.y=1.35;
  for(let i=-3;i<=3;i++){rod(racket,[i*.045,.1,.005],[i*.045,.58,.005],.003,paper);rod(racket,[-.18,.15+i*.055+.16,.005],[.18,.15+i*.055+.16,.005],.003,paper);}
  rod(racket,[-.12,.1,0],[0,-.15,0],.023,navy);rod(racket,[.12,.1,0],[0,-.15,0],.023,navy);rod(racket,[0,-.15,0],[0,-.51,0],.036,red);
  const questBoard=createQuestBoard(scene,materials,textures);
  // Indigo contact prints of the owner's actual travel photographs.
  yield;
  const cards=group("Postcards / travel collection",1.97,.12,2.04);
  cyl(cards,.3,.07,0,.04,0,brass);cyl(cards,.03,2.45,0,1.25,0,brass);
  label(cards,"POSTCARDS",1.06,.25,0,2.5,.055);
  const photoLoads:ReturnType<typeof createIndigoPostcard>[]=[],postcardHits:{hit:THREE.Mesh;folder:string;index:number}[]=[];
  for(let row=0;row<3;row++)for(let col=0;col<2;col++){
    const x=col*.49-.245,y=.7+row*.54,photo=TRAM_POSTCARDS[row*2+col];
    box(cards,.45,.43,.035,x,y,.12,paper,.007);
    const print=createIndigoPostcard(photo.folder,photo.index,textures,materials);photoLoads.push(print);
    mesh(cards,new THREE.PlaneGeometry(.395,.278),print.material,x,y+.027,.145);
    label(cards,photo.folder.toUpperCase(),.38,.063,x,y-.153,.146,"#e9d9b5","#293653");
    for(const dx of [-.21,.21])rod(cards,[x+dx,y-.22,.16],[x+dx,y-.09,.16],.008,brass);
    rod(cards,[x-.21,y-.21,.17],[x+.21,y-.21,.17],.009,brass);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(.45,.43,.045),new THREE.MeshBasicMaterial());
    hit.position.set(1.97+x,.12+y,2.185);hit.updateMatrixWorld();
    postcardHits.push({hit,folder:photo.folder,index:photo.index});
  }
  // Enamel postal station: cast feet, collection plate, brass hardware and a
  // working letter flap. Moving pieces are excluded from the static batches.
  const mail=group("Mailbox / contact",4.87,.1,2.78);mail.rotation.y=-.13;
  for(const x of [-.3,.3])for(const z of [-.22,.22]){cyl(mail,.065,.18,x,.09,z,brass);ball(mail,.075,x,.045,z,dark);}
  box(mail,.82,1.17,.69,0,.82,0,navy,.085);box(mail,.91,.12,.78,0,.26,0,brass,.04);
  box(mail,.89,.36,.78,0,1.49,0,red,.16);box(mail,.85,.045,.74,0,1.35,0,brass,.02);
  box(mail,.64,.78,.045,0,.74,.357,cream,.04);box(mail,.56,.7,.018,0,.74,.386,navy,.03);
  for(const x of [-.345,.345])for(const y of [.34,1.22])ball(mail,.019,x,y,.364,brass);
  for(const y of [.5,.96]){cyl(mail,.025,.12,-.34,y,.396,brass);ball(mail,.03,-.34,y+.06,.396,brass);}
  box(mail,.62,.135,.04,0,1.245,.373,dark,.012);
  const flap=new THREE.Group();flap.name="Mailbox / hinged brass letter flap";flap.position.set(0,1.32,.4);flap.userData.dynamic=true;mail.add(flap);
  box(flap,.63,.135,.023,0,-.067,0,brass,.008);
  label(mail,"POST",.7,.145,0,1.49,.4,"#a84c35","#ffe4b4");
  label(mail,"CONTACT",.49,.14,0,.96,.4,"#294951","#ffe4b4");
  label(mail,"COLLECTION",.43,.105,0,.67,.4,"#e9d9b5","#294951");
  label(mail,"MON–FRI  17:00",.43,.095,0,.56,.4,"#e9d9b5","#294951");
  const lock=cyl(mail,.04,.018,.19,.82,.4,brass);lock.rotation.x=Math.PI/2;
  box(mail,.009,.035,.008,.19,.81,.413,dark,.003);
  const flag=new THREE.Group();flag.name="Mailbox / collection flag";flag.position.set(.46,.95,0);flag.userData.dynamic=true;mail.add(flag);
  rod(flag,[0,0,0],[0,.62,0],.023,brass);box(flag,.22,.15,.032,.085,.56,0,redLight,.016);ball(mail,.054,.46,.95,0,brass);
  // A tied bundle of airmail beside the station; every envelope has a folded seal.
  yield;
  const letters=group("Mailbox / outgoing letters",5.44,.16,2.85);letters.rotation.y=.19;
  for(let i=0;i<3;i++){
    box(letters,.38,.024,.27,0,.03+i*.026,0,paper,.005);
    for(let n=0;n<5;n++)box(letters,.033,.004,.035,-.15+n*.073,.044+i*.026,.115,n%2?red:navy,.001);
  }
  rod(letters,[-.18,.097,-.1],[0,.1,.025],.003,wood);rod(letters,[.18,.097,-.1],[0,.1,.025],.003,wood);
  box(letters,.025,.006,.28,0,.106,0,woodLight,.002);ball(letters,.022,0,.113,0,red);
  let mailTime=0,mailAmount=0;
  const animateMailbox=(seconds:number,open:boolean)=>{
    const dt=Math.min(.05,Math.max(0,seconds-mailTime));mailTime=seconds;mailAmount+=(Number(open)-mailAmount)*(1-Math.exp(-dt*5));
    flap.rotation.x=-mailAmount*1.05;flag.rotation.z=.92-mailAmount*.92;
    for(const part of [flap,flag]){part.traverse(o=>{o.matrixAutoUpdate=true;});part.updateWorldMatrix(true,true);}
  };
  // Back platform has luggage, route signage, bicycle and a small bird bath.
  yield;
  const back=group("Back platform / waiting for the next adventure",0,.1,-2.8);
  for(const x of [-1.7,1.7])rod(back,[x,.02,-.25],[x,.95,-.25],.035,dark);
  for(let i=0;i<3;i++){
    const suitcase=box(back,.66,.5,.32,2.4+i*.15,.28+i*.5,0,i%2?red:navy,.07);suitcase.rotation.y=i*.14;
    box(back,.22,.055,.12,2.4+i*.15,.57+i*.5,0,brass,.02);
    for(const dx of [-.22,.22])box(back,.032,.47,.035,2.4+i*.15+dx,.28+i*.5,.165,woodLight,.007);
    label(back,["MUC","IN","AT"][i],.18,.14,2.4+i*.15,.3+i*.5,.177,"#e9d9b5","#294951");
  }
  // A harbor-like edge: mooring cleats and a rolled cable tie the station to the water.
  const mooring=group("Platform / mooring hardware and coil",0,.09,0);
  for(const x of [-5.45,5.45])for(const z of [-3.25,3.22]){
    cyl(mooring,.1,.08,x,.08,z,dark);cyl(mooring,.053,.2,x,.19,z,brass);
    box(mooring,.31,.055,.1,x,.3,z,brass,.025);
  }
  for(let n=0;n<5;n++){
    const coil=mesh(mooring,new THREE.TorusGeometry(.15+n*.032,.014,5,26),woodLight,4.5,.14,-3.18);coil.rotation.x=Math.PI/2;
  }
  const props=buildWorldProps(scene,materials,textures);
  const garden=group("Garden / planting beds and climbing vines");
  const leafGeo=new THREE.SphereGeometry(1,8,5);
  for(const [cx,cz,w,d] of FLOWER_BEDS){
    box(garden,w,.15,d,cx,.1,cz,soil,.12);
  }
  for(let i=0;i<32;i++){
    const y=.35+i*.115,x=-2.12+Math.sin(i*.8)*.1,z=.43+Math.cos(i*.5)*.09;
    const leaf=mesh(garden,leafGeo.clone(),i%2?green:lightGreen,x,y,z);leaf.scale.set(.12,.055,.07);leaf.rotation.z=i;
  }
  leafGeo.dispose();
  const livingGarden=createTramGarden(scene,materials);
  yield;
  // One station light, with a bent swan-neck shade. Warm bulbs, cheap static light.
  const lamp=group("Platform / evening lamp",-5.3,.08,-.2);
  cyl(lamp,.11,.12,0,.06,0,brass);cyl(lamp,.04,3.5,0,1.8,0,dark);
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,3.5,0),new THREE.Vector3(0,3.8,0),new THREE.Vector3(.45,3.83,0),new THREE.Vector3(.5,3.54,0)]);
  mesh(lamp,new THREE.TubeGeometry(curve,16,.032,6,false),dark,0,0,0);cyl(lamp,.2,.14,.5,3.5,0,brass,.045);ball(lamp,.085,.5,3.41,0,glow);
  const ambient=new THREE.HemisphereLight(0xd9e6f2,0x545b54,.85);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xfff2dc,2.25);sun.position.set(-9,5.7,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:9,bottom:-9,near:.1,far:40});sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xb9d1e5,.28);fill.position.set(4,5,-6);scene.add(fill);
  scene.updateMatrixWorld(true);
  // The tram is a compact diorama: 8m cells avoid splitting each material
  // across many tiny batches while retaining bounds for off-screen culling.
  yield* batchRoomGeometrySteps(scene,computer.screen,8);
  // Detached raycast proxies are never rendered and never block the CRT projection.
  const landmarks:WorldLandmark[]=[];
  const add=(id:WorldStop,p:number[],s:number[],camera:number[],target=p)=>{
    const hit=new THREE.Mesh(new THREE.BoxGeometry(...s as [number,number,number]),new THREE.MeshBasicMaterial());hit.position.set(...p as [number,number,number]);hit.updateMatrixWorld();
    landmarks.push({id,hit,target:new THREE.Vector3(...target),camera:new THREE.Vector3(...camera)});
  };
  add("home",[-.45,3.2,.98],[1.3,1.3,.9],[-.45,3.2,4]);
  add("work",[3.36,1.4,1.5],[1.35,2.6,1.2],[5.4,3.15,6.8]);
  add("resume",[-4.82,2.20,1.37],[2.20,2.12,.54],[-6.7,3.12,6.9]);
  add("photos",[1.97,1.47,2.1],[1.03,2.6,.4],[3.4,2.8,6.5]);
  add("blogs",[VENDING_POSITION[0],VENDING_POSITION[1]+1.46,VENDING_POSITION[2]],[1.72,2.92,1.25],[-9,2,-.5]);
  landmarks.find(l=>l.id==="blogs")!.hit.rotation.y=VENDING_YAW;
  landmarks.find(l=>l.id==="blogs")!.hit.updateMatrixWorld();
  add("contact",[4.87,.94,2.78],[.98,1.85,.85],[6.8,2.7,6.5]);
  const occluders:THREE.Mesh[]=[];
  const proxyMaterial=new THREE.MeshBasicMaterial();materials.push(proxyMaterial);
  const occluder=(p:number[],s:number[],tilt=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(...s as [number,number,number]),proxyMaterial);o.position.set(...p as [number,number,number]);o.rotation.x=tilt;o.updateMatrixWorld();occluders.push(o);};
  occluder([0,1.43,-.85],[8.65,1.42,2.45]);occluder([0,4.02,-.85],[8.9,.56,2.65]);
  occluder([.87,3.64,.84],[6.46,.06,1.28],.16);occluder([0,2.92,-2.02],[8.7,1.58,.16]);
  occluder([-3.3,2.92,.38],[2.12,1.5,.16]);
  for(const x of [-4.28,4.28])occluder([x,2.92,-.85],[.12,1.55,2.25]);
  let animationFrame=-1,arcadeStart:number|null=null;
  const animateArcade=(seconds:number)=>{
    arcadeStart??=seconds;seconds-=arcadeStart;
    const frame=Math.floor(seconds*(arcadeLoop.getMode()==="credits"?2:24));if(frame===animationFrame)return [];animationFrame=frame;
    const sounds=arcadeLoop.draw(seconds);gameTex.needsUpdate=true;return sounds;
  };
  const ready=Promise.all([questBoard.ready,...photoLoads.map(photo=>photo.ready),arcadeLoop.ready.then(()=>{gameTex.needsUpdate=true;})]).then(()=>{});
  const disposePhotos=()=>{questBoard.dispose();arcadeLoop.dispose();props.tvHit.geometry.dispose();photoLoads.forEach(photo=>photo.dispose());postcardHits.forEach(({hit})=>{hit.geometry.dispose();(hit.material as THREE.Material).dispose();});};
  // WebGL's immutable texture storage must be released when switching between
  // the native NES raster and the higher-resolution credits canvas.
  const toggleArcade=()=>{const mode=arcadeLoop.toggle();gameTex.dispose();gameTex.needsUpdate=true;animationFrame=-1;return mode;};
  return {computer,keyboardBounds,keyboardSupport,tramWindows,materials,textures,landmarks,occluders,postcardHits,arcadeModeHit,arcadeScreenHit,arcadeMode:arcadeLoop.getMode,toggleArcade,tickerScreen:props.tickerScreen,tvHit:props.tvHit,tvScreen:props.tvScreen,vendingScreen:props.vendingScreen,ready,disposePhotos,animateArcade,animateMailbox,animateGarden:livingGarden.update,roomPosition:new THREE.Vector3(-15.3,6.2,18.4),roomTarget:new THREE.Vector3(0,2.8,0)};
}
