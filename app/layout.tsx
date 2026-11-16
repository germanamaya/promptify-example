import type { Metadata } from "next";
import { IBM_Plex_Sans, Pixelify_Sans } from "next/font/google";
import { DEFAULT_LANGUAGE, normalizeLanguage, translate } from "@/lib/i18n/messages";
import { getCurrentUserForRequest } from "@/lib/i18n/current-user";
import { LocaleProvider } from "./components/locale-provider";
import "./globals.css";

export const instant = false;

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const pixelSans = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const result = await getCurrentUserForRequest();
  const language = result.ok ? normalizeLanguage(result.data.language) : DEFAULT_LANGUAGE;
  return {
    title: { default: translate(language, "meta.title"), template: "%s · Promptify" },
    description: translate(language, "meta.description"),
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children, modal }: LayoutProps<"/">) {
  const result = await getCurrentUserForRequest();
  const language = result.ok ? normalizeLanguage(result.data.language) : DEFAULT_LANGUAGE;
  const content = result.ok
    ? <LocaleProvider language={language}>{children}{modal}</LocaleProvider>
    : <main className="empty-state error-state" role="alert">
      <h1>{translate(DEFAULT_LANGUAGE, "error.readTitle")}</h1>
      <p>{translate(DEFAULT_LANGUAGE, result.error === "Authentication required" ? "error.auth" : result.error === "You are not allowed to do this" ? "error.forbidden" : "error.generic")}</p>
    </main>;

  return (
    <html
      lang={language}
      className={`${plexSans.variable} ${pixelSans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{content}</body>
    </html>
  );
}
