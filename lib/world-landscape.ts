import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { shorelineRadius, DEFAULT_SHORELINE } from "./lake-shoreline.mjs";
import {createShoreDetail} from "./shore-detail";
import {WORLD_ASSETS} from "./world-assets.mjs";

export const TERRAIN_RADII=[76,105,137];
const TERRAIN_WIDTH=25;
const mountainAngleDistance=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function mountainHeight(a:number,fraction:number){
  // Separate alpine massifs, with a low saddle between them: not a cone ring.
  const peak=(angle:number,width:number,height:number)=>height*Math.exp(-Math.pow(mountainAngleDistance(a,angle)/width,2));
  // Keep a valley in the default camera's sightline, with the tallest massif
  // off to the east, so the mountains frame the sky instead of filling it.
  const silhouette=6+peak(.1,.28,42)+peak(-.35,.15,23)+peak(-1.18,.12,20)+peak(-1.55,.2,30)+peak(1.5,.4,29)+peak(2.7,.25,22);
  const profile=Math.pow(Math.max(0,Math.sin(fraction*Math.PI)),1.55);
  const warp=a+Math.sin(fraction*8+a*7)*.022;
  const folds=.7+.18*Math.abs(Math.sin(warp*31+fraction*5))+.08*Math.abs(Math.sin(warp*73-fraction*13))+.04*Math.sin(warp*157+fraction*25);
  return -.59+profile*silhouette*folds;
}

/** A single baked alpine mesh: ridgelines, rock strata, scree and snow gullies.
 * No texture downloads or per-frame terrain work. */
export function mountainGeometry(){
  const segments=512,rows=32,positions:number[]=[],indices:number[]=[],colors:number[]=[];
  for(let row=0;row<=rows;row++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,f=row/rows,r=167+f*54;
    positions.push(Math.cos(a)*r,mountainHeight(a,f),Math.sin(a)*r);
  }
  for(let row=0;row<rows;row++)for(let i=0;i<segments;i++){
    const a=row*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const p=geometry.attributes.position,n=geometry.attributes.normal,sun=new THREE.Vector3(-.65,.7,.4).normalize();
  for(let i=0;i<p.count;i++){
    const h=p.getY(i),x=p.getX(i),z=p.getZ(i),normal=new THREE.Vector3().fromBufferAttribute(n,i),slope=1-normal.y;
    const strata=Math.sin(h*2.5+x*.15+z*.17)*.035+Math.sin(x*2.1-z*.8)*.018;
    const color=new THREE.Color(0x66756d).lerp(new THREE.Color(0x98928b),THREE.MathUtils.smoothstep(h+slope*14,3,20));
    color.multiplyScalar(.7+Math.max(0,normal.dot(sun))*.48+strata);
    const snowLine=23+Math.sin(x*.22+z*.14)*2+Math.sin(x*.65-z*.3)*1.2;
    const snow=THREE.MathUtils.smoothstep(h,snowLine,snowLine+5)*THREE.MathUtils.smoothstep(normal.y,.22,.8);
    color.lerp(new THREE.Color(0xe9e9df).multiplyScalar(.82+Math.max(0,normal.dot(sun))*.22),snow);
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));return geometry;
}
export function terrainHeight(layer:number,a:number,fraction:number){
  const row=THREE.MathUtils.clamp(fraction,0,1)*12;
  const ridge=3.5+Math.pow(.5+.5*Math.sin(a*5+layer*1.3),2)*4+Math.pow(.5+.5*Math.sin(a*11+layer),3)*2.5+Math.sin(a*23)*.3;
  const gullies=.83+.12*Math.sin(a*37+row*.32)+.05*Math.sin(a*73-row*.5);
  return -.58+Math.pow(Math.max(0,Math.sin(fraction*Math.PI)),1.3)*ridge*gullies*(1+layer*.08);
}

/** Continuous ring terrain: all azimuths have a horizon, including the reflection.
 * Geometry and vertex colours are baked once, not recomputed in the frame loop. */
