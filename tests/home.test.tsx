import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { SEED_WORKS } from "@/lib/catalogue";

describe("home page", () => {
  it("renders the App shell catalogue with every seed work, the storage note and the hub footer", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("All work");
    for (const work of SEED_WORKS) expect(html).toContain(work.title);
    expect(html).toContain("saved in this browser only (localStorage)");
    expect(html).toContain("are examples from data/works.json");
    expect(html).toContain('href="https://bookchaowalit.com/"');
    expect(html).toContain('href="#main"');
  });
});
