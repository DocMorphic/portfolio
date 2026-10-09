import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {WORLD_ASSETS} from './world-assets.mjs';

/** An original career case board: layered paper, real pinheads and red thread.
 * Inspired by physical detective walls / Alan Wake's clustered case-board layout. */
export function createQuestBoard(scene:THREE.Scene,materials:THREE.Material[],textures:THREE.Texture[]){
  const root=new THREE.Group();root.name='Journey / investigation board';root.position.set(-4.82,.12,1.37);root.rotation.y=-.30;scene.add(root);
  const mat=(color:number,metalness=0,roughness=.7)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness});materials.push(m);return m;};
  const wood=mat(0x947558),edge=mat(0xc1a283),dark=mat(0x343e38,.45),steel=mat(0xb8b7a0,.72,.35),red=mat(0x9e2520),paper=mat(0xdcd2bd),tape=mat(0xcdbc87);
  tape.transparent=true;tape.opacity=.72;
  const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,m:THREE.Material,p:number[])=>{const o=new THREE.Mesh(g,m);o.name=`Case board / ${name}`;o.position.set(...p as [number,number,number]);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(parent:THREE.Object3D,name:string,s:number[],p:number[],m:THREE.Material,r=0)=>mesh(parent,name,r?new RoundedBoxGeometry(s[0],s[1],s[2],1,r):new THREE.BoxGeometry(s[0],s[1],s[2]),m,p);
  const rod=(name:string,a:number[],b:number[],r:number,m:THREE.Material)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),o=mesh(root,name,new THREE.CylinderGeometry(r,r,start.distanceTo(end),8),m,start.clone().add(end).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return o;};
  for(const x of [-.77,.77]){
    box(root,'wooden upright',[.09,2.94,.10],[x,1.49,-.11],wood,.014);
    box(root,'grounded foot',[.22,.08,.76],[x,.04,-.08],dark,.02);
    rod('rear leg brace',[x,.09,-.40],[x,1.38,-.11],.026,dark);
  }
  box(root,'backing',[2.10,1.95,.11],[0,2.08,-.01],wood,.025);
  const corkCanvas=document.createElement('canvas');corkCanvas.width=corkCanvas.height=512;const cc=corkCanvas.getContext('2d')!;
  cc.fillStyle='#97734c';cc.fillRect(0,0,512,512);let seed=971;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<15000;i++){cc.fillStyle=i%3===0?'#715337':i%3===1?'#b38c5d':'#9e7a50';cc.fillRect(random()*512,random()*512,1+random()*3,1+random()*3);}
  const corkTexture=new THREE.CanvasTexture(corkCanvas);corkTexture.colorSpace=THREE.SRGBColorSpace;corkTexture.anisotropy=8;textures.push(corkTexture);
  const cork=new THREE.MeshStandardMaterial({map:corkTexture,bumpMap:corkTexture,bumpScale:.009,roughness:1});materials.push(cork);
  box(root,'textured cork',[1.99,1.84,.035],[0,2.08,.06],cork);
  for(const x of [-1.04,1.04])box(root,'side frame',[.085,2.03,.16],[x,2.08,.045],edge,.012);
  for(const y of [1.09,3.07]){const rail=box(root,'cross frame',[.085,2.17,.16],[0,y,.045],edge,.008);rail.rotation.z=Math.PI/2;}
  for(const x of [-1.04,1.04])for(const y of [1.09,3.07]){
    const screw=mesh(root,'frame screw',new THREE.CylinderGeometry(.014,.014,.006,10),steel,[x,y,.13]);screw.rotation.x=Math.PI/2;
    const slot=box(root,'screwdriver slot',[.017,.003,.002],[x,y,.134],dark);slot.rotation.z=.3;
  }
  for(const x of [-.976,.976])box(root,'inner frame bevel',[.012,1.89,.025],[x,2.08,.137],wood,.003);
  box(root,'marker tray',[1.10,.055,.24],[.38,1.07,.12],wood,.009);
  rod('red marker',[.1,1.117,.14],[.48,1.128,.14],.024,red);
  rod('marker cap',[.49,1.128,.14],[.57,1.131,.14],.028,dark);

  const atlas=document.createElement('canvas');atlas.width=atlas.height=2048;const ctx=atlas.getContext('2d')!;
  type Note={x:number;y:number;w:number;h:number;tilt:number;bg:string;lines:string[];kind?:'header'|'subject'|'sticky'};
  const notes:Note[]=[
    {x:0,y:2.83,w:1.81,h:.25,tilt:.008,bg:'#263f3a',lines:['EXPERIENCE & EDUCATION'],kind:'header'},
    {x:-.60,y:2.37,w:.60,h:.44,tilt:-.09,bg:'#efe2c5',lines:['LYCEUM','GPU INFRA','AUG 2026 →']},
    {x:.08,y:2.30,w:.54,h:.50,tilt:.06,bg:'#e9ddc3',lines:['DHARMAY','DAVE','THE STORY SO FAR'],kind:'subject'},
    {x:.67,y:2.39,w:.44,h:.41,tilt:.12,bg:'#e6ce77',lines:['TUM','OCT 2026','NEXT STOP'],kind:'sticky'},
    {x:-.64,y:1.74,w:.48,h:.31,tilt:.075,bg:'#e6dcca',lines:['CLAR AI','VOICE AI']},
    {x:.01,y:1.47,w:.54,h:.30,tilt:-.06,bg:'#e9e5d6',lines:['SCAILE','GEO / AI']},
    {x:.65,y:1.69,w:.46,h:.39,tilt:-.12,bg:'#dbbc68',lines:['NEXT','CHAPTER?'],kind:'sticky'},
    {x:-.57,y:1.32,w:.62,h:.13,tilt:-.03,bg:'#e7d9b9',lines:['CONNECT THE DOTS']},
  ];
  let scannedMaterials:HTMLImageElement|undefined,disposed=false;
  const paintNotes=()=>notes.forEach((note,i)=>{
    const height=512*note.h/note.w;ctx.save();ctx.translate(i%4*512,Math.floor(i/4)*512);ctx.scale(1,512/height);ctx.fillStyle=note.bg;ctx.fillRect(0,0,512,height);
    if(scannedMaterials){const half=scannedMaterials.width/2;ctx.drawImage(scannedMaterials,note.kind==='sticky'?half:0,half,half,half,0,0,512,height);}
    ctx.textBaseline='middle';ctx.textAlign='center';
    const line=(x:number,y:number,x2:number,y2:number,color='#74766b',width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();};
    const text=(value:string,x:number,y:number,font:string,color='#2d332f')=>{ctx.font=font;ctx.fillStyle=color;ctx.fillText(value,x,y);};
    // Fine edge scuffs and a lightly creased fold survive even without the scan.
    for(let n=0;n<300;n++){ctx.fillStyle=`rgba(97,72,44,${.02+(n%4)*.015})`;ctx.fillRect((n*73)%512,(n*137)%height,1+n%3,1);}
    line(0,height*.54,512,height*.536,'rgba(130,99,65,.10)',2);line(0,height*.546,512,height*.542,'rgba(255,255,255,.35)',2);
    if(note.kind==='header'){
      line(16,8,496,8,'#8f4d3e',2);line(16,height-8,496,height-8,'#8f4d3e',2);
      text(note.lines[0],256,height/2,'bold 30px Georgia,serif');
    }else if(note.kind==='subject'){
      ctx.fillStyle='#ad543e';ctx.fillRect(0,0,512,51);text('PERSONAL FILE  /  01',256,27,'21px Georgia,serif','#fff0d3');
      text(note.lines[0],256,height*.29,'bold 58px Georgia,serif');text(note.lines[1],256,height*.46,'bold 77px Georgia,serif');
      line(35,height*.60,477,height*.60);text(note.lines[2],256,height*.67,'italic 23px Georgia,serif');
      ctx.textAlign='left';text('Student. Builder. Curious.',36,height*.79,'32px "Case Notes",cursive');
      ctx.strokeStyle='#a94a39';ctx.lineWidth=3;ctx.strokeRect(35,height*.88,178,34);text('IN PROGRESS',48,height*.92,'19px Georgia,serif','#9a4335');
    }else if(note.kind==='sticky'){
      for(let y=67;y<height-15;y+=44)line(16,y,496,y,'rgba(99,123,137,.21)');
      line(48,10,48,height-10,'rgba(172,70,53,.21)',2);
      if(i===3){text(note.lines[0],256,height*.26,'bold 100px "Case Notes",cursive','#294754');text(note.lines[1],256,height*.52,'57px "Case Notes",cursive');text(note.lines[2],256,height*.78,'44px "Case Notes",cursive','#954f37');}
      else{text(note.lines[0],256,height*.26,'77px "Case Notes",cursive');text(note.lines[1],256,height*.48,'bold 77px "Case Notes",cursive');text('still writing it...',260,height*.74,'37px "Case Notes",cursive','#8c4831');}
      line(118,height*.61,413,height*.59,'#9b4e37',3);
    }else if(i===1){
      text('FIELD NOTES  /  ENGINEERING',256,30,'19px Georgia,serif');line(26,51,486,51,'#363a32',3);
      text(note.lines[0],256,101,'bold 75px Georgia,serif');line(26,149,486,149,'#363a32',2);
      text(note.lines[1],256,179,'italic 32px Georgia,serif');
      ctx.textAlign='left';text('Serverless inference',29,224,'24px Georgia,serif');text('GPU VMs at scale',29,256,'24px Georgia,serif');
      text(note.lines[2],29,height-31,'bold 22px Georgia,serif','#a24c32');
      // A tiny marked-up server schematic in the clipping margin.
      for(let n=0;n<3;n++){ctx.strokeStyle='#73766c';ctx.lineWidth=2;ctx.strokeRect(354,214+n*29,121,21);for(let k=0;k<4;k++){ctx.fillStyle='#9a5e3d';ctx.fillRect(367+k*14,221+n*29,5,5);}}
    }else if(i===4){
      ctx.fillStyle='rgba(111,148,156,.16)';ctx.fillRect(0,0,512,height);
      text('RESEARCH LOG  /  02',256,24,'18px Georgia,serif');text(note.lines[0],256,82,'bold 64px Georgia,serif');text(note.lines[1],256,135,'italic 30px Georgia,serif');
      ctx.beginPath();ctx.strokeStyle='#427179';ctx.lineWidth=3;
      for(let x=35;x<478;x++){const y=height*.72+Math.sin(x*.22)*Math.sin(x*.041)*22;if(x===35)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
      text('accuracy / latency',256,height-25,'29px "Case Notes",cursive');
    }else if(i===5){
      text('ENGINEERING MEMO',256,26,'18px Georgia,serif');line(25,45,487,45);
      text(note.lines[0],256,99,'bold 69px Georgia,serif');text(note.lines[1],256,158,'italic 31px Georgia,serif');
      ctx.fillStyle='rgba(208,171,57,.28)';ctx.fillRect(47,height-74,418,36);text('make the output human',256,height-53,'36px "Case Notes",cursive');
    }else{
      text(note.lines[0],256,height*.52,'bold 43px "Case Notes",cursive','#874332');
    }
    ctx.restore();
  });
  paintNotes();
  const printTexture=new THREE.CanvasTexture(atlas);printTexture.colorSpace=THREE.SRGBColorSpace;printTexture.anisotropy=8;textures.push(printTexture);
  const print=new THREE.MeshStandardMaterial({map:printTexture,emissiveMap:printTexture,emissive:0xffffff,emissiveIntensity:.13,roughness:.93,side:THREE.DoubleSide});materials.push(print);
  const pins:THREE.Vector3[]=[];
  const pin=(position:THREE.Vector3)=>{
    rod('pin shaft',[position.x,position.y,.082],[position.x,position.y,position.z],.005,steel);
    const collar=mesh(root,'pushpin collar',new THREE.CylinderGeometry(.015,.021,.018,10),red,[position.x,position.y,position.z-.012]);collar.rotation.x=Math.PI/2;
    const cap=mesh(root,'red pushpin',new THREE.SphereGeometry(.020,12,8),red,position.toArray());cap.scale.z=.65;
  };
  notes.forEach((note,i)=>{
    const group=new THREE.Group();group.name=`Case board / ${note.lines.join(' ')}`;group.position.set(note.x,note.y,.094+(i%2)*.008);group.rotation.z=note.tilt;root.add(group);
    const g=new THREE.PlaneGeometry(note.w,note.h,12,12),uv=g.attributes.uv,positions=g.attributes.position;
    for(let j=0;j<uv.count;j++){
      const u=uv.getX(j),v=uv.getY(j);uv.setXY(j,(i%4+(1+u*510)/512)/4,1-(Math.floor(i/4)+(1+(1-v)*510)/512)/4);
      if(note.kind!=='header'){
        if(u===0||u===1)positions.setX(j,positions.getX(j)+Math.sin(j*13+i)*.0025);
        if(v===0||v===1)positions.setY(j,positions.getY(j)+Math.sin(j*7+i)*.002);
        positions.setZ(j,.002+Math.pow(1-v,3)*(.007+Math.pow(Math.abs(u-.5)*2,5)*.024)+Math.sin(u*5+i)*.003);
      }
    }g.computeVertexNormals();mesh(group,'printed clue',g,print,[0,0,.005]);
    mesh(group,'paper thickness',g.clone(),paper,[0,0,.003]);
    if(i===1||i===4||i===5){const under=mesh(group,'overlapping document',g.clone(),paper,[.015,-.013,-.004]);under.rotation.z=.028;}
    const p=new THREE.Vector3(0,note.h/2-.027,.068).applyEuler(group.rotation).add(group.position);pins.push(p);
    if(i===0||i===7){for(const x of [-note.w*.32,note.w*.32]){const strip=box(group,'masking tape',[.19,.059,.007],[x,note.h/2-.004,.014],tape);strip.rotation.z=x<0?-.15:.10;}}
    else pin(p);
  });
  const clip=new THREE.Group();clip.position.set(.24,2.52,.15);clip.rotation.z=-.12;root.add(clip);
  box(clip,'binder clip',[.088,.048,.029],[0,0,0],dark,.007);
  for(const z of [-.008,.018]){const handle=mesh(clip,'clip wire handle',new THREE.TorusGeometry(.025,.0025,5,16,Math.PI*1.7),steel,[0,.039,z]);handle.scale.x=.72;}

  // A real local travel photo, inset in its own Polaroid with a physical tack.
  const photograph=mat(0xffffff,0,.46);
  const photo=new THREE.Group();photo.name='Case board / pinned field photograph';photo.position.set(.07,1.87,.125);photo.rotation.z=-.10;root.add(photo);
  box(photo,'photo border',[.48,.32,.012],[0,0,0],paper);
  mesh(photo,'field photograph',new THREE.PlaneGeometry(.431,.244),photograph,[0,.017,.007]);
  const photoPin=new THREE.Vector3(0,.139,.056).applyEuler(photo.rotation).add(photo.position);pin(photoPin);
  // Each string terminates at a pin. Sag and depth keep it physical, not a line
  // painted over the board; connections follow the outer margins of each clue.
  const connect=(a:THREE.Vector3,b:THREE.Vector3,bend=0)=>{
    const mid=a.clone().lerp(b,.5);mid.x+=bend;mid.y-=.035;mid.z=Math.max(.14,(a.z+b.z)/2-.025);
    const curve=new THREE.CatmullRomCurve3([a,mid,b]);
    mesh(root,'red connecting thread',new THREE.TubeGeometry(curve,16,.004,5,false),red,[0,0,0]);
    for(const p of [a,b])mesh(root,'thread loop on pin',new THREE.TorusGeometry(.014,.004,5,12),red,[p.x,p.y,p.z-.01]);
  };
  connect(pins[1],pins[2],-.01);connect(pins[2],pins[3],.01);
  connect(pins[1],pins[4],-.13);connect(pins[4],pins[5],-.03);
  connect(pins[5],pins[6],.03);connect(pins[3],pins[6],.13);connect(photoPin,pins[2],.36);
  // Two actual red marker circles on cork, visually distinct from the thread.
  const circle=(x:number,y:number,rx:number,ry:number)=>{
    const points=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2;return new THREE.Vector3(x+Math.cos(a)*rx,y+Math.sin(a)*ry,.086);});
    mesh(root,'marker annotation',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.0025,4,false),red,[0,0,0]);
  };
  circle(-.61,2.40,.34,.27);circle(.64,1.66,.28,.24);
  const loadPhoto=typeof document.createElementNS!=='function'?Promise.resolve():new Promise<void>(resolve=>{
    new THREE.TextureLoader().load('/photos/germany/germany-3.jpg',texture=>{
      if(disposed){texture.dispose();resolve();return;}
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;textures.push(texture);photograph.map=texture;photograph.needsUpdate=true;resolve();
    },undefined,()=>resolve());
  });
  const loadSurfaces=typeof Image==='undefined'?Promise.resolve():new Promise<void>(resolve=>{
    const image=new Image();image.onload=()=>{
      if(disposed){resolve();return;}scannedMaterials=image;const half=image.width/2;
      cc.drawImage(image,0,0,half,half,0,0,512,512);corkTexture.needsUpdate=true;
      const grain=document.createElement('canvas');grain.width=grain.height=512;grain.getContext('2d')!.drawImage(image,half,0,half,half,0,0,512,512);
      const grainTexture=new THREE.CanvasTexture(grain);grainTexture.colorSpace=THREE.SRGBColorSpace;grainTexture.anisotropy=8;textures.push(grainTexture);
      for(const material of [wood,edge]){material.map=grainTexture;material.bumpMap=grainTexture;material.bumpScale=.006;material.needsUpdate=true;}
      paintNotes();printTexture.needsUpdate=true;resolve();
    };image.onerror=()=>resolve();image.src=WORLD_ASSETS.boardMaterials;
  });
  const loadHandwriting=typeof FontFace==='undefined'?Promise.resolve():new FontFace('Case Notes','url(/fonts/Caveat.ttf)',{weight:'400 700'}).load().then(font=>{
    if(!disposed){document.fonts.add(font);paintNotes();printTexture.needsUpdate=true;}
  }).catch(()=>{});
  return {root,ready:Promise.all([loadPhoto,loadSurfaces,loadHandwriting]),dispose:()=>{disposed=true;}};
}
