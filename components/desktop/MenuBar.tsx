"use client";

import { useState, useRef, useEffect } from "react";
import { useClock } from "@/hooks/use-clock";
import { useWindowManager } from "@/hooks/use-window-manager";
import { useTheme } from "@/hooks/use-theme";
import { BrightnessPopover } from "./BrightnessPopover";

const CMD_KEY = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

function resetSystem() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("portfolio:"));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
  window.location.reload();
}

export function MenuBar() {
  const clock = useClock();
  const { mode } = useTheme();
  const {
    openWindow,
    closeWindow,
    minimizeWindow,
    centerWindow,
    maximizeWindow,
    getFocusedAppId,
  } = useWindowManager();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const focusedAppId = getFocusedAppId();
  const anyMenuOpen = openMenu === "portfolio" || openMenu === "file" || openMenu === "view";

  return (
    <div
      ref={menuRef}
      className="desktop-menubar relative z-[600] flex h-[34px] items-stretch justify-between border-b pr-3"
      style={{
        background: "var(--color-menubar-bg)",
        borderColor: "var(--color-menubar-border)",
      }}
    >
      {/* Left: Logo + Portfolio menu + File + View */}
      <div className="flex items-stretch">
        {/* Logo — click to open Site Stats */}
        <button
          className="ml-1.5 mr-1 flex h-[34px] w-[34px] shrink-0 items-center justify-center"
          onClick={() => openWindow("stats")}
          aria-label="Site stats"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mode === "dark" ? "/icon_dark.png" : "/icon.png"}
            alt="Portfolio logo"
            width={32}
            height={32}
            style={{ display: "block", width: "32px", height: "32px", objectFit: "contain" }}
          />
        </button>

        {/* Portfolio dropdown menu */}
        <MenuButton
          label="Portfolio"
          isOpen={openMenu === "portfolio"}
          onClick={() => setOpenMenu(openMenu === "portfolio" ? null : "portfolio")}
          onHoverOpen={() => setOpenMenu("portfolio")}
          anyMenuOpen={anyMenuOpen}
          className="ml-3"
          bold
        >
          {/* Items below */}
          <MenuItem
            label="About Portfolio"
            shortcut={`${CMD_KEY}+Opt+A`}
            onClick={() => { openWindow("about"); setOpenMenu(null); }}
          />
          <MenuItem
            label="Contact Me"
            shortcut={`${CMD_KEY}+Opt+K`}
            onClick={() => { openWindow("contact"); setOpenMenu(null); }}
          />
          <MenuItem
            label="Open Guide"
            shortcut={`${CMD_KEY}+Opt+H`}
            onClick={() => { openWindow("help"); setOpenMenu(null); }}
          />
          <MenuDivider />
          <MenuItem
            label="Settings..."
            onClick={() => { openWindow("settings"); setOpenMenu(null); }}
          />
          <MenuItem
            label="Reset System"
            onClick={() => { if (confirm("Reset all settings and reload?")) resetSystem(); }}
          />
        </MenuButton>

        {/* File Menu */}
        <div className="hidden md:flex">
          <MenuButton
            label="File"
            isOpen={openMenu === "file"}
            onClick={() => setOpenMenu(openMenu === "file" ? null : "file")}
            onHoverOpen={() => setOpenMenu("file")}
            anyMenuOpen={anyMenuOpen}
            className="ml-2"
          >
            <MenuItem label="New Window" disabled />
            <MenuItem label="Open..." disabled />
            <MenuDivider />
            <MenuItem
              label="Close Window"
              shortcut={`${CMD_KEY}+Opt+W`}
              onClick={() => {
                if (focusedAppId) closeWindow(focusedAppId);
                setOpenMenu(null);
              }}
              disabled={!focusedAppId}
            />
          </MenuButton>
        </div>

        {/* View Menu */}
        <MenuButton
          label="View"
          isOpen={openMenu === "view"}
          onClick={() => setOpenMenu(openMenu === "view" ? null : "view")}
          onHoverOpen={() => setOpenMenu("view")}
          anyMenuOpen={anyMenuOpen}
          className="ml-2"
        >
          <MenuItem
            label="Refresh"
            shortcut={`${CMD_KEY}+Opt+R`}
            onClick={() => window.location.reload()}
          />
          <MenuItem
            label="Maximize"
            shortcut={`${CMD_KEY}+Opt+F`}
            onClick={() => {
              if (focusedAppId) maximizeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuItem
            label="Minimize"
            shortcut={`${CMD_KEY}+Opt+M`}
            onClick={() => {
              if (focusedAppId) minimizeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuItem
            label="Close"
            shortcut={`${CMD_KEY}+Opt+W`}
            onClick={() => {
              if (focusedAppId) closeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuDivider />
          <MenuItem
            label="Center Window"
            shortcut={`${CMD_KEY}+Opt+C`}
            onClick={() => {
              if (focusedAppId) centerWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
        </MenuButton>
      </div>

      {/* Right: Display + Clock */}
      <div className="flex shrink-0 items-stretch gap-1 md:gap-2">
        <div className="relative flex items-center">
          <DisplayButton
            isOpen={openMenu === "brightness"}
            onClick={() => setOpenMenu(openMenu === "brightness" ? null : "brightness")}
          />
          {openMenu === "brightness" && (
            <BrightnessPopover onClose={() => setOpenMenu(null)} />
          )}
        </div>

        <span
          className="flex items-center whitespace-nowrap text-[11.5px]"
          style={{ color: "var(--color-menubar-text)" }}
        >
          <span className="md:hidden">{clock.time}</span>
          <span className="hidden md:inline">{clock.full}</span>
        </span>
      </div>
    </div>
  );
}

function MenuButton({
  label,
  isOpen,
  onClick,
  onHoverOpen,
  anyMenuOpen,
  className,
  bold,
  children,
}: {
  label: string;
  isOpen: boolean;
  onClick: () => void;
  onHoverOpen: () => void;
  anyMenuOpen: boolean;
  className?: string;
  bold?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  // Hover is always light beige (works in both themes since the menu bar
  // is always beige). Open state stays dark brown + white.
  const bg = isOpen
    ? "var(--color-button-dark)"
    : hover
    ? "var(--color-menubar-hover)"
    : "transparent";
  const fg = isOpen ? "#ffffff" : "var(--color-menubar-text)";
  return (
    <div className={`relative flex items-center ${className ?? ""}`}>
      <button
        className="px-2.5 py-1 text-[12.5px] transition-colors"
        style={{
          background: bg,
          color: fg,
          fontWeight: bold ? 600 : 500,
        }}
        onMouseEnter={() => {
          setHover(true);
          // Auto-switch: if any menu is already open and it's not this one, open this one
          if (anyMenuOpen && !isOpen) {
            onHoverOpen();
          }
        }}
        onMouseLeave={() => setHover(false)}
        onClick={onClick}
      >
        {label}
      </button>
      {isOpen && (
        <div
          className="menu-dropdown absolute left-0 top-full mt-0 min-w-[180px] border"
          style={{
            background: "var(--color-surface-solid)",
            borderColor: "var(--color-border-strong)",
            padding: "4px 0",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="flex w-full items-center justify-between px-3 py-1 text-left text-[11.5px] transition-colors"
      style={{
        color: disabled ? "var(--color-text-dim)" : "var(--color-text)",
        cursor: disabled ? "default" : "pointer",
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--color-button-dark)";
          e.currentTarget.style.color = "#ffffff";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-text)";
        }
      }}
    >
      {label}
      {shortcut && (
        <span className="ml-5 text-[10px]" style={{ color: "inherit", opacity: 0.6 }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="mx-2 my-0.5 h-px" style={{ background: "var(--color-border)" }} />;
}

/**
 * Brightness / Display button — sized and styled like File / View / Portfolio.
 * Transparent by default, light cream on hover, dark brown when open.
 * Icon is a sun.
 */
function DisplayButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  // Hover always light beige; open state dark brown + white (same as other menu buttons)
  const bg = isOpen
    ? "var(--color-button-dark)"
    : hover
    ? "var(--color-menubar-hover)"
    : "transparent";
  const iconColor = isOpen ? "#ffffff" : "var(--color-menubar-text)";
  return (
    <button
      className="flex h-[26px] w-[26px] items-center justify-center transition-colors"
      style={{ background: bg }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      aria-label="Display settings"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke={iconColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  );
}
