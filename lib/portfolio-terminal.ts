export const TERMINAL_SECTIONS = ["home", "work", "about", "resume", "blogs", "photos", "contact"] as const;
export type TerminalSection = typeof TERMINAL_SECTIONS[number];
export type TerminalRoute = { section: TerminalSection; item?: string };
export type TerminalCommand = { route: TerminalRoute } | { action: "help" | "clear" | "exit" } | { error: string };
/** Numbers address rows in the current view, never the unrelated footer tabs. */
export function terminalRowIndex(raw:string,count:number):number|null{
  if(!/^0*[1-9]\d*$/.test(raw.trim()))return null;
  const index=Number(raw.trim())-1;
  return Number.isSafeInteger(index)&&index<count?index:null;
}

export function resolveTerminalCommand(raw: string, projects: readonly string[], folders: readonly string[]): TerminalCommand {
  const command = raw.trim().toLowerCase();
  if (["help", "?", "man"].includes(command)) return { action: "help" };
  if (["exit", "logout", "desktop"].includes(command)) return { action: "exit" };
  if (command === "clear") return { action: "clear" };
  const path = command.replace(/^(?:cd|cat|open|ls)\s+/, "").replace(/^\/?(?:home\/dharmay\/)?/, "").replace(/\/$/, "").replace(/\.(?:txt|md|app)$/, "");
  const aliases: Record<string, TerminalSection> = { "": "home", "~": "home", "/": "home", "..": "home", ls: "work", projects: "work", experience: "resume", education: "resume", whoami: "about", blog: "blogs", photography: "photos", email: "contact" };
  if (Object.hasOwn(aliases, path)) return { route: { section: aliases[path] } };
  if ((TERMINAL_SECTIONS as readonly string[]).includes(path)) return { route: { section: path as TerminalSection } };
  const project = path.replace(/^(?:projects|work)\//, "");
  if (projects.includes(project)) return { route: { section: "work", item: project } };
  const folder = path.replace(/^photos\//, "");
  if (folders.includes(folder)) return { route: { section: "photos", item: folder } };
  return { error: `Not found: ${raw.trim().slice(0, 100)}. Type help for commands.` };
}
