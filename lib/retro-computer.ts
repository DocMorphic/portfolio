import * as THREE from "three";
import { buildRetroComputer } from "./retro-computer-model";
import { dvdPosition, DVD_WIDTH, DVD_HEIGHT } from "./dvd-screensaver";
import { ComputerSpin } from "./computer-spin";
import { editCode, findComputerMedia, KEYCAP_REST, KEYCAP_PRESSED, stepKeycap, advanceTerminalCode, TERMINAL_CODE, TERMINAL_HINT_KEYS, keyboardHintsVisible, MAX_CODE_LENGTH, type ComputerView, type KeyFeedback } from "./computer-interactions";
import { computerMedia, type ComputerMedia } from "@/content/computer-media";
import { convexHull, expandByFootprint, moveMouseWithinScene, type Point, type Bounds } from "./mouse-collision";
import { mouseDragTarget } from "./mouse-drag";
import { MouseReturn } from "./mouse-return";
import { stepMousePlacement } from "./mouse-placement";

export type ComputerControls = { power(): void; disk(): void; screen(): void; keyboard(): void; back(): void; screenBounds():{x:number;y:number;width:number;height:number}; resetMouse(): void; key(value: string): void; playPause(): void; dispose(): void };
type ComputerState = { powered: boolean; ejected: boolean; message: string; view: ComputerView; playing: boolean; hasMedia: boolean; terminal: boolean; terminalReady: boolean };

