import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Loading from "@/app/loading";
import ErrorPage from "@/app/error";

describe("Route states", () => {
  it("announces loading without inventing contributions", () => {
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading");
    expect(html).not.toContain("Ada");
  });

  it("offers a retry for an unexpected page failure without exposing the error", () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: new Error("sensitive runtime detail"), reset: vi.fn() }));
    expect(html).toContain("Retry");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("sensitive runtime detail");
  });
});
