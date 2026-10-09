import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {WORLD_ASSETS} from "./world-assets.mjs";

export const BILLBOARD={width:4.1,height:4.1/3,y:5.22,x:-.22,z:.46,texture:WORLD_ASSETS.billboard} as const;

/** A solid, chipped board. Only its forward cap gets the corresponding paint UVs. */
export function roadsidePlank(row:number,left:number,right:number){
  const step=BILLBOARD.height/6,half=step/2-.013;
  const points=[
    [left+.035,-half],[right-.10,-half],[right-.035,-half+.027],
    [right-.065,-.026],[right-.31,-.007],[right-.012,.012],
    [right,half-.028],[right-.075,half],[left+.015,half],
    [left,half-.048],[left+.08,.035],[left+.013,.014],
  ];
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1,steps:1});
  const positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)/BILLBOARD.width+.5,(positions.getY(i)+(row+.5)*step)/BILLBOARD.height);
  // Back, end grain, bevels and split surfaces are bare wood, never mirrored artwork.
  geometry.clearGroups();let start=0,last=-1;
  for(let i=0;i<positions.count;i+=3){
    const material=normals.getZ(i)>.99?0:1;
    if(material!==last){if(i)geometry.addGroup(start,i-start,last);start=i;last=material;}
  }
  geometry.addGroup(start,positions.count-start,last);geometry.translate(0,0,-.15);
  return geometry;
}

