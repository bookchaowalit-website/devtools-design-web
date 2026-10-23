import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { SEED_WORKS } from "@/lib/catalogue";

const post = (body: unknown) =>
  POST(new Request("https://example.test/api/mcp", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const call = async (id: number, name: string, args: Record<string, unknown> = {}) =>
  (await post({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } })).json();
const textOf = (json: { result: { content: { text: string }[] } }) => JSON.parse(json.result.content[0].text);

describe("POST /api/mcp over the published seed catalogue", () => {
  it("get_all returns the seed works and echoes the id", async () => {
    const json = await call(11, "get_all");
    expect(json.id).toBe(11);
    expect(textOf(json)).toEqual(SEED_WORKS);
  });

  it("get_by_id finds a work and errors on an unknown id", async () => {
    expect(textOf(await call(2, "get_by_id", { id: SEED_WORKS[0].id }))).toEqual(SEED_WORKS[0]);
    const missing = await call(3, "get_by_id", { id: "nope" });
    expect(missing.error ?? missing.result?.isError).toBeTruthy();
  });

  it("search filters by tool", async () => {
    const hits = textOf(await call(4, "search", { query: "sketch" }));
    expect(hits.map((work: { title: string }) => work.title)).toEqual(["UI Design"]);
  });

  it("rejects an unknown tool, bad JSON (400) and answers notifications with 202", async () => {
    expect((await call(5, "drop_table")).error).toBeDefined();
    expect((await post("{")).status).toBe(400);
    expect((await post({ jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
  });
});
