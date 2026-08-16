import type { MDXComponents } from "mdx/types";

function Callout({ children }: { readonly children: React.ReactNode }) {
  return <div className="callout">{children}</div>;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Callout,
    ...components,
  };
}
