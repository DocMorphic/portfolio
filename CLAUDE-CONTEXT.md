# Portfolio — Claude session brief

A condensed onboarding for a Claude Code session starting work in this repo. Read this once before touching code. The standing `AGENTS.md` rule still applies on top.

## What this is

A personal portfolio site with a **"desktop OS" UI metaphor** — a wallpaper, a taskbar, a menu bar, and resizable "windows" that each render an "app" (About, Works, Blog, Terminal, Settings, etc.). Content is authored as typed TypeScript files; there's no CMS and no database.

- **Stack:** Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript
- **Backend:** 4 Next route handlers (`app/api/{blogs,contact,fetch-title,stats}/route.ts`) backed by file stores in `lib/`. No DB, no auth.
- **Remote:** `github.com/DocMorphic/portfolio.git` · current branch: `main`

## Hard rules — read before writing any code

### 1. This is Next.js 16, not the Next.js in your training data

The repo's `AGENTS.md` flags it explicitly. Before changing anything Next-specific (route handlers, server components, async `params`, dynamic functions, `fetch` cache semantics, fonts, `next/image`, metadata, middleware, `revalidate`, `cookies()`/`headers()`), open the relevant page under `node_modules/next/dist/docs/` and confirm the current API. Do not assume `app/`-router patterns from older versions.

### 2. Tailwind is v4 — CSS-first

- There is **no** `tailwind.config.js`/`.ts`. Theme tokens, custom utilities, screens, and content scanning live in `app/globals.css` via `@theme`, `@layer`, `@source`. Do not generate a JS config file.
- Plugin authoring uses the v4 API. Don't suggest legacy `@tailwindcss/forms` etc. without confirming v4 support.

### 3. No shadcn/ui — components are hand-rolled

There is no `components/ui/` and no `components.json`. Building blocks live in:

- `components/desktop/` — `Desktop`, `Wallpaper`, `Taskbar`, `MenuBar`, `BootScreen`, `DesktopIcons`, `BrightnessPopover`
- `components/window/` — `Window`, `WindowTitleBar`, `WindowContent`
- `components/apps/` — one component per "OS app" (`AboutApp`, `WorksApp`, `BlogApp`, `TerminalApp`, `SettingsApp`, `ContactApp`, `ExperienceApp`, `PhotoGalleryApp`, `SiteStatsApp`, `SearchApp`, `HelpApp`, `TextEditorApp`, `ImageViewerApp`, `ProjectDetailApp`)

Do not add shadcn/Radix unless the user explicitly asks.

## Project shape

```
app/
  layout.tsx        page.tsx        globals.css   # Tailwind v4 @theme is here
  api/              # blogs, contact, fetch-title, stats
components/
  desktop/  window/  apps/
content/            # Source of truth for everything the user sees
  projects.ts          # Cards on the Works app
  project-details.ts   # Modal/window detail per project
  blog-posts.ts
  experience.ts
  about.ts  help.ts  text-files.ts  folder-files.ts
hooks/              # custom React hooks
lib/
  blogs-store.ts  stats-store.ts  email.ts  wallpapers.ts  constants.ts  types.ts
public/             # screenshots and static assets
```

## Conventions to follow

- **Adding a project** → entry in `content/projects.ts` and (optional) detail in `content/project-details.ts`. Screenshots go in `public/`.
- **Adding a blog post** → entry in `content/blog-posts.ts`. The `/api/blogs` route serves them; state goes through `lib/blogs-store.ts`.
- **Adding a new "app"** → a component in `components/apps/`, then register it wherever the Desktop/Taskbar enumerates apps (search the repo — there's a single registry). Window chrome is reused via `components/window/`.
- **State** → file-based stores in `lib/*.ts`. Don't reach for Prisma/Convex/Drizzle/Supabase.
- **Imports** → use the existing alias (`@/components/...`, `@/lib/...`, `@/content/...`) consistent with `tsconfig.json`.
- **a11y matters** — windows are custom widgets. Focus management, ARIA roles, Esc-to-close, keyboard reachability for taskbar/menu items are easy to break. Test with the keyboard before declaring a UI change "done".

## What's out of scope unless explicitly asked

- Auth, database, real-time, CMS migration, i18n, monorepo splitting, design-system extraction.

## Working loop

1. `git status` to see what's in flight; read `git log --oneline -10` for recent direction.
2. Confirm Next 16 / Tailwind v4 idioms against the local docs / `app/globals.css` before drafting code.
3. For any change that touches a "Window" or "App" component, verify keyboard behavior in the running app, not just the diff.
4. Run `pnpm dev` and validate in the browser. If you can't, say so in the final report.

## Commands

```
pnpm dev          # next dev (port 3000)
pnpm build        # next build
pnpm lint         # eslint
```

## Optional skills to install (none required)

The user has the `skills` CLI installed (`pnpm dlx skills ...`). Skills that would help here:

- **`nextjs`** — auto-loads relevant pages from `node_modules/next/dist/docs/` before Next-specific edits.
- **`tailwindcss`** — codifies v4-specific idioms.
- **`accessibility`** or **`a11y`** — guides ARIA for custom dialog/window patterns.
- **`seo`** / **`open-graph`** — per-route metadata, sitemap, OG images.

Browse and install à la carte:

```
pnpm dlx skills search nextjs
pnpm dlx skills add <name>
```

Do **not** clone a kitchen-sink agent harness (e.g. ECC) into this repo. The point is to keep the configuration small and self-explanatory.

## File you're reading

`CLAUDE-CONTEXT.md` — drop-in brief written for sessions like this. If you change conventions or stack, update this file in the same PR so the next session inherits the truth.
