import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageSwitcher } from "@/app/components/language-switcher";
import { LocaleProvider, T } from "@/app/components/locale-provider";

describe("language preference UI", () => {
  it("renders the selected locale and native language names", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider language="de">
        <T id="nav.library" />
        <LanguageSwitcher className="test-language-switcher" />
      </LocaleProvider>,
    );

    expect(html).toContain("Bibliothek");
    expect(html).toContain('aria-label="Sprache"');
    expect(html).toContain('value="de" selected=""');
    expect(html).toContain("English");
    expect(html).toContain("Español");
    expect(html).toContain("Italiano");
    expect(html).toContain("Português (Portugal)");
    expect(html).toContain("Deutsch");
  });
});
