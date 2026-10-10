import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {createTramSolar} from './tram-solar';

export const VENDING_POSITION=[-5.5,.12,-.5] as const;
export const VENDING_YAW=-Math.PI/2;

/** Small fitted props, all static meshes are batched by the world builder. */
export function buildWorldProps(scene:THREE.Scene,materials:THREE.Material[],textures:THREE.Texture[]){
  const mat=(color:number,metalness=0,roughness=.65)=>{const existing=materials.find(m=>m instanceof THREE.MeshStandardMaterial&&m.color.getHex()===color) as THREE.MeshStandardMaterial|undefined;if(existing)return existing;const m=new THREE.MeshStandardMaterial({color,metalness,roughness});materials.push(m);return m;};
  const paint=mat(0x294951,.3,.36),cream=mat(0xe9d9b5),steel=mat(0xa3adb0,.8,.28),rubber=mat(0x303532,0,.95),leather=mat(0x916244,0,.85),brass=mat(0xb99151,.65,.36),dark=mat(0x253637),red=mat(0xa84c35,.2,.4);
  const mesh=(p:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;};
  const box=(p:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,r=.025)=>mesh(p,new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)),m,x,y,z);
  const rod=(p:THREE.Object3D,a:number[],b:number[],r:number,m:THREE.Material)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),o=mesh(p,new THREE.CylinderGeometry(r,r,start.distanceTo(end),8),m);o.position.copy(start.clone().add(end).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return o;};
  const tube=(p:THREE.Object3D,points:number[][],r:number,m:THREE.Material)=>mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),20,r,6,false),m);
  const ring=(p:THREE.Object3D,r:number,t:number,x:number,y:number,z:number,m:THREE.Material,arc=Math.PI*2)=>mesh(p,new THREE.TorusGeometry(r,t,8,48,arc),m,x,y,z);
  const atlas=document.createElement("canvas");atlas.width=1024;atlas.height=2048;const ink=atlas.getContext("2d")!,atlasTexture=new THREE.CanvasTexture(atlas);atlasTexture.colorSpace=THREE.SRGBColorSpace;textures.push(atlasTexture);
  const labelMaterial=new THREE.MeshStandardMaterial({map:atlasTexture,roughness:.65});materials.push(labelMaterial);let labelRow=0;
  const label=(p:THREE.Object3D,text:string,w:number,h:number,x:number,y:number,z:number,bg:string,fg="#eee5d2")=>{
    const row=labelRow++*64,span=Math.min(1024,Math.round(64*w/h));ink.fillStyle=bg;ink.fillRect(0,row,span,64);ink.fillStyle=fg;ink.textAlign="center";ink.textBaseline="middle";ink.font=`bold ${Math.min(36,span/Math.max(text.length,1)*1.45)}px monospace`;ink.fillText(text,span/2,row+32);atlasTexture.needsUpdate=true;
    const geometry=new THREE.PlaneGeometry(w,h),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(1+uv.getX(i)*(span-2))/1024,1-(row+1+(1-uv.getY(i))*62)/2048);
    const o=mesh(p,geometry,labelMaterial,x,y,z);o.castShadow=false;return o;
  };
  const bicycle=new THREE.Group();bicycle.name="Keepsake / city bicycle";bicycle.position.set(-3.4,.59,-3.35);bicycle.rotation.set(.105,-.12,0);scene.add(bicycle);
  for(const x of [-.72,.72]){
    ring(bicycle,.435,.034,x,0,0,rubber);ring(bicycle,.402,.014,x,0,0,steel);
    rod(bicycle,[x,0,-.07],[x,0,.07],.045,steel);
    for(let n=0;n<28;n++){const a=n*Math.PI/14;rod(bicycle,[x,0,n%2?.036:-.036],[x+Math.cos(a)*.399,Math.sin(a)*.399,0],.0033,steel);}
    const fender=ring(bicycle,.48,.026,x,0,0,paint,Math.PI*.91);fender.rotation.z=.05;
    for(const side of [-1,1])rod(bicycle,[x,0,side*.055],[x+(x<0?-.36:.36),.3,side*.055],.007,steel);
    box(bicycle,.06,.1,.05,x+(x<0?-.45:.45),.15,0,x<0?red:cream,.013);
  }
  const rear=[-.72,0,0],bb=[-.08,-.075,0],seat=[-.31,.59,0],head=[.43,.6,0];
  for(const [a,b] of [[rear,bb],[bb,seat],[seat,rear],[seat,head],[head,bb]])rod(bicycle,a,b,.026,paint);
  for(const side of [-1,1])tube(bicycle,[[.43,.6,side*.05],[.45,.21,side*.06],[.72,0,side*.05]],.021,paint);
  rod(bicycle,seat,[-.34,.77,0],.022,steel);box(bicycle,.32,.065,.2,-.37,.79,0,leather,.055);
  tube(bicycle,[[.43,.59,0],[.39,.81,0],[.35,.86,0]],.023,steel);
  tube(bicycle,[[.23,.83,-.24],[.4,.9,-.15],[.42,.88,0],[.4,.9,.15],[.23,.83,.24]],.016,steel);
  for(const side of [-1,1]){rod(bicycle,[.23,.83,side*.24],[.31,.85,side*.19],.026,rubber);tube(bicycle,[[.3,.84,side*.19],[.65,.55,side*.12],[.54,.3,side*.05]],.005,rubber);}
  ring(bicycle,.13,.012,-.08,-.075,.065,steel);ring(bicycle,.055,.009,-.72,0,.065,steel);
  tube(bicycle,[[-.72,.055,.073],[-.08,.055,.073],[.05,-.075,.073],[-.08,-.205,.073],[-.72,-.055,.073],[-.77,0,.073],[-.72,.055,.073]],.006,dark);
  for(const side of [-1,1]){rod(bicycle,[-.08,-.075,side*.08],[.07*side-.08,-.075-.13*side,side*.11],.015,steel);box(bicycle,.13,.035,.12,.07*side-.08,-.075-.13*side,side*.15,rubber,.009);}
  // Rear luggage rack and a wire basket have real rails instead of solid cubes.
  for(const z of [-.12,.12]){rod(bicycle,[-.72,0,z],[-.76,.52,z],.01,steel);rod(bicycle,[-1,.52,z],[-.4,.52,z],.012,steel);}
  for(let i=0;i<5;i++)rod(bicycle,[-.94+i*.11,.52,-.12],[-.94+i*.11,.52,.12],.008,steel);
  for(const y of [.44,.55,.67,.79])for(const z of [-.2,.2])rod(bicycle,[.55,y,z],[.94,y,z],.008,brass);
  for(const x of [.55,.65,.75,.85,.94])for(const z of [-.2,.2])rod(bicycle,[x,.44,z],[x,.79,z],.008,brass);
  for(const x of [.55,.94])for(const y of [.44,.55,.67,.79])rod(bicycle,[x,y,-.2],[x,y,.2],.008,brass);
  rod(bicycle,[-.15,-.08,-.07],[-.25,-.50,-.27],.013,steel);

  // Face fully out across the platform end, clear of the case board in front.
  const vending=new THREE.Group();vending.name="Blogs / journal vending machine";vending.position.set(...VENDING_POSITION);vending.rotation.y=VENDING_YAW;vending.scale.setScalar(1.22);scene.add(vending);
  const enamel=mat(0x149ca3,.35,.25),cobalt=mat(0x2346b8,.28,.3);
  const trim=new THREE.MeshStandardMaterial({color:0xadf7df,emissive:0x64d8c1,emissiveIntensity:.8,roughness:.3});materials.push(trim);
  for(const x of [-.48,.48])box(vending,.13,.12,.63,x,.06,0,rubber,.02);
  box(vending,1.42,2.34,.98,0,1.25,-.035,enamel,.12);
  box(vending,1.26,2.08,.08,0,1.29,.475,enamel,.065);
  box(vending,1.47,.34,1.04,0,2.32,-.015,cobalt,.09);
  box(vending,1.37,.17,.07,0,2.51,.22,enamel,.05);
  for(const x of [-.65,.65]){
    box(vending,.034,1.86,.025,x,1.37,.526,trim,.012);
    const foot=box(vending,.25,.22,.48,x,.19,.27,enamel,.045);foot.rotation.z=x<0?-.25:.25;
    const footLamp=box(vending,.16,.035,.13,x,.14,.515,trim,.012);footLamp.rotation.z=x<0?-.25:.25;
    // Door hinges, flush bolts, and side cooling louvers sit on actual panels.
    for(const y of [.7,1.94])box(vending,.05,.17,.09,x,y,.51,steel,.012);
    for(let j=0;j<8;j++)box(vending,.013,.022,.32,x<0?-.718:.718,.48+j*.048,-.10,dark,.004);
    const sideLabel=label(vending,"FRESH IDEAS",.69,.26,x<0?-.72:.72,1.56,-.02,"#137f85","#c6ffe8");sideLabel.rotation.y=x<0?-Math.PI/2:Math.PI/2;
    const stripe=box(vending,.012,.075,.83,x<0?-.719:.719,1.05,-.035,cream,.004);stripe.rotation.x=-.12;
  }
  for(const x of [-.53,.45])box(vending,.075,1.38,.075,x,1.41,.525,dark,.02);
  for(const y of [.755,2.065])box(vending,1.05,.07,.075,-.04,y,.525,dark,.02);
  const vendingMaterial=new THREE.MeshBasicMaterial({color:0x172e2a,toneMapped:false});materials.push(vendingMaterial);
  mesh(vending,new THREE.PlaneGeometry(.9,1.26),vendingMaterial,-.04,1.41,.519);
  const vendingScreen=mesh(vending,new THREE.PlaneGeometry(.9,1.26),vendingMaterial,-.04,1.41,.533);
  vendingScreen.name="Blogs / glass interaction plane";vendingScreen.userData.dynamic=true;vendingScreen.castShadow=false;vendingScreen.visible=true;
  const marquee=label(vending,"BLOGS",1.12,.235,0,2.32,.55,"#2346b8","#d5fff2");
  const marqueeMaterial=new THREE.MeshStandardMaterial({map:atlasTexture,emissiveMap:atlasTexture,emissive:0xffffff,emissiveIntensity:.55,roughness:.55});materials.push(marqueeMaterial);marquee.material=marqueeMaterial;
  label(vending,"SOMETHING GOOD",.92,.075,0,2.51,.261,"#137f85","#d5fff2");
  box(vending,.065,.21,.04,.566,.60,.54,dark,.013);box(vending,.008,.09,.01,.566,.63,.566,brass,.002);
  box(vending,.026,.026,.012,.566,.55,.568,trim,.009);
  box(vending,.90,.25,.15,-.08,.41,.488,dark,.045);box(vending,.86,.035,.23,-.08,.28,.57,steel,.012);
  label(vending,"STORIES TO GO",.68,.055,-.08,.24,.58,"#137f85","#c6ffe8");
  // Turn the complete TV assembly to the opposite side, with its cradle and
  // mounting shoes attached and wholly inside the same roof corner.
  const tv=new THREE.Group();tv.name="Front corner / SAD-ist television";tv.position.set(-3.35,3.4,-.15);tv.rotation.y=-.18;scene.add(tv);
  for(const x of [-.59,.59]){
    box(tv,.30,.06,.60,x,.92,-.07,steel,.01).name='TV / bolted roof shoe';
    box(tv,.085,.10,.46,x,.985,-.07,steel,.009).name='TV / solid pedestal';
    for(const z of [-.28,.14])mesh(tv,new THREE.CylinderGeometry(.024,.024,.015,6),brass,x,.958,z);
  }
  box(tv,1.56,.065,.56,0,1.04,-.07,steel,.014).name='TV / continuous cabinet cradle';
  box(tv,1.75,1.13,.68,0,1.62,0,leather,.11);box(tv,1.65,1.01,.06,0,1.62,.348,cream,.05);
  box(tv,1.28,.79,.024,0,1.62,-.349,dark,.045);
  for(let i=0;i<9;i++)box(tv,.81,.018,.012,0,1.46+i*.044,-.368,rubber,.004);
  tube(tv,[[.56,1.24,-.367],[.7,.98,-.45],[.73,.91,-.15],[.58,.91,.18]],.018,rubber);
  box(tv,1.29,.86,.08,-.11,1.63,.395,rubber,.09);
  const poster=document.createElement("canvas");poster.width=640;poster.height=432;const pc=poster.getContext("2d")!;
  pc.fillStyle="#14201f";pc.fillRect(0,0,640,432);pc.fillStyle="#e7dcc4";pc.textAlign="center";pc.font="bold 42px monospace";pc.fillText("HOG HUNT",320,190);pc.font="24px monospace";pc.fillText("SAD-ist  /  WATCH",320,250);
  const posterTexture=new THREE.CanvasTexture(poster);posterTexture.colorSpace=THREE.SRGBColorSpace;textures.push(posterTexture);
  const tvMaterial=new THREE.MeshBasicMaterial({map:posterTexture,toneMapped:false});materials.push(tvMaterial);
  const tvScreen=mesh(tv,new THREE.PlaneGeometry(1.17,.79),tvMaterial,-.11,1.63,.443);tvScreen.name="TV / Hog Hunt by SAD-ist";tvScreen.userData.dynamic=true;
  for(const y of [1.86,1.59]){const dial=mesh(tv,new THREE.CylinderGeometry(.085,.085,.065,20),rubber,.65,y,.42);dial.rotation.x=Math.PI/2;box(tv,.012,.075,.01,.65,y,.46,cream,.004);}
  for(let i=0;i<8;i++)box(tv,.13,.012,.02,.65,1.23+i*.026,.403,dark,.003);
  label(tv,"HOG HUNT • SAD-ist",.94,.07,-.1,1.155,.394,"#e2dcc7","#283c37");
  for(const side of [-1,1]){rod(tv,[0,2.18,-.07],[side*.5,2.7,-.13],.011,steel);mesh(tv,new THREE.SphereGeometry(.022,8,6),steel,side*.5,2.7,-.13);}
  tv.updateMatrixWorld(true);
  const tvHit=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.1,.18),dark);tvHit.position.set(0,1.62,.44);tvHit.applyMatrix4(tv.matrixWorld);tvHit.updateMatrixWorld();
  const ticker=new THREE.Group();ticker.name="Roof / market ticker";ticker.position.set(.8,4.96,-2.05);ticker.rotation.y=Math.PI;scene.add(ticker);
  for(const x of [-1.85,1.85]){rod(ticker,[x,-.66,-.38],[x,-.32,0],.05,steel);box(ticker,.32,.045,.46,x,-.66,-.38,steel,.01);rod(ticker,[x,-.66,-.62],[x,-.36,0],.035,steel);}
  box(ticker,6.08,1.42,.27,0,0,0,paint,.065);box(ticker,5.96,1.32,.025,0,0,.147,dark,.012);
  const tickerMat=new THREE.MeshBasicMaterial({color:0x0c141c,toneMapped:false});materials.push(tickerMat);
  const tickerScreen=mesh(ticker,new THREE.PlaneGeometry(5.8,1.276),tickerMat,0,0,.166);tickerScreen.userData.dynamic=true;tickerScreen.name="Markets / live display";

  createTramSolar(scene,materials);

  // A travel kit on the bench: shaped canvas rucksack, stitched pockets,
  // buckled straps, an analogue camera and an unfolded trail map.
  const kit=new THREE.Group();kit.name="Bench / travel kit";kit.position.set(-1.6,.65,2.15);scene.add(kit);
  const canvas=mat(0x73794c,0,.95);
  box(kit,.64,.69,.36,0,.355,0,canvas,.12);
  box(kit,.58,.19,.38,0,.64,.02,canvas,.075);
  box(kit,.43,.26,.075,0,.24,.212,leather,.05);
  for(const x of [-.2,.2]){box(kit,.056,.58,.018,x,.40,.203,leather,.01);box(kit,.085,.09,.026,x,.39,.222,brass,.012);box(kit,.05,.055,.03,x,.39,.24,dark,.008);}
  tube(kit,[[-.13,.68,0],[-.12,.82,0],[.12,.82,0],[.13,.68,0]],.024,leather);
  for(const x of [-.28,.28])tube(kit,[[x,.57,-.17],[x,.31,-.26],[x,.05,-.17]],.028,leather);
  for(let i=0;i<9;i++)box(kit,.006,.007,.005,-.175+i*.044,.33,.253,cream,.001);
  const cameraProp=new THREE.Group();cameraProp.name="Bench / analogue camera";cameraProp.position.set(-.45,.645,2.34);cameraProp.rotation.y=-.2;scene.add(cameraProp);
  box(cameraProp,.43,.27,.19,0,.135,0,rubber,.025);box(cameraProp,.44,.065,.19,0,.24,0,steel,.015);
  const lens=mesh(cameraProp,new THREE.CylinderGeometry(.105,.10,.12,24),dark,0,.13,.14);lens.rotation.x=Math.PI/2;
  const lensCoating=new THREE.MeshPhysicalMaterial({color:0x123568,metalness:.65,roughness:.16,clearcoat:1,clearcoatRoughness:.08});materials.push(lensCoating);
  const glass=mesh(cameraProp,new THREE.CircleGeometry(.079,24),lensCoating,0,.13,.204);glass.name="Camera / coated lens";
  ring(cameraProp,.092,.009,0,.13,.203,steel);
  box(cameraProp,.10,.04,.08,.13,.29,-.01,steel,.012);
  tube(cameraProp,[[-.2,.18,0],[-.3,.015,.18],[.18,.01,.35],[.25,.18,0]],.012,leather);
  const mapCanvas=document.createElement("canvas");mapCanvas.width=512;mapCanvas.height=320;const mc=mapCanvas.getContext("2d")!;
  mc.fillStyle="#e8dcc1";mc.fillRect(0,0,512,320);
  for(let n=0;n<12;n++){mc.strokeStyle=n%2?"#98a28a":"#b2b8a0";mc.lineWidth=2;mc.beginPath();for(let x=0;x<=512;x+=8){const y=30+n*23+Math.sin(x*.013+n)*18+Math.cos(x*.025+n*.5)*10;if(!x)mc.moveTo(x,y);else mc.lineTo(x,y);}mc.stroke();}
  mc.strokeStyle="#4d8a9b";mc.lineWidth=13;mc.beginPath();mc.moveTo(210,0);mc.bezierCurveTo(50,130,350,180,250,320);mc.stroke();
  mc.strokeStyle="#ac684b";mc.lineWidth=4;mc.setLineDash([8,6]);mc.beginPath();mc.moveTo(340,280);mc.lineTo(390,180);mc.lineTo(315,110);mc.lineTo(380,50);mc.stroke();mc.setLineDash([]);
  mc.fillStyle="#354b42";mc.font="bold 27px monospace";mc.fillText("TAKE THE LONG WAY",20,35);
  const mapTexture=new THREE.CanvasTexture(mapCanvas);mapTexture.colorSpace=THREE.SRGBColorSpace;textures.push(mapTexture);
  const mapMat=new THREE.MeshStandardMaterial({map:mapTexture,side:THREE.DoubleSide,roughness:1});materials.push(mapMat);
  const foldedMap=new THREE.Group();foldedMap.name="Bench / folded trail map";foldedMap.position.set(-1.05,.65,2.48);foldedMap.rotation.y=.18;scene.add(foldedMap);
  for(let i=0;i<3;i++){const geo=new THREE.PlaneGeometry(.20,.37);const uv=geo.attributes.uv;for(let v=0;v<uv.count;v++)uv.setX(v,(i+uv.getX(v))/3);const panel=mesh(foldedMap,geo,mapMat,(i-1)*.196,i===1?.013:0,0);panel.rotation.set(-Math.PI/2,0,(i-1)*.08);}
  return {tvScreen,tvHit,vendingScreen,tickerScreen};
}
