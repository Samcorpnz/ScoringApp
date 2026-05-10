import { useEffect, useRef } from "react";
import { DisplayTheme, DEFAULT_DISPLAY_THEME } from "../types";

export function useDisplayTheme(theme: DisplayTheme | undefined) {
  const t = theme ?? DEFAULT_DISPLAY_THEME;
  const loadedFonts = useRef(new Set<string>());

  useEffect(() => {
    if (!t.font) return;
    if (loadedFonts.current.has(t.font)) return;
    loadedFonts.current.add(t.font);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(t.font)}:wght@400;700;900&display=swap`;
    document.head.appendChild(link);
  }, [t.font]);

  const primaryColor = t.primaryColor || DEFAULT_DISPLAY_THEME.primaryColor;
  const backgroundColor = t.backgroundColor || DEFAULT_DISPLAY_THEME.backgroundColor;

  const textScale = t.textScale ?? 1;

  // CSS custom properties override — applied inline on the root wrapper element
  return {
    backgroundColor,
    fontFamily: t.font ? `"${t.font}", sans-serif` : undefined,
    // Override CSS variables used by display components
    "--accent":         primaryColor,
    "--accent-dim":     `${primaryColor}22`,
    "--border-accent":  `${primaryColor}44`,
    "--bg-base":        backgroundColor,
    "--text-scale":     String(textScale),
    textScale,
    competitionLogoUrl: t.competitionLogoUrl || "",
  } as React.CSSProperties & { textScale: number; competitionLogoUrl: string };
}
