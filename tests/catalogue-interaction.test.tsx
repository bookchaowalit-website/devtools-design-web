// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesignCatalogue } from "@/components/design-catalogue";
import { STORAGE_KEY } from "@/lib/works";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const rows = () => [...host.querySelectorAll(".as-row h3")].map((h) => h.textContent);
// A pointer click (detail 1); a keyboard click has detail 0 and moves focus to Undo after Remove.
const press = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })); });
const notice = () => host.querySelector('.as-sr[role="status"]')?.textContent;
function type(el: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function choose(el: HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<DesignCatalogue />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("design catalogue", () => {
  it("adds a work through the composer and saves it to localStorage", () => {
    press(button("New work"));
    expect(document.activeElement).toBe(host.querySelector('form[aria-label="New work"] input'));
    const add = button("Add");
    expect(add.disabled).toBe(true);
    type(host.querySelector<HTMLInputElement>('form input')!, "Annual report");
    type(host.querySelectorAll<HTMLInputElement>('form input')[1], "InDesign, Figma");
    press([...host.querySelectorAll(".as-segmented button")].find((b) => b.textContent === "Approved")!);
    act(() => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(rows()[0]).toBe("Annual report");
    expect(notice()).toBe("Added “Annual report”.");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].status).toBe("Approved");
  });

  it("shows a validation error for a whitespace-only title", () => {
    press(button("New work"));
    type(host.querySelector<HTMLInputElement>('form input')!, "​ ");
    act(() => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Give the work a title.");
    press(button("Cancel"));
    expect(host.querySelector("form")).toBeNull();
  });

  it("filters by status list and search, with distinct empty states", () => {
    press(host.querySelector<HTMLButtonElement>('.as-lists li:nth-child(4) button')!);
    expect(host.querySelector("h1")?.textContent).toBe("Approved");
    expect(rows()).toEqual(["Brand Identity"]);
    press(host.querySelector<HTMLButtonElement>('.as-lists li:nth-child(2) button')!);
    expect(host.textContent).toContain("Nothing at this status");
    press(host.querySelector<HTMLButtonElement>('.as-lists li:nth-child(1) button')!);
    type(host.querySelector<HTMLInputElement>('input[type="search"]')!, "sketch");
    expect(rows()).toEqual(["UI Design"]);
    type(host.querySelector<HTMLInputElement>('input[type="search"]')!, "zzz");
    expect(host.textContent).toContain("Nothing matches");
    press(button("Clear search"));
    expect(rows()).toHaveLength(2);
  });

  it("changes a status from the row select", () => {
    choose(host.querySelector<HTMLSelectElement>(".as-row select")!, "Draft");
    expect(host.querySelector(".as-row .as-pill")?.textContent).toBe("Draft");
  });

  it("removes with an Undo toast that puts the work back in place, and the toast times out", () => {
    vi.useFakeTimers();
    press(host.querySelector('button[aria-label="Remove Brand Identity"]')!);
    expect(rows()).toEqual(["UI Design"]);
    press(button("Undo"));
    expect(rows()).toEqual(["Brand Identity", "UI Design"]);
    press(host.querySelector('button[aria-label="Remove UI Design"]')!);
    act(() => { vi.advanceTimersByTime(6100); });
    expect(host.querySelector(".as-toast")).toBeNull();
    press(host.querySelector('button[aria-label="Remove Brand Identity"]')!);
    expect(host.textContent).toContain("No work yet");
  });

  it("exports and imports a JSON backup with a notice", async () => {
    const created = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    press(button("Export JSON"));
    expect(created).toHaveBeenCalled();
    expect(notice()).toBe("Exported 2 works to design-catalogue.json.");
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([JSON.stringify({ works: [{ id: "9", title: "Poster", type: "Editorial", tools: [], status: "Draft" }, { id: "1" }] })], "b.json");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 0)); });
    expect(rows()).toContain("Poster");
    expect(notice()).toContain("Imported 1 new work, skipped 1");
    const bad = new File(["nope"], "c.json");
    Object.defineProperty(input, "files", { value: [bad], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 0)); });
    expect(notice()).toBe("That file is not valid JSON.");
  });
});

describe("batch Undo", () => {
  // One more work, so there are three rows to remove from.
  beforeEach(() => {
    press(button("New work"));
    type(host.querySelector<HTMLInputElement>('form[aria-label="New work"] input')!, "Editorial system");
    act(() => { host.querySelector<HTMLFormElement>('form[aria-label="New work"]')!.requestSubmit(); });
  });
  // detail 0 = keyboard (Enter/Space) click, 1 = pointer click.
  const click = (el: Element, detail: number) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
  const shownRows = () => [...host.querySelectorAll<HTMLElement>(".as-row[data-item]")];
  const rowIds = () => shownRows().map((row) => row.dataset.item);
  const removeButton = (i: number) => shownRows()[i].querySelector<HTMLButtonElement>(".as-danger")!;
  const undoButton = () => host.querySelector<HTMLButtonElement>(".as-toast button")!;
  const escape = () => act(() => { host.querySelector(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });

  it("consecutive removes restore together with one Undo", () => {
    vi.useFakeTimers();
    const before = rowIds();
    expect(before).toHaveLength(3);
    click(removeButton(1), 1);
    act(() => { vi.advanceTimersByTime(4000); });
    click(removeButton(0), 1);
    expect(rowIds()).toEqual(before.slice(2));
    expect(host.querySelector(".as-toast span")!.textContent).toBe("Removed 2 works");
    expect(undoButton().getAttribute("aria-label")).toBe("Undo remove of 2 works");
    // The second removal restarted the 6 s window: 4 s later it is still open.
    act(() => { vi.advanceTimersByTime(4000); });
    click(undoButton(), 1);
    expect(rowIds()).toEqual(before);
    expect(host.querySelector(".as-toast")).toBeNull();
    expect(notice()).toBe("Restored 2 works.");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(3);
  });

  it("keyboard remove focuses Undo; Undo focuses the restored row, Escape the next one", () => {
    const before = rowIds();
    click(removeButton(0), 0);
    expect(document.activeElement).toBe(undoButton());
    expect(document.documentElement.style.getPropertyValue("--as-toast-space")).toMatch(/px$/);
    click(undoButton(), 0);
    expect(rowIds()).toEqual(before);
    expect(document.activeElement).toBe(removeButton(0));
    click(removeButton(0), 0);
    escape();
    expect(host.querySelector(".as-toast")).toBeNull();
    expect(document.activeElement).toBe(removeButton(0));
    expect(rowIds()).toEqual(before.slice(1));
  });

  it("keeps a focused toast open until focus leaves it", () => {
    vi.useFakeTimers();
    click(removeButton(0), 0);
    act(() => { vi.advanceTimersByTime(7000); });
    expect(host.querySelector(".as-toast")).not.toBeNull();
    act(() => { button("New work").focus(); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect(host.querySelector(".as-toast")).toBeNull();
  });
});
