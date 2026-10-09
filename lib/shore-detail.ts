import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
import {shorelineRadius,DEFAULT_SHORELINE} from "./lake-shoreline.mjs";
import {WORLD_ASSETS} from "./world-assets.mjs";

export const SHORE_DETAIL_IMAGE=WORLD_ASSETS.shoreForest;

/** Small curved forest stands, baked into one draw. No camera-facing sprites. */
export function shoreDetailGeometry(profile=DEFAULT_SHORELINE){
  const parts:THREE.BufferGeometry[]=[];
  let state=(profile.seed^0x51f15e)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  // Walk in metres so a close bank doesn't squeeze a whole forest into a sliver.
  for(let angle=0;angle<Math.PI*2;){
    const radius=shorelineRadius(angle,profile),width=29+random()*12;
    const height=9+random()*3,depth=1+random()*3,flip=random()>.5;
    const crop=.7+random()*.3,start=random()*(1-crop),tint=.94+random()*.12;
    const span=width/radius;
    if(radius<150){
      const geometry=new THREE.PlaneGeometry(1,1,18,4),p=geometry.attributes.position,uv=geometry.attributes.uv;
      const colors:number[]=[],edges:number[]=[];
      for(let i=0;i<p.count;i++){
        const u=uv.getX(i),v=uv.getY(i),a=angle+(u-.5)*span;
        const r=shorelineRadius(a,profile)+depth+v*v*1.6;
        p.setXYZ(i,Math.cos(a)*r,-3+v*(height+3),Math.sin(a)*r);
        uv.setXY(i,start+(flip?1-u:u)*crop,Math.max(.018,(-2.5+v*(height+3))/(height+.5)));
        colors.push(tint,tint,tint);
        edges.push(THREE.MathUtils.smoothstep(u,0,.09)*(1-THREE.MathUtils.smoothstep(u,.91,1)));
      }
      geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
      geometry.setAttribute("edgeFade",new THREE.Float32BufferAttribute(edges,1));
      geometry.computeVertexNormals();parts.push(geometry);
    }
    angle+=span*.83;
  }
  const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());
  geometry.computeBoundingSphere();return geometry;
}

export function createShoreDetail(scene:THREE.Scene,night:{value:number},profile=DEFAULT_SHORELINE,anisotropy=8){
  let disposed=false;
  const texture=new THREE.Texture();texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=anisotropy;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,vertexColors:true,uniforms:{forest:{value:texture},night},
    vertexShader:`attribute float edgeFade;varying float standOpacity;varying vec2 forestUV;varying vec3 worldPoint;varying vec3 tint;
      void main(){forestUV=uv;tint=color;standOpacity=edgeFade;worldPoint=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D forest;uniform float night;varying float standOpacity;varying vec2 forestUV;varying vec3 worldPoint;varying vec3 tint;
      void main(){
        vec4 texel=texture2D(forest,forestUV);
        if(texel.a<.06)discard;
        float distanceToBank=length(worldPoint.xz);
        float fade=1.-smoothstep(110.,150.,distanceToBank);
        // A little shoreline mist, but keep nearby needles and bark resolved.
        float haze=clamp(1.-exp(-max(0.,distance(cameraPosition,worldPoint)-18.)*.0027)+.07*exp(-max(0.,worldPoint.y)*.2),.08,.46);
        vec3 day=mix(texel.rgb*tint,vec3(.52,.62,.67),haze);
        vec3 dark=mix(texel.rgb*tint*vec3(.12,.18,.3)+vec3(.002,.005,.012),vec3(.019,.029,.045),haze);
        gl_FragColor=vec4(mix(day,dark,night),texel.a*fade*standOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new THREE.Mesh(shoreDetailGeometry(profile),material);mesh.name="Landscape / detailed near-bank forest";mesh.renderOrder=-9;mesh.visible=false;scene.add(mesh);
  const ready=typeof document==="undefined"?Promise.resolve():new Promise<void>(resolve=>{
    new THREE.ImageLoader().load(SHORE_DETAIL_IMAGE,image=>{if(!disposed){texture.image=image;texture.needsUpdate=true;mesh.visible=true;}resolve();},undefined,()=>resolve());
  });
  return {mesh,ready,dispose:()=>{disposed=true;mesh.geometry.dispose();material.dispose();texture.dispose();}};
}