/** Painted roadside welcome board, carried by timber rails and bolted roof shoes. */
export function createTramShopSign(scene:THREE.Scene,materials:THREE.Material[]){
  let disposed=false,texture:THREE.Texture|undefined;
  const root=new THREE.Group();root.name="Roof / roadside welcome billboard";root.position.set(BILLBOARD.x,0,BILLBOARD.z);scene.add(root);
  const timber=new THREE.MeshStandardMaterial({color:0x70543b,roughness:.88});
  const plank=new THREE.MeshStandardMaterial({color:0x806347,roughness:.92});
  // Bare cut surfaces have directional grain as well as a matte timber response.
  plank.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBoardPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBoardPoint = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBoardPoint;').replace('#include <color_fragment>',`#include <color_fragment>
      float warp = sin(vBoardPoint.x * 3.7 + vBoardPoint.y * 13.0) * 0.7;
      float grain = sin(vBoardPoint.y * 240.0 + warp + sin(vBoardPoint.x * 9.0) * 0.25);
      float fineGrain = sin(vBoardPoint.y * 670.0 + warp * 2.0);
      diffuseColor.rgb *= 0.90 + grain * 0.075 + fineGrain * 0.028;
    `);
  };
  plank.customProgramCacheKey=()=> 'roadside-bare-timber-v1';
  const iron=new THREE.MeshStandardMaterial({color:0x30403c,metalness:.72,roughness:.4});
  const zinc=new THREE.MeshStandardMaterial({color:0xa5a497,metalness:.8,roughness:.32});
  const face=new THREE.MeshStandardMaterial({roughness:.96,metalness:0});
  const bulb=new THREE.MeshStandardMaterial({color:0xffe0a1,emissive:0xffd58c,emissiveIntensity:.12});
  const signLights:THREE.SpotLight[]=[];
  materials.push(timber,plank,iron,zinc,face,bulb);
  const box=(name:string,size:number[],at:number[],material:THREE.Material)=>{
    const mesh=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],1,.009),material);
    mesh.name=name;mesh.position.set(at[0],at[1],at[2]);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const beam=(name:string,a:number[],b:number[],width:number,depth:number,material:THREE.Material)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const mesh=box(name,[width,start.distanceTo(end),depth],start.clone().add(end).multiplyScalar(.5).toArray(),material);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return mesh;
  };
  const bottom=BILLBOARD.y-BILLBOARD.height/2,top=BILLBOARD.y+BILLBOARD.height/2;
  // Paint lives on the individual boards: there is no full rectangular image plane.
  const boards:THREE.Mesh[]=[];
  for(let row=0;row<6;row++){
    const left=-BILLBOARD.width/2+[.14,.02,.06,0,.1,.2][row],right=BILLBOARD.width/2-[.10,0,.04,.12,.035,.08][row];
    const spans=row===0?[[left,1.03],[1.075,right]]:[[left,right]];
    for(const [l,r] of spans){
      const board=new THREE.Mesh(roadsidePlank(row,l,r),[plank,plank]);board.name='Billboard / painted timber plank';
      board.position.set(0,bottom+(row+.5)*BILLBOARD.height/6,[.014,0,.024,-.009,.011,0][row]);
      board.rotation.z=[-.003,.002,-.002,0,.003,-.003][row];board.rotation.y=row%2?.005:-.004;
      if(row===0&&l>0){board.rotation.z=-.038;board.position.y+=.041;board.userData.brokenEnd=true;}
      board.castShadow=true;board.receiveShadow=true;root.add(board);boards.push(board);
      // Recessed dark nail heads move with each plank, including the cracked end.
      for(const x of [-1.65,1.65])if(x>l&&x<r){
        const nail=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.011,7),iron);
        nail.name='Billboard / plank nail';nail.rotation.x=Math.PI/2;nail.position.set(x,0,.012);board.add(nail);
      }
    }
  }
  for(const x of [-1.65,1.65]){
    beam('Billboard / timber upright',[x,4.29,-.24],[x,top-.08,-.24],.13,.14,timber);
    beam('Billboard / rear diagonal brace',[x,4.31,-.79],[x,5.09,-.24],.075,.075,iron);
    box('Billboard / bolted mounting foot',[.34,.055,.78],[x,4.3,-.46],iron);
    for(const z of [-.77,-.15]){
      const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.019,6),zinc);bolt.name='Billboard / roof bolt';bolt.position.set(x,4.339,z);root.add(bolt);
    }
  }
  for(const y of [bottom+.18,top-.18])box('Billboard / rear cross rail',[BILLBOARD.width-.28,.1,.1],[0,y,-.19],timber);
  // Ordinary shaded lamps, not luminous paint or a neon rim.
  for(const x of [-1.55,1.55]){
    const curve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(x,top-.16,-.2),new THREE.Vector3(x,top+.14,-.2),
      new THREE.Vector3(x,top+.19,.12),new THREE.Vector3(x,top+.06,.27),
    ]);
    const arm=new THREE.Mesh(new THREE.TubeGeometry(curve,14,.019,6,false),iron);arm.name='Billboard / attached lamp arm';root.add(arm);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(.13,.105,16,1,true),iron);shade.name='Billboard / lamp shade';shade.position.set(x,top+.015,.27);shade.rotation.x=.38;root.add(shade);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(.108,16),bulb);lens.name='Billboard / warm lamp lens';lens.position.set(x,top-.032,.25);lens.rotation.x=-Math.PI/2+.38;root.add(lens);
    const light=new THREE.SpotLight(0xffdcaa,0,3.1,Math.PI*.31,.72,2);
    light.name='Billboard / warm downlight';light.position.set(x,top-.04,.30);
    light.target.position.set(x*.72,BILLBOARD.y-.15,.015);
    light.castShadow=false;root.add(light,light.target);signLights.push(light);
  }
  root.updateMatrixWorld(true);root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
  // Keep physical timber visible if the artwork fails to load.
  const ready=new THREE.TextureLoader().loadAsync(BILLBOARD.texture).then(loaded=>{
    if(disposed){loaded.dispose();return;}
    texture=loaded;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    face.map=texture;face.needsUpdate=true;
    for(const board of boards)board.material=[face,plank];
  }).catch(()=>{/* Bare timber is the fallback, not a missing or floating face. */});
  return {root,ready,update:(night:number)=>{
    const amount=THREE.MathUtils.clamp(night,0,1);
    bulb.emissiveIntensity=.12+amount*.6;
    signLights.forEach(light=>{light.intensity=amount*1.3;});
  },dispose:()=>{disposed=true;texture?.dispose();}};
}
