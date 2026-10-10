import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { keyboardRows, keyUnits, KEYCAP_REST } from "./computer-interactions";

/** One model shared by the About desk toy and the full-sized room. */
export function buildRetroComputer({keyFeedback=true}:{keyFeedback?:boolean}={}) {
  const rig = new THREE.Group();
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const material = (color: number, roughness = 0.7, metalness = 0) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(result); return result;
  };
  const cream = material(0xe6d4ac);
  const edge = material(0xbca783);
  const ivory = material(0xf4e7ce);
  const charcoal = material(0x292d28);
  const green = material(0x63866a);
  const metal = material(0xaaa99c, 0.4, 0.45);
  const keyMat = material(0xeee0c2);
  const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, radius = 0.035) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w/3, h/3, d/3)), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const texture = (canvas: HTMLCanvasElement) => {
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; textures.push(tex); return tex;
  };
  const label = (text: string, w: number, h: number, x: number, y: number, z: number) => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#5c604e"; ctx.font = "bold 48px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 256, 48);
    const mat = new THREE.MeshBasicMaterial({ map: texture(canvas), transparent: true, depthWrite: false }); materials.push(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat); mesh.position.set(x,y,z); rig.add(mesh);
  };

  // A deep CRT shell, recessed glass, separate pedestal, and low system unit.
  const collisionBodies = [
  box(rig, 2.25, 0.42, 1.42, 0, 0.4, 0.12, cream, 0.08),
  box(rig, 2.1, 0.06, 1.25, 0, 0.17, 0.12, edge),
  box(rig, 0.8, 0.13, 0.7, 0, 0.67, 0, edge),
  box(rig, 0.42, 0.28, 0.4, 0, 0.8, -0.05, cream),
  box(rig, 2.1, 1.62, 1.25, 0, 1.65, -0.08, cream, 0.16),
  box(rig, 2.13, 1.64, 0.22, 0, 1.65, 0.57, ivory, 0.14),
  box(rig, 1.84, 1.29, 0.075, 0, 1.73, 0.705, edge, 0.1),
  box(rig, 1.73, 1.18, 0.055, 0, 1.73, 0.752, charcoal, 0.095),
  ];
  label("D D — 0 1", 0.48, 0.085, -0.54, 1.025, 0.69);
  for (let i=0;i<8;i++) {
    box(rig, 0.014, 0.49, 0.038, 1.052, 1.7, -0.42+i*0.09, charcoal, 0.005);
    box(rig, 0.025, 0.07, 0.01, 0.39+i*0.045, 1.035, 0.688, edge, 0.004);
  }
  box(rig, 0.86, 0.067, 0.05, 0.49, 0.44, 0.844, charcoal, 0.014);
  const ejectButton = box(rig, 0.16, 0.08, 0.065, 0.99, 0.44, 0.86, edge, 0.018);
  const powerButton = box(rig, 0.2, 0.17, 0.07, -0.85, 0.44, 0.865, green, 0.025);
  label("I", 0.045, 0.075, -0.85, 0.44, 0.903);
  const ledMat = material(0x96dc91); ledMat.emissive.set(0x578844); ledMat.emissiveIntensity = 0.8;
  const led = box(rig, 0.035, 0.035, 0.015, -0.64, 0.44, 0.86, ledMat, 0.005);

  const disk = new THREE.Group(); rig.add(disk); disk.position.set(0.48, 0.435, 0.45);
  box(disk, 0.72, 0.038, 0.69, 0, 0, 0, green, 0.014);
  box(disk, 0.36, 0.006, 0.24, 0.04, 0.023, -0.2, metal, 0.004);
  box(disk, 0.48, 0.007, 0.29, 0, 0.023, 0.12, ivory, 0.003);
  box(disk, 0.33, 0.008, 0.019, 0, 0.029, 0.06, green, 0.002);
  box(disk, 0.23, 0.008, 0.012, -0.05, 0.029, 0.13, edge, 0.002);

  const keyboard = new THREE.Group(); rig.add(keyboard); keyboard.position.set(-0.1, 0.09, 1.4); keyboard.rotation.x = 0.08;
  collisionBodies.push(box(keyboard, 2.46, 0.13, 0.95, 0, 0, 0, cream, 0.06));
  box(keyboard, 2.28, 0.03, 0.8, 0, 0.075, -0.015, edge, 0.025);
  const legends = [...new Set(keyboardRows.flat())];
  const atlas = document.createElement("canvas");atlas.width=1024;atlas.height=1024;
  const ink = atlas.getContext("2d")!;ink.fillStyle="#3d493c";ink.textAlign="center";ink.textBaseline="middle";
  const shortNames: Record<string,string>={Backspace:"⌫",Left:"←",Right:"→",Space:"",Caps:"caps",Shift:"shift",Enter:"enter"};
  legends.forEach((key,i)=>{ink.font=`${key.length===1?"bold 62":"36"}px monospace`;ink.fillText(shortNames[key]??key,i%8*128+64,Math.floor(i/8)*128+64,118);});
  const legendMaterial = new THREE.MeshBasicMaterial({map:texture(atlas),transparent:true,depthWrite:false});materials.push(legendMaterial);
  const keys: {group:THREE.Group;name:string;pressedUntil:number;hint:THREE.MeshStandardMaterial;restColor:THREE.Color}[]=[];
  keyboardRows.forEach((row,r)=>{
    const unit=2.22/row.reduce((sum,key)=>sum+keyUnits(key),0);let x=-1.11;
    row.forEach(name=>{
      const width=keyUnits(name)*unit;const group=new THREE.Group();group.position.set(x+width/2,KEYCAP_REST,-0.33+r*0.165);group.userData.key=name;keyboard.add(group);
      // A stationary dark switch well makes the moving keycap's travel legible.
      box(keyboard,width-0.009,0.018,0.15,x+width/2,0.092,group.position.z,charcoal,0.005);
      const source=name==="Esc"?green:name==="Enter"?edge:keyMat;
      const hint=keyFeedback?source.clone():source;
      const restColor=hint.color.clone();if(keyFeedback)materials.push(hint);
      const cap=box(group,width-0.019,0.12,0.142,0,0,0,hint,0.013);
      const points=cap.geometry.attributes.position;
      for(let i=0;i<points.count;i++){
        const y=points.getY(i), taper=1-0.2*(y+0.06)/0.12;
        points.setXYZ(i,points.getX(i)*taper,y,points.getZ(i)*taper);
      }
      cap.geometry.computeVertexNormals();
      // Keep the square atlas cells square, even on wider modifier keys.
      const legendSize=Math.min(width-0.04,0.11);
      const geometry=new THREE.PlaneGeometry(legendSize,legendSize);const uv=geometry.attributes.uv;const index=legends.indexOf(name);
      for(let i=0;i<uv.count;i++)uv.setXY(i,(index%8+uv.getX(i))/8,1-(Math.floor(index/8)+1-uv.getY(i))/8);
      const legend=new THREE.Mesh(geometry,legendMaterial);legend.rotation.x=-Math.PI/2;legend.position.y=0.061;group.add(legend);
      // Small tactile marks on the home keys, visible in the close-up.
      if(name==="F"||name==="J")box(group,0.037,0.006,0.006,0,0.063,0.041,edge,0.002);
      keys.push({group,name,pressedUntil:-1,hint,restColor});x+=width;
    });
  });
  const mouse = new THREE.Group(); rig.add(mouse); mouse.position.set(1.36,0.1,1.35); mouse.rotation.y=-0.15;
  const mouseBody=box(mouse,0.32,0.17,0.5,0,0,0,cream,0.08);
  box(mouse,0.013,0.009,0.19,0,0.085,-0.1,edge,0.003);
  const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(1.36,0.07,1.12),new THREE.Vector3(1.52,0.05,0.7),new THREE.Vector3(1.4,0.05,0.25),new THREE.Vector3(0.98,0.2,0.2)]);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(cable,32,0.017,6,false),edge);rig.add(wire);

  const screenCanvas = document.createElement("canvas"); screenCanvas.width=512; screenCanvas.height=352;
  const ctx = screenCanvas.getContext("2d")!;
  // Align bounce bounds to the visible ink, not font baselines or empty padding.
  ctx.font="italic 900 80px Arial, sans-serif";
  const dvdInk=ctx.measureText("DVD");
  ctx.font="bold 14px Arial, sans-serif";
  const videoInk=ctx.measureText("V I D E O");
  const logoInk={
    left:Math.min(-dvdInk.actualBoundingBoxLeft,5,59-videoInk.actualBoundingBoxLeft),
    right:Math.max(dvdInk.actualBoundingBoxRight,175,59+videoInk.actualBoundingBoxRight),
    top:Math.min(72-dvdInk.actualBoundingBoxAscent,79,111-videoInk.actualBoundingBoxAscent),
    bottom:Math.max(72+dvdInk.actualBoundingBoxDescent,97,111+videoInk.actualBoundingBoxDescent),
  };
  const screenTexture=texture(screenCanvas);
  const screenMat=new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false});materials.push(screenMat);
  const glassGeometry=new THREE.PlaneGeometry(1.62,1.07,32,24);
  const positions=glassGeometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i), y=positions.getY(i);
    const corner=Math.max(0,Math.abs(y)-0.44);
    positions.setXYZ(i,x*(1-corner*0.5),y,0.045*(1-(x/0.81)**2)*(1-(y/0.535)**2));
  }
  glassGeometry.computeVertexNormals();
  const screen=new THREE.Mesh(glassGeometry,screenMat);screen.position.set(0,1.73,0.787);rig.add(screen);

  return { rig, materials, textures, edge, keyboard, keys, mouse, mouseBody, wire, screen, screenCanvas, screenTexture, ctx, logoInk, powerButton, ejectButton, disk, led, collisionBodies };
}
