import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { createWaterRipples } from "./water-ripples";
import { WaterInteraction, RIPPLE_DOMAIN, RIPPLE_RESOLUTION } from "./water-interaction";
import { shorelineShader, DEFAULT_SHORELINE } from "./lake-shoreline.mjs";
import { WaterReflectionBudget } from "./water-reflection-budget";

/** One small planar reflection target, shared by the entire water surface. */
export function createWorldWater(scene:THREE.Scene,screen:THREE.Mesh,screenMaterial:THREE.Material|THREE.Material[],renderer:THREE.WebGLRenderer,otherScreens:{screen:THREE.Mesh;material:THREE.Material|THREE.Material[]}[]=[],shoreline=DEFAULT_SHORELINE){
  const ripples=createWaterRipples(renderer),interaction=new WaterInteraction();
  // LRO surface photography, loaded only with this world (not the desktop).
  const moonMap=new THREE.TextureLoader().load("/assets/moon-lroc-2k.jpg");
  moonMap.colorSpace=THREE.SRGBColorSpace;
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{
    zenith:{value:new THREE.Color(0x7496ba)},horizon:{value:new THREE.Color(0xead4bb)},sun:{value:new THREE.Vector3(-.6,.38,.6).normalize()},time:{value:0},night:{value:0},moonMap:{value:moonMap},
  },vertexShader:`varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 direction;uniform vec3 zenith;uniform vec3 horizon;uniform vec3 sun;uniform float time;uniform float night;uniform sampler2D moonMap;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    float cloud(vec2 p){float n=0.,a=.53;for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.07+17.3;a*=.49;}return n;}
    vec3 stars(vec2 uv,float cells){vec2 p=uv*vec2(cells,cells*.5),cell=floor(p),f=fract(p);float seed=hash(cell),enabled=step(.965,seed);vec2 center=vec2(hash(cell+17.),hash(cell+43.))*.7+.15;float dist=length(f-center),radius=.025+.07*pow(hash(cell+71.),9.);float star=exp(-dist*dist/(radius*radius))*enabled;vec3 tint=mix(vec3(.55,.72,1.),vec3(1.,.82,.57),hash(cell+19.));return tint*star*(.6+pow(seed,30.)*1.2);}
    void main(){vec3 d=normalize(direction);float h=pow(max(d.y,0.),.6);vec3 c=mix(horizon,zenith,clamp(h*1.5,0.,1.));
      float glow=pow(max(dot(d,sun),0.),100.);c+=vec3(.4,.23,.10)*glow;
      // At full night the daytime cloud result is replaced completely below.
      // Skip that expensive FBM pass instead of shading it twice per pixel.
      if(d.y>.015&&night<.999){
        vec2 p=d.xz/(d.y+.16)*2.1+vec2(time*.006,time*.0015);
        float density=cloud(p),body=smoothstep(.43,.69,density);
        float lit=clamp((density-cloud(p+vec2(-.12,.09)))*7.+.56,0.,1.);
        vec3 shade=mix(vec3(.48,.57,.67),vec3(1.,.96,.87),lit);
        float haze=smoothstep(.018,.19,d.y);
        c=mix(c,shade,body*haze*.94);
        float wisps=smoothstep(.61,.79,cloud(p*.72+vec2(31.,time*.002)));
        c=mix(c,vec3(.94,.95,.94),wisps*haze*(1.-body)*.24);
      }
      if(night>.001){
        vec2 skyUV=vec2(atan(d.z,d.x)/6.2831853+.5,asin(d.y)/3.14159265+.5);
        float latitude=dot(d,normalize(vec3(.5,.65,.57))),band=exp(-latitude*latitude/ .016);
        vec2 dustUV=vec2(atan(d.x,d.y)*2.5,d.z*4.);float dust=cloud(dustUV*3.+15.),wisps=cloud(dustUV*7.-19.);
        vec3 nocturne=mix(vec3(.002,.004,.013),vec3(.012,.019,.039),pow(1.-max(d.y,0.),3.));
        nocturne+=band*mix(vec3(.018,.025,.046),vec3(.18,.12,.19),dust)*(.35+wisps*.85);
        nocturne*=1.-band*smoothstep(.53,.7,cloud(dustUV*5.))* .62;
        nocturne+=(stars(skyUV,940.)*.8+stars(skyUV+vec2(.17,.09),440.)*.55)*smoothstep(-.03,.15,d.y);
        // A fictional binary-moon sky, composed for the arrival camera.
        // Both are behind the real terrain cards; the lower limbs disappear
        // naturally behind the ridge rather than floating over the landscape.
        for(int satellite=0;satellite<2;satellite++){
          bool primary=satellite==0;
          vec3 moonDirection=normalize(primary?vec3(.36,.13,-.93):vec3(.83,.21,-.55));
          float moonDot=dot(d,moonDirection);
          vec3 moonRight=normalize(cross(moonDirection,vec3(0.,1.,0.))),moonUp=cross(moonRight,moonDirection);
          vec2 disc=vec2(dot(d,moonRight),dot(d,moonUp))/(primary?.235:.105);
          float radius=length(disc),edge=max(fwidth(radius),.001);
          nocturne+=vec3(.009,.014,.026)*pow(max(moonDot,0.),primary?35.:85.);
          if(moonDot>0.&&radius<1.+edge){
            vec3 normal=vec3(disc,sqrt(max(0.,1.-dot(disc,disc))));
            vec2 lunarUV=vec2(atan(normal.x,normal.z)/6.2831853+.5,asin(clamp(normal.y,-1.,1.))/3.14159265+.5);
            if(!primary)lunarUV=vec2(fract(lunarUV.x+.31),1.-lunarUV.y);
            vec3 albedo=texture2D(moonMap,lunarUV).rgb;
            vec3 illumination=normalize(primary?vec3(-.32,.18,.93):vec3(.8,.2,.45));
            float sunlight=max(0.,dot(normal,illumination));
            vec3 tint=primary?vec3(.86,.98,1.13):vec3(1.24,.72,.48);
            vec3 lunarColor=albedo*tint*(.025+sunlight*1.4);
            float horizonHaze=1.-smoothstep(.01,.2,d.y);
            lunarColor=mix(lunarColor,vec3(.045,.065,.1),horizonHaze*.48);
            nocturne=mix(nocturne,lunarColor,1.-smoothstep(1.-edge,1.+edge,radius));
          }
        }
        // A faint elongated companion galaxy; fixed in the celestial sphere.
        vec3 g=normalize(vec3(.6,.63,-.49));vec3 u=normalize(cross(g,vec3(0.,1.,0.))),v=cross(g,u);
        float ellipse=pow(dot(d,u)/.09,2.)+pow(dot(d,v)/.022,2.);
        nocturne+=vec3(.14,.14,.17)*exp(-ellipse*2.)*step(.98,dot(d,g));
        // Folded auroral curtains: soft vertical rays grow above a wandering
        // green lower edge and dissolve into a violet upper veil.
        float azimuth=atan(d.z,d.x),elevation=asin(clamp(d.y,-1.,1.));
        vec3 aurora=vec3(0.);
        for(int curtain=0;curtain<3;curtain++){
          float k=float(curtain),a=azimuth+k*.63,timeFlow=time*.035;
          float fold=sin(a*3.+timeFlow+k)*.045+sin(a*7.-timeFlow*.7)*.018;
          float base=.15+k*.11+fold,up=elevation-base;
          float envelope=smoothstep(-.012,.024,up)*exp(-max(up,0.)*(7.+k*2.));
          float rays=.4+.6*pow(.5+.5*sin(a*190.+cloud(vec2(a*12.,timeFlow))*16.),2.);
          float activity=.5+.5*sin(a*2.+k*2.-timeFlow);
          vec3 tint=mix(vec3(.045,.57,.28),vec3(.22,.065,.38),smoothstep(.035,.25,up));
          aurora+=tint*envelope*rays*activity*(.6-k*.12);
        }
        // One localized northern display, fading away before the opposite sky.
        float bearing=azimuth+.9;
        float angularDistance=abs(atan(sin(bearing),cos(bearing)));
        float auroraSector=1.-smoothstep(.35,.9,angularDistance);
        nocturne+=aurora*auroraSector*smoothstep(.035,.12,d.y);
        c=mix(c,nocturne,night);
      }
      gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>
      #include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(250,48,24),skyMaterial);sky.name="Sky / evening atmosphere";scene.add(sky);scene.background=new THREE.Color(0xf0ceae);scene.fog=null;
  const shader={name:"WorldWater",uniforms:{color:{value:new THREE.Color()},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},time:{value:0},night:{value:0},rippleField:{value:ripples.texture},rippleFade:{value:0}},
    vertexShader:`uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 waterPosition;
      void main(){waterPosition=(modelMatrix*vec4(position,1.)).xyz;vUv=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform vec3 color;uniform sampler2D tDiffuse;uniform sampler2D rippleField;uniform float rippleFade;uniform mat4 textureMatrix;uniform float time;uniform float night;varying vec4 vUv;varying vec3 waterPosition;
      ${shorelineShader(shoreline)}
      void main(){vec2 uv=vUv.xy/vUv.w;float waves=sin(waterPosition.x*1.8+waterPosition.z*.6+time*.65)*.65+sin(waterPosition.z*3.1-waterPosition.x*.4-time*.8)*.35;
      float crossWave=sin(waterPosition.x*1.4+waterPosition.z*2.7+time*.45);
      vec2 fieldUV=waterPosition.xz/${RIPPLE_DOMAIN}.+.5,texel=vec2(1./${RIPPLE_RESOLUTION}.,0.);
      vec2 slope=vec2(0.);
      if(all(greaterThan(fieldUV,vec2(.01)))&&all(lessThan(fieldUV,vec2(.99)))){
        slope=vec2(texture2D(rippleField,fieldUV+texel).r-texture2D(rippleField,fieldUV-texel).r,texture2D(rippleField,fieldUV+texel.yx).r-texture2D(rippleField,fieldUV-texel.yx).r)*${(RIPPLE_RESOLUTION/(2*RIPPLE_DOMAIN)).toFixed(1)}*rippleFade;
      }
      // Project a world-space normal perturbation, so ripples stay attached to
      // the lake as the camera orbits, rather than following screen coordinates.
      vec4 displaced=vUv+textureMatrix*vec4(-slope.x*2.4,slope.y*2.4,0.,0.);
      float shoreRadius=shorelineRadius(atan(waterPosition.z,waterPosition.x));
      float shoreDamping=1.-smoothstep(shoreRadius-24.,shoreRadius-1.,length(waterPosition.xz));
      uv=displaced.xy/displaced.w+vec2(waves,crossWave)*.0016*shoreDamping;
      vec3 reflected=texture2D(tDiffuse,uv).rgb;vec3 water=mix(vec3(.15,.24,.28),vec3(.003,.009,.016),night);
      vec3 normal=normalize(vec3(-slope.x,1.,-slope.y)),eye=normalize(cameraPosition-waterPosition),sun=normalize(vec3(-.6,.38,.6));
      float fresnel=.4+.6*pow(1.-max(0.,dot(normal,eye)),5.);
      float glint=pow(max(0.,dot(normal,normalize(sun+eye))),130.)*min(.45,length(slope)*3.);
      vec3 c=mix(reflected,water,mix(.14,.035,fresnel))+waves*.004+glint*vec3(1.,.93,.78);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>}`};
  const water=new Reflector(new THREE.PlaneGeometry(480,480),{textureWidth:1024,textureHeight:1024,multisample:0,clipBias:.0001,shader,color:0xa6c4d2});
  water.name="Water / single planar reflection";water.rotation.x=-Math.PI/2;water.position.y=-.49;scene.add(water);
  const reflect=water.onBeforeRender,lastView=new THREE.Matrix4(),lastProjection=new THREE.Matrix4();
  const reflectionBudget=new WaterReflectionBudget();let dirty=true,reflectionRenders=0;
  water.onBeforeRender=function(renderer,world,camera,geometry,material,group){
    // Reuse the captured image together with its original projective matrix.
    // Fast camera frames refresh both; late frames can reuse a recent capture.
    const lensChanged=!lastProjection.equals(camera.projectionMatrix);
    const cameraChanged=!lastView.equals(camera.matrixWorld)||lensChanged;
    if(!reflectionBudget.shouldUpdate(performance.now(),cameraChanged,dirty,lensChanged))return;
    dirty=false;lastView.copy(camera.matrixWorld);lastProjection.copy(camera.projectionMatrix);
    const mask=screen.material;screen.material=screenMaterial;
    // Cross-origin video stays in its official iframe. Reflect the TV glass,
    // not its transparent DOM aperture, so no hole is punched in the water.
    const otherMasks=otherScreens.map(entry=>{const previous=entry.screen.material;entry.screen.material=entry.material;return previous;});
    try{reflect.call(this,renderer,world,camera,geometry,material,group);reflectionRenders++;}finally{screen.material=mask;otherScreens.forEach((entry,i)=>{entry.screen.material=otherMasks[i];});}
  };
  return {water,interaction,get reflectionRenders(){return reflectionRenders;},setNight:(amount:number)=>{skyMaterial.uniforms.night.value=amount;(water.material as THREE.ShaderMaterial).uniforms.night.value=amount;dirty=true;},get isRippling(){return ripples.activity>0;},update:(seconds:number,sceneChanged=false,dt=0)=>{
    dirty ||= sceneChanged;skyMaterial.uniforms.time.value=seconds;
    ripples.step(dt,interaction.drain());const uniforms=(water.material as THREE.ShaderMaterial).uniforms;
    uniforms.time.value=seconds;uniforms.rippleField.value=ripples.texture;uniforms.rippleFade.value=ripples.activity;
  },dispose:()=>{ripples.dispose();water.dispose();skyMaterial.dispose();moonMap.dispose();}};
}
