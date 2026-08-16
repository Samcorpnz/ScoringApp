"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "../nav";

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="sidebar-toggle"
        aria-expanded={open}
        aria-controls="help-sidebar"
        onClick={() => setOpen(v => !v)}
      >
        {open ? "Close menu" : "Browse help topics"}
      </button>
      <nav id="help-sidebar" aria-label="Help topics" className={`sidebar ${open ? "sidebar-open" : ""}`}>
        {NAV.map(section => (
          <div key={section.href} className="sidebar-section">
            <a
              href={section.href}
              className={`sidebar-section-title ${pathname === section.href ? "active" : ""}`}
            >
              {section.title}
            </a>
            <ul>
              {section.links
                .filter(link => link.href !== section.href)
                .map(link => (
                  <li key={link.href}>
                    <a href={link.href} className={pathname === link.href ? "active" : ""}>
                      {link.title}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
