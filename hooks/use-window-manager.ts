"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import {desktopArea,fitDesktopWindow,type WindowBounds} from "@/lib/responsive-layout";
import type { WindowState } from "@/lib/types";
import { APP_REGISTRY } from "@/lib/constants";

// Reserved zones
const MENUBAR_HEIGHT = 34;
const MIN_MARGIN = 12;

// Mobile (< MOBILE_BREAKPOINT) reserves extra vertical space at the top
// of the desktop for the horizontally-scrolling icon row.
const MOBILE_BREAKPOINT = 768;

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function dockFootprint() {
  return desktopArea(viewportBounds()).dock;
}

function topReserve() {
  return desktopArea(viewportBounds()).y-12;
}

function viewportBounds(){
  if(typeof window==="undefined")return {width:1280,height:800};
  const css=getComputedStyle(document.documentElement),inset=(name:string)=>parseFloat(css.getPropertyValue(name))||0;
  return {width:window.innerWidth,height:window.visualViewport&&Math.abs(window.visualViewport.scale-1)<.02?window.visualViewport.height:window.innerHeight,top:inset("--safe-top"),bottom:inset("--safe-bottom"),left:inset("--safe-left"),right:inset("--safe-right")};
}

/**
 * Per-window context — stores arbitrary data an app needs to render
 * (e.g. which image the ImageViewer should show).
 */
export interface WindowContext {
  imageUrl?: string;
  imageName?: string;
  folderId?: string;
  imageIndex?: number;
  imageCount?: number;
  /** Message shown in the search-result window. */
  searchMessage?: string;
  /** Original query that was searched. */
  searchQuery?: string;
  /** Which project the project-detail window should display. */
  projectId?: string;
  /** Current slide index in the project-detail visual carousel. */
  projectSlide?: number;
}

interface WindowManagerContextValue {
  windows: WindowState[];
  windowStatuses: Record<string, string>;
  windowContexts: Record<string, WindowContext>;
  openWindow: (appId: string, context?: WindowContext) => void;
  closeWindow: (appId: string) => void;
  minimizeWindow: (appId: string) => void;
  restoreWindow: (appId: string) => void;
  focusWindow: (appId: string) => void;
  updatePosition: (appId: string, position: { x: number; y: number }) => void;
  updateSize: (appId: string, size: { width: number; height: number }) => void;
  centerWindow: (appId: string) => void;
  maximizeWindow: (appId: string) => void;
  setWindowStatus: (appId: string, status: string) => void;
  setWindowContext: (appId: string, patch: WindowContext) => void;
  getOpenWindows: () => WindowState[];
  getFocusedAppId: () => string | null;
}

export const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function useWindowManager(): WindowManagerContextValue {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error("useWindowManager must be used within WindowManagerProvider");
  return ctx;
}

function clampPosition(x: number, y: number, w: number, h: number) {
  return fitDesktopWindow({position:{x,y},size:{width:w,height:h}},viewportBounds()).position;
}

function clampSize(w: number, h: number) {
  return fitDesktopWindow({position:{x:0,y:0},size:{width:w,height:h}},viewportBounds()).size;
}

export function useWindowManagerProvider(): WindowManagerContextValue {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [windowStatuses, setWindowStatuses] = useState<Record<string, string>>({});
  const [windowContexts, setWindowContexts] = useState<Record<string, WindowContext>>({});
  const zIndexCounter = useRef(10);
  const preferred=useRef(new Map<string,WindowBounds>());
  useEffect(()=>{
    const refit=()=>{
      const viewport=viewportBounds();
      setWindows(prev=>prev.map(win=>{
        let original=preferred.current.get(win.appId);
        if(!original){original={position:win.position,size:win.size};preferred.current.set(win.appId,original);}
        const fitted=fitDesktopWindow(original,viewport,win.isMaximized);
        if(fitted.position.x===win.position.x&&fitted.position.y===win.position.y&&fitted.size.width===win.size.width&&fitted.size.height===win.size.height)return win;
        return {...win,...fitted};
      }));
    };
    window.addEventListener("resize",refit);window.visualViewport?.addEventListener("resize",refit);
    return()=>{window.removeEventListener("resize",refit);window.visualViewport?.removeEventListener("resize",refit);};
  },[]);

  const openWindow = useCallback((appId: string, context?: WindowContext) => {
    const appDef = APP_REGISTRY[appId];
    if (!appDef) return;

    // Store/merge context
    if (context) {
      setWindowContexts((prev) => ({ ...prev, [appId]: { ...prev[appId], ...context } }));
    }

    setWindows((prev) => {
      const existing = prev.find((w) => w.appId === appId);
      if (existing) {
        const newZ = ++zIndexCounter.current;
        return prev.map((w) =>
          w.appId === appId ? { ...w, isMinimized: false, zIndex: newZ } : w
        );
      }

      const newZ = ++zIndexCounter.current;
      const clampedSize = clampSize(appDef.defaultWidth, appDef.defaultHeight);

      let defaultX = appDef.defaultX;
      let defaultY = appDef.defaultY;

      if (typeof window !== "undefined") {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const reserve = topReserve();
        const mobile = isMobileViewport();
        const contentHeight = vh - MENUBAR_HEIGHT - reserve;
        const offset = mobile ? 0 : (prev.length % 5) * 24;
        defaultX = Math.max(
          MIN_MARGIN,
          Math.floor((vw - clampedSize.width) / 2) + offset
        );
        // Top-biased: anchor windows in the upper third with a min 30px
        // offset, so the title bar is reachable on iPad / pinch-zoomed
        // visual viewports where the bottom can be clipped.
        defaultY = Math.max(
          MIN_MARGIN + reserve,
          reserve +
            Math.max(
              30,
              Math.floor((contentHeight - clampedSize.height - dockFootprint()) / 3)
            ) +
            offset
        );

        // Cap defaultY so the window bottom always clears the dock, even
        // if the cascade `offset` pushed us down. Previously the 4th/5th
        // window in a stack could land with its bottom tucked behind the
        // taskbar on desktop (offset = 72px, 96px).
        const maxDefaultY =
          vh - MENUBAR_HEIGHT - dockFootprint() - clampedSize.height - MIN_MARGIN;
        defaultY = Math.min(defaultY, Math.max(MIN_MARGIN + reserve, maxDefaultY));
      }

      const pos = clampPosition(defaultX, defaultY, clampedSize.width, clampedSize.height);

      const newWindow: WindowState = {
        appId,
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        zIndex: newZ,
        position: pos,
        size: clampedSize,
      };
      preferred.current.set(appId,{position:pos,size:{width:appDef.defaultWidth,height:appDef.defaultHeight}});
      return [...prev, newWindow];
    });
  }, []);

  const closeWindow = useCallback((appId: string) => {
    preferred.current.delete(appId);
    setWindows((prev) => prev.filter((w) => w.appId !== appId));
    setWindowStatuses((prev) => {
      const next = { ...prev };
      delete next[appId];
      return next;
    });
    setWindowContexts((prev) => {
      const next = { ...prev };
      delete next[appId];
      return next;
    });
  }, []);

  const minimizeWindow = useCallback((appId: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.appId === appId ? { ...w, isMinimized: true } : w))
    );
  }, []);

  const restoreWindow = useCallback((appId: string) => {
    const newZ = ++zIndexCounter.current;
    setWindows((prev) =>
      prev.map((w) => (w.appId === appId ? { ...w, isMinimized: false, zIndex: newZ } : w))
    );
  }, []);

  const focusWindow = useCallback((appId: string) => {
    setWindows((prev) => {
      const w = prev.find((win) => win.appId === appId);
      if (!w) return prev;
      // Only bump z-index if not already topmost
      const currentMax = Math.max(
        ...prev.filter((win) => win.isOpen && !win.isMinimized).map((win) => win.zIndex)
      );
      if (w.zIndex >= currentMax) return prev;
      const newZ = ++zIndexCounter.current;
      return prev.map((win) =>
        win.appId === appId ? { ...win, zIndex: newZ } : win
      );
    });
  }, []);

  const updatePosition = useCallback(
    (appId: string, position: { x: number; y: number }) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.appId !== appId) return w;
          const clamped = clampPosition(position.x, position.y, w.size.width, w.size.height);
          preferred.current.set(appId,{position:clamped,size:w.size});
          return { ...w, position: clamped };
        })
      );
    },
    []
  );

  const updateSize = useCallback(
    (appId: string, size: { width: number; height: number }) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.appId !== appId) return w;
          const clamped = clampSize(size.width, size.height);
          const position=clampPosition(w.position.x,w.position.y,clamped.width,clamped.height);
          preferred.current.set(appId,{position,size:clamped});
          // Manual resize drops the maximize flag — no more restore icon.
          return {
            ...w,
            size: clamped,
            position,
            isMaximized: false,
            preMaxPosition: undefined,
            preMaxSize: undefined,
          };
        })
      );
    },
    []
  );

  const centerWindow = useCallback((appId: string) => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    const contentHeight = window.innerHeight - MENUBAR_HEIGHT;
    setWindows((prev) =>
      prev.map((w) => {
        if (w.appId !== appId) return w;
        const x = Math.floor((vw - w.size.width) / 2);
        const y = Math.floor((contentHeight - w.size.height - dockFootprint()) / 2);
        const position=clampPosition(x,y,w.size.width,w.size.height);
        preferred.current.set(appId,{position,size:w.size});
        return { ...w, position };
      })
    );
  }, []);

  const maximizeWindow = useCallback((appId: string) => {
    if (typeof window === "undefined") return;
    setWindows((prev) =>
      prev.map((w) => {
        if (w.appId !== appId) return w;

        // Toggle off — restore the previous bounds
        if (w.isMaximized && w.preMaxSize && w.preMaxPosition) {
          return {
            ...w,
            isMaximized: false,
            isMinimized: false,
            ...fitDesktopWindow({position:w.preMaxPosition,size:w.preMaxSize},viewportBounds()),
            preMaxPosition: undefined,
            preMaxSize: undefined,
            zIndex: ++zIndexCounter.current,
          };
        }

        // Toggle on — remember current bounds and fill the usable desktop.
        // Phone windows still leave the shortcut strip and dock visible.
        const fitted=fitDesktopWindow(w,viewportBounds(),true);
        return {
          ...w,
          isMaximized: true,
          isMinimized: false,
          preMaxPosition: w.position,
          preMaxSize: w.size,
          ...fitted,
          zIndex: ++zIndexCounter.current,
        };
      })
    );
  }, []);

  const setWindowStatus = useCallback((appId: string, status: string) => {
    setWindowStatuses((prev) => {
      if (prev[appId] === status) return prev;
      return { ...prev, [appId]: status };
    });
  }, []);

  const setWindowContext = useCallback((appId: string, patch: WindowContext) => {
    setWindowContexts((prev) => ({ ...prev, [appId]: { ...prev[appId], ...patch } }));
  }, []);

  const getOpenWindows = useCallback(() => windows.filter((w) => w.isOpen), [windows]);

  const getFocusedAppId = useCallback(() => {
    const visible = windows.filter((w) => w.isOpen && !w.isMinimized);
    if (visible.length === 0) return null;
    return visible.reduce((a, b) => (a.zIndex > b.zIndex ? a : b)).appId;
  }, [windows]);

  return {
    windows,
    windowStatuses,
    windowContexts,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    focusWindow,
    updatePosition,
    updateSize,
    centerWindow,
    maximizeWindow,
    setWindowStatus,
    setWindowContext,
    getOpenWindows,
    getFocusedAppId,
  };
}