export function terrainGeometry(layer:number) {
  const segments=256,rows=12,positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const near=[0x647c76,0x84949a,0xa5adb4][layer],base=new THREE.Color(near),sun=new THREE.Vector3(-.5,.7,.5).normalize();
  const radius=TERRAIN_RADII[layer];
  for(let row=0;row<=rows;row++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,r=radius+row/rows*TERRAIN_WIDTH;
    const h=terrainHeight(layer,a,row/rows);
    positions.push(Math.cos(a)*r,h,Math.sin(a)*r);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<segments;i++){
    const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const normal=geometry.attributes.normal;
  for(let i=0;i<normal.count;i++){
    const n=new THREE.Vector3().fromBufferAttribute(normal,i),lit=.65+Math.max(0,n.dot(sun))*.48;
    const h=positions[i*3+1],x=positions[i*3],z=positions[i*3+2];
    const patch=.5+.3*Math.sin(x*.29+z*.37)+.2*Math.sin(x*.81-z*.47);
    const c=base.clone().lerp(new THREE.Color(0x526c48),patch*.3);
    c.lerp(new THREE.Color(0x929081),THREE.MathUtils.smoothstep(1-n.y,.18,.55)*.6);
    c.lerp(new THREE.Color(0x898a75),1-THREE.MathUtils.smoothstep(h,-.4,1.1));c.multiplyScalar(lit);
    if(layer>0&&h>7.3)c.lerp(new THREE.Color(0xd7dad3),THREE.MathUtils.smoothstep(h,7.3,10)*.48);
    colors.push(c.r,c.g,c.b);
  }
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));return geometry;
}

export function treeGeometry(kind:number){
  const parts:THREE.BufferGeometry[]=[];
  const part=(g:THREE.BufferGeometry,color:number,p:number[],s=[1,1,1],rotation=0)=>{
    g.computeVertexNormals();const geo=g.index?g.toNonIndexed():g;geo.scale(...s as [number,number,number]);geo.rotateY(rotation);geo.translate(...p as [number,number,number]);
    const c=new THREE.Color(color),colors:number[]=[],normals=geo.attributes.normal;
    for(let i=0;i<geo.attributes.position.count;i++){const shade=.7+Math.max(0,normals.getY(i)*.65-normals.getX(i)*.3+normals.getZ(i)*.2)*.38;colors.push(c.r*shade,c.g*shade,c.b*shade);}
    geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));parts.push(geo);if(g!==geo)g.dispose();
  };
  part(new THREE.CylinderGeometry(.045,.085,1.4,6),kind===1?0xbabdb0:0x645d48,[0,.7,0]);
  const branch=(from:THREE.Vector3,to:THREE.Vector3,r:number)=>{
    const g=new THREE.CylinderGeometry(r*.4,r,from.distanceTo(to),5);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));
    part(g,kind===1?0xc4c5ad:0x62543e,from.clone().add(to).multiplyScalar(.5).toArray());
  };
  const crown=(p:number[],s:number[],color:number,seed:number)=>{
    const g=new THREE.SphereGeometry(1,8,4),positions=g.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const r=1+.12*Math.sin(x*17+y*13+seed)*Math.sin(z*19-y*11)+.05*Math.cos(x*37+z*31);
      positions.setXYZ(i,x*r,y*r,z*r);
    }
    part(g,color,p,s,seed);
  };
  if(kind===0){
    // Needled branch fans with gaps, rather than stacked solid cones.
    for(let tier=0;tier<4;tier++)for(let b=0;b<5;b++){
      const a=b*Math.PI*2/5+tier*.8,r=.48-tier*.09,y=.9+tier*.43;
      const tip=new THREE.Vector3(Math.cos(a)*r,y+.09,Math.sin(a)*r);
      branch(new THREE.Vector3(0,y-.1,0),tip,.027);
      crown(tip.toArray(),[.3-tier*.035,.2,.31-tier*.035],b%2?0x3c614e:0x284b40,a+tier);
    }
    crown([0,2.65,0],[.16,.35,.17],0x456e54,2);
  }else if(kind===1){
    for(let i=0;i<9;i++){
      const p=new THREE.Vector3(Math.sin(i*2.4)*.38,1.3+i*.13,Math.cos(i*2.4)*.32);
      branch(new THREE.Vector3(0,.65+i*.09,0),p,.022);
      crown(p.toArray(),[.3,.49,.3],i%2?0x86a260:0x577b4c,i);
    }
    for(let i=0;i<5;i++)part(new THREE.CylinderGeometry(.055,.055,.025,6),0x687567,[0,.3+i*.19,0]);
  }else{
    for(let i=0;i<11;i++){
      const p=new THREE.Vector3(Math.sin(i*2.4)*.53,1.3+(i%4)*.19,Math.cos(i*2.4)*.5);
      branch(new THREE.Vector3(0,.65,0),p,.04);
      crown(p.toArray(),[.36,.33,.39],i%2?0x628745:0x3c6541,i);
    }
  }
  const result=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());return result;
}

