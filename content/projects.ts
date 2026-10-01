import type { Project } from "@/lib/types";

export const projects: Project[] = [
  {
    id: "tradefly",
    title: "Tradefly",
    description:
      "A fly-brain paper-trading experiment. Two simulated fruit-fly brains turn market inputs into buy, sell, or hold decisions, with a desktop interface for inspecting neural activity, account history, and the evidence behind each trade. Paper trading only; profitability has not been established.",
    tags: ["Next.js", "TypeScript", "Python", "Brian2", "Three.js", "Alpaca"],
    role: "Solo",
    category: "Personal",
    year: "2026",
    startDate: "Sep 2026",
    endDate: "Sep 2026",
    github: "https://github.com/DocMorphic/tradefly",
    link: "https://papertradefly.vercel.app/",
  },
  {
    id: "aliquot",
    title: "Aliquot",
    description:
      "An AI-powered experiment planner that turns plain-language scientific hypotheses into operational experiment plans — protocols with citations, verified reagent catalog numbers, equipment lists, budgets, timelines, and per-claim confidence scores. Built on a desktop-OS interface where each experiment is its own workspace.",
    tags: ["Next.js", "Claude AI", "Supabase", "Tavily"],
    role: "Solo",
    category: "Personal",
    year: "2026",
    startDate: "Apr 2026",
    endDate: "Apr 2026",
    github: "https://github.com/DocMorphic/aliquot",
    link: "https://aliquot-pi.vercel.app",
  },
  {
    id: "hashi",
    title: "Hashi",
    description:
      "A web-based Hashiwokakero logic puzzle. Implements graph-based algorithms for bridge validation and puzzle-solving. Built in TypeScript + React + CSS3, deployed on Vercel.",
    tags: ["TypeScript", "React", "CSS3", "Graph Algorithms"],
    role: "Solo",
    category: "Personal",
    year: "2025",
    startDate: "Feb 2025",
    endDate: "Feb 2025",
    link: "https://hashiii.vercel.app",
  },
  {
    id: "framed",
    title: "Framed",
    description:
      "A competitive PvP arena fighter with a unique \"window-based\" environmental mechanic and fast-paced combat logic. Built from scratch in GDScript, Godot, and Blender with custom physics and collision detection.",
    tags: ["Godot", "GDScript", "Blender", "Game Design"],
    role: "Solo",
    category: "Personal",
    year: "2026",
    startDate: "Feb 2026",
    endDate: "Now",
  },
  {
    id: "portfolio",
    title: "Portfolio",
    description:
      "This site. A desktop-OS-style portfolio with draggable windows, a working terminal, file explorer, site stats dashboard, and full theming. Built with Next.js 16, React 19, Tailwind 4, and a Supabase analytics backend.",
    tags: ["Next.js", "React", "TypeScript", "Tailwind", "Supabase"],
    role: "Solo",
    category: "Personal",
    year: "2026",
    startDate: "May 2026",
    endDate: "Now",
    github: "https://github.com/DocMorphic/portfolio",
  },
  {
    id: "pyra",
    title: "Pyra",
    description:
      "A digital-twin O&M console for utility-scale solar plants. Doesn't just detect underperformance — explains it, quantifies the euros lost (curtailment-adjusted), and turns each finding into an actionable maintenance ticket. Built around a per-inverter ML model that learns each unit's healthy behavior and a Claude-powered Copilot grounded on validated analytics.",
    tags: ["Next.js 16", "Python", "scikit-learn", "Claude Sonnet 4.6", "pvlib", "DuckDB"],
    role: "Solo (Hackathon)",
    category: "Personal",
    year: "2026",
    startDate: "Jun 2026",
    endDate: "Jun 2026",
    github: "https://github.com/DocMorphic/pyra",
  },
];
