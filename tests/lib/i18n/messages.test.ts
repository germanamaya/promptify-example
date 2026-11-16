import { describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, LANGUAGES, normalizeLanguage, translate } from "@/lib/i18n/messages";

describe("application languages", () => {
  it("supports only the requested language set and uses English by default", () => {
    expect(LANGUAGES).toEqual(["en", "es", "it", "pt-PT", "de"]);
    expect(DEFAULT_LANGUAGE).toBe("en");
  });

  it("normalizes unknown stored values to English", () => {
    expect(normalizeLanguage("pt-PT")).toBe("pt-PT");
    expect(normalizeLanguage("fr")).toBe("en");
  });

  it("provides translated interface labels and native language names", () => {
    expect(translate("es", "language.label")).toBe("Idioma");
    expect(translate("de", "language.portuguese")).toBe("Português (Portugal)");
  });
});
