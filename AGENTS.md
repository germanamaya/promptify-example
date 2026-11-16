<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project framework

Everything below applies to every agent working in this repository.

## Context

- **What it is:** Promptify, an internal prompt library. Company members create, edit, and share prompts with each other.
- **Status:** production application. Treat every change as production code.
- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- **Data:** SQL Server, accessed exclusively through Prisma ORM.
- **Hosting:** Azure App Service (Linux, Node).
- **Authentication:** Microsoft Entra ID via App Service **Easy Auth**. The platform handles sign-in before requests reach the app; the app does not implement login.
- **Persistence:** SQL Server (in Azure), Prisma ORM
- **Audit:** Application Insights

## Code quality

- Code must be **modular**, **easy to read**, and above all **easy to test**.
- Keep modules small and single-purpose. Separate business logic from framework, UI, and I/O concerns (Prisma, HTTP, Application Insights) so logic can be tested in isolation.
- Use clear names and straightforward control flow. Avoid clever or deeply nested code.

## Testing

Follow **TDD** using the **Red → Green → Refactor** cycle for every feature and bug fix:

1. **Red:** write a failing test that describes the expected behavior. Run it and confirm it fails for the right reason.
2. **Green:** write the minimum code needed to make the test pass. Run the tests and confirm they pass.
3. **Refactor:** clean up the code and tests while keeping all tests green. Run the tests again.

Rules:

- Never write production code without a failing test that requires it.
- Every new test must be seen failing before its production code exists. A test that passes on its first run proves nothing about the change: remove it or rewrite it until it fails for the right reason.
- Fix bugs by first writing a test that reproduces them.
- Test behavior through public interfaces, not implementation details.
- Every change must leave the full test suite passing before it is considered done.

## Security

- [SECURITY.md](./SECURITY.md) defines the security model (identity, authorization, content handling, secrets, audit). It is binding: read it before touching auth, data access, or anything that renders user content.
- Do not weaken its rules without explicit approval from the project owner.

## Domain language

- [GLOSSARY.md](./GLOSSARY.md) defines the canonical domain vocabulary of Promptify.
- Always use its terms in code (models, routes, variables), UI text, and conversation. Never use the words listed under _Avoid_.
- Do not edit GLOSSARY.md; it is maintained by the project owner.

## Internationalization
- Translate all new or modified user-facing UI text into every supported language (`en`, `es`, `it`, `pt-PT`, `de`) using the existing localization system in `lib/i18n/messages.ts`. Do not hardcode user-facing strings in components.
- This includes buttons, labels, placeholders, validation and error messages, empty and loading states, dialogs, accessibility text, and metadata.
- Do not translate user-authored content, including Prompts.
- Add or update tests to verify the translations.