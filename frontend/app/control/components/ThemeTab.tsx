"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { MatchState, DisplayTheme, DEFAULT_DISPLAY_THEME } from "../../types";
import { RELAY_URL } from "../lib/relay";
import { Card, ColorSwatch, SectionLabel } from "./primitives";

const FONT_SUGGESTIONS = [
  "Bebas Neue", "Barlow Condensed", "Oswald", "Inter", "Roboto Condensed",
  "Anton", "Rajdhani", "Teko", "Exo 2", "Montserrat",
];

export function ThemeTab({ state, push, controlToken }: { state: MatchState; push: (p: Partial<MatchState>) => void; controlToken: string }) {
  const theme: DisplayTheme = state.displayTheme ?? { ...DEFAULT_DISPLAY_THEME };
  const [showFontSuggestions, setShowFontSuggestions] = useState(false);

  const updateTheme = (patch: Partial<DisplayTheme>) =>
    push({ displayTheme: { ...theme, ...patch } });

  const primaryColor = theme.primaryColor || DEFAULT_DISPLAY_THEME.primaryColor;
  const backgroundColor = theme.backgroundColor || DEFAULT_DISPLAY_THEME.backgroundColor;

  return (
    <div className="space-y-6">
      {/* Live preview */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Preview</SectionLabel>
        <div
          className="mt-4 rounded-xl flex items-center justify-center gap-8 py-6 px-4"
          style={{ background: backgroundColor, fontFamily: theme.font ? `"${theme.font}", sans-serif` : undefined }}
        >
          {theme.competitionLogoUrl && (
            <div style={{ position: "relative", height: 48, width: 48, flexShrink: 0 }}>
              <Image
                src={theme.competitionLogoUrl.startsWith("/logos/") ? `${RELAY_URL}${theme.competitionLogoUrl}` : theme.competitionLogoUrl}
                alt="Competition logo"
                fill
                style={{ objectFit: "contain" }}
              />
            </div>
          )}
          <div className="text-center">
            <p className="font-black" style={{ color: primaryColor, fontSize: `${2.5 * (theme.textScale ?? 1)}rem`, lineHeight: 1 }}>
              {state.home.score}
            </p>
            <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: "#ffffff99" }}>
              {state.home.name || "HOME"}
            </p>
          </div>
          <div className="text-center">
            <p className="font-bold" style={{ color: primaryColor, fontSize: `${1.5 * (theme.textScale ?? 1)}rem` }}>
              {String(Math.floor(state.clockSeconds / 60)).padStart(2, "0")}:{String(state.clockSeconds % 60).padStart(2, "0")}
            </p>
            <p className="text-xs font-black tracking-widest mt-1" style={{ color: primaryColor }}>
              QTR {state.period}
            </p>
          </div>
          <div className="text-center">
            <p className="font-black" style={{ color: primaryColor, fontSize: `${2.5 * (theme.textScale ?? 1)}rem`, lineHeight: 1 }}>
              {state.visitor.score}
            </p>
            <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: "#ffffff99" }}>
              {state.visitor.name || "VISITOR"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Primary colour */}
        <Card title="Primary / Accent Colour">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Accent colour for clock, period, scoreboard chrome, and highlights across all displays.
          </p>
          <ColorSwatch color={primaryColor} />
          <input
            type="color"
            className="mt-3 rounded-lg w-full h-10 cursor-pointer"
            style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
            value={primaryColor}
            onChange={e => updateTheme({ primaryColor: e.target.value })}
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            {["#00C8FF", "#FFFFFF", "#F59E0B", "#22C55E", "#EF4444", "#A855F7", "#EC4899"].map(c => (
              <button key={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: primaryColor === c ? "2px solid white" : "2px solid transparent" }}
                onClick={() => updateTheme({ primaryColor: c })} />
            ))}
          </div>
        </Card>

        {/* Background colour */}
        <Card title="Display Background Colour">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Background colour of the scoreboard displays (not the overlay — that stays transparent).
          </p>
          <ColorSwatch color={backgroundColor} />
          <input
            type="color"
            className="mt-3 rounded-lg w-full h-10 cursor-pointer"
            style={{ border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
            value={backgroundColor}
            onChange={e => updateTheme({ backgroundColor: e.target.value })}
          />
          <div className="flex gap-2 mt-2 flex-wrap">
            {["#07090F", "#000000", "#0a0a0a", "#0F172A", "#1E1B4B", "#052e16", "#1a0000"].map(c => (
              <button key={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: `2px solid ${backgroundColor === c ? "white" : "#ffffff33"}` }}
                onClick={() => updateTheme({ backgroundColor: c })} />
            ))}
          </div>
        </Card>

        {/* Font */}
        <Card title="Display Font">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Enter any Google Font name. Leave blank to use the default system font.
          </p>
          <div className="relative">
            <input
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              value={theme.font}
              placeholder="e.g. Bebas Neue"
              onChange={e => updateTheme({ font: e.target.value })}
              onFocus={() => setShowFontSuggestions(true)}
              onBlur={() => setTimeout(() => setShowFontSuggestions(false), 150)}
            />
            {showFontSuggestions && (
              <div
                className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
              >
                {FONT_SUGGESTIONS.filter(f => f.toLowerCase().includes(theme.font.toLowerCase())).map(f => (
                  <button
                    key={f}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                    style={{ color: "var(--text-primary)", background: "transparent", display: "block" }}
                    onMouseDown={() => updateTheme({ font: f })}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          {theme.font && (
            <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
              Font loaded from Google Fonts automatically on the display pages.
            </p>
          )}
          {theme.font && (
            <button
              className="mt-2 text-xs"
              style={{ color: "var(--text-dim)" }}
              onClick={() => updateTheme({ font: "" })}
            >
              Clear font
            </button>
          )}
        </Card>

        {/* Text scale */}
        <Card title="Text Scale">
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Scale scores and clock text up or down across all displays.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs font-mono w-8 text-right" style={{ color: "var(--text-dim)" }}>0.5×</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={theme.textScale ?? 1}
              className="flex-1"
              onChange={e => updateTheme({ textScale: parseFloat(e.target.value) })}
            />
            <span className="text-xs font-mono w-8" style={{ color: "var(--text-dim)" }}>2×</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <code className="text-sm font-mono font-bold" style={{ color: "var(--accent)" }}>
              {(theme.textScale ?? 1).toFixed(2)}×
            </code>
            <div className="flex gap-2">
              {[0.75, 1, 1.25, 1.5, 1.75].map(s => (
                <button
                  key={s}
                  className="rounded px-2 py-1 text-xs font-bold"
                  style={{
                    background: Math.abs((theme.textScale ?? 1) - s) < 0.01 ? "var(--accent-dim)" : "var(--bg-elevated)",
                    border: `1px solid ${Math.abs((theme.textScale ?? 1) - s) < 0.01 ? "var(--border-accent)" : "var(--border)"}`,
                    color: Math.abs((theme.textScale ?? 1) - s) < 0.01 ? "var(--accent)" : "var(--text-secondary)",
                  }}
                  onClick={() => updateTheme({ textScale: s })}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Competition logo */}
      <CompetitionLogoUploader theme={theme} updateTheme={updateTheme} controlToken={controlToken} />

      {/* Reset */}
      <div className="flex justify-end">
        <button
          className="rounded-lg px-4 py-2 text-sm font-bold"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger)" }}
          onClick={() => push({ displayTheme: { ...DEFAULT_DISPLAY_THEME } })}
        >
          Reset Theme to Defaults
        </button>
      </div>
    </div>
  );
}

function CompetitionLogoUploader({ theme, updateTheme, controlToken }: {
  theme: DisplayTheme;
  updateTheme: (p: Partial<DisplayTheme>) => void;
  controlToken: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const logoSrc = theme.competitionLogoUrl
    ? theme.competitionLogoUrl.startsWith("/logos/") ? `${RELAY_URL}${theme.competitionLogoUrl}` : theme.competitionLogoUrl
    : null;

  const handleFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${RELAY_URL}/api/competition-logo`, {
        method: "POST",
        headers: { "x-control-secret": controlToken },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { competitionLogoUrl } = await res.json();
      updateTheme({ competitionLogoUrl });
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await fetch(`${RELAY_URL}/api/competition-logo`, {
        method: "DELETE",
        headers: { "x-control-secret": controlToken },
      });
      updateTheme({ competitionLogoUrl: "" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <SectionLabel>Competition / Event Logo</SectionLabel>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Displayed in the header area of applicable scoreboard outputs. Separate from team logos.
      </p>

      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          height: 140, background: "var(--bg-elevated)",
          border: `1px dashed ${logoSrc ? "rgba(0,200,255,0.3)" : "var(--border)"}`,
          cursor: "pointer",
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        {logoSrc ? (
          <div style={{ position: "relative", height: 110, width: "60%" }}>
            <Image src={logoSrc} alt="Competition logo" fill style={{ objectFit: "contain" }} />
          </div>
        ) : (
          <div className="text-center">
            <p className="text-2xl mb-1">⬆</p>
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Click or drag to upload</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>PNG, JPG, SVG, WebP — max 5 MB</p>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg py-2 text-sm font-bold"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)" }}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : logoSrc ? "Replace Logo" : "Upload Logo"}
        </button>
        {logoSrc && (
          <button
            className="rounded-lg px-4 py-2 text-sm font-bold"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger)" }}
            onClick={handleRemove}
            disabled={uploading}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
