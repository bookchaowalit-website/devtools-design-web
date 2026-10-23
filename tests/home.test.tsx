import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { SEED_WORKS } from "@/lib/catalogue";

describe("home page", () => {
  it("renders every seed work from data/works.json and the local-only footer", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("work in constellations.");
    for (const work of SEED_WORKS) expect(html).toContain(work.title);
    expect(html).toContain("Local catalogue · data stays in this browser");
  });
});
