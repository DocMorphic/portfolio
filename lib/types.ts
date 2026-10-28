export type ThemeMode = "dark" | "light";
export type AccentColor = "orange" | "green" | "blue" | "purple";

export interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  brightness: number;
  wallpaperId: string;
  customWallpaperUrl: string | null;
}

export interface WindowState {
  appId: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  // Saved bounds to restore when the user toggles maximize off
  preMaxPosition?: { x: number; y: number };
  preMaxSize?: { width: number; height: number };
}

export interface AppDefinition {
  id: string;
  title: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultX: number;
  defaultY: number;
  showInExplorer: boolean;
  showInTaskbar: boolean;
}

export interface FileTreeNode {
  id: string;
  name: string;
  type: "file" | "folder" | "app" | "image";
  appId?: string;
  children?: FileTreeNode[];
  src?: string;
  content?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  tags: string[];
  role?: string;
  category?: string;
  link?: string;
  github?: string;
  image?: string;
  year: string;
  startDate?: string;
  endDate?: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  companyUrl?: string;
  role: string;
  employmentType?: string;
  location?: string;
  locationType?: string;
  startDate: string;
  endDate: string;
  duration?: string;
  description: string;
  tags: string[];
}

export interface BlogPost {
  id: string;
  title: string;
  date: string;
  readingTime: string;
  description: string;
  tags: string[];
  slug: string;
}

export interface TerminalLine {
  type: "input" | "output" | "error";
  content: string;
}