function mistMaterial(density=.0045,night={value:0}){
  // Keep the distance/height haze independent from foreground scene fog.
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.mist={value:new THREE.Color(0xc3ced0)};
    shader.uniforms.night=night;
    shader.uniforms.mistDensity={value:density};
    shader.vertexShader="varying float mistDistance;varying float mistHeight;varying vec3 mistPosition;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
      mistDistance=length(mvPosition.xyz);vec4 landscapePoint=vec4(transformed,1.);
      #ifdef USE_INSTANCING
      landscapePoint=instanceMatrix*landscapePoint;
      #endif
      mistPosition=(modelMatrix*landscapePoint).xyz;mistHeight=mistPosition.y;`);
    shader.fragmentShader="uniform float night;uniform vec3 mist;uniform float mistDensity;varying float mistDistance;varying float mistHeight;varying vec3 mistPosition;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <tonemapping_fragment>",`float grain=fract(sin(dot(floor(mistPosition*5.),vec3(12.9898,78.233,39.425)))*43758.5453);
      float detail=1.-smoothstep(.3,1.8,length(fwidth(mistPosition)));gl_FragColor.rgb*=1.+(grain-.5)*.32*detail;
      float haze=1.-exp(-pow(max(0.,mistDistance-24.)*mistDensity,1.35));haze=clamp(haze+exp(-max(0.,mistHeight)*.27)*.08,0.,.91);gl_FragColor.rgb=mix(gl_FragColor.rgb,mist,haze);
      gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*vec3(.065,.10,.18),night);
      #include <tonemapping_fragment>`);
  };
  material.customProgramCacheKey=()=>"landscape-height-mist-v4";return material;
}

export const LANDSCAPE_IMAGES=[WORLD_ASSETS.panorama,WORLD_ASSETS.valley,WORLD_ASSETS.escarpment];
export const SHORE_PHOTO_HEIGHT=64;
export const SHORE_RELIEF_ROWS=24;
export function shoreRelief(height:number,angle:number,radius:number){
  // Waterline stays fixed; upper slopes recede into the landscape, creating
  // real translation parallax without a full mountain/forest simulation.
  const retreat=THREE.MathUtils.smoothstep(height,0,64)*26*(.85+.1*Math.sin(angle*3)+.05*Math.cos(angle*7));
  return Math.min(226-radius,retreat);
}
export function shorelineGeometry(profile=DEFAULT_SHORELINE){
  // Keep a fixed physical height. Scaling the photograph down with radius
  // cancels perspective and makes the close shore read as miniature scenery.
  const segments=256,geometry=new THREE.CylinderGeometry(155,155,SHORE_PHOTO_HEIGHT+16,segments,SHORE_RELIEF_ROWS,true);
  geometry.rotateY(.47);
  const positions=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),angle=Math.atan2(z,x);
    const bank=shorelineRadius(angle,profile),height=positions.getY(i)+(SHORE_PHOTO_HEIGHT-16)/2;
    const radius=bank+shoreRelief(height,angle,bank);
    positions.setXYZ(i,Math.cos(angle)*radius,positions.getY(i),Math.sin(angle)*radius);
  }
  // Texture density follows metres along the irregular bank, not degrees
  // around the camera. Near sectors occupy fewer source pixels, so their
  // trees get wider as well as taller instead of becoming thin stretched pines.
  const lengths=[0];
  const base=SHORE_RELIEF_ROWS*(segments+1);
  for(let i=1;i<=segments;i++)lengths.push(lengths[i-1]+Math.hypot(positions.getX(base+i)-positions.getX(base+i-1),positions.getZ(base+i)-positions.getZ(base+i-1)));
  for(let row=0;row<=SHORE_RELIEF_ROWS;row++)for(let i=0;i<=segments;i++)uv.setX(row*(segments+1)+i,lengths[i]/lengths[segments]);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
