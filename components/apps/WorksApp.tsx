"use client";

import { projects } from "@/content/projects";
import { useWindowManager } from "@/hooks/use-window-manager";

// Map "Sept 2025" / "Nov 2024" / "Now" into a number of months since Jan of START_YEAR
const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sept: 8, sep: 8, oct: 9, nov: 10, dec: 11,
};
const START_YEAR = 2025;
const END_YEAR = 2027;
const TOTAL_MONTHS = (END_YEAR - START_YEAR + 1) * 12; // 36 — 2025, 2026, 2027
const YEARS = Array.from(
  { length: END_YEAR - START_YEAR + 1 },
  (_, i) => START_YEAR + i
);

// Month offset → CSS percent across the timeline. All positioning is
// percent-based so the Gantt fills whatever container width the Works
// window gives it — no horizontal scroll, no dead space on the right.
const pct = (months: number) => `${(months / TOTAL_MONTHS) * 100}%`;

function toMonthIndex(dateStr: string): number {
  if (dateStr.toLowerCase() === "now") {
    const now = new Date();
    return Math.max(0, (now.getFullYear() - START_YEAR) * 12 + now.getMonth());
  }
  const parts = dateStr.trim().split(/\s+/);
  const month = MONTH_NAMES[parts[0].toLowerCase().replace(".", "")] ?? 0;
  const year = parseInt(parts[1] || String(START_YEAR), 10);
  return (year - START_YEAR) * 12 + month;
}

