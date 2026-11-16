import Link from "next/link";
import { connection } from "next/server";
import { getContainer } from "@/lib/container";
import { Brand } from "@/app/components/brand";
import { Icon } from "@/app/components/ui-icon";
import { ReadError } from "@/app/components/read-error";
import { CategoryForm, AdministratorForm } from "@/app/components/administration-forms";
import { T } from "@/app/components/locale-provider";

export default async function Administration() {
  await connection();
  const { queries } = getContainer();
  const me = await queries.getMe();
  if (!me.ok) return <ReadError error={me.error} />;
  if (!me.data.isAdministrator) return <ReadError error="You are not allowed to do this" />;
  const categories = await queries.listCategories();
  if (!categories.ok) return <ReadError error={categories.error} />;
  const users = await queries.listUsers();
  if (!users.ok) return <ReadError error={users.error} />;
  return <div className="supporting-page">
    <header className="supporting-header"><Brand /><Link href="/" className="text-link"><Icon name="back" /> <T id="nav.library" /></Link></header>
    <main className="administration-content">
      <h1><T id="admin.title" /></h1>
      <p className="detail-description"><T id="admin.description" /></p>
      <section className="management-section" aria-labelledby="categories-title">
        <h2 id="categories-title"><T id="admin.categories" /></h2>
        <p className="section-description"><T id="admin.categoryDescription" /></p>
        <div className="category-management-list">
          {categories.data.map((category) => <CategoryForm key={category.id} category={category} />)}
          {!categories.data.length && <p className="section-description"><T id="admin.emptyCategories" /></p>}
        </div>
        <h3 className="management-subheading"><T id="admin.newCategory" /></h3>
        <CategoryForm />
      </section>
      <section className="management-section" aria-labelledby="roles-title">
        <h2 id="roles-title"><T id="admin.roles" /></h2>
        <p className="section-description"><T id="admin.rolesDescription" /></p>
        <AdministratorForm users={users.data} />
      </section>
    </main>
  </div>;
}
