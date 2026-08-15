"use client";

import { usePathname } from "next/navigation";
import { NAV } from "../nav";

function titleFor(pathname: string): string | null {
  for (const section of NAV) {
    for (const link of section.links) {
      if (link.href === pathname) return link.title;
    }
    if (section.href === pathname) return section.title;
  }
  return null;
}

function sectionFor(pathname: string): { title: string; href: string } | null {
  for (const section of NAV) {
    if (section.links.some(l => l.href === pathname) && section.href !== pathname) {
      return { title: section.title, href: section.href };
    }
  }
  return null;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const title = titleFor(pathname);
  const section = sectionFor(pathname);

  return (
    <p className="breadcrumb">
      <a href="/">Help centre</a>
      {section && (
        <>
          {" / "}
          <a href={section.href}>{section.title}</a>
        </>
      )}
      {title && !section && pathname !== "/" && <> {" / "}{title}</>}
    </p>
  );
}
