"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { CategoryDto, MeDto, PromptListDto } from "@/lib/dto/dtos";
import { Brand } from "./brand";
import { LogoutLink } from "./logout-link";
import { syncSearchDraft, type SearchDraft } from "./search-draft";
import { Icon } from "./ui-icon";

function libraryUrl(q: string, categoryId = "", page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (categoryId) params.set("categoryId", categoryId);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/?${params}` : "/";
}

export function Library({ me, categories, prompts, q, categoryId }: {
  me: MeDto; categories: CategoryDto[]; prompts: PromptListDto; q: string; categoryId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searchState, setSearchState] = useState<SearchDraft>({ draft: q, appliedQ: q });
  const synced = syncSearchDraft(searchState, q);
  if (synced !== searchState) setSearchState(synced);
  const { draft } = synced;
  // Category changes apply the text visible in the search box, not a stale applied search.
  const visibleQ = draft.trim();
  const navigate = (href: string) => {
    setSearchState({ draft: new URL(href, "http://x").searchParams.get("q") ?? "", appliedQ: q });
    startTransition(() => router.push(href, { scroll: false }));
  };
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const { items, total, page, pageSize } = prompts;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(q || categoryId);
  const initials = me.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  const origin = libraryUrl(q, categoryId, page);
  const creationHref = `/prompts/new?from=${encodeURIComponent(origin)}`;
  const filterLink = (href: string, children: ReactNode, className: string, selected = false) => (
    <Link href={href} scroll={false} className={className} aria-current={selected ? "page" : undefined}
      onNavigate={(event) => { event.preventDefault(); navigate(href); }}>
      {children}
    </Link>
  );

  return (
    <div className="library-app">
      <a href="#main" className="skip-link">Saltar al contenido</a>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-content">
          <nav aria-label="Biblioteca">
            {filterLink("/", <><Icon name="library" /> Biblioteca</>, "sidebar-discover", !filtered)}
          </nav>
          <nav className="category-nav" aria-label="Filtrar por Categoría">
            <h2>Categorías</h2>
            {filterLink(libraryUrl(visibleQ), <><span className="all-categories-dot" /> Todas las Categorías</>, `category-link ${!categoryId ? "is-selected" : ""}`, !categoryId)}
            {categories.map((category) => (
              <div key={category.id}>
                {filterLink(libraryUrl(visibleQ, category.id), <><span className="category-dot" style={{ backgroundColor: category.color }} />{category.name}</>, `category-link ${category.id === categoryId ? "is-selected" : ""}`, category.id === categoryId)}
              </div>
            ))}
            {!categories.length && <p className="sidebar-hint">Aún no hay Categorías.</p>}
          </nav>
          {me.isAdministrator && <Link href="/administration" className="administration-link"><Icon name="shield" /> Administración</Link>}
        </div>
        <div className="user-profile">
          <span className="avatar">{initials}</span>
          <div><strong>{me.name}</strong><span>{me.isAdministrator ? "Administrador" : "Usuario"}</span></div>
          <LogoutLink />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <span className="workspace-name">Biblioteca interna</span>
          <div className="topbar-actions">
            {me.isAdministrator && <Link href="/administration" className="mobile-administration">Administración</Link>}
            <LogoutLink className="mobile-logout" />
            <span className="internal-label">Solo para nuestro equipo</span>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="library-heading">
            <div><h1>Biblioteca de Prompts</h1><p>Encuentra, reutiliza y comparte lo que funciona.</p></div>
            <Link className="button button-primary" href={creationHref} scroll={false}><Icon name="plus" /> Crear Prompt</Link>
          </div>
          <div className="library-tools">
            <form action="/" method="get" className="search-form" role="search" onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              navigate(libraryUrl(String(form.get("q") ?? "").trim(), categoryId));
            }}>
              <label htmlFor="prompt-search" className="sr-only">Buscar Prompts</label>
              <Icon name="search" />
              <input id="prompt-search" name="q" type="search" maxLength={200} value={draft}
                onChange={(event) => setSearchState({ draft: event.target.value, appliedQ: q })} placeholder="Buscar en título, descripción y contenido" />
              <button type="submit" className="button search-button" disabled={pending}>Buscar</button>
            </form>
            <div className="mobile-category-form">
              <label htmlFor="mobile-category">Categoría</label>
              <select id="mobile-category" value={categoryId} disabled={pending} onChange={(event) => navigate(libraryUrl(visibleQ, event.target.value))}>
                <option value="">Todas las Categorías</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
          </div>
          <section className="prompt-section" aria-labelledby="prompt-list-title" aria-busy={pending}>
            <div className="section-heading">
              <div className="section-title">
                <h2 id="prompt-list-title">{q ? "Resultados de búsqueda" : selectedCategory?.name ?? "Todos los Prompts"}</h2>
                <span className="result-count">{total}</span>
              </div>
            </div>
            <p className="filter-status" role="status">{pending ? "Actualizando Prompts…" : `${total} ${total === 1 ? "Prompt disponible" : "Prompts disponibles"}`}</p>
            {filtered && <div className="active-filters">
              <p>{q && <>Búsqueda: <strong>“{q}”</strong></>}{q && selectedCategory && " · "}{selectedCategory?.name}</p>
              {filterLink("/", "Limpiar filtros", "text-link")}
            </div>}
            {items.length > 0 ? (
              <div className="prompt-list">
                <div className="list-columns" aria-hidden="true"><span>Prompt</span><span>Categorías</span><span>Autor</span><span>Compartido</span></div>
                {items.map((prompt) => (
                  <article key={prompt.id} className="prompt-row">
                    <div className="prompt-summary">
                      <h3><Link scroll={false} href={`/prompts/${prompt.id}?from=${encodeURIComponent(origin)}`}>{prompt.title}</Link></h3>
                      {prompt.description && <p className="prompt-description">{prompt.description}</p>}
                    </div>
                    <div className="category-badges">
                      {prompt.categories.map((category) => (
                        <span className="category-badge" key={category.name}>
                          <span className="category-dot" style={{ backgroundColor: category.color }} />{category.name}
                        </span>
                      ))}
                    </div>
                    <span className="author-name">{prompt.authorName}</span>
                    <time dateTime={prompt.createdAt}>{new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(prompt.createdAt))}</time>
                  </article>
                ))}
              </div>
            ) : <div className="empty-state">
              <Icon name={filtered ? "search" : "library"} />
              <h3>{filtered ? "No encontramos Prompts con estos filtros" : total > 0 ? "Esta página no tiene Prompts" : "El primer Prompt puede ser el tuyo"}</h3>
              <p>{filtered ? "Prueba con otras palabras o cambia de Categoría." : "Comparte un Prompt para que otros Usuarios puedan reutilizarlo."}</p>
              {filtered || total > 0 ? filterLink("/", "Limpiar filtros", "button button-secondary") : <Link className="button button-primary" href={creationHref} scroll={false}>Crear el primer Prompt</Link>}
            </div>}
            {(pageCount > 1 || page > 1) && <nav className="pagination" aria-label="Paginación">
              <span>{total ? `${Math.min((page - 1) * pageSize + 1, total + 1) > total ? 0 : (page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total} Prompts` : "0 Prompts"}</span>
              <div>
                {page > 1 ? filterLink(libraryUrl(q, categoryId, page - 1), <><Icon name="back" /> Anterior</>, "button button-secondary") : <span className="button button-secondary" aria-disabled="true">Anterior</span>}
                <span className="page-number" aria-current="page">{page}</span>
                {page < pageCount ? filterLink(libraryUrl(q, categoryId, page + 1), <>Siguiente <Icon name="arrow" /></>, "button button-secondary") : <span className="button button-secondary" aria-disabled="true">Siguiente</span>}
              </div>
            </nav>}
          </section>
          <footer className="workspace-footer"><span>Promptify · Biblioteca interna</span><span>No compartas secretos ni datos personales.</span></footer>
        </main>
      </div>
    </div>
  );
}