export function WorksApp() {
  const { openWindow } = useWindowManager();
  const todayIndex = toMonthIndex("Now");

  return (
    <div className="flex flex-col gap-5">
      {/* Heading */}
      <div>
        <h1 className="font-serif-heading text-[30px] leading-none" style={{ color: "var(--color-text)" }}>
          Works
        </h1>
        <p className="mt-3 text-[12.5px] leading-[1.55]" style={{ color: "var(--color-text-secondary)" }}>
          Explore selected projects with timelines, stack choices, and delivery outcomes. This view includes company and freelance examples in a horizontal timeline display.
        </p>
      </div>

      {/* PROJECT LIST card */}
      <div className="border" style={{ borderColor: "var(--color-border-hover)" }}>
        <div
          className="border-b px-4 py-2.5"
          style={{
            background: "var(--color-surface-alt)",
            borderColor: "var(--color-border-hover)",
          }}
        >
          <span className="text-[10.5px] font-semibold tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            PROJECT LIST
          </span>
        </div>
        <div>
          {projects.map((p, i) => (
            <button
              key={p.id}
              className={`block w-full cursor-pointer px-4 py-2 text-left text-[12.5px] transition-colors hover:bg-[var(--color-surface-hover)] ${
                i !== projects.length - 1 ? "border-b" : ""
              }`}
              style={{ borderColor: "var(--color-border-hover)", color: "var(--color-text)" }}
              onClick={() => openWindow("project-detail", { projectId: p.id, projectSlide: 0 })}
            >
              <span className="font-semibold">{p.title}</span>
              <span style={{ color: "var(--color-text-muted)" }}>
                {" "}· {p.role} · {p.startDate} – {p.endDate} · {p.category}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* TIMELINE card — fixed names column + percent-based grid that
          fills the available width. */}
      <TimelineCard todayIndex={todayIndex} />
    </div>
  );
}

// Timeline visual constants — vertical metrics stay in pixels, horizontal
// positioning is percent-based via the pct() helper.
const NAMES_WIDTH = 120; // px — fixed left column for project titles
const HEADER_H = 32;     // px — year header row
const ROW_H = 34;        // px — each project row
const BAR_H = 22;        // px — project bar inside each row

function TimelineCard({ todayIndex }: { todayIndex: number }) {
  const { openWindow } = useWindowManager();
  return (
    <div className="border" style={{ borderColor: "var(--color-border-hover)" }}>
      {/* Card header */}
      <div
        className="border-b px-4 py-2.5"
        style={{
          background: "var(--color-surface-alt)",
          borderColor: "var(--color-border-hover)",
        }}
      >
        <span
          className="text-[10.5px] font-semibold tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          TIMELINE ({START_YEAR}–{END_YEAR})
        </span>
      </div>

      <div className="flex">
        {/* LEFT: fixed names column */}
        <div
          className="shrink-0 border-r"
          style={{ width: NAMES_WIDTH, borderColor: "var(--color-border-hover)" }}
        >
          {/* Names header — matches year header height */}
          <div
            className="flex items-center border-b px-3"
            style={{
              height: HEADER_H,
              borderColor: "var(--color-border-hover)",
              background: "var(--color-surface-alt)",
            }}
          >
            <span
              className="text-[10px] font-semibold tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              PROJECTS
            </span>
          </div>
          {projects.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center px-3 ${
                i !== projects.length - 1 ? "border-b" : ""
              }`}
              style={{
                height: ROW_H,
                borderColor: "var(--color-border-hover)",
              }}
            >
              <span className="truncate text-[11px]" style={{ color: "var(--color-text)" }}>
                {p.title}
              </span>
            </div>
          ))}
        </div>

        {/* RIGHT: percent-based timeline that fills the remaining width.
            Year labels, grid lines, today marker and bars are all
            positioned in % of TOTAL_MONTHS. */}
        <div className="relative flex-1 overflow-hidden">
          {/* Year header row */}
          <div
            className="relative border-b"
            style={{
              height: HEADER_H,
              borderColor: "var(--color-border-hover)",
              background: "var(--color-surface-alt)",
            }}
          >
            {YEARS.map((year, i) => (
              <span
                key={year}
                className="absolute top-1/2 -translate-y-1/2 text-[10.5px] font-semibold tracking-wider"
                style={{
                  color: "var(--color-text-muted)",
                  left: `calc(${pct(i * 12)} + 8px)`,
                }}
              >
                {year}
              </span>
            ))}
          </div>

          {/* Rows (bars) + vertical grid lines */}
          <div className="relative">
            {/* Year boundary lines — every 12 months, skipping the 0 edge */}
            {YEARS.slice(1).map((_, idx) => {
              const i = idx + 1;
              return (
                <div
                  key={`y-${i}`}
                  className="pointer-events-none absolute top-0 bottom-0 w-px"
                  style={{
                    left: pct(i * 12),
                    background: "var(--color-border-hover)",
                  }}
                />
              );
            })}

            {/* Quarter boundary lines — subtler, skipping year boundaries */}
            {Array.from(
              { length: Math.floor((TOTAL_MONTHS - 1) / 3) },
              (_, i) => (i + 1) * 3
            )
              .filter((m) => m % 12 !== 0 && m < TOTAL_MONTHS)
              .map((m) => (
                <div
                  key={`q-${m}`}
                  className="pointer-events-none absolute top-0 bottom-0 w-px"
                  style={{
                    left: pct(m),
                    background: "var(--color-border)",
                    opacity: 0.6,
                  }}
                />
              ))}

            {/* Today marker line */}
            <div
              className="pointer-events-none absolute top-0 bottom-0"
              style={{
                left: pct(todayIndex),
                width: "2px",
                background: "var(--color-accent)",
                opacity: 0.85,
                zIndex: 2,
              }}
            />
            {/* Today label pinned to top of the marker */}
            <div
              className="pointer-events-none absolute"
              style={{
                left: pct(todayIndex),
                top: 2,
                transform: "translateX(-50%)",
                background: "var(--color-tag-bg)",
                color: "var(--color-accent)",
                fontSize: "9.5px",
                padding: "1px 6px",
                border: "1px solid var(--color-accent)",
                zIndex: 3,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              Today
            </div>

            {projects.map((p, i) => {
              const start = toMonthIndex(p.startDate || `Jan ${START_YEAR}`);
              const end = toMonthIndex(p.endDate || "Now");
              // Instant projects (start === end) still get a full-month
              // worth of visible width — reads as "this happened here"
              // rather than a pinprick next to a multi-month bar.
              const durationMonths = Math.max(1, Math.abs(end - start));

              return (
                <div
                  key={p.id}
                  className={`relative ${
                    i !== projects.length - 1 ? "border-b" : ""
                  }`}
                  style={{
                    height: ROW_H,
                    borderColor: "var(--color-border-hover)",
                  }}
                >
                  <button
                    className="absolute cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      left: pct(Math.min(start, end)),
                      top: (ROW_H - BAR_H) / 2,
                      width: pct(durationMonths),
                      height: BAR_H,
                      background: "var(--color-button-dark)",
                      opacity: 0.6,
                      zIndex: 1,
                    }}
                    onClick={() => openWindow("project-detail", { projectId: p.id, projectSlide: 0 })}
                    aria-label={`View ${p.title} details`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
