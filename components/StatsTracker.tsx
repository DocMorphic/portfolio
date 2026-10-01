"use client";

import { useEffect } from "react";

// Persistent browser-scoped visitor ID. Lives in localStorage so a given
// device maps to the same UUID across tabs, refreshes, and days — which
// is what "unique visitor" actually means in analytics land.
const VISITOR_KEY = "portfolio:visitor-id";
// Records the YYYY-MM-DD we last tracked for this device. Skip tracking
// again if the date already matches today. Net effect: 1 page view per
// visitor per day. Refresh in the same tab → no dupe. Next day → counted.
const TRACKED_DATE_KEY = "portfolio:tracked-date";

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}

function todayIso(): string {
  // Use the visitor's local date, not UTC — a visitor in Munich at 00:30
  // should not be double-counted just because UTC still thinks it's
  // yesterday. This matches how the Site Stats "Today" column will feel
  // to whoever is reading it.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fires a POST to /api/stats/track on mount.
 *
 * Dedupes per (visitor, day) — one row per visitor per calendar day.
 * Same visitor refreshing or bouncing around within a day → no extra
 * rows. Same visitor coming back tomorrow → fresh row, unique count
 * stays stable.
 */
export function StatsTracker() {
  useEffect(() => {
    try {
      const today = todayIso();
      if (localStorage.getItem(TRACKED_DATE_KEY) === today) return;

      const visitorId = getOrCreateVisitorId();
      if (!visitorId) return;

      fetch("/api/stats/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // API field name stays `sessionId` for backward compat with
          // existing rows and the track endpoint. Semantically this is
          // now a persistent visitor ID, not a per-tab session ID.
          sessionId: visitorId,
          path: window.location.pathname,
        }),
      })
        .then((res) => {
          if (res.ok) localStorage.setItem(TRACKED_DATE_KEY, today);
        })
        .catch(() => {
          // silent — tracking failures shouldn't break the site
        });
    } catch {
      // localStorage blocked (private mode on some browsers) — ignore
    }
  }, []);

  return null;
}
