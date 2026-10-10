"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ComputerTerminal } from "@/components/ComputerTerminal";
import { TramTelevision } from "@/components/TramTelevision";
import { JournalVending } from "@/components/JournalVending";
import { WorldSoundControl } from "@/components/WorldSoundControl";
import { WorldMarketTicker } from "@/components/WorldMarketTicker";
import { worldSound } from "@/lib/world-sound";
import type { RoomControls, RoomView, WorldSelection } from "@/lib/portfolio-room";
import type { TerminalSection } from "@/lib/portfolio-terminal";
import { worldOverlayGate, type WorldPhase } from "@/lib/world-overlay";
import { journeyStore, routeReady, journeyGamePainted } from "@/lib/route-transition";

type Bounds={x:number;y:number;width:number;height:number};
export function PortfolioRoom({active,sourceReady,sourceBounds,onExit,standalone=false}:{active:boolean;sourceReady:boolean;sourceBounds():Bounds|undefined;onExit():void;standalone?:boolean}){
  const journey=useSyncExternalStore(journeyStore.subscribe,journeyStore.snapshot,journeyStore.serverSnapshot);
  const root=useRef<HTMLDivElement>(null),host=useRef<HTMLDivElement>(null),surface=useRef<HTMLDivElement>(null),tvSurface=useRef<HTMLDivElement>(null),vendingSurface=useRef<HTMLDivElement>(null),tickerSurface=useRef<HTMLDivElement>(null);
  const controls=useRef<RoomControls|null>(null),exit=useRef(onExit),bounds=useRef(sourceBounds);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const [phase,setPhase]=useState<WorldPhase>("warming"),phaseRef=useRef<WorldPhase>("warming");
  const [view,setView]=useState<RoomView>("terminal"),viewRef=useRef<RoomView>("terminal");
  const [selection,setSelection]=useState<WorldSelection|null>(null);
  const [night,setNight]=useState(false);
  const closing=useRef(false);
  const animation=useRef<Animation|null>(null),finishExit=useRef<()=>void>(()=>{});
  const gate=worldOverlayGate(active,phase);
  useEffect(()=>{if(active)return worldSound.attach();},[active]);
  useEffect(()=>{phaseRef.current=phase;},[phase]);
  useEffect(()=>{
    if(active)return;
    closing.current=false;animation.current?.cancel();controls.current?.setActive(false);setPhase("warming");
  },[active]);
  useEffect(()=>{exit.current=onExit;bounds.current=sourceBounds;},[onExit,sourceBounds]);
  useEffect(()=>{
    let cancelled=false;
    const fallback=()=>{if(cancelled)return;controls.current?.dispose();controls.current=null;viewRef.current="terminal";setView("terminal");setSelection(null);setFailed(true);setReady(true);if(host.current)host.current.style.pointerEvents="none";
      if(closing.current)finishExit.current();else if(phaseRef.current!=="warming")setPhase("live");
      if(surface.current)Object.assign(surface.current.style,{visibility:"visible",transform:"none",width:"100%",height:"100%",borderRadius:"0"});};
    journeyGamePainted().then(()=>cancelled?null:import("@/lib/portfolio-room")).then(async module=>{
      if(!module)return;const {createPortfolioRoom}=module;
      if(cancelled||!host.current||!surface.current)return;
      const world=await createPortfolioRoom(host.current,surface.current,next=>{
        if(cancelled)return;viewRef.current=next;setView(next);
        if(next!=="terminal"&&root.current?.style.visibility==="visible")root.current?.focus({preventScroll:true});
        if(next==="terminal"&&closing.current)finishExit.current();
        if(next==="room"&&phaseRef.current==="entering")setPhase("live");
      },fallback,setSelection,setNight,tvSurface.current??undefined,vendingSurface.current??undefined,tickerSurface.current??undefined);
      if(cancelled){world.dispose();return;}
      controls.current=world;await world.prepare();if(!cancelled)setReady(true);
    }).catch(fallback);
    return()=>{cancelled=true;animation.current?.cancel();controls.current?.dispose();controls.current=null;};
  },[]);
  const sourceClip=useCallback(()=>{
    if(standalone)return "inset(0px 0px 0px 0px round 0px)";
    const mini=bounds.current();
    if(!mini)return "inset(45% 45% 45% 45% round 18px)";
    return `inset(${Math.max(0,mini.y)}px ${Math.max(0,innerWidth-mini.x-mini.width)}px ${Math.max(0,innerHeight-mini.y-mini.height)}px ${Math.max(0,mini.x)}px round 18px)`;
  },[standalone]);
  useEffect(()=>{
    finishExit.current=()=>{
      if(standalone){worldSound.play("exit");exit.current();return;}
      if(!root.current)return;setPhase("leaving");
      const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      animation.current?.cancel();animation.current=root.current.animate([{clipPath:"inset(0px 0px 0px 0px round 0px)",opacity:1},{clipPath:sourceClip(),opacity:0}],{duration:reduced?0:standalone?380:1000,easing:"cubic-bezier(.65,0,.35,1)",fill:"forwards"});
      animation.current.onfinish=()=>{controls.current?.setActive(false);if(root.current)root.current.style.visibility="hidden";setPhase("warming");closing.current=false;exit.current();};
    };
  });
  useEffect(()=>{
    if(!active||!sourceReady||!ready||phase!=="warming"||!root.current)return;
    closing.current=false;root.current.style.visibility="visible";controls.current?.setActive(true);
    animation.current?.cancel();
    const start=sourceClip();phaseRef.current="entering";setPhase("entering");root.current.focus({preventScroll:true});
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reveal the live 3D camera through the CRT aperture; never scale a screenshot
    // of the entire browser. The same aperture closes onto the desk on exit.
    animation.current=root.current.animate([{clipPath:start,opacity:standalone?1:0},{clipPath:"inset(0px 0px 0px 0px round 0px)",opacity:1}],{duration:reduced||standalone?0:1100,easing:"cubic-bezier(.22,.7,.3,1)",fill:"forwards"});
    controls.current?.enter();
    animation.current.onfinish=()=>{if(!controls.current)setPhase("live");};
  },[active,sourceReady,ready,phase,standalone,sourceClip]);
  useEffect(()=>{if(ready&&phase!=="warming")routeReady("world");},[ready,phase]);
  useEffect(()=>{
    if(gate.inert)return;
    const desktop=document.querySelector<HTMLElement>(".desktop-brightness"),prior=document.activeElement as HTMLElement|null,wasInert=desktop?.inert??false;
    // The miniature camera can keep animating even while its DOM is inert.
    if(desktop)desktop.inert=true;
    return()=>{if(desktop)desktop.inert=wasInert;prior?.focus({preventScroll:true});};
  },[gate.inert]);
  const cancelExit=useCallback(()=>{closing.current=false;animation.current?.cancel();controls.current?.setActive(false);setPhase("warming");setSelection(null);exit.current();},[]);
  const leave=useCallback(()=>{if(closing.current||phaseRef.current!=="live"){cancelExit();return;}closing.current=true;setSelection(null);if(standalone||viewRef.current==="terminal"||!controls.current)finishExit.current();else controls.current.focus();},[cancelExit,standalone]);
  useEffect(()=>{
    if(!active||journey)return;
    const key=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();if(closing.current||phaseRef.current!=="live"){cancelExit();return;}if(controls.current)controls.current.reveal();else leave();}
      if(e.key==="Tab"){
        const items=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea,[tabindex="0"]')??[]).filter(el=>!el.closest("[inert]")&&el.getClientRects().length);
        if(!items.length)return;const first=items[0],last=items.at(-1)!;
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",key,true);return()=>document.removeEventListener("keydown",key,true);
  },[active,journey,cancelExit,leave]);
  const navigate=(section:TerminalSection)=>controls.current?.visit(section,undefined,true);
  return createPortal(<div {...gate}><div ref={root} className={`portfolio-room world-${phase}`} style={{visibility:phase==="warming"?"hidden":"visible",transformOrigin:"0 0",viewTransitionName:standalone?"computer-portal":undefined}} inert={!active||!!journey} data-view={view} role="dialog" aria-modal={active&&!journey} aria-label="Hidden portfolio world" tabIndex={-1}
    onPointerDown={event=>{if((view==="tv"||view==="vending")&&event.target instanceof HTMLElement&&!event.target.closest(".world-tv-display,.world-vending-display,[data-sound-control],button,a"))controls.current?.reveal();}}
    onKeyDown={event=>{event.stopPropagation();if(view!=="room"||event.target instanceof HTMLElement&&event.target.closest("button,input,textarea,a"))return;
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();controls.current?.orbit(event.key==="ArrowLeft"?.085:event.key==="ArrowRight"?-.085:0,event.key==="ArrowUp"?-.085:event.key==="ArrowDown"?.085:0);}
      if(["+","=","-"].includes(event.key)){event.preventDefault();controls.current?.zoom(event.key==="-"?1:-1);}}}>
    <div ref={host} className="portfolio-room-scene"/>
    <div ref={tickerSurface} className="world-market-display" style={{width:800,height:176}}>{phase==="live"&&<WorldMarketTicker/>}</div>
    <div className="portfolio-room-display-layer"><div ref={surface} className="portfolio-room-display" inert={view!=="terminal"||phase!=="live"} style={{pointerEvents:view==="terminal"&&phase==="live"?"auto":"none"}}>
      <ComputerTerminal autoFocus={false} onExit={leave} onNavigateSection={failed?undefined:navigate}/>
    </div></div>
    <div ref={tvSurface} className="world-tv-display" inert={view!=="tv"||phase!=="live"} style={{pointerEvents:view==="tv"&&phase==="live"?"auto":"none"}}>
      {phase==="live"&&<TramTelevision/>}
    </div>
    <div ref={vendingSurface} className="world-vending-display" inert={view!=="vending"||phase!=="live"} style={{overflow:"hidden",background:"#9be3ca",zIndex:0,pointerEvents:view==="vending"&&phase==="live"?"auto":"none"}}>
      {ready&&<JournalVending focused={view==="vending"} onBack={()=>controls.current?.reveal()}/>}
    </div>
    {phase==="live"&&<>
      <div className="portfolio-room-toolbar"><WorldSoundControl/><button aria-pressed={night} onClick={()=>controls.current?.setNight(!night)}>{night?"☀ Day":"☾ Night"}</button><button onClick={leave}>Exit to desktop</button></div>
      {view==="arcade"&&<div className="world-arcade-controls"><button onClick={()=>controls.current?.visit("work")}>Projects</button><button onClick={()=>controls.current?.reveal()}>← Back</button></div>}
      {view==="tv"&&<div className="world-tv-credit"><span>“Hog Hunt” by <a href="https://www.youtube.com/@SAD_istfied" target="_blank" rel="noopener noreferrer">SAD-ist</a></span><a href="https://www.youtube.com/watch?v=MPiILYNStd8" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a><button onClick={()=>controls.current?.reveal()}>Back to the lake</button></div>}
      {view==="object"&&selection&&<section className="world-story" aria-label={`${selection.section} portfolio`}>
        <button className="world-story-back" onClick={()=>controls.current?.reveal()} aria-label="Return to the 3D world">← Back to the lake</button>
        <ComputerTerminal key={`${selection.section}/${selection.folder??""}/${selection.photo??""}`} initialSection={selection.section} initialFolder={selection.folder} initialPhoto={selection.photo??null} autoFocus={false} onExit={leave} onNavigateSection={navigate}/>
      </section>}
      {failed&&<p className="portfolio-room-notice" role="status">3D is unavailable. The portfolio terminal still works.</p>}
    </>}
    <span className="sr-only" role="status">{view==="moving"?"Camera moving":view==="room"?"Drag to orbit, scroll to zoom, shift-drag to pan. Select a 3D object to explore.":view==="arcade"?"Click the arcade screen to switch Mario and credits. Escape returns to the lake.":view==="vending"?"Choose a chocolate on the screen to explore its blog. Escape returns to the lake.":"Portfolio terminal"}</span>
  </div></div>,document.body);
}
