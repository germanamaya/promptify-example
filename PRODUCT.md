# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Company Users discover, create, edit, and share reusable Prompts internally.

## Product Purpose

Promptify is an internal Prompt library. Its home prioritizes discovering new
Prompts, with genuine text search to find relevant material.

## Capabilities and Constraints

- Every Prompt has one Author and belongs to one or more Categories.
- Categories have names and colors and are maintained by Administrators.
- All Prompts are visible to all authenticated Users; there are no private Prompts.
- The backend lists newest first with Category filtering and pagination.
- Text search matches Prompt titles, descriptions, and content before pagination.
- Favorites, popularity rankings, and recommendations are outside this scope.
- Identity and authorization remain server-side, as defined in SECURITY.md.
- Prompt content is plain text, never interpreted as HTML or Markdown.
- Domain vocabulary follows GLOSSARY.md.

## Brand Commitments

The product name is Promptify. The user-pinned visual identity is dark,
console-inspired 8/16-bit Pixel Art. Keep the working library compact and its
Prompt content readable; no gamification or decorative CRT effects.
DESIGN.md records the shipped system; composition is recorded separately.

## Evidence on Hand

The Prisma-backed backend provides real Prompts, Categories, Authors, and creation
dates. No usage metrics or editorial selections exist and none should be invented.

## Product Principles

- Make new Prompts easy to discover.
- Keep search and filters truthful across the entire library.
- Prioritize readable content over decorative metrics.
- Preserve the existing permission and content-security model.
