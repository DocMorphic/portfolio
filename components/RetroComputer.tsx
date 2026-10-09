"use client";

import { useEffect, useRef, useState } from "react";
import type { ComputerControls } from "@/lib/retro-computer";
import type { ComputerView } from "@/lib/computer-interactions";
import { useWindowManager } from "@/hooks/use-window-manager";
import { useRouter } from "next/navigation";
import { navigateImmersive, routeReady } from "@/lib/route-transition";
import { worldSound } from "@/lib/world-sound";
import { prefetchWorldAssets } from "@/lib/world-prefetch";

export function RetroComputer() {
  const router=useRouter();
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<ComputerControls | null>(null);
  const { getFocusedAppId } = useWindowManager();
  const [status, setStatus] = useState("Loading the little computer…");
  const [ready, setReady] = useState(false);
  const [powered, setPowered] = useState(true);
  const [ejected, setEjected] = useState(false);
  const [view, setView] = useState<ComputerView>("overview");
  const [playing, setPlaying] = useState(false);
  const [hasMedia, setHasMedia] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const aboutIsFocused = getFocusedAppId() === "about";
  useEffect(() => {
    if (!terminalReady) return;
    navigateImmersive("/v2",path=>router.push(path));
  }, [terminalReady,router]);
  useEffect(()=>{
    // Start route fetching only after the correct secret, during the camera pan.
    if(terminal){router.prefetch("/v2");void prefetchWorldAssets();}
  },[terminal,router]);
  useEffect(()=>{if(ready)routeReady("desktop");},[ready]);

  useEffect(() => {
    if (ready && aboutIsFocused) controls.current?.resetMouse();
  }, [ready, aboutIsFocused]);

  useEffect(() => {
    if (view === "overview" || terminal) return;
    host.current?.focus({ preventScroll: true });
    // Handle inspection before the desktop's Escape-to-close shortcut,
    // including when focus is on a non-focusable part of the 3D scene.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || getFocusedAppId() !== "about") return;
      event.preventDefault();
      event.stopPropagation();
      controls.current?.back();
    };
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, [view, terminal, getFocusedAppId]);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    // Three.js and its geometry are fetched only when About is mounted.
    import("@/lib/retro-computer").then(({ createComputer }) => {
      if (cancelled || !host.current) return;
      const computer = createComputer(host.current, (state) => {
        setTerminal(state.terminal);
        setTerminalReady(state.terminalReady);
        setPowered(state.powered);
        setEjected(state.ejected);
        setStatus(state.message);
        setView(state.view);
        setPlaying(state.playing);
        setHasMedia(state.hasMedia);
      });
      controls.current = computer;
      dispose = computer.dispose;
      setReady(true);
    }).catch(() => {
      if (!cancelled) setStatus("The little computer needs WebGL to start.");
    });
    return () => { cancelled = true; dispose?.(); controls.current = null; };
  }, []);

  return <div style={{viewTransitionName:"computer-portal"}} className={`retro-computer-stage${view !== "overview" ? " is-inspecting" : ""}`}
    onPointerDownCapture={()=>{void worldSound.unlock();}} onKeyDownCapture={()=>{void worldSound.unlock();}}
    onKeyDown={event => {if(event.key === "Escape" && view !== "overview"){event.preventDefault();event.stopPropagation();controls.current?.back();}}}>
    <div ref={host} className="retro-computer-canvas" inert={terminalReady} tabIndex={ready && !terminalReady ? 0 : -1} role="group"
      aria-label={view === "keyboard" ? "Clickable 3D keyboard. Type TERMINAL or click its keys to enter the tram world. Escape returns." : "3D retro computer. Click the orange-lit keyboard, then type TERMINAL to enter the tram world. Drag to spin or use the wired mouse."} />
    {!ready && <p className="retro-computer-fallback">{status}</p>}
    <div className="retro-computer-controls" aria-label="Mini computer controls">
      {view !== "overview" && <button type="button" onClick={() => controls.current?.back()} aria-label="Return to computer view">← Back</button>}
      {view === "screen" && hasMedia && <button type="button" onClick={() => controls.current?.playPause()}>{playing ? "Pause" : "Play"}</button>}
      <button disabled={!ready} type="button" onClick={() => controls.current?.power()}
        aria-label={powered ? "Turn mini computer off" : "Turn mini computer on"} aria-pressed={powered}>
        <span aria-hidden="true">⏻</span> Power
      </button>
      <button disabled={!ready} type="button" onClick={() => controls.current?.disk()}
        aria-label={ejected ? "Insert floppy disk" : "Eject floppy disk"} aria-pressed={ejected}>
        <span aria-hidden="true">⏏</span> {ejected ? "Insert" : "Eject"}
      </button>
    </div>
    <span className="sr-only" role="status">{status}</span>
  </div>;
}
