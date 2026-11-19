"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon, type Tone } from "@/components/app-shell";
import { SEED_WORKS } from "@/lib/catalogue";
import { STATUSES, STORAGE_KEY, TYPES, createWork, exportWorks, filterWorks, importWorks, parseStoredWorks, restoreWork, setWorkStatus } from "@/lib/works";
import type { Status, Work, WorkDraft } from "@/lib/works";

const EMPTY_DRAFT: WorkDraft = { title: "", type: "UI/UX", tools: "", status: "Draft" };
const TONE: Record<Status, Tone> = { Draft: "grey", "In review": "amber", Approved: "green" };
type Filter = Status | "All";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `work-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Works mirrored to localStorage: the server render uses the seed, then the browser's saved list loads. */
function useWorks() {
  const [works, setWorks] = useState<Work[]>(SEED_WORKS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = parseStoredWorks(localStorage.getItem(STORAGE_KEY));
      // Hydrate browser-local entries after the server-rendered seed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setWorks(saved);
    } catch { /* storage blocked: keep seed */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(works)); } catch { /* storage full or blocked */ }
  }, [works, ready]);
  return [works, setWorks] as const;
}

export function DesignCatalogue() {
  const [works, setWorks] = useWorks();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<WorkDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState<{ work: Work; index: number } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wasComposing = useRef(false);

  const visible = useMemo(() => filterWorks(works, query).filter((work) => filter === "All" || work.status === filter), [works, query, filter]);
  const countOf = (value: Filter) => (value === "All" ? works.length : works.filter((work) => work.status === value).length);
  const title = filter === "All" ? "All work" : filter;

  useEffect(() => {
    if (composing) titleRef.current?.focus();
    else if (wasComposing.current) newRef.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(timer);
  }, [removed]);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createWork(draft, createId());
    if ("error" in result) { setFormError(result.error); return; }
    setWorks((current) => [result.work, ...current]);
    if (filter !== "All" && filter !== result.work.status) setFilter(result.work.status);
    setQuery("");
    setNotice(`Added “${result.work.title}”.`);
    setDraft(EMPTY_DRAFT);
    setFormError("");
    setComposing(false);
  }
  function remove(work: Work) {
    const index = works.findIndex((item) => item.id === work.id);
    setWorks((current) => current.filter((item) => item.id !== work.id));
    setRemoved({ work, index });
    setNotice(`Removed “${work.title}”. Undo is available for a few seconds.`);
  }
  function undo() {
    if (!removed) return;
    setWorks((current) => restoreWork(current, removed.work, removed.index));
    setNotice(`Restored “${removed.work.title}”.`);
    setRemoved(null);
  }
  function exportJson() {
    const href = URL.createObjectURL(new Blob([exportWorks(works)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "design-catalogue.json";
    anchor.click();
    URL.revokeObjectURL(href);
    setNotice(`Exported ${works.length} ${works.length === 1 ? "work" : "works"} to design-catalogue.json.`);
  }
  async function importJson(file: File | undefined) {
    if (!file) return;
    const result = importWorks(works, await file.text());
    if ("error" in result) { setNotice(result.error); return; }
    setWorks(result.works);
    setNotice(`Imported ${result.added} new ${result.added === 1 ? "work" : "works"}${result.skipped ? `, skipped ${result.skipped} (already here or invalid)` : ""}.`);
  }

  const lists: { value: Filter; tone?: Tone }[] = [{ value: "All" }, ...STATUSES.map((status) => ({ value: status, tone: TONE[status] }))];

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Design Specs" tagline="A catalogue of visual work" />
      <div className="as-body">
        <aside className="as-side" aria-label="Lists">
          <h2>Status</h2>
          <ul className="as-lists">
            {lists.map(({ value, tone }) => (
              <ListButton key={value} label={value === "All" ? "All work" : value} count={countOf(value)} tone={tone} current={filter === value} onSelect={() => setFilter(value)} />
            ))}
          </ul>
        </aside>

        <main id="main" className="as-main">
          <div className="as-head">
            <div>
              <h1>{title}</h1>
              <p aria-live="polite">{visible.length} {visible.length === 1 ? "work" : "works"}{query.trim() ? ` matching “${query.trim()}”` : ""}</p>
            </div>
            <div className="as-tools">
              <label className="as-search">
                <span className="as-sr">Search by title, type, tool or status</span>
                <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
              </label>
              {composing ? null : <button ref={newRef} type="button" className="as-button" onClick={() => setComposing(true)}><PlusIcon />New work</button>}
            </div>
          </div>

          {composing ? (
            <form className="as-composer" onSubmit={add} aria-label="New work" noValidate>
              <label className="as-field">Title
                <input ref={titleRef} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Editorial system" autoComplete="off" aria-invalid={formError ? true : undefined} aria-describedby={formError ? "work-form-error" : undefined} />
              </label>
              <div className="ds-fields">
                <label className="as-field">Type
                  <select className="ds-select" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select>
                </label>
                <label className="as-field">Tools, comma-separated
                  <input value={draft.tools} onChange={(event) => setDraft({ ...draft, tools: event.target.value })} placeholder="Figma, Illustrator" autoComplete="off" />
                </label>
              </div>
              {formError ? <p id="work-form-error" className="ds-error" role="alert">{formError}</p> : null}
              <div className="as-composer-foot">
                <div className="as-segmented-wrap">
                  <span id="status-label">Status</span>
                  <div className="as-segmented" role="group" aria-labelledby="status-label">
                    {STATUSES.map((status) => <button key={status} type="button" aria-pressed={draft.status === status} onClick={() => setDraft({ ...draft, status })}>{status}</button>)}
                  </div>
                </div>
                <div className="as-composer-actions">
                  <button type="button" className="as-plain" onClick={() => { setComposing(false); setDraft(EMPTY_DRAFT); setFormError(""); }}>Cancel</button>
                  <button type="submit" className="as-button" disabled={!draft.title.trim()}>Add</button>
                </div>
              </div>
            </form>
          ) : null}

          {visible.length ? (
            <ul className="as-list" aria-label={title}>
              {visible.map((work) => (
                <li className="as-row ds-row" key={work.id}>
                  <div>
                    <h3>{work.title}</h3>
                    <p className="as-row-detail">{work.type}{work.tools.length ? ` · ${work.tools.join(", ")}` : ""}</p>
                  </div>
                  <Pill tone={TONE[work.status]}>{work.status}</Pill>
                  <label className="ds-status">
                    <span className="as-sr">Status for {work.title}</span>
                    <select className="ds-select" value={work.status} onChange={(event) => setWorks((current) => setWorkStatus(current, work.id, event.target.value as Status))}>
                      {STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${work.title}`} onClick={() => remove(work)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              {query.trim() ? (
                <>
                  <strong>Nothing matches</strong>
                  No work in {filter === "All" ? "the catalogue" : title} mentions “{query.trim()}”.
                  <div className="ds-empty-action"><button type="button" className="as-plain" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>Clear search</button></div>
                </>
              ) : works.length === 0 ? (
                <><strong>No work yet</strong>Press New work to add the first piece, or import a backup below.</>
              ) : (
                <><strong>Nothing at this status</strong>No work is marked {title} yet. Change a work&apos;s status, or add one with this status.</>
              )}
            </div>
          )}

          <section className="ds-backup" aria-labelledby="backup-title">
            <h2 id="backup-title">Backup</h2>
            <p>Your catalogue is saved in this browser only (localStorage). Export a JSON file to keep a copy or move it to another browser; import merges a backup without replacing what is here.</p>
            <div className="ds-backup-actions">
              <button type="button" className="as-plain" onClick={exportJson}>Export JSON</button>
              <button type="button" className="as-plain" onClick={() => fileRef.current?.click()}>Import JSON</button>
              <input ref={fileRef} className="as-sr" type="file" accept="application/json,.json" tabIndex={-1} aria-hidden="true" onChange={(event) => { void importJson(event.target.files?.[0]); event.target.value = ""; }} />
            </div>
          </section>

          <p className="as-note">The two starting entries, Brand Identity and UI Design, are examples from data/works.json, also served read-only at /api/mcp. Works you add stay in this browser and are never sent anywhere.</p>
        </main>
      </div>

      <p className="as-sr" role="status" aria-live="polite">{notice}</p>
      {removed ? (
        <div className="as-toast" role="group" aria-label="Undo remove" onKeyDown={(event) => { if (event.key === "Escape") setRemoved(null); }}>
          <span>Removed “{removed.work.title}”</span>
          <button type="button" className="as-plain" onClick={undo}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/devtools-design-web" />
    </div>
  );
}
