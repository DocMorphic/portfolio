import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildSideQuestWorldAsync, type WorldStop } from "./side-quest-world-model";
import {yieldLoadingWork} from "./loading-work";
import { safeWorldCamera, worldFlightCurve, worldEntranceCurve } from "./world-camera";
import { fittedScreen, screenQuadMatrix, smoothRoomStep, type ScreenQuad } from "./room-projection";
import { createWorldWater } from "./world-water";
import { createTramLife } from "./tram-life";
import {createWorldBirds} from './world-birds';
import { createWorldLandscape } from "./world-landscape";
import { createShoreline, keepCameraInsideLake } from "./lake-shoreline.mjs";
import { createWorldStation } from "./world-station";
import { createWorldFish } from "./world-fish";
import type { TerminalSection } from "./portfolio-terminal";
import { journeyPresented,journeyStore } from "./route-transition";
import {worldFrameAllowed} from "./world-overlay";
import { worldSound } from "./world-sound";
import {assetFlight,CAMERA_PASS,cameraTravelElapsed} from "./spatial-sound";
import {worldOverviewScale,worldReadingMode} from "./responsive-layout";
import {worldFramePolicy} from "./world-frame-policy";
import {warmWorldTextures,captureWorldEnvironment} from "./world-prewarm";
import {createTramRooftop} from "./tram-rooftop";
import {createWaterLettering} from "./water-lettering";
import {createTramShopSign} from "./tram-shop-sign";
import {drawTramDVD} from "./tram-dvd";
import {createWorldZoom,worldWheelZoom} from "./world-zoom";

export type RoomView = "terminal" | "moving" | "room" | "object" | "tv" | "vending" | "arcade";
export type WorldSelection = {section:TerminalSection;folder?:string;photo?:number};
export type RoomControls = { switchArcade():void; prepare():Promise<void>; setActive(active:boolean):void; setNight(night:boolean):void; enter():void; reveal():void; focus():void; visit(stop:TerminalSection,photo?:{folder:string;index:number},quiet?:boolean):void; zoom(direction:number):void; reset():void; orbit(x:number,y:number):void; dispose():void };

