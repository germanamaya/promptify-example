import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Brand } from "@/app/components/brand";
import { Icon } from "@/app/components/ui-icon";

describe("Pixel Art identity", () => {
  it("keeps the home link accessible and renders a pixel-grid mark", () => {
    const html = renderToStaticMarkup(createElement(Brand));
    expect(html).toContain('aria-label="Promptify, home"');
    expect(html).toContain('href="/"');
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).not.toContain('rx="10"');
  });

  it.each(["arrow", "back", "search", "plus", "library", "copy", "check", "shield"] as const)(
    "renders %s as crisp pixel geometry without adding redundant accessible text",
    (name) => {
      const html = renderToStaticMarkup(createElement(Icon, { name }));
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('shape-rendering="crispEdges"');
      expect(html).toContain('fill="currentColor"');
      expect(html).not.toContain("<circle");
      expect(html).not.toContain('stroke-linecap="round"');
    },
  );
});
