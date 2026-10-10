export type ViewportBounds={width:number;height:number;top?:number;bottom?:number;left?:number;right?:number};
export type WindowBounds={position:{x:number;y:number};size:{width:number;height:number}};
export function desktopArea(v:ViewportBounds){
  const mobile=v.width<768,margin=mobile?6:12;
  const menu=(mobile?44:34)+(v.top??0),dock=(mobile?76:72)+(v.bottom??0);
  // The shortcut strip is ~96px tall. Keep it clear on every phone height,
  // including landscape and when the on-screen keyboard shrinks the viewport.
  const reserve=mobile?100:0;
  const x=margin+(v.left??0),y=margin+reserve;
  return {x,y,width:Math.max(1,v.width-x-margin-(v.right??0)),height:Math.max(1,v.height-menu-dock-y-margin),mobile,menu,dock};
}
/** Keep the whole window reachable after rotation, browser resizing or a keyboard. */
export function fitDesktopWindow(bounds:WindowBounds,v:ViewportBounds,maximized=false):WindowBounds{
  const area=desktopArea(v),fill=area.mobile||maximized;
  const width=Math.min(area.width,Math.max(Math.min(280,area.width),fill?area.width:bounds.size.width));
  const height=Math.min(area.height,Math.max(Math.min(180,area.height),fill?area.height:bounds.size.height));
  return {size:{width,height},position:{x:fill?area.x:Math.max(area.x,Math.min(v.width-(v.right??0)-(area.mobile?6:12)-width,bounds.position.x)),y:fill?area.y:Math.max(area.y,Math.min(area.y+area.height-height,bounds.position.y))}};
}
/** Preserve the familiar wide-screen composition, fit the island in portrait. */
export function worldOverviewScale(width:number,height:number){
  return Math.max(1,Math.min(2.8,1.05/Math.max(.25,width/Math.max(1,height))));
}
export function worldReadingMode(width:number,height:number){return width<700&&height>500?"sheet":width<1000?"compact":"side";}
