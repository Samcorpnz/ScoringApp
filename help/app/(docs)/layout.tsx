import { Sidebar } from "../components/Sidebar";
import { Breadcrumb } from "../components/Breadcrumb";

export default function DocsLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="help-shell">
      <Sidebar />
      <article className="help-article">
        <Breadcrumb />
        {children}
      </article>
    </div>
  );
}