/** A self-contained desk toy: no model downloads, audio, or physics worker. */
export function createComputer(host: HTMLElement, onState: (state: ComputerState) => void, terminalSurface?: HTMLElement | null): ComputerControls {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.1, 50);
  camera.position.set(4.2, 3.1, 7);
  camera.lookAt(0, 0.8, 0.35);
  const { rig, materials, textures, keyboard, keys, mouse, mouseBody, wire, screen, screenTexture, ctx, logoInk, powerButton, ejectButton, disk, led, collisionBodies } = buildRetroComputer();
  scene.add(rig);
  const heldKeys = new Set<string>();
  let maxKeyTravel=0;
  const normalizeKey = (name:string) => name === " " ? "Space" : name.length === 1 ? name.toUpperCase() : name;
  const mouseHome=mouse.position.clone();
  const mouseTarget=mouse.position.clone();const lastMouse=mouse.position.clone();
  scene.add(new THREE.HemisphereLight(0xfff5dd,0x726956,2.6));
  const light=new THREE.DirectionalLight(0xffefd6,2.5);light.position.set(-3,10,3);light.castShadow=true;
  light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-4;light.shadow.camera.right=4;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;light.shadow.normalBias=0.035;light.shadow.bias=-0.0001;
  scene.add(light);
  const fill=new THREE.DirectionalLight(0xc6e1e0,1.2);fill.position.set(4,2,-2);scene.add(fill);
  const shadowMat=new THREE.ShadowMaterial({opacity:0.18});materials.push(shadowMat);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),shadowMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

  let powered=true,ejected=false,boot=-10,wake=-10,time=0,previous=0,lastDraw=-1,frame=0,visible=true,disposed=false;
  let targetX=0,targetY=0,hoverYaw=0;
  const spin = new ComputerSpin();
  let activePointer: number | null = null;
  let pressedObject: THREE.Object3D | null = null;
  let gesture: "spin" | "mouse" | "key" | null = null;
  let gestureStart={x:0,y:0};let gestureMoved=false;
  let view:ComputerView="overview",entry="",message="Click the keyboard to explore.";
  let accepted="";
  const feedback=new Map<string,{kind:KeyFeedback;until:number}>();
  let terminal=false,terminalReady=false;
  let activeMedia:ComputerMedia|undefined;
  const media=document.createElement("video");media.playsInline=true;media.preload="none";media.volume=0.8;
  let playRequest=0;
  let pendingPlayback=false;
  let viewWidth=7.7;
  let travel: null | {elapsed:number;from:THREE.Vector3;to:THREE.Vector3;qFrom:THREE.Quaternion;qTo:THREE.Quaternion;width:number;yaw:number} = null;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const notify=(text:string)=>{message=text;onState({powered,ejected,message,view,playing:!media.paused,hasMedia:!!activeMedia,terminal,terminalReady});};
  const stopMedia=()=>{playRequest++;pendingPlayback=false;media.pause();};
  const power=()=>{if(terminal){back();return;}powered=!powered;if(powered){boot=time;wake=time;}else stopMedia();notify(powered?"Booting portfolio…":"Computer asleep.");invalidate();};
  const eject=()=>{ejected=!ejected;notify(ejected?"Floppy disk ejected. Click again to insert.":"Floppy disk inserted.");invalidate();};
  const mouseReturn=new MouseReturn();
  let mouseReturnFrom:THREE.Vector3|null=null;
  const resetMouse=()=>{
    if(gesture==="mouse"){
      const captured=activePointer;activePointer=null;gesture=null;pressedObject=null;
      if(captured!==null&&renderer.domElement.hasPointerCapture(captured))renderer.domElement.releasePointerCapture(captured);
      renderer.domElement.style.cursor="default";
    }
    mouseTarget.copy(mouse.position);
    mouseReturn.request();mouseReturnFrom=null;invalidate();
  };
  const focusView=(next:ComputerView)=>{
    resetMouse();
    if(next===view)return;
    heldKeys.clear();
    const captured=activePointer;activePointer=null;pressedObject=null;gesture=null;mouseTarget.y=0.1;
    if(captured!==null&&renderer.domElement.hasPointerCapture(captured))renderer.domElement.releasePointerCapture(captured);
    view=next;targetX=0;targetY=0;
    const pose=new THREE.PerspectiveCamera();let to:THREE.Vector3;
    // Near-overhead rather than perfectly vertical: the sculpted key sides and
    // downward travel remain visible, without moving or replacing the canvas.
    if(next==="keyboard"){to=new THREE.Vector3(-0.1,4.5,3.5);pose.position.copy(to);pose.lookAt(-0.1,0.2,1.4);}
    else if(next==="screen"){to=new THREE.Vector3(0,2.55,5.8);pose.position.copy(to);pose.lookAt(0,1.16,0.9);}
    else{to=new THREE.Vector3(4.2,3.1,7);pose.position.copy(to);pose.lookAt(0,0.8,0.35);}
    travel={elapsed:0,from:camera.position.clone(),to,qFrom:camera.quaternion.clone(),qTo:pose.quaternion.clone(),width:viewWidth,yaw:rig.rotation.y};
    spin.reset();notify(message);invalidate();
  };
  const focusKeyboard=()=>{stopMedia();entry="";accepted="";feedback.clear();focusView("keyboard");notify("Some keys are glowing. Find the sequence. Escape goes back.");};
  const back=()=>{stopMedia();terminal=false;terminalReady=false;entry="";accepted="";feedback.clear();focusView("overview");notify("Back at the desktop.");};
  const wakeScreen=()=>{resetMouse();if(view==="screen"&&powered)return;if(!powered){powered=true;boot=time;}wake=time;focusView("screen");notify(activeMedia?activeMedia.title:"Welcome to the tiny portfolio.");invalidate();};
  const play=()=>{
    if(!activeMedia)return;
    powered=true;media.volume=0.8;const request=++playRequest;
    void media.play().then(()=>{if(!disposed&&request===playRequest){notify(`Playing ${activeMedia?.title}.`);invalidate();}})
      .catch(()=>{if(!disposed&&request===playRequest){notify("Playback could not start. Press Play to retry.");invalidate();}});
  };
  const preparePlayback=()=>{
    // Claim playback permission inside the actual Enter/click gesture, silently.
    // Rewind and start the chosen media only after the camera reaches the CRT.
    const request=++playRequest;media.volume=0;
    void media.play().then(()=>{
      if(disposed||request!==playRequest)return;
      media.pause();media.currentTime=0;
      if(view==="screen"&&!travel)play();else pendingPlayback=true;
    }).catch(()=>{if(!disposed&&request===playRequest)notify("Media is ready. Press Play after the camera moves to the monitor.");});
  };
  const playPause=()=>{if(media.paused)play();else{stopMedia();notify("Playback paused.");invalidate();}};
  const key=(name:string,pulse=true)=>{
    if(pulse)for(const item of keys)if(item.name===normalizeKey(name))item.pressedUntil=time+0.14;
    if(name==="Esc"||name==="Escape"){back();return;}
    if(terminal)return;
    if(name==="Enter"){
      const match=findComputerMedia(entry,computerMedia);
      if(!match){notify(computerMedia.length?"That code wasn't recognized. Try again.":"No secret media has been linked yet.");invalidate();return;}
      stopMedia();activeMedia=match;media.src=match.src;media.load();powered=true;focusView("screen");notify(`Unlocked: ${match.title}`);preparePlayback();return;
    }
    // Keep the last characters instead of locking up after repeated guesses.
    entry=editCode(entry.length===MAX_CODE_LENGTH&&name.length===1?entry.slice(1):entry,name);
    const result=advanceTerminalCode(accepted,normalizeKey(name));accepted=result.accepted;
    if(result.feedback)feedback.set(normalizeKey(name),{kind:result.feedback,until:time+.85});
    if(name==="Backspace")feedback.clear();
    if(accepted===TERMINAL_CODE){
      stopMedia();activeMedia=undefined;terminal=true;terminalReady=false;powered=true;entry="";
      focusView("screen");notify("Sequence accepted. Opening portfolio terminal…");
    }else notify("Some keys are glowing. Find the sequence.");
    invalidate();
  };
  media.onended=()=>{notify("Playback finished.");invalidate();};
  media.onerror=()=>{notify("This media could not be loaded. Check its file and format.");invalidate();};
  const drawScreen=()=>{
    ctx.fillStyle=powered?"#17352a":"#16221e";ctx.fillRect(0,0,512,352);
    if(powered) {
      ctx.fillStyle="#b3e6a2";ctx.font="20px monospace";
      if(terminal){
        ctx.fillStyle="#0c1510";ctx.fillRect(0,0,512,352);
        ctx.fillStyle="#a7edb4";ctx.font="18px monospace";
        ["PERSONAL PORTFOLIO","","SEQUENCE ACCEPTED","MOUNTING /home/dharmay","","CONNECTING TO TTY-01…"].forEach((line,i)=>ctx.fillText(line,30,48+i*35));
      }else if(activeMedia){
        ctx.fillStyle="#07130e";ctx.fillRect(0,0,512,352);
        if(activeMedia.kind==="video"&&media.readyState>=2&&media.videoWidth){
          const scale=Math.min(512/media.videoWidth,352/media.videoHeight);const w=media.videoWidth*scale,h=media.videoHeight*scale;
          ctx.drawImage(media,(512-w)/2,(352-h)/2,w,h);
        }else{
          ctx.strokeStyle="#89c497";ctx.lineWidth=3;
          for(const radius of [45,58,72,88]){ctx.beginPath();ctx.arc(256,140,radius,0,Math.PI*2);ctx.stroke();}
          const angle=reduced.matches||media.paused?0:media.currentTime*1.4;
          ctx.fillStyle="#d8dfaf";ctx.beginPath();ctx.arc(256+Math.cos(angle)*58,140+Math.sin(angle)*58,5,0,Math.PI*2);ctx.fill();
          ctx.textAlign="center";ctx.font="20px monospace";ctx.fillText(activeMedia.title,256,268,460);ctx.font="16px monospace";ctx.fillText(media.paused?"PAUSED":"NOW PLAYING",256,300);ctx.textAlign="start";
        }
      }else if(!reduced.matches && time-boot<1.8) {
        const lines=["PERSONAL COMPUTER","64K MEMORY ........ OK","MOUNTING PORTFOLIO","READY."];
        lines.slice(0,Math.min(4,Math.floor((time-boot)*2.5)+1)).forEach((line,i)=>ctx.fillText(line,30,65+i*48));
      } else if(time-wake<8) {
        ctx.fillStyle="#608866";ctx.fillRect(0,0,512,352);
        ctx.fillStyle="#e2d7b6";ctx.fillRect(0,0,512,30);ctx.fillStyle="#293b2c";ctx.font="bold 18px monospace";ctx.fillText("DD / Portfolio",18,22);
        ctx.fillStyle="#213829";ctx.fillRect(94,84,342,212);ctx.fillStyle="#f0e5c7";ctx.fillRect(88,78,342,212);
        ctx.fillStyle="#b6c09b";ctx.fillRect(88,78,342,29);ctx.fillStyle="#263d2e";ctx.fillText("hello.txt",104,100);
        ctx.font="bold 29px monospace";ctx.fillText("Hello, world.",112,156);
        ctx.font="18px monospace";ctx.fillText("I'm Dharmay.",112,195);ctx.fillText("I build things.",112,224);
        if(reduced.matches||Math.floor(time*2)%2===0)ctx.fillRect(112,246,12,20);
      } else {
        const logo=dvdPosition(reduced.matches?0:time);
        ctx.fillStyle="#091710";ctx.fillRect(0,0,512,352);
        ctx.save();ctx.translate(logo.x,logo.y);
        ctx.scale(DVD_WIDTH/(logoInk.right-logoInk.left),DVD_HEIGHT/(logoInk.bottom-logoInk.top));
        ctx.translate(-logoInk.left,-logoInk.top);
        ctx.fillStyle=logo.color;ctx.shadowColor=logo.color;ctx.shadowBlur=4;
        ctx.font="italic 900 80px Arial, sans-serif";ctx.fillText("DVD",0,72);
        ctx.beginPath();ctx.ellipse(90,88,85,9,0,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;ctx.fillStyle="#091710";
        ctx.beginPath();ctx.ellipse(90,88,26,3,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=logo.color;ctx.font="bold 14px Arial, sans-serif";ctx.fillText("V I D E O",59,111);
        ctx.restore();
      }
      ctx.fillStyle="rgba(5,20,12,.15)";for(let y=0;y<352;y+=4)ctx.fillRect(0,y,512,1);
      const vignette=ctx.createRadialGradient(256,176,90,256,176,300);vignette.addColorStop(0,"transparent");vignette.addColorStop(1,"rgba(0,15,8,.48)");ctx.fillStyle=vignette;ctx.fillRect(0,0,512,352);
      ctx.fillStyle="rgba(255,255,225,.035)";ctx.beginPath();ctx.ellipse(122,52,180,28,-0.25,0,Math.PI*2);ctx.fill();
    }
    screenTexture.needsUpdate=true;
  };
  const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
  const mouseOffset=new THREE.Vector3();
  const mouseCursor=new THREE.Vector2();
  const placementRay=new THREE.Raycaster();
  const groundPlane=new THREE.Plane();
  // Sample the rendered rounded surfaces, not oversized enclosing boxes.
  rig.updateMatrixWorld(true);
  const vertices=(mesh:THREE.Mesh)=>{
    const positions=mesh.geometry.attributes.position;
    const unique=new Map<string,THREE.Vector3>();
    for(let i=0;i<positions.count;i++){
      const p=new THREE.Vector3().fromBufferAttribute(positions,i);
      unique.set(p.toArray().join(","),p);
    }
    return [...unique.values()];
  };
  const obstacleVertices=collisionBodies.map(mesh=>vertices(mesh).map(p=>rig.worldToLocal(mesh.localToWorld(p))));
  const mouseVertices=vertices(mouseBody).map(p=>p.applyAxisAngle(new THREE.Vector3(0,1,0),mouse.rotation.y));
  const projectMousePoint=(point:THREE.Vector3):Point=>{
    const p=point.clone().applyMatrix4(rig.matrixWorld).project(camera);
    return {x:(p.x+1)*host.clientWidth/2,y:(1-p.y)*host.clientHeight/2};
  };
  let constraintsCache:{key:string;value:{bounds:Bounds;obstacles:Point[][]}}|undefined;
  const mouseConstraints=(height=mouse.position.y)=>{
    rig.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const key=[host.clientWidth,host.clientHeight,height,...rig.matrixWorld.elements,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(",");
    if(constraintsCache?.key===key)return constraintsCache.value;
    const origin=projectMousePoint(new THREE.Vector3(0,0.1,0));
    const footprintAt=(y:number)=>convexHull(mouseVertices.map(v=>{
      const p=projectMousePoint(v.clone().add(new THREE.Vector3(0,y,0)));
      return {x:p.x-origin.x,y:p.y-origin.y};
    }));
    const footprint=footprintAt(height);
    // Only frame bounds reserve both heights; object contact uses the current surface.
    const frameFootprint=[...footprintAt(0.1),...footprintAt(0.25)];
    const left=Math.min(...frameFootprint.map(p=>p.x))-0.5,right=Math.max(...frameFootprint.map(p=>p.x))+0.5;
    const top=Math.min(...frameFootprint.map(p=>p.y))-0.5,bottom=Math.max(...frameFootprint.map(p=>p.y))+0.5;
    const bounds:Bounds={left:-left,right:host.clientWidth-right,top:-top,bottom:host.clientHeight-bottom};
    const obstacles=obstacleVertices.map(points=>expandByFootprint(convexHull(points.map(projectMousePoint)),footprint));
    const value={bounds,obstacles};constraintsCache={key,value};return value;
  };
  const placeMouse=(from:THREE.Vector3,to:THREE.Vector3,constraints:ReturnType<typeof mouseConstraints>)=>{
    const start=projectMousePoint(new THREE.Vector3(from.x,0.1,from.z));
    const target=projectMousePoint(new THREE.Vector3(to.x,0.1,to.z));
    const result=moveMouseWithinScene(start,target,constraints.bounds,constraints.obstacles);
    if(!result)return from.clone();
    placementRay.setFromCamera(new THREE.Vector2(result.x/host.clientWidth*2-1,1-result.y/host.clientHeight*2),camera);
    groundPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0).transformDirection(rig.matrixWorld),rig.localToWorld(new THREE.Vector3(0,0.1,0)));
    const world=placementRay.ray.intersectPlane(groundPlane,new THREE.Vector3());
    if(!world)return from.clone();
    const local=rig.worldToLocal(world);local.y=to.y;return local;
  };
  const within=(object:THREE.Object3D|undefined,group:THREE.Object3D)=>{for(let node=object;node;node=node.parent??undefined)if(node===group)return true;return false;};
  const keyName=(object:THREE.Object3D|undefined)=>{for(let node=object;node;node=node.parent??undefined)if(node.userData.key)return node.userData.key as string;return undefined;};
  const hit=(event:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(rig.children,true)[0]?.object;};
  const dragMouse=()=>{
    const r=renderer.domElement.getBoundingClientRect();
    if(!r.width||!r.height)return;
    rig.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    raycaster.setFromCamera(new THREE.Vector2((mouseCursor.x-r.left)/r.width*2-1,1-(mouseCursor.y-r.top)/r.height*2),camera);
    const target=mouseDragTarget(raycaster.ray,rig.matrixWorld,mouseOffset,0.25);
    if(target)mouseTarget.copy(placeMouse(mouse.position,target,mouseConstraints(0.25)));
  };
  const down=(event:PointerEvent)=>{
    if(!event.isPrimary||event.button!==0||activePointer!==null||travel)return;
    const object=hit(event);
    // The miniature can be very small below the mobile About copy. Its canvas
    // remains a generous tap target; the keyboard then gets a real close-up.
    if(!object){if(view==="overview"&&window.matchMedia("(max-width: 600px)").matches)focusKeyboard();return;}
    if(within(object,mouse)&&view!=="overview")return;
    activePointer=event.pointerId;pressedObject=object;
    gesture=within(object,mouse)?"mouse":within(object,keyboard)||view!=="overview"?"key":"spin";
    gestureStart={x:event.clientX,y:event.clientY};gestureMoved=false;
    if(view==="keyboard"){
      const name=keyName(object);
      if(name){heldKeys.add(name);for(const item of keys)if(item.name===name)item.pressedUntil=time+0.14;}
    }
    if(gesture==="spin")spin.begin(event.clientX,event.clientY,event.timeStamp,host.clientWidth);
    else if(gesture==="mouse"){
      mouseReturn.cancel();mouseReturnFrom=null;
      const contact=raycaster.intersectObjects(mouse.children,true)[0];
      if(contact)mouseOffset.copy(rig.worldToLocal(contact.point.clone())).sub(mouse.position);else mouseOffset.set(0,0,0);
      mouseCursor.set(event.clientX,event.clientY);
      spin.velocity=0;dragMouse();
    }
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.style.cursor="grabbing";
    host.focus({preventScroll:true});invalidate();
  };
  const move=(event:PointerEvent)=>{
    if(activePointer!==null){
      if(event.pointerId===activePointer){
        if(Math.hypot(event.clientX-gestureStart.x,event.clientY-gestureStart.y)>6)gestureMoved=true;
        if(gesture==="spin")spin.move(event.clientX,event.clientY,event.timeStamp);
        else if(gesture==="mouse"){
          mouseCursor.set(event.clientX,event.clientY);dragMouse();
        }
        targetX=0;targetY=0;invalidate();
      }
      return;
    }
    const r=host.getBoundingClientRect();targetX=view==="overview"?((event.clientX-r.left)/r.width-0.5)*0.22:0;targetY=view==="overview"?((event.clientY-r.top)/r.height-0.5)*0.06:0;
    const object=hit(event);renderer.domElement.style.cursor=within(object,keyboard)||object===screen||object===powerButton||object===ejectButton?"pointer":within(object,mouse)||object&&view==="overview"?"grab":"default";invalidate();
  };
  const leave=()=>{targetX=0;targetY=0;if(activePointer===null)renderer.domElement.style.cursor="default";invalidate();};
  const release=(event:PointerEvent)=>{
    if(event.pointerId!==activePointer)return;
    const cancelled=event.type!=="pointerup";
    const pressedKey=keyName(pressedObject??undefined);if(pressedKey)heldKeys.delete(pressedKey);
    const dragged=gesture==="spin"?spin.release(event.timeStamp,cancelled,reduced.matches):gestureMoved;
    if(gesture==="mouse")mouseTarget.y=0.1;
    activePointer=null;
    if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId);
    const object=hit(event);
    renderer.domElement.style.cursor=object?"grab":"default";
    if(!cancelled&&!dragged){
      if(within(pressedObject??undefined,keyboard)&&within(object,keyboard)){
        resetMouse();
        if(view!=="keyboard")focusKeyboard();else{const name=keyName(object);if(name&&name===keyName(pressedObject??undefined))key(name,false);}
      }else if(object===pressedObject){
        if(object===powerButton)power();else if(object===ejectButton||object?.parent===disk)eject();else if(object===screen)wakeScreen();
      }
    }
    pressedObject=null;gesture=null;invalidate();
  };
  const resetView=()=>{
    const pointerId=activePointer;activePointer=null;pressedObject=null;spin.reset();targetX=0;targetY=0;hoverYaw=0;
    if(pointerId!==null&&renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId);
    notify("Computer view reset.");invalidate();
  };
  const keydown=(event:KeyboardEvent)=>{
    if(event.target instanceof HTMLElement&&event.target.closest("input, textarea, button, a, [contenteditable]"))return;
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();back();}
    else if(view==="keyboard"){
      if(event.key.length===1||event.key==="Backspace"||event.key==="Enter"){event.preventDefault();heldKeys.add(normalizeKey(event.key));key(event.key);}
    }
    else if(event.key==="Home"){event.preventDefault();resetView();}
    else if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
      event.preventDefault();spin.rotateBy((event.key==="ArrowLeft"?-1:1)*Math.PI/8);invalidate();
    }
  };
  const keyup=(event:KeyboardEvent)=>{heldKeys.delete(normalizeKey(event.key));invalidate();};
  const blur=()=>{heldKeys.clear();invalidate();};
  host.addEventListener("keyup",keyup);host.addEventListener("blur",blur);
  renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("pointerleave",leave);renderer.domElement.addEventListener("pointerup",release);renderer.domElement.addEventListener("pointercancel",release);renderer.domElement.addEventListener("lostpointercapture",release);host.addEventListener("keydown",keydown);
  function render(now:number){
    frame=0;if(disposed||!visible||document.hidden)return;
    const dt=previous?Math.min((now-previous)/1000,0.05):0;previous=now;time+=dt;
    const blend=reduced.matches?1:1-Math.exp(-dt*9);
    if(!travel&&view==="overview"&&gesture!=="mouse")spin.step(dt,reduced.matches);
    hoverYaw+=(targetX-hoverYaw)*blend;
    // Keep the drag plane's model transform stable while holding the mouse.
    if(!travel&&gesture!=="mouse"){rig.rotation.y=spin.angle+hoverYaw;rig.rotation.x+=(targetY-rig.rotation.x)*blend;}
    if(travel){
      travel.elapsed+=dt;const t=reduced.matches?1:Math.min(1,travel.elapsed/1.25);const ease=t*t*t*(t*(6*t-15)+10);
      camera.position.lerpVectors(travel.from,travel.to,ease);camera.position.y+=Math.sin(Math.PI*t)*0.25;
      camera.quaternion.slerpQuaternions(travel.qFrom,travel.qTo,ease);
      const aspect=Math.max(0.1,host.clientWidth/Math.max(1,host.clientHeight));
      const targetWidth=view==="overview"?Math.max(4*aspect,3.9):view==="keyboard"?Math.max(2.75,1.08*aspect):Math.max(2.75,2.5*aspect);
      viewWidth=THREE.MathUtils.lerp(travel.width,targetWidth,ease);
      rig.rotation.y=THREE.MathUtils.lerp(travel.yaw,Math.round(travel.yaw/(Math.PI*2))*Math.PI*2,ease);rig.rotation.x*=1-ease;
      if(t===1){travel=null;spin.reset();hoverYaw=0;rig.rotation.set(0,0,0);if(terminal){terminalReady=true;notify("Portfolio terminal ready.");}if(pendingPlayback){pendingPlayback=false;play();}}
    }
    const aspect=Math.max(0.1,host.clientWidth/Math.max(1,host.clientHeight));
    camera.left=-viewWidth/2;camera.right=viewWidth/2;camera.top=viewWidth/aspect/2;camera.bottom=-viewWidth/aspect/2;camera.updateProjectionMatrix();
    for(const item of keys){
      const hintsVisible=keyboardHintsVisible(view,!!travel,terminal);
      const flash=feedback.get(item.name),kind=flash&&flash.until>time?flash.kind:accepted.includes(item.name)?"correct":null;
      const tint=kind==="correct"?0x4ddc83:kind==="misplaced"?0xffd449:kind==="wrong"?0xf14c52:TERMINAL_HINT_KEYS.has(item.name)?0xf08a24:null;
      item.hint.color.copy(item.restColor);item.hint.emissiveIntensity=0;
      if(hintsVisible&&tint!==null){item.hint.color.set(tint);item.hint.emissive.set(tint);item.hint.emissiveIntensity=kind?.55:reduced.matches?.3:.3+Math.sin(time*2.1)*.09;}
      const pressed=heldKeys.has(item.name)||item.pressedUntil>time;
      item.group.position.y=reduced.matches?(pressed?KEYCAP_PRESSED:KEYCAP_REST):stepKeycap(item.group.position.y,pressed,dt);
      maxKeyTravel=Math.max(maxKeyTravel,KEYCAP_REST-item.group.position.y);
    }
    // Aggregate geometry-only diagnostic: never expose the secret or typed keys.
    renderer.domElement.dataset.maxKeyTravel=maxKeyTravel.toFixed(4);
    renderer.domElement.dataset.hintsVisible=String(keyboardHintsVisible(view,!!travel,terminal));
    // Direct manipulation must not trail the pointer or accumulate collision offsets.
    const returnProgress=mouseReturn.step(dt,!!travel,reduced.matches);
    if(returnProgress!==null){
      mouseReturnFrom??=mouse.position.clone();
      mouseTarget.lerpVectors(mouseReturnFrom,mouseHome,returnProgress);
    }
    const mouseBlend=gesture==="mouse"||returnProgress!==null?1:blend;
    if(view==="overview"&&!travel){
      if(gesture==="mouse")dragMouse();
      // Keep the resting mouse in rig-local coordinates throughout a spin.
      // Projected monitor overlap must never rewrite its position or target.
      mouse.position.copy(stepMousePlacement(mouse.position,mouseTarget,mouseBlend,gesture==="mouse",(from,to)=>placeMouse(from,to,mouseConstraints(to.y))));
      const projected=projectMousePoint(new THREE.Vector3(mouse.position.x,0.1,mouse.position.z));
      renderer.domElement.dataset.mouseScreenPosition=`${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
    }else mouse.position.lerp(mouseTarget,mouseBlend);
    if(mouse.position.distanceToSquared(lastMouse)>0.000001){
      const end=new THREE.Vector3(0,0,-0.24).applyAxisAngle(new THREE.Vector3(0,1,0),mouse.rotation.y).add(mouse.position);
      const slack=Math.max(0.05,0.45-(end.distanceTo(new THREE.Vector3(1.05,0.2,0.2)))*0.15);
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(1.05,0.2,0.2),new THREE.Vector3(1.38,0.055,0.45),new THREE.Vector3(end.x+slack,0.055,end.z-0.3),end]);
      wire.geometry.dispose();wire.geometry=new THREE.TubeGeometry(curve,32,0.017,6,false);lastMouse.copy(mouse.position);
    }
    renderer.domElement.dataset.spinAngle=spin.angle.toFixed(3);
    renderer.domElement.dataset.spinVelocity=spin.velocity.toFixed(3);
    renderer.domElement.dataset.view=view;renderer.domElement.dataset.transition=travel?"moving":"settled";
    renderer.domElement.dataset.mousePosition=mouse.position.toArray().map(n=>n.toFixed(3)).join(",");
    disk.position.z+=((ejected?1.26:0.45)-disk.position.z)*blend;
    led.visible=powered;
    if(time-lastDraw>1/24||reduced.matches){drawScreen();lastDraw=time;}
    renderer.render(scene,camera);
    // Anchor DOM interaction to the actual glass, not the About window. The
    // orthographic camera makes this affine mapping exact for the screen plane.
    // Renderer updates world/camera matrices before we project its three corners.
    if(terminalSurface&&terminal){
      const project=(x:number,y:number)=>{
        const p=screen.localToWorld(new THREE.Vector3(x,y,0)).project(camera);
        return {x:(p.x+1)*host.clientWidth/2+host.offsetLeft,y:(1-p.y)*host.clientHeight/2+host.offsetTop};
      };
      const tl=project(-0.81,0.535),tr=project(0.81,0.535),bl=project(-0.81,-0.535);
      terminalSurface.style.transform=`matrix(${(tr.x-tl.x)/512},${(tr.y-tl.y)/512},${(bl.x-tl.x)/352},${(bl.y-tl.y)/352},${tl.x},${tl.y})`;
    }
    // Once the HTML terminal owns the glass, the obscured 3D scene can sleep.
    if((!terminalReady&&!reduced.matches)||travel||mouseReturn.active||!media.paused||keys.some(item=>item.pressedUntil>time)||[...feedback.values()].some(f=>f.until>time))frame=requestAnimationFrame(render);
  }
  function invalidate(){if(!disposed&&!frame&&visible&&!document.hidden){previous=0;frame=requestAnimationFrame(render);}}
  const resize=()=>{
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w,h,false);
    if(!travel)viewWidth=view==="overview"?Math.max(4*w/h,3.9):view==="keyboard"?Math.max(2.75,1.08*w/h):Math.max(2.75,2.5*w/h);
    invalidate();
  };
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else invalidate();});intersection.observe(host);
  const visibility=()=>{if(document.hidden){heldKeys.clear();cancelAnimationFrame(frame);frame=0;spin.release(performance.now(),true);activePointer=null;pressedObject=null;gesture=null;mouseTarget.y=0.1;stopMedia();notify("Playback paused while hidden.");}else invalidate();};
  document.addEventListener("visibilitychange",visibility);reduced.addEventListener("change",invalidate);
  notify(message);drawScreen();resize();invalidate();
  return {power,disk:eject,screen:wakeScreen,keyboard:focusKeyboard,back,screenBounds:()=>{
    const rect=host.getBoundingClientRect();const p=[[-.81,.535],[.81,.535],[.81,-.535],[-.81,-.535]].map(([x,y])=>screen.localToWorld(new THREE.Vector3(x,y,0)).project(camera));
    const xs=p.map(v=>rect.left+(v.x+1)*rect.width/2),ys=p.map(v=>rect.top+(1-v.y)*rect.height/2);
    return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  },resetMouse,key,playPause,dispose:()=>{
    disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",visibility);reduced.removeEventListener("change",invalidate);
    renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerleave",leave);renderer.domElement.removeEventListener("pointerup",release);renderer.domElement.removeEventListener("pointercancel",release);renderer.domElement.removeEventListener("lostpointercapture",release);host.removeEventListener("keydown",keydown);
    playRequest++;media.onended=null;media.onerror=null;media.pause();media.removeAttribute("src");media.load();
    host.removeEventListener("keyup",keyup);host.removeEventListener("blur",blur);
    scene.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});materials.forEach(mat=>mat.dispose());textures.forEach(tex=>tex.dispose());renderer.dispose();renderer.domElement.remove();
  }};
}
