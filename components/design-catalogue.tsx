"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon, type Tone } from "@/components/app-shell";
import { SEED_WORKS } from "@/lib/catalogue";
import { STATUSES, STORAGE_KEY, TYPES, createWork, exportWorks, filterWorks, importWorks, parseStoredWorks, restoreWork, setWorkStatus } from "@/lib/works";
import type { Status, Work, WorkDraft } from "@/lib/works";

const EMPTY_DRAFT: WorkDraft = { title: "", type: "UI/UX", tools: "", status: "Draft" };
const TONE: Record<Status, Tone> = { Draft: "grey", "In review": "amber", Approved: "green" };
type Filter = Status | "All";
// index: where it sat in the stored list when removed. nextShown / prevShown: the rows shown around it, for focus.
type RemovedEntry = { work: Work; index: number; nextShown?: string; prevShown?: string };
type RemovedBatch = { removals: RemovedEntry[]; viaKeyboard: boolean };
const removedLabel = (removals: RemovedEntry[]) => (removals.length === 1 ? `Removed “${removals[0].work.title}”` : `Removed ${removals.length} works`);

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
  // Every removal still inside the Undo window: one Undo puts them all back where they were.
  const [removed, setRemovedState] = useState<RemovedBatch | null>(null);
  // The latest batch, so two removals before a re-render still both land in it.
  const removedRef = useRef<RemovedBatch | null>(null);
  const setRemoved = (batch: RemovedBatch | null) => { removedRef.current = batch; setRemovedState(batch); };
  const [toastFocused, setToastFocused] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<string[] | null>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const wasComposing = useRef(false);

  const visible = useMemo(() => filterWorks(works, query).filter((work) => filter === "All" || work.status === filter), [works, query, filter]);
  const countOf = (value: Filter) => (value === "All" ? works.length : works.filter((work) => work.status === value).length);
  const title = filter === "All" ? "All work" : filter;

  useEffect(() => {
    if (composing) titleRef.current?.focus();
    else if (wasComposing.current) newRef.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  // A removal made from the keyboard moves focus to Undo (the focused Remove button has just gone).
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  // When the toast closes after Undo or Escape, focus goes back near the removed row once the list has re-rendered:
  // the first of these rows still shown, else the New button.
  useEffect(() => {
    const ids = focusNext.current;
    if (removed || !ids) return;
    focusNext.current = null;
    const rows = [...document.querySelectorAll<HTMLElement>(".as-row[data-item]")];
    const row = ids.map((id) => rows.find((entry) => entry.dataset.item === id)).find(Boolean);
    (row?.querySelector<HTMLButtonElement>(".as-danger") ?? newRef.current)?.focus();
  }, [removed, works]);
  // While the toast shows, reserve its height (plus its 24px offset and a gap) at the bottom of the page and in
  // scroll-padding, so the last rows and anything focused behind it can scroll clear of it.
  const toastShown = removed !== null;
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toastShown || !toast) return;
    const rootStyle = document.documentElement.style;
    const reserve = () => rootStyle.setProperty("--as-toast-space", `${toast.offsetHeight + 32}px`);
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(toast);
    return () => { observer?.disconnect(); rootStyle.removeProperty("--as-toast-space"); };
  }, [toastShown]);
  // The Undo toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = null; setRemovedState(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

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
  function remove(work: Work, viaKeyboard: boolean) {
    const index = works.findIndex((item) => item.id === work.id);
    if (index < 0) return;
    setWorks((current) => current.filter((item) => item.id !== work.id));
    const shownAt = visible.findIndex((item) => item.id === work.id);
    const removal: RemovedEntry = { work, index, nextShown: visible[shownAt + 1]?.id, prevShown: shownAt > 0 ? visible[shownAt - 1].id : undefined };
    const removals = [...(removedRef.current?.removals ?? []), removal];
    setRemoved({ removals, viaKeyboard });
    setNotice(removals.length === 1 ? `Removed “${work.title}”. Undo is available for a few seconds.` : `Removed ${removals.length} works. Undo is available for a few seconds.`);
  }
  function closeToast(focusIds?: string[]) {
    const last = removedRef.current?.removals.at(-1);
    // Dismissed: the row after the removed one, else the one before it.
    focusNext.current = focusIds ?? [last?.nextShown, last?.prevShown].filter((id): id is string => Boolean(id));
    setRemoved(null);
    setToastFocused(false);
  }
  function undo() {
    const removals = removedRef.current?.removals;
    if (!removals?.length) return;
    // Latest removal first, so each index refers to the list as it was just before that removal.
    setWorks((current) => removals.reduceRight((list, { work, index }) => restoreWork(list, work, index), current));
    const latest = removals[removals.length - 1].work;
    setNotice(removals.length === 1 ? `Restored “${latest.title}”.` : `Restored ${removals.length} works.`);
    // Undone: back to the restored row the user removed last.
    closeToast([latest.id]);
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
                <li className="as-row ds-row" key={work.id} data-item={work.id}>
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
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${work.title}`} onClick={(event) => remove(work, event.detail === 0)}>Remove</button>
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
        <div
          ref={toastRef}
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{removedLabel(removed.removals)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label={removed.removals.length === 1 ? "Undo remove" : `Undo remove of ${removed.removals.length} works`}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/devtools-design-web" />
    </div>
  );
}
