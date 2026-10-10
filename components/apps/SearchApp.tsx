"use client";

import { useEffect, useRef, useState } from "react";
import { useWindowManager } from "@/hooks/use-window-manager";
import { useTheme } from "@/hooks/use-theme";

// Keyword → action map. First entry whose keywords match the query wins.
// Priority matters — more specific intents go first.
interface SearchIntent {
  keywords: string[];
  appId: string;
  message: string;
}

const INTENTS: SearchIntent[] = [
  {
    keywords: ["llm", "ai", "robot", "prompt"],
    appId: "terminal",
    message:
      "Try the hidden llm.txt — there's a secret sequence on the desktop. Opened terminal while you figure it out.",
  },
  {
    keywords: ["game", "snake", "play", "rps", "hangman", "guess"],
    appId: "terminal",
    message:
      "Games live inside the terminal. Type 'game' for snake, 'rps', 'hangman', or 'guess'.",
  },
  {
    keywords: [
      "hello",
      "hi",
      "hey",
      "who",
      "bio",
      "about",
      "yourself",
      "dharmay",
      "intro",
      "wes",
    ],
    appId: "about",
    message: "Opened About to tell you who Dharmay is.",
  },
  {
    keywords: [
      "work",
      "project",
      "portfolio",
      "ship",
      "build",
      "lighthouse",
      "hashi",
      "tradefly",
      "framed",
      "freelance",
    ],
    appId: "works",
    message: "Opened Works — here's what Dharmay has been building.",
  },
  {
    keywords: [
      "experience",
      "career",
      "job",
      "history",
      "resume",
      "cv",
      "role",
      "intern",
    ],
    appId: "experience",
    message: "Opened the Experience timeline.",
  },
  {
    keywords: ["blog", "post", "writing", "article", "read", "link"],
    appId: "blog",
    message:
      "Opened Blog — you can even drop a cool link and it'll show up for everyone.",
  },
  {
    keywords: [
      "contact",
      "email",
      "reach",
      "message",
      "dm",
      "hire",
      "form",
      "talk",
    ],
    appId: "contact",
    message: "Opened Contact — send Dharmay a message.",
  },
  {
    keywords: ["terminal", "command", "cli", "shell"],
    appId: "terminal",
    message: "Opened the terminal. Type 'help' to see every command.",
  },
  {
    keywords: [
      "setting",
      "theme",
      "dark",
      "light",
      "accent",
      "display",
      "color",
      "colour",
      "mode",
    ],
    appId: "settings",
    message: "Opened Settings — tweak the look of the place.",
  },
  {
    keywords: ["help", "shortcut", "key", "keyboard", "how", "guide"],
    appId: "help",
    message: "Opened Help — here are the shortcuts.",
  },
  {
    keywords: ["stat", "visit", "analytics", "view", "tracker", "count"],
    appId: "stats",
    message: "Opened the Site Stats dashboard.",
  },
  {
    keywords: ["germany", "berlin", "munich", "deutschland", "german"],
    appId: "folder-germany",
    message: "Opened the Germany folder.",
  },
  {
    keywords: ["austria", "salzburg", "vienna", "wien"],
    appId: "folder-austria",
    message: "Opened the Austria folder.",
  },
  {
    keywords: ["india", "gujarat", "rajkot", "home", "indian"],
    appId: "folder-india",
    message: "Opened the India folder.",
  },
  {
    keywords: ["buildlog", "build-log", "log"],
    appId: "build-log-md",
    message: "Opened build-log.md.",
  },
];

function matchIntent(query: string): SearchIntent | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const words = q.split(/\s+/);
  for (const intent of INTENTS) {
    for (const kw of intent.keywords) {
      // Match if any keyword appears as a substring OR as a word
      if (q.includes(kw) || words.includes(kw)) return intent;
    }
  }
  return null;
}

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { openWindow, closeWindow, setWindowContext } = useWindowManager();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const q = query.trim();
    if (!q || submitting) return;
    setSubmitting(true);
    const intent = matchIntent(q) ?? {
      appId: "about",
      message:
        "Couldn't pin down exactly what you meant. Opened About as a starting point — try more specific words like 'projects', 'contact', or 'photos'.",
      keywords: [],
    };

    // Short delay so the submission feels like it's "thinking"
    window.setTimeout(() => {
      openWindow(intent.appId);
      openWindow("search-result");
      setWindowContext("search-result", {
        searchMessage: intent.message,
        searchQuery: q,
      });
      closeWindow("search");
    }, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      closeWindow("search");
    }
  };

  return (
    <div className="-mx-5 -my-4 flex h-[calc(100%+32px)] flex-col">
      <div className="relative flex flex-1 flex-col px-5 py-4">
        <textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting}
          className="custom-scrollbar min-h-0 flex-1 resize-none bg-transparent pr-14 text-[15px] leading-[1.5] outline-none"
          style={{
            color: "var(--color-text)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          }}
          placeholder="What do you want to know or to go to? Ask anything or go to anywhere you want"
          rows={3}
          autoFocus
        />

        {/* Submit button — bottom-right */}
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !query.trim()}
          className="absolute bottom-4 right-5 flex h-9 w-9 items-center justify-center border-2 transition-colors disabled:opacity-40"
          style={{
            background: submitting
              ? "var(--color-button-dark-hover)"
              : "var(--color-button-dark)",
            borderColor: "var(--color-border-strong)",
            color: "#ffffff",
          }}
          aria-label="Submit search"
        >
          {submitting ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 10 4 15 9 20" />
              <path d="M20 4v7a4 4 0 0 1-4 4H4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SearchResultApp — the "Search action complete" toast window that pops
// up next to whatever the search dispatched.
// ──────────────────────────────────────────────────────────────────────

export function SearchResultApp() {
  const { windowContexts } = useWindowManager();
  const ctx = windowContexts["search-result"];
  const message =
    ctx?.searchMessage ?? "Nothing to report. Search something from the search window.";

  return (
    <div className="flex h-full flex-col">
      <p
        className="text-[13px] leading-[1.55]"
        style={{ color: "var(--color-text)" }}
      >
        {message}
      </p>
    </div>
  );
}
