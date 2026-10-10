"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { aboutData } from "@/content/about";
import { projects } from "@/content/projects";
import { PROJECT_DETAILS } from "@/content/project-details";
import { experience, education } from "@/content/experience";
import { FOLDER_CONTENTS } from "@/content/folder-files";
import { BlogApp } from "@/components/apps/BlogApp";
import { ContactApp } from "@/components/apps/ContactApp";
import { AboutSocialLinks } from "@/components/AboutSocialLinks";
import { resolveTerminalCommand, terminalRowIndex, TERMINAL_SECTIONS, type TerminalRoute } from "@/lib/portfolio-terminal";
import type { ExperienceEntry } from "@/lib/types";

const HELP = "home · work · about · resume · blogs · photos · contact\nopen <project>   cat about.txt   cd photos/germany\n1–9 select a visible list row · type a row number + Enter\n↑ ↓ history   Tab complete   clear   exit / Esc";
const projectIds = projects.map(project => project.id);
const folderIds = Object.keys(FOLDER_CONTENTS);
const completions = [...TERMINAL_SECTIONS, ...projectIds, ...folderIds, "help", "clear", "exit"];

function Timeline({ entries }: { entries: ExperienceEntry[] }) {
  return <div className="ct-timeline">{entries.map(entry => <article key={entry.id}>
    <span className="ct-meta">{entry.startDate} — {entry.endDate}</span>
    <h3>{entry.role}</h3><p className="ct-accent">{entry.company}</p>
    <p>{entry.description}</p><div className="ct-tags">{entry.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
  </article>)}</div>;
}

export function ComputerTerminal({ onExit, autoFocus = true, initialSection = "home", initialFolder, initialPhoto=null, onNavigateSection }: { onExit(): void; autoFocus?: boolean; initialSection?: TerminalRoute["section"];initialFolder?:string;initialPhoto?:number|null;onNavigateSection?:(section:TerminalRoute["section"])=>void }) {
  const commandId=useId();
  const [route, setRoute] = useState<TerminalRoute>({ section: initialSection,item:initialFolder });
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draft = useRef("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [photo, setPhoto] = useState<number | null>(initialPhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const output = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const chooseRow=useCallback((raw:string)=>{
    const rows=output.current?.querySelectorAll<HTMLElement>("[data-terminal-row]");
    const index=terminalRowIndex(raw,rows?.length??0);
    if(index===null||!rows)return false;
    rows[index].click();rows[index].scrollIntoView({block:"nearest",behavior:"smooth"});return true;
  },[]);
  useEffect(()=>{
    const choose=(event:KeyboardEvent)=>{
      const region=output.current;
      if(!region||region.closest("[inert]")||!region.getClientRects().length)return;
      if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
      if(event.target instanceof HTMLElement&&(event.target.isContentEditable||event.target.closest("input,textarea,select")))return;
      if(/^[1-9]$/.test(event.key)&&chooseRow(event.key)){event.preventDefault();event.stopPropagation();}
    };
    document.addEventListener("keydown",choose,true);
    return()=>document.removeEventListener("keydown",choose,true);
  },[chooseRow]);
  useEffect(() => {
    // Don't summon a phone's software keyboard over the newly revealed screen.
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const navigate = (next: TerminalRoute) => {
    if(onNavigateSection&&next.section!==route.section&&!next.item){onNavigateSection(next.section);return;}
    setRoute(next); setResponse(""); setPhoto(null);
    output.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };
  const run = () => {
    if (!input.trim()) return;
    if(chooseRow(input)){setHistory(prev=>[input,...prev].slice(0,50));setInput("");setHistoryIndex(-1);draft.current="";return;}
    const result = resolveTerminalCommand(input, projectIds, folderIds);
    setHistory(prev => [input, ...prev].slice(0, 50)); setHistoryIndex(-1); setInput(""); draft.current = "";
    if ("route" in result) navigate(result.route);
    else if ("error" in result) setResponse(result.error);
    else if (result.action === "exit") onExit();
    else setResponse(result.action === "help" ? HELP : "");
    // Command entry remains ready for another command; clicked navigation moves
    // reading focus to the heading instead.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };
  const project = route.section === "work" ? projects.find(item => item.id === route.item) : undefined;
  const detail = project ? PROJECT_DETAILS[project.id] : undefined;
  const folder = route.section === "photos" && route.item ? FOLDER_CONTENTS[route.item] : undefined;
  const photos = folder?.items.filter(item => item.type === "image" && item.src) ?? [];
  const path = route.section === "home" ? "~" : `~/${route.section}${route.item ? `/${route.item}` : ""}`;

  return <section className="computer-terminal" data-section={route.section} aria-label="Dharmay's secret portfolio terminal"
    onKeyDown={event => {
      // Desktop/global shortcuts must not consume keystrokes inside the CRT.
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); onExit(); }
    }}>
    <header className="ct-header"><div><b>DD_OS</b><span> / PERSONAL ARCHIVE</span></div><button type="button" onClick={onExit} aria-label="Exit terminal and return to computer">DISCONNECT ↗</button></header>
    <div className="ct-session"><span>GUEST SESSION / TTY-01</span><span>CONNECTION ESTABLISHED</span></div>
    <div ref={output} className="ct-output">
      <h2 ref={heading} tabIndex={-1} className="ct-command-heading"><span aria-hidden="true">$ </span>{route.section === "home" ? "whoami" : `ls ${path}`}</h2>

      {route.section === "home" && <div className="ct-home">
        <div className="ct-wordmark" aria-label="Dharmay Dave"><span>DHARMAY</span><span>DAVE<span className="ct-caret" aria-hidden="true">_</span></span></div>
        <p className="ct-lead">{aboutData.title}</p>
        <p>{aboutData.intro[0]}</p>
        <dl className="ct-facts"><div><dt>BASED IN</dt><dd>{aboutData.location}</dd></div><div><dt>BUILDING</dt><dd>AI systems, web products & games</dd></div><div><dt>STATUS</dt><dd>You found the other side.</dd></div></dl>
        <div className="ct-home-links"><button onClick={() => navigate({ section: "work" })}>[ EXPLORE WORK ]</button><button onClick={() => navigate({ section: "about" })}>[ ABOUT ME ]</button></div>
        <p className="ct-meta ct-hint">Click a module below or type <button onClick={() => setResponse(HELP)}>help</button>.</p>
      </div>}

      {route.section === "work" && !project && <>
        <h1>Selected work<span className="ct-count"> / {projects.length.toString().padStart(2, "0")}</span></h1>
        <p className="ct-meta">Open a file to inspect its stack, process and visuals.</p>
        <div className="ct-files">{projects.map((item, index) => <article key={item.id}>
          <button data-terminal-row={index+1} className="ct-file-toggle" aria-expanded={expanded === item.id} onClick={() => setExpanded(expanded === item.id ? null : item.id)}><span className="ct-meta">{String(index + 1).padStart(2, "0")}</span><b>{item.id}.app</b><span>{item.year}</span><span aria-hidden="true">{expanded === item.id ? "−" : "+"}</span></button>
          <p>{item.description}</p>
          {expanded === item.id && <div className="ct-file-details"><div className="ct-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div><p className="ct-meta">{item.role} / {item.startDate} — {item.endDate}</p><button className="ct-open" onClick={() => navigate({ section: "work", item: item.id })}>READ {item.title.toUpperCase()} ↗</button></div>}
        </article>)}</div>
      </>}

      {project && <>
        <button className="ct-back" onClick={() => navigate({ section: "work" })}>← /work</button>
        <h1>{project.title}</h1><p className="ct-lead">{project.description}</p>
        <dl className="ct-facts"><div><dt>ROLE</dt><dd>{project.role}</dd></div><div><dt>PERIOD</dt><dd>{project.startDate} — {project.endDate}</dd></div></dl>
        <h3 className="ct-section-title">TECH STACK</h3><div className="ct-tags">{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        {!!detail?.tasks.length && <><h3 className="ct-section-title">TASKS</h3><p>{detail.tasks.join(" / ")}</p></>}
        {detail?.sections.map(section => <section className="ct-prose" key={section.title}><h3 className="ct-section-title">{section.title}</h3><p>{section.content}</p></section>)}
        {detail?.diagram && <section className="ct-prose"><h3 className="ct-section-title">{detail.diagram.title}</h3><ol className="ct-flow">{detail.diagram.nodes.map(node => <li key={node}>{node}</li>)}</ol></section>}
        {!!detail?.visuals.length && <section className="ct-prose"><h3 className="ct-section-title">VISUALS</h3>{detail.visuals.map(visual => <figure key={visual.src}>
          {visual.type === "video" ? <video src={visual.src} controls playsInline preload="metadata" /> : <a href={visual.src} target="_blank" rel="noopener noreferrer" aria-label={`Open original: ${visual.caption ?? project.title}`}>
            {/* Original assets, without resizing or recompression. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={visual.src} alt={visual.caption ?? project.title} loading="lazy" />
          </a>}<figcaption>{visual.caption}</figcaption></figure>)}</section>}
        <h3 className="ct-section-title">REFERENCES</h3><div className="ct-reference-links">{(detail?.references ?? [{ label: "GitHub", href: project.github }, { label: "Live project", href: project.link }]).filter(link => link.href).map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div>
      </>}

      {route.section === "about" && <><h1>A little about me.</h1>{aboutData.intro.map(text => <p className="ct-prose" key={text}>{text}</p>)}<AboutSocialLinks onContact={() => navigate({section:"contact"})} /><h3 className="ct-section-title">CURRENT FOCUS</h3><ul className="ct-focus">{aboutData.currentFocus.map(text => <li key={text}>{text}</li>)}</ul></>}
      {route.section === "resume" && <><h1>Experience & education.</h1><h3 className="ct-section-title">EXPERIENCE</h3><Timeline entries={experience} /><h3 className="ct-section-title">EDUCATION</h3><Timeline entries={education} /></>}
      {route.section === "blogs" && <div className="ct-existing"><BlogApp numbered /></div>}
      {route.section === "contact" && <div className="ct-existing ct-contact"><ContactApp /></div>}
      {route.section === "photos" && !folder && <><h1>Field notes.</h1><p>Photographs and notes, from home and elsewhere.</p><div className="ct-files">{Object.entries(FOLDER_CONTENTS).map(([id, item],index) => <article key={id}><button data-terminal-row={index+1} className="ct-folder" onClick={() => navigate({ section: "photos", item: id })}>{String(index+1).padStart(2,"0")} [DIR] {item.label}<span>↗</span></button><p>{item.description}</p></article>)}</div></>}
      {folder && <><button className="ct-back" onClick={() => navigate({ section: "photos" })}>← /photos</button><h1>{folder.label}/</h1><p>{folder.description}</p>
        {photo === null ? <><p className="ct-notes">{folder.text.replace(/^# .*\n/, "")}</p><div className="ct-photo-grid">{photos.map((item, index) => <button data-terminal-row={index+1} key={item.src} onClick={() => { setPhoto(index); output.current?.scrollTo({ top: 0 }); }} aria-label={`View ${item.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.src} alt={item.name} loading="lazy" /><span>{String(index+1).padStart(2,"0")} {item.name}</span></button>)}</div></> : <><div className="ct-photo-controls"><button onClick={() => setPhoto(null)}>← All photos</button><button disabled={photo === 0} onClick={() => setPhoto(photo - 1)}>← Prev</button><button disabled={photo === photos.length - 1} onClick={() => setPhoto(photo + 1)}>Next →</button></div><figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[photo].src} alt={photos[photo].name} /><figcaption>{photos[photo].name} / {photo + 1} of {photos.length} <a href={photos[photo].src} target="_blank" rel="noopener noreferrer">Original ↗</a></figcaption></figure></>}
      </>}
    </div>
    {response && <pre className="ct-response" role="status">{response}</pre>}
    <form className="ct-prompt" onSubmit={event => { event.preventDefault(); run(); }}><label htmlFor={commandId}>dharmay@tram<span aria-hidden="true">:~$</span></label><input id={commandId} ref={inputRef} value={input} onChange={event => { setInput(event.target.value); setHistoryIndex(-1); }} placeholder="type help" aria-label="Portfolio terminal command" autoComplete="off" spellCheck={false} autoCapitalize="off" onKeyDown={event => {
      if (event.key === "ArrowUp") { event.preventDefault(); if (!history.length) return; if (historyIndex === -1) draft.current = input; const next = Math.min(historyIndex + 1, history.length - 1); setHistoryIndex(next); setInput(history[next]); }
      if (event.key === "ArrowDown") { event.preventDefault(); const next = Math.max(-1, historyIndex - 1); setHistoryIndex(next); setInput(next === -1 ? draft.current : history[next]); }
      if (event.key === "Tab" && input.trim()) { const options = completions.filter(item => item.startsWith(input.toLowerCase())); if (options.length) { event.preventDefault(); if (options.length === 1) setInput(options[0]); else setResponse(options.join("  ")); } }
    }} /><button type="submit" aria-label="Run command">↵</button></form>
    <nav className="ct-nav" aria-label="Terminal modules">{TERMINAL_SECTIONS.map((section, index) => <button key={section} aria-current={route.section === section ? "page" : undefined} onClick={() => navigate({ section })}><span>{String(index + 1).padStart(2, "0")}</span> {section}</button>)}</nav>
  </section>;
}
