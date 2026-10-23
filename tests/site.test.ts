import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { DEFAULT_SITE_URL, SITE_URL } from "@/lib/site";

describe("site origin", () => {
  it("defaults to the live custom domain, not the old vercel.app host", () => {
    expect(DEFAULT_SITE_URL).toBe("https://design.bookchaowalit.com");
    expect(SITE_URL).toBe(DEFAULT_SITE_URL);
  });

  it("robots.txt and sitemap.xml use that origin", () => {
    expect(robots()).toMatchObject({ sitemap: `${SITE_URL}/sitemap.xml` });
    expect(sitemap().map((entry) => entry.url)).toEqual([SITE_URL, `${SITE_URL}/more-projects`]);
  });
});