export function createWorldLandscape(scene:THREE.Scene,profile=DEFAULT_SHORELINE,anisotropy=8) {
  const night={value:0},textures=LANDSCAPE_IMAGES.map(()=>new THREE.Texture());let disposed=false;
  for(const texture of textures){texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.ClampToEdgeWrapping;texture.anisotropy=anisotropy;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;}
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,uniforms:{panorama:{value:textures[0]},valley:{value:textures[1]},escarpment:{value:textures[2]},night,distant:{value:0}},
    vertexShader:`varying vec2 landscapeUV;varying vec3 landscapePosition;void main(){landscapeUV=uv;landscapePosition=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D panorama;uniform sampler2D valley;uniform sampler2D escarpment;uniform float night;uniform float distant;varying vec2 landscapeUV;varying vec3 landscapePosition;
      vec4 vistaSample(sampler2D image,vec2 uv){
        vec4 t=texture2D(image,uv);
        // Repair tiny enclosed alpha pinholes without growing the outer ridge
        // silhouette. Otherwise bright sky shines through individual rock pixels.
        if(t.a<.7){
          vec2 stepUV=vec2(2./2172.,2./724.);
          vec4 l=texture2D(image,uv-vec2(stepUV.x,0.)),r=texture2D(image,uv+vec2(stepUV.x,0.));
          vec4 b=texture2D(image,uv-vec2(0.,stepUV.y)),a=texture2D(image,uv+vec2(0.,stepUV.y));
          if(min(min(l.a,r.a),min(b.a,a.a))>.85)t=vec4((l.rgb+r.rgb+b.rgb+a.rgb)*.25,1.);
        }
        return t;
      }
      float sectorDistance(float u,float center){return mod(u-center+.5,1.)-.5;}
      float sectorWeight(float distance){return 1.-smoothstep(.153,.18,abs(distance));}
      vec2 vistaUV(float offset){
        float x=clamp(offset/.36+.5,0.,1.);
        // Only lower the upper ridges at joins. Compressing the whole image
        // also miniaturizes the waterline trees, undoing their perspective.
        float rise=mix(mix(.13,.72,distant),1.,smoothstep(.04,.28,min(x,1.-x)));
        float height=max(0.,landscapePosition.y+.5);
        float aboveForest=max(0.,height-10.);
        float upperRelief=aboveForest*aboveForest/(aboveForest+8.);
        float y=max(.012,(height+upperRelief*(1./rise-1.))/mix(${SHORE_PHOTO_HEIGHT.toFixed(1)},76.,distant));
        return vec2(x,clamp(y,.012,1.));
      }
      void main(){
        float u=fract(landscapeUV.x+.07);
        float a=sectorDistance(u,1./6.),b=sectorDistance(u,.5),c=sectorDistance(u,5./6.);
        float wa=sectorWeight(a),wb=sectorWeight(b),wc=sectorWeight(c),sum=wa+wb+wc;
        vec4 pa=vec4(0.),pb=vec4(0.),pc=vec4(0.);
        if(wa>0.)pa=vistaSample(panorama,vistaUV(a));
        if(wb>0.)pb=vistaSample(valley,vistaUV(b));
        if(wc>0.)pc=vistaSample(escarpment,vistaUV(c));
        float alpha=(pa.a*wa+pb.a*wb+pc.a*wc)/sum;
        vec3 rgb=(pa.rgb*pa.a*wa+pb.rgb*pb.a*wb+pc.rgb*pc.a*wc)/max(.001,alpha*sum);
        vec4 texel=vec4(rgb,alpha);
        if(texel.a<.04)discard;
        // Reject the cutout's tiny saturated blue edge fringe, not natural rock.
        if(texel.b>max(texel.r,texel.g)*2.2)discard;
        float distanceFog=1.-exp(-max(0.,distance(cameraPosition,landscapePosition)-35.)*.0028);
        float shoreMist=.14*exp(-max(0.,landscapePosition.y)*.055);
        float haze=mix(clamp(distanceFog+shoreMist,.06,.54),.68+shoreMist*.4,distant);
        vec3 day=mix(texel.rgb,vec3(.52,.62,.67),haze);
        vec3 moonlit=texel.rgb*vec3(.12,.18,.3)+vec3(.002,.005,.012);
        moonlit=mix(moonlit,vec3(.019,.029,.045),haze);
        gl_FragColor=vec4(mix(day,moonlit,night),texel.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  // Three different vistas, each shown once. Feather only the narrow joins;
  // never mirror or tile a mountain silhouette around the lake.
  // Continue the backdrop below the reflection plane, so neither clip bias nor
  // wave sampling can reveal a bright sky slit at the waterline.
  const mountains=new THREE.Mesh(shorelineGeometry(profile),material);
  mountains.renderOrder=-10; // Distant transparent joins must render before foreground light particles.
  mountains.position.y=(SHORE_PHOTO_HEIGHT-16)/2-.5;mountains.name="Landscape / irregular alpine shoreline";scene.add(mountains);
  // A separate, farther range is visible through the low foreground saddles.
  // Offset its peaks from the front range's starting vista. Reuse the
  // loaded photographs, but compress their relief and soften distant contrast.
  // 232 is beyond every shoreline point (max 224), inside the sky dome (250).
  const distantMaterial=material.clone();
  distantMaterial.uniforms={...material.uniforms,distant:{value:1}};
  const distantMountains=new THREE.Mesh(new THREE.CylinderGeometry(232,232,90,256,1,true),distantMaterial);
  distantMountains.position.y=33;
  distantMountains.rotation.y=.47+Math.PI/3;
  distantMountains.renderOrder=-11;
  distantMountains.name="Landscape / distant valley backdrop";
  scene.add(distantMountains);
  const forest=createShoreDetail(scene,night,profile,anisotropy);
  const photosReady=typeof document==="undefined"?Promise.resolve():Promise.all(LANDSCAPE_IMAGES.map((path,index)=>new Promise<void>(resolve=>{
    new THREE.ImageLoader().load(path,image=>{
      if(!disposed){textures[index].image=image;textures[index].needsUpdate=true;}resolve();
    },undefined,()=>{
      if(!disposed&&!fallbackMesh){mountains.visible=false;const fallback=new THREE.Mesh(mountainGeometry(),mistMaterial(.0026,night));fallback.name="Landscape / offline fallback";scene.add(fallback);fallback.updateMatrixWorld();fallbackMesh=fallback;}resolve();
    });
  }))).then(()=>{});
  let fallbackMesh:THREE.Mesh<THREE.BufferGeometry,THREE.Material>|undefined;
  const ready=Promise.all([photosReady,forest.ready]).then(()=>{});
  return {mountains,distantMountains,forest:forest.mesh,ready,setNight:(amount:number)=>{night.value=amount;},dispose:()=>{disposed=true;forest.dispose();mountains.geometry.dispose();material.dispose();distantMountains.geometry.dispose();distantMaterial.dispose();textures.forEach(t=>t.dispose());fallbackMesh?.geometry.dispose();fallbackMesh?.material.dispose();}};
}