export async function createPortfolioRoom(host:HTMLElement,surface:HTMLElement,onView:(view:RoomView)=>void,onLost:()=>void,onStop?:(stop:WorldSelection|null)=>void,onNight?:(night:boolean)=>void,tvSurface?:HTMLElement,vendingSurface?:HTMLElement,tickerSurface?:HTMLElement):Promise<RoomControls> {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
  // Include the water's nested reflection render in draw-call diagnostics.
  renderer.info.autoReset=false;
  renderer.setPixelRatio(worldFramePolicy(false,window.devicePixelRatio).pixelRatio);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.localClippingEnabled=true;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.domElement.setAttribute("aria-hidden","true");host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x576d83);scene.fog=new THREE.Fog(0x576d83,35,85);
  await yieldLoadingWork();
  const {computer,tramWindows,materials,textures,landmarks,occluders,postcardHits,tvHit,tvScreen,vendingScreen,tickerScreen,arcadeModeHit,arcadeScreenHit,arcadeMode,toggleArcade,ready:photosReady,disposePhotos,animateArcade,animateGarden,animateMailbox,roomPosition,roomTarget}=await buildSideQuestWorldAsync(scene);
  await yieldLoadingWork();
  const shoreline=createShoreline();
  const water=createWorldWater(scene,computer.screen,computer.screen.material,renderer,[{screen:tvScreen,material:tvScreen.material},{screen:vendingScreen,material:vendingScreen.material},{screen:tickerScreen,material:tickerScreen.material}],shoreline);
  const landscape=createWorldLandscape(scene,shoreline,Math.min(8,renderer.capabilities.getMaxAnisotropy()));
  await yieldLoadingWork();
  const daylight:{light:THREE.Light;intensity:number;color:THREE.Color}[]=[];
  scene.traverse(o=>{if(o instanceof THREE.Light)daylight.push({light:o,intensity:o.intensity,color:o.color.clone()});});
  const station=createWorldStation(scene,materials,textures);
  await yieldLoadingWork();
  const rooftop=createTramRooftop(scene,materials);
  await yieldLoadingWork();
  const lettering=createWaterLettering(scene);
  const shopSign=createTramShopSign(scene,materials);
  // Zero-intensity lights still enlarge Three's lighting shaders. Keep the
  // nocturnal lamps out of the daytime shader and warm both variants below.
  const nightLights:THREE.Light[]=[...station.lights,...station.accents,rooftop.wash];
  shopSign.root.traverse(object=>{if(object instanceof THREE.Light)nightLights.push(object);});
  let nightLightsVisible=false;
  const showNightLights=(visible:boolean)=>{nightLightsVisible=visible;nightLights.forEach(light=>{light.visible=visible;});};
  showNightLights(false);
  // A small, cached environment capture gives the solar glass real sky/terrain
  // reflections. It is not another reflection pass on every animation frame.
  const roofEnvironment=new THREE.WebGLCubeRenderTarget(128,{generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const roofProbe=new THREE.CubeCamera(.1,400,roofEnvironment);roofProbe.position.set(0,6,-1);roofProbe.updateMatrixWorld(true);
  let environmentNight=-1,environmentPending=false;
  const captureRoofEnvironment=async(amount:number)=>{
    if(environmentPending||disposed)return;environmentPending=true;
    try{
    if(!await captureWorldEnvironment(renderer,scene,roofProbe,[water.water,lettering.root],()=>disposed))return;
    scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshPhysicalMaterial){m.envMap=roofEnvironment.texture;m.envMapIntensity=.8;m.needsUpdate=true;}});
    environmentNight=amount;
    }finally{environmentPending=false;}
  };
  await yieldLoadingWork();
  let night=false,nightAmount=0;
  const moonlight=new THREE.Color(0x8daede);
  const setNight=(next:boolean)=>{worldSound.play("switch");night=next;renderer.shadowMap.needsUpdate=true;onNight?.(next);invalidate();};
  // The real depth buffer masks the HTML behind the canvas. A roof, awning or
  // bezel can cover any part of the screen without a CPU raycast or DOM pop.
  const screenMask=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,blending:THREE.NoBlending,depthWrite:false});materials.push(screenMask);
  const idleComputerMaterial=computer.screen.material;
  computer.screen.renderOrder=10;
  if(tvSurface){tvScreen.material=screenMask;tvScreen.renderOrder=10;}
  if(vendingSurface){vendingScreen.material=screenMask;vendingScreen.renderOrder=10;}
  if(tickerSurface){tickerScreen.material=screenMask;tickerScreen.renderOrder=10;}
  scene.updateMatrixWorld(true);scene.traverse(object=>{object.matrixAutoUpdate=false;});scene.matrixWorldAutoUpdate=false;
  // Dynamic objects live outside the frozen static batches and update only their subtree.
  const life=createTramLife(scene,materials);
  await yieldLoadingWork();
  const birds=createWorldBirds(scene,materials);
  await yieldLoadingWork();
  const fish=createWorldFish(scene,materials,(p,strength)=>{
    water.interaction.splash(p,strength);
    worldSound.play("splash",{position:{x:p.x,y:-.49,z:p.z},gain:Math.min(.85,Math.sqrt(strength*7)),rate:Math.max(.92,Math.min(1.08,1.14-strength*2))});
  });
  const screenCenter=computer.screen.getWorldPosition(new THREE.Vector3());
  const scale=computer.rig.scale.x,glassWidth=1.62*scale,glassHeight=1.07*scale;
  const camera=new THREE.PerspectiveCamera(45,1,.025,400);
  const soundPosition=new THREE.Vector3();let soundTime=0;
  const soundForward=new THREE.Vector3(),soundUp=new THREE.Vector3();
  const syncListener=()=>{soundForward.set(0,0,-1).applyQuaternion(camera.quaternion);soundUp.set(0,1,0).applyQuaternion(camera.quaternion);worldSound.listener(camera.position,soundForward,soundUp);};
  const orbitControls=new OrbitControls(camera,renderer.domElement);
  orbitControls.enabled=false;orbitControls.enableDamping=true;orbitControls.dampingFactor=.085;
  orbitControls.minDistance=4;orbitControls.maxDistance=90;
  orbitControls.minPolarAngle=.18;orbitControls.maxPolarAngle=Math.PI*.48;
  // OrbitControls damps rotation, but its dolly changes radius instantly.
  // Keep its rotation/pan handling and ease zoom through one shared target.
  orbitControls.enableZoom=false;orbitControls.panSpeed=.7;orbitControls.rotateSpeed=1.15;
  const zoomMotion=createWorldZoom(orbitControls.minDistance,orbitControls.maxDistance);
  const zoomOffset=new THREE.Vector3();
  const queueZoom=(amount:number)=>{
    if(view!=="room"||!orbitControls.enabled)return;
    zoomMotion.add(camera.position.distanceTo(orbitControls.target),amount);invalidate();
  };
  orbitControls.screenSpacePanning=false;orbitControls.target.copy(roomTarget);
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  let width=1,height=1,displayWidth=1,displayHeight=1,view:RoomView="terminal",frame=0,previous=0,disposed=false,active=false,preparing=false;
  let ambientTimer:ReturnType<typeof setTimeout>|undefined,lastReflection=-Infinity;
  let orbitMotionUntil=0,orbitHeld=false;
  let sampleStart=0,sampleFrames=0,sampleWork=0,sampleReflectionRenders=0,lastDisplayDraw=-Infinity,lastDvdDraw=-Infinity,birdReduced=reduced.matches;
  const movingFrameGaps:number[]=[];
  let mailOpen=false;
  let objectSection:TerminalSection="work";
  let entranceHeld=false;
  const savedPosition=roomPosition.clone(),savedTarget=roomTarget.clone();
  let travel:null|{elapsed:number;duration:number;startedAt?:number;path:THREE.Curve<THREE.Vector3>;to:THREE.Vector3;qFrom:THREE.Quaternion;qTo:THREE.Quaternion;target:THREE.Vector3;end:Exclude<RoomView,"moving">;stop:WorldSelection|null;entrance?:boolean;airStarted?:boolean;pan?:number;airGain?:number}=null;
  const poseCamera=new THREE.PerspectiveCamera();
  const overviewPose=()=>roomTarget.clone().add(roomPosition.clone().sub(roomTarget).multiplyScalar(worldOverviewScale(width,height)));
  const vendingPose=()=>{
    // Keep the readable screen and its navigation inside the mobile viewport.
    const target=vendingScreen.localToWorld(new THREE.Vector3(0,-.08,0)),normal=new THREE.Vector3(0,0,1).transformDirection(vendingScreen.matrixWorld);
    const worldScale=vendingScreen.getWorldScale(new THREE.Vector3()).x;
    const distance=fittedScreen(width,Math.max(180,height-110),1.12*worldScale,1.48*worldScale,camera.fov).distance;
    return {target,position:target.clone().addScaledVector(normal,distance)};
  };
  const tvPose=()=>{
    const target=tvScreen.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(tvScreen.matrixWorld);
    const distance=fittedScreen(width,Math.max(180,height-140),1.17,.79,camera.fov).distance*(width<700?1.12:1.48);
    return {target,position:target.clone().addScaledVector(normal,distance)};
  };
  const focusPose=()=>screenCenter.clone().add(new THREE.Vector3(0,0,fittedScreen(width,height,glassWidth,glassHeight,camera.fov).distance));
  const objectPose=(id:TerminalSection)=>{
    const stop=landmarks.find(s=>s.id===(id==="about"?"home":id));if(!stop)return null;
    const target=stop.target.clone();
    if(worldReadingMode(width,height)==="sheet")target.y-=stop.camera.distanceTo(target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*.55;
    else if(width>=700){const right=new THREE.Vector3(0,1,0).cross(stop.camera.clone().sub(target)).normalize();target.addScaledVector(right,stop.camera.distanceTo(target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*.48);}
    return {target,position:stop.camera.clone()};
  };
  const arcadePose=()=>{const target=arcadeScreenHit.position.clone().add(new THREE.Vector3(0,-.12,.09));const distance=fittedScreen(width,Math.max(200,height-180),1.7,1.5,camera.fov).distance;return {target,position:target.clone().add(new THREE.Vector3(0,distance*.22,distance))};};
  const arcadeAudible=()=>arcadeMode()==="mario"&&(view==="arcade"||view==="object"&&objectSection==="work");
  const notify=(next:RoomView)=>{view=next;computer.screen.material=next==="terminal"?screenMask:idleComputerMaterial;worldSound.arcadeFocus(arcadeAudible());host.dataset.view=next;host.style.pointerEvents=next==="terminal"||next==="tv"||next==="vending"?"none":"auto";onView(next);};
  const switchArcade=()=>{host.dataset.arcadeMode=toggleArcade();worldSound.arcadeFocus(arcadeAudible());worldSound.play("arcadeSwitch",{position:arcadeModeHit.position,gain:.65});invalidate();};
  function moveTo(end:Exclude<RoomView,"moving">,to:THREE.Vector3,target:THREE.Vector3,stop:WorldSelection|null=null){
    if(disposed)return;
    zoomMotion.reset();
    if(end==="room"&&view==="room"&&camera.position.distanceTo(to)<.02&&orbitControls.target.distanceTo(target)<.02)return;
    onStop?.(null);orbitControls.enabled=false;host.dataset.hover="";
    poseCamera.position.copy(to);poseCamera.lookAt(target);
    const path=worldFlightCurve(camera.position,to);
    syncListener();
    const direction=to.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
    const flight=assetFlight(path.getLength());
    travel={elapsed:0,duration:reduced.matches?0:flight.duration,path,to:to.clone(),qFrom:camera.quaternion.clone(),qTo:poseCamera.quaternion.clone(),target:target.clone(),end,stop,pan:Math.sign(direction.x)*.3,airGain:flight.gain};
    notify("moving");worldSound.media(false);
    invalidate();
  }
  const focus=()=>{mailOpen=false;if(view!=="terminal")moveTo("terminal",focusPose(),screenCenter);};
  const reveal=()=>{if(mailOpen)worldSound.play("mailbox",{gain:.65});mailOpen=false;moveTo("room",overviewPose(),roomTarget);};
  const watchTV=()=>{
    worldSound.play("switch");
    const pose=tvPose();moveTo("tv",pose.position,pose.target);
  };
  const enter=()=>{
    zoomMotion.reset();
    entranceHeld=true;
    worldSound.media(false);
    void journeyPresented().then(()=>{if(!disposed){entranceHeld=false;previous=0;invalidate();}});
    savedTarget.copy(roomTarget);savedPosition.copy(overviewPose());
    const path=worldEntranceCurve(savedPosition,savedTarget);camera.position.copy(path.getPoint(0));camera.lookAt(savedTarget);camera.updateMatrixWorld();
    poseCamera.position.copy(savedPosition);poseCamera.lookAt(savedTarget);
    orbitControls.enabled=false;onStop?.(null);travel={elapsed:0,duration:reduced.matches?0:CAMERA_PASS.duration,path,to:savedPosition.clone(),qFrom:camera.quaternion.clone(),qTo:poseCamera.quaternion.clone(),target:savedTarget.clone(),end:"room",stop:null,entrance:true};
    // Replace the prewarm CRT close-up BEFORE the loader begins fading. This
    // single held frame does not advance the entrance or start its audio.
    notify("moving");cancelAnimationFrame(frame);frame=0;render(performance.now(),true);
  };
  const visit=(id:TerminalSection,photo?:{folder:string;index:number},quiet=false)=>{
    if(!quiet)worldSound.play(id==="blogs"?"machine":id==="work"?"arcade":id==="photos"||id==="resume"?"paper":id==="contact"?"mailbox":id==="home"?"key":"wood",{position:landmarks.find(s=>s.id===id)?.target??screenCenter,gain:id==="resume"?.35:1});
    mailOpen=id==="contact";
    if(id==="blogs"){
      const pose=vendingPose();moveTo("vending",pose.position,pose.target);return;
    }
    if(id==="home"){focus();return;}const pose=objectPose(id);if(!pose)return;
    objectSection=id;
    moveTo("object",pose.position,pose.target,{section:id,folder:photo?.folder,photo:photo?.index});
  };
  const raycaster=new THREE.Raycaster();
  const waterPlane=new THREE.Plane(new THREE.Vector3(0,1,0),.49),waterPoint=new THREE.Vector3(),blockPoint=new THREE.Vector3();
  const platformBounds=new THREE.Box3(new THREE.Vector3(-6.85,-.5,-4.7),new THREE.Vector3(6.85,.3,4.7));
  const windowTargets=tramWindows.windows.flatMap(w=>[w.hit,...w.sash.children]);
  const waterHit=(event:PointerEvent)=>{
    const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    if(!raycaster.ray.intersectPlane(waterPlane,waterPoint))return null;
    const distance=raycaster.ray.origin.distanceTo(waterPoint);
    if(raycaster.ray.intersectBox(platformBounds,blockPoint)&&raycaster.ray.origin.distanceTo(blockPoint)<distance)return null;
    const blocker=raycaster.intersectObjects([...occluders,...landmarks.map(l=>l.hit),...station.hits.map(h=>h.mesh),...windowTargets,tvHit],false)[0];
    return blocker&&blocker.distance<distance?null:{x:waterPoint.x,z:waterPoint.z};
  };
  const pick=(event:PointerEvent)=>{
    const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    const cards=raycaster.intersectObjects(postcardHits.map(s=>s.hit),false);
    const signs=raycaster.intersectObjects(station.hits.map(h=>h.mesh),false);
    const windows=raycaster.intersectObjects(windowTargets,false);
    const television=raycaster.intersectObject(tvHit,false)[0];
    const arcadeHit=raycaster.intersectObjects([arcadeScreenHit],false)[0];
    if(arcadeHit){const blocker=raycaster.intersectObjects(occluders,false)[0];if(!blocker||blocker.distance>arcadeHit.distance-.1)return {id:"work" as WorldStop,photo:undefined,arcade:true,mode:arcadeHit.object===arcadeModeHit};}
    const hits=raycaster.intersectObjects(landmarks.map(s=>s.hit),false);if(!hits.length&&!cards.length&&!signs.length&&!windows.length&&!television)return null;
    const card=cards[0]&&postcardHits.find(s=>s.hit===cards[0].object);
    const nearest=raycaster.intersectObjects(occluders,false)[0];
    const distance=Math.min(hits[0]?.distance??Infinity,cards[0]?.distance??Infinity,signs[0]?.distance??Infinity,windows[0]?.distance??Infinity,television?.distance??Infinity);
    if(nearest&&nearest.distance<distance-.3)return null;
    if(television?.distance===distance)return {id:"home" as WorldStop,photo:undefined,tv:true};
    if(windows[0]&&windows[0].distance===distance)return {id:"home" as WorldStop,photo:undefined,windowIndex:tramWindows.windows.findIndex(w=>w.hit===windows[0].object||w.sash===windows[0].object.parent)};
    if(signs[0]&&signs[0].distance===distance)return {id:"home" as WorldStop,photo:undefined,action:station.hits.find(h=>h.mesh===signs[0].object)!.action};
    if(card&&(!hits[0]||hits[0].distance>=cards[0].distance-.5))return {id:"photos" as WorldStop,photo:card};
    const hit=landmarks.find(s=>s.hit===hits[0]?.object);return hit?{id:hit.id,photo:undefined}:null;
  };
  let press:null|{id:number;x:number;y:number;moved:boolean}=null;
  let hoverFrame=0;
  const pointers=new Set<number>();
  const touches=new Map<number,{x:number;y:number}>();
  let pinchDistance=0,dollyPointer:null|{id:number;y:number}=null;
  const touchDistance=()=>{const [a,b]=Array.from(touches.values());return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
  const wheel=(event:WheelEvent)=>{
    if(view!=="room"||!orbitControls.enabled)return;
    event.preventDefault();queueZoom(worldWheelZoom(event.deltaY,event.deltaMode,event.ctrlKey));
  };
  const down=(event:PointerEvent)=>{
    water.interaction.reset();
    if(view!=="room"&&view!=="object"&&view!=="tv"&&view!=="arcade")return;pointers.add(event.pointerId);
    if(view==="room"&&event.pointerType==="touch"){touches.set(event.pointerId,{x:event.clientX,y:event.clientY});pinchDistance=touchDistance();}
    if(view==="room"&&event.button===1)dollyPointer={id:event.pointerId,y:event.clientY};
    if(pointers.size>1){if(press)press.moved=true;return;}
    if(event.button===0)press={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  };
  const pointerMove=(event:PointerEvent)=>{
    if(touches.has(event.pointerId)){
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});const distance=touchDistance();
      if(distance>0&&pinchDistance>0)queueZoom(Math.log(pinchDistance/distance)*1.35);
      pinchDistance=distance;
    }
    if(dollyPointer?.id===event.pointerId){queueZoom((event.clientY-dollyPointer.y)*.006);dollyPointer.y=event.clientY;}
    if(press){if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>5)press.moved=true;renderer.domElement.style.cursor="grabbing";host.dataset.hover="";}
    else if(view==="room"||view==="arcade"||view==="object"){
      cancelAnimationFrame(hoverFrame);hoverFrame=requestAnimationFrame(()=>{
        hoverFrame=0;if(disposed||(view!=="room"&&view!=="arcade"&&view!=="object")||press)return;
        const hit=pick(event),arcade=!!hit&&"arcade" in hit;
        renderer.domElement.style.cursor=view==="object"?(arcade?"pointer":"default"):hit?"pointer":"grab";
        host.dataset.hover=arcade?"arcade-screen":"";
        const point=view==="room"&&!hit&&!reduced.matches?waterHit(event):null;
        if(point)water.interaction.move(point,performance.now()/1000);else water.interaction.reset();
      });
    }
  };
  const up=(event:PointerEvent)=>{const click=press?.id===event.pointerId&&!press.moved&&pointers.size===1;pointers.delete(event.pointerId);touches.delete(event.pointerId);pinchDistance=touchDistance();if(dollyPointer?.id===event.pointerId)dollyPointer=null;press=null;if(click&&view==="arcade"){const hit=pick(event);if(hit&&"arcade" in hit)switchArcade();else reveal();return;}if(click&&view==="object"){const hit=pick(event);if(hit&&"arcade" in hit)switchArcade();else if(!(objectSection==="resume"&&hit?.id==="resume"))reveal();return;}if(click&&view==="tv"){reveal();return;}if(click&&view==="room"){const hit=pick(event);if(hit){
    if("arcade" in hit){switchArcade();visit("work",undefined,true);}
    else if("tv" in hit)watchTV();
    else if("windowIndex" in hit){const window=tramWindows.windows[hit.windowIndex!];worldSound.play(window.open?"windowClose":"window",{position:window.hit.position});tramWindows.toggle(hit.windowIndex!);host.dataset.openWindows=tramWindows.windows.filter(w=>w.open).length.toString();invalidate();}
    else if("action" in hit){const position=station.hits.find(h=>h.action===hit.action)?.mesh.position;if(hit.action==="night")setNight(!night);else if(hit.action==="bell"){station.ring();worldSound.play("bell",{position});}else if(hit.action==="hologram"){if(reduced.matches||life.cycleHologram(performance.now()/1000))worldSound.play("hologram",{position});}else if(hit.action)visit(hit.action);invalidate();}
    else visit(hit.id,hit.photo);
  }else if(!reduced.matches){const point=waterHit(event);if(point){water.interaction.click(point);fish.jump(point,performance.now()/1000);invalidate();}}}};
  const cancel=()=>{press=null;pointers.clear();touches.clear();pinchDistance=0;dollyPointer=null;zoomMotion.reset();host.dataset.hover="";water.interaction.reset();};
  const pointerLeave=()=>{water.interaction.reset();host.dataset.hover="";};
  renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",pointerMove);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointercancel",cancel);
  renderer.domElement.addEventListener("pointerleave",pointerLeave);
  renderer.domElement.addEventListener("wheel",wheel,{passive:false});
  const projectedCamera=new THREE.Matrix4(),projectedLens=new THREE.Matrix4();let projectedView="",projectedSize="";
  function projectSurface(){
    const size=`${width}/${height}`;
    if(projectedView===view&&projectedSize===size&&projectedCamera.equals(camera.matrixWorld)&&projectedLens.equals(camera.projectionMatrix))return;
    projectedView=view;projectedSize=size;projectedCamera.copy(camera.matrixWorld);projectedLens.copy(camera.projectionMatrix);
    if(tickerSurface){
      const center=tickerScreen.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(tickerScreen.matrixWorld);
      const corners=[[-2.9,.638],[2.9,.638],[2.9,-.638],[-2.9,-.638]].map(([x,y])=>tickerScreen.localToWorld(new THREE.Vector3(x,y,.001)));
      const visible=camera.position.clone().sub(center).dot(normal)>0&&corners.every(p=>p.clone().applyMatrix4(camera.matrixWorldInverse).z<-.02);
      tickerSurface.style.visibility=visible?"visible":"hidden";
      if(visible){const quad=corners.map(p=>{p.project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}) as ScreenQuad;tickerSurface.style.transform="matrix3d("+screenQuadMatrix(quad,800,176).join(",")+")";}
    }
    if(vendingSurface){
      const center=vendingScreen.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(vendingScreen.matrixWorld);
      const corners=[[-.45,.63],[.45,.63],[.45,-.63],[-.45,-.63]].map(([x,y])=>vendingScreen.localToWorld(new THREE.Vector3(x,y,.001)));
      const visible=camera.position.clone().sub(center).dot(normal)>0&&corners.every(p=>p.clone().applyMatrix4(camera.matrixWorldInverse).z<-.02);
      vendingSurface.style.visibility=visible?"visible":"hidden";
      if(visible){const quad=corners.map(p=>{p.project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}) as ScreenQuad;
      const logicalWidth=600,logicalHeight=logicalWidth*1.4;
        vendingSurface.style.width=logicalWidth+"px";vendingSurface.style.height=logicalHeight+"px";
        vendingSurface.style.transform="matrix3d("+screenQuadMatrix(quad,logicalWidth,logicalHeight).join(",")+")";}
    }
    if(tvSurface){
      const center=tvScreen.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(tvScreen.matrixWorld);
      const corners=[[-.585,.395],[.585,.395],[.585,-.395],[-.585,-.395]].map(([x,y])=>tvScreen.localToWorld(new THREE.Vector3(x,y,.001)));
      const visible=camera.position.clone().sub(center).dot(normal)>0&&corners.every(p=>p.clone().applyMatrix4(camera.matrixWorldInverse).z<-.02);
      tvSurface.style.visibility=visible?"visible":"hidden";
      if(visible){
        const quad=corners.map(p=>{p.project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}) as ScreenQuad;
        tvSurface.style.transform="matrix3d("+screenQuadMatrix(quad,640,432).join(",")+")";
      }
    }
    if(view!=="terminal"){surface.style.visibility="hidden";return;}
    const points=[[-.81,.535],[.81,.535],[.81,-.535],[-.81,-.535]].map(([x,y])=>computer.screen.localToWorld(new THREE.Vector3(x,y,.001)));
    if(!(camera.position.z>screenCenter.z&&points.every(p=>p.clone().applyMatrix4(camera.matrixWorldInverse).z<-.02))){surface.style.visibility="hidden";return;}
    const quad=points.map(p=>{p.project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}) as ScreenQuad;
    if(quad.every(p=>p.x<0)||quad.every(p=>p.x>width)||quad.every(p=>p.y<0)||quad.every(p=>p.y>height)){surface.style.visibility="hidden";return;}
    surface.style.visibility="visible";surface.style.width=displayWidth+"px";surface.style.height=displayHeight+"px";
    surface.style.transform="matrix3d("+screenQuadMatrix(quad,displayWidth,displayHeight).join(",")+")";surface.style.borderRadius="0";host.dataset.screenQuad=JSON.stringify(quad);
  }
  function render(now:number,entranceSnapshot=false){
    frame=0;clearTimeout(ambientTimer);if(disposed||document.hidden||!worldFrameAllowed(active,preparing,entranceHeld||!!journeyStore.snapshot(),entranceSnapshot))return;
    const workStart=performance.now();
    const cameraActive=!!travel||view==="room"&&(zoomMotion.active||orbitHeld||now<orbitMotionUntil);
    const budget=worldFramePolicy(cameraActive,window.devicePixelRatio);
    if(renderer.getPixelRatio()!==budget.pixelRatio){renderer.setPixelRatio(budget.pixelRatio);life.setSteamViewport(renderer.domElement.height);}
    const frameGap=previous?now-previous:0;
    if(cameraActive&&frameGap>0&&frameGap<150)movingFrameGaps.push(frameGap);
    const dt=previous?Math.min(frameGap/1000,.05):1/60;previous=now;
    const nightMoving=Math.abs(Number(night)-nightAmount)>.001;
    if(nightMoving){
      nightAmount=reduced.matches?Number(night):THREE.MathUtils.damp(nightAmount,Number(night),3,dt);
      if(Math.abs(Number(night)-nightAmount)<.001)nightAmount=Number(night);
      daylight.forEach(({light,intensity,color})=>{const nightLevel=light instanceof THREE.HemisphereLight?.34:.2;light.intensity=intensity*(1-nightAmount*(1-nightLevel));light.color.copy(color).lerp(moonlight,nightAmount);});
      landscape.setNight(nightAmount);water.setNight(nightAmount);
    }
    station.update(nightAmount,reduced.matches?0:dt);
    rooftop.update(nightAmount);shopSign.update(nightAmount);lettering.update(now/1000,nightAmount,reduced.matches);
    if(nightLightsVisible!==(nightAmount>.001)){showNightLights(nightAmount>.001);renderer.shadowMap.needsUpdate=true;}
    if(environmentNight>=0&&!environmentPending&&Math.abs(nightAmount-Number(night))<.001&&environmentNight!==Number(night))void captureRoofEnvironment(Number(night));
    const windowsMoving=tramWindows.update(dt,reduced.matches);
    if(windowsMoving)renderer.shadowMap.needsUpdate=true;
    if(travel){
      syncListener();
      if(!travel.entrance||!entranceHeld){
        const flightNow=performance.now();travel.startedAt??=flightNow;
        travel.elapsed=cameraTravelElapsed(travel.startedAt,flightNow,travel.duration);
      }
      if(travel.entrance&&!entranceHeld&&!travel.airStarted&&!reduced.matches){travel.airStarted=true;worldSound.play("arrival",{duration:travel.duration});}
      host.dataset.flightDuration=String(travel.duration);host.dataset.flightElapsed=String(travel.elapsed);
      const t=travel.duration?Math.min(1,travel.elapsed/travel.duration):1,ease=travel.entrance?1-Math.pow(1-t,3):smoothRoomStep(t);
      // CurvePath may return null at its accumulated floating-point endpoint.
      // Land on the exact destination rather than sampling beyond the last arc.
      camera.position.copy(t===1?travel.to:(travel.path.getPoint(ease)??travel.to));camera.quaternion.slerpQuaternions(travel.qFrom,travel.qTo,ease);
      if(!travel.entrance&&!travel.airStarted&&!reduced.matches){travel.airStarted=true;syncListener();worldSound.play("camera",{duration:travel.duration,pan:travel.pan,gain:travel.airGain});}
      if(travel.entrance)camera.lookAt(travel.target);
      if(t===1){
        const {end,target,stop}=travel;travel=null;orbitControls.target.copy(target);
        const position=camera.position.clone();orbitControls.enableDamping=false;orbitControls.update();orbitControls.target.copy(target);camera.position.copy(position);camera.lookAt(target);orbitControls.enableDamping=!reduced.matches;
        orbitControls.enabled=end==="room";notify(end);onStop?.(stop);renderer.domElement.style.cursor=end==="room"?"grab":"default";
      }
    }else if(view==="room"){
      orbitControls.update();
      if(zoomMotion.active){
        zoomOffset.copy(camera.position).sub(orbitControls.target);
        zoomOffset.setLength(zoomMotion.step(zoomOffset.length(),dt,reduced.matches));
        camera.position.copy(orbitControls.target).add(zoomOffset);
      }
      const before=orbitControls.target.clone();orbitControls.target.x=THREE.MathUtils.clamp(before.x,-4.5,4.5);orbitControls.target.z=THREE.MathUtils.clamp(before.z,-2.5,3);orbitControls.target.y=THREE.MathUtils.clamp(before.y,.4,3.5);camera.position.add(orbitControls.target.clone().sub(before));
      const safe=safeWorldCamera(camera.position);
      if(Math.hypot(safe.x-camera.position.x,safe.y-camera.position.y,safe.z-camera.position.z)>.0001)zoomMotion.reset();
      camera.position.set(safe.x,safe.y,safe.z);
    }
    const lakeSafe=keepCameraInsideLake(camera.position,shoreline);
    if(Math.hypot(lakeSafe.x-camera.position.x,lakeSafe.y-camera.position.y,lakeSafe.z-camera.position.z)>.0001)zoomMotion.reset();
    camera.position.set(lakeSafe.x,lakeSafe.y,lakeSafe.z);
    if(travel?.entrance)camera.lookAt(travel.target);
    syncListener();
    const redrawDisplays=now-lastDisplayDraw>=1000/30;
    if(redrawDisplays){
    lastDisplayDraw=now;
    const dvdInterval=camera.position.distanceTo(screenCenter)<10?1000/30:1000/12;
    if(view!=="terminal"&&camera.position.z>screenCenter.z&&now-lastDvdDraw>=dvdInterval){lastDvdDraw=now;drawTramDVD(computer.ctx,reduced.matches?0:now/1000,computer.logoInk);computer.screenTexture.needsUpdate=true;}
    // The attract loop keeps playing at every camera distance. Only audio is
    // focus-gated; never freeze the cabinet in the world overview.
    if(!reduced.matches){
      const cues=animateArcade(now/1000);
      if(arcadeAudible())for(const cue of cues)worldSound.play(cue,{gain:.85,position:landmarks[1].target});
    }
    }
    const living=!reduced.matches&&view!=="terminal";
    if(living||nightMoving||birdReduced!==reduced.matches)birds.update(living?dt:0,nightAmount,reduced.matches);
    birdReduced=reduced.matches;
    if(living){life.update(now/1000,nightAmount);animateGarden(now/1000);animateMailbox(now/1000,mailOpen);}
    else if(reduced.matches)life.update(0,nightAmount);
    if(living&&fish.active)fish.update(now/1000,nightAmount);
    const reflectionChanged=windowsMoving||living&&now-lastReflection>65;
    if(reflectionChanged)lastReflection=now;
    if(now-soundTime>100){
      const speed=soundTime?Math.min(1,camera.position.distanceTo(soundPosition)/(Math.max(.1,(now-soundTime)/1000)*25)):0;
      worldSound.update(camera.position.distanceTo(screenCenter),speed,nightAmount,view==="terminal"||view==="tv");soundPosition.copy(camera.position);soundTime=now;
    }
    renderer.info.reset();
    water.update(reduced.matches?0:now/1000,reflectionChanged,reduced.matches?0:dt);camera.updateMatrixWorld();renderer.render(scene,camera);projectSurface();
    const workMs=performance.now()-workStart;
    host.dataset.quality="high";
    sampleStart ||= now;sampleFrames++;sampleWork+=workMs;
    if(now-sampleStart>1000){
      host.dataset.fishActive=String(fish.active);host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);
      host.dataset.camera=camera.position.toArray().map(n=>n.toFixed(3)).join(",");host.dataset.pixelRatio=String(renderer.getPixelRatio());
      host.dataset.renderMs=(sampleWork/sampleFrames).toFixed(2);host.dataset.fps=(sampleFrames*1000/(now-sampleStart)).toFixed(1);
      host.dataset.reflectionPasses=String(water.reflectionRenders-sampleReflectionRenders);sampleReflectionRenders=water.reflectionRenders;
      if(movingFrameGaps.length){movingFrameGaps.sort((a,b)=>a-b);host.dataset.movingFrameP95=movingFrameGaps[Math.floor((movingFrameGaps.length-1)*.95)].toFixed(1);movingFrameGaps.length=0;}
      sampleStart=now;sampleFrames=0;sampleWork=0;
    }
    // The timeout is followed by requestAnimationFrame: 16 ms here yields ~30
    // ambient frames/s, whereas 33 ms plus RAF was unintentionally ~20 fps.
    host.dataset.hologram=life.hologramActive?"rebuilding":"formed";
    host.dataset.birdsInView=String(birds.visibleCount(camera));
    if(entranceSnapshot)return;
    if(cameraActive||travel||nightMoving||windowsMoving||active&&!reduced.matches&&(life.hologramActive||water.isRippling||fish.active)&&(view==="room"||view==="object"))invalidate();else if(active&&!reduced.matches&&view!=="terminal")ambientTimer=setTimeout(invalidate,budget.idleDelay);
  }
  function invalidate(){if(!disposed&&(active||preparing)&&!frame&&!document.hidden)frame=requestAnimationFrame(render);}
  const orbitStart=()=>{orbitHeld=true;invalidate();};
  const orbitEnd=()=>{orbitHeld=false;orbitMotionUntil=performance.now()+180;invalidate();};
  const orbitChange=()=>{orbitMotionUntil=performance.now()+180;invalidate();};
  orbitControls.addEventListener("start",orbitStart);orbitControls.addEventListener("end",orbitEnd);orbitControls.addEventListener("change",orbitChange);
  const resize=()=>{
    zoomMotion.reset();
    const oldScale=worldOverviewScale(width,height);
    width=host.clientWidth;height=host.clientHeight;if(!width||!height)return;camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    life.setSteamViewport(renderer.domElement.height);
    const fit=fittedScreen(width,height,glassWidth,glassHeight,camera.fov);displayWidth=fit.width;displayHeight=fit.height;
    // A resize may change the destination, but must not restart the clock or
    // add time after the already-playing wind finishes.
    if(travel){
      const now=performance.now();
      travel.duration=Math.max(0,travel.duration-(travel.startedAt===undefined?0:cameraTravelElapsed(travel.startedAt,now,travel.duration)));
      if(travel.startedAt!==undefined)travel.startedAt=now;
      travel.elapsed=0;
    }
    if(travel&&travel.end==="terminal"){
      travel.to.copy(focusPose());travel.path=worldFlightCurve(camera.position,travel.to);travel.qFrom.copy(camera.quaternion);
    }else if(travel){
      const pose=travel.end==="arcade"?arcadePose():travel.end==="vending"?vendingPose():travel.end==="tv"?tvPose():travel.end==="object"?objectPose(objectSection):{position:overviewPose(),target:roomTarget.clone()};
      if(pose){
        travel.to.copy(pose.position);travel.target.copy(pose.target);poseCamera.position.copy(pose.position);poseCamera.lookAt(pose.target);travel.qTo.copy(poseCamera.quaternion);
        travel.path=worldFlightCurve(camera.position,travel.to);travel.qFrom.copy(camera.quaternion);
      }
    }else if(view==="terminal"){camera.position.copy(focusPose());camera.quaternion.identity();host.style.pointerEvents="none";}
    else if(view==="vending"||view==="tv"||view==="arcade"){
      const pose=view==="arcade"?arcadePose():view==="vending"?vendingPose():tvPose();camera.position.copy(pose.position);camera.lookAt(pose.target);orbitControls.target.copy(pose.target);
    }else if(view==="room"){
      const ratio=worldOverviewScale(width,height)/oldScale;
      camera.position.sub(orbitControls.target).multiplyScalar(ratio).add(orbitControls.target);
    }else if(view==="object"){
      const pose=objectPose(objectSection);if(pose){camera.position.copy(pose.position);camera.lookAt(pose.target);orbitControls.target.copy(pose.target);}
    }
    savedPosition.sub(savedTarget).multiplyScalar(worldOverviewScale(width,height)/oldScale).add(savedTarget);
    invalidate();
  };
  const observer=new ResizeObserver(resize);observer.observe(host);
  const visibility=()=>{previous=0;if(document.hidden){cancel();cancelAnimationFrame(frame);clearTimeout(ambientTimer);frame=0;}else invalidate();};document.addEventListener("visibilitychange",visibility);
  const lost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(frame);frame=0;onLost();};renderer.domElement.addEventListener("webglcontextlost",lost);resize();
  return {switchArcade,prepare:async()=>{
    // Do not start the render loop while texture uploads/shaders are warming.
    resize();await Promise.all([landscape.ready,lettering.ready,shopSign.ready,photosReady]);if(disposed)return;
    await warmWorldTextures(renderer,scene,()=>disposed);if(disposed)return;
    // Compile BEFORE the first cube face, not after six blocking scene draws.
    await renderer.compileAsync(scene,camera);if(disposed)return;
    await captureRoofEnvironment(0);if(disposed)return;
    await renderer.compileAsync(scene,camera);if(disposed)return;
    // Avoid compiling the extra point/spot-light variant on the first night toggle.
    try{showNightLights(true);await renderer.compileAsync(scene,camera);}
    finally{showNightLights(false);}
    await yieldLoadingWork();
    if(!disposed){preparing=true;render(performance.now());preparing=false;}
  },setActive:(next)=>{
    active=next;previous=0;if(!next)mailOpen=false;
    if(next){invalidate();return;}
    cancelAnimationFrame(frame);frame=0;clearTimeout(ambientTimer);travel=null;zoomMotion.reset();orbitControls.enabled=false;
    // An aborted transition must not resume halfway through the tram next time.
    camera.position.copy(focusPose());camera.lookAt(screenCenter);camera.updateMatrixWorld();projectSurface();
    if(view!=="terminal"){notify("terminal");onStop?.(null);}
  },setNight,enter,reveal,focus,visit,zoom:(direction)=>{
    queueZoom(direction*.26);
  },reset:()=>{if(view==="room")moveTo("room",overviewPose(),roomTarget);},orbit:(x,y)=>{
    if(view!=="room")return;const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbitControls.target));s.theta+=x;s.phi=THREE.MathUtils.clamp(s.phi+y,orbitControls.minPolarAngle,orbitControls.maxPolarAngle);camera.position.copy(orbitControls.target).add(new THREE.Vector3().setFromSpherical(s));orbitControls.update();invalidate();
  },dispose:()=>{
    disposed=true;birds.dispose();shopSign.dispose();roofEnvironment.dispose();cancelAnimationFrame(frame);cancelAnimationFrame(hoverFrame);clearTimeout(ambientTimer);observer.disconnect();orbitControls.dispose();document.removeEventListener("visibilitychange",visibility);renderer.domElement.removeEventListener("webglcontextlost",lost);
    renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",pointerMove);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",cancel);
    renderer.domElement.removeEventListener("pointerleave",pointerLeave);
    renderer.domElement.removeEventListener("wheel",wheel);
    scene.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();if(object instanceof THREE.Light&&"shadow" in object)(object as THREE.DirectionalLight).shadow?.dispose();});
    landmarks.forEach(s=>{s.hit.geometry.dispose();(s.hit.material as THREE.Material).dispose();});materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();
    occluders.forEach(o=>o.geometry.dispose());arcadeModeHit.geometry.dispose();arcadeScreenHit.geometry.dispose();disposePhotos();water.dispose();life.dispose();fish.dispose();landscape.dispose();station.dispose();tramWindows.dispose();lettering.dispose();
  }};
}
