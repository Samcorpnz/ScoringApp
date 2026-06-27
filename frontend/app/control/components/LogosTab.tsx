"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { MatchState, TeamState } from "../../types";
import { RELAY_URL } from "../lib/relay";
import { SectionLabel } from "./primitives";

export function LogosTab({ state, push, controlToken }: { state: MatchState; push: (p: Partial<MatchState>) => void; controlToken: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <LogoUploader team="home" teamState={state.home} push={push} state={state} controlToken={controlToken} />
      <LogoUploader team="visitor" teamState={state.visitor} push={push} state={state} controlToken={controlToken} />
    </div>
  );
}

function LogoUploader({ team, teamState, push, state, controlToken }: {
  team: "home" | "visitor";
  teamState: TeamState;
  push: (p: Partial<MatchState>) => void;
  state: MatchState;
  controlToken: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const color = teamState.color || (team === "home" ? "#F59E0B" : "#818CF8");

  const logoSrc = teamState.logoUrl
    ? teamState.logoUrl.startsWith("/logos/") ? `${RELAY_URL}${teamState.logoUrl}` : teamState.logoUrl
    : null;

  const handleFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`${RELAY_URL}/api/logo/${team}`, {
        method: "POST",
        headers: { "x-control-secret": controlToken },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { logoUrl } = await res.json();
      push({ [team]: { ...teamState, logoUrl } } as Partial<MatchState>);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await fetch(`${RELAY_URL}/api/logo/${team}`, {
        method: "DELETE",
        headers: { "x-control-secret": controlToken },
      });
      push({ [team]: { ...teamState, logoUrl: "" } } as Partial<MatchState>);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3">
        <div style={{ width: 4, height: 32, borderRadius: 2, background: color, boxShadow: `0 0 8px ${color}` }} />
        <div>
          <SectionLabel>{team === "home" ? "Home" : "Visitor"} Team Logo</SectionLabel>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{teamState.name || team}</p>
        </div>
      </div>

      {/* Preview */}
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          height: 140, background: "var(--bg-elevated)", border: `1px dashed ${logoSrc ? color + "55" : "var(--border)"}`,
          cursor: "pointer",
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        {logoSrc ? (
          <div style={{ position: "relative", height: 110, width: "80%" }}>
            <Image src={logoSrc} alt={teamState.name} fill style={{ objectFit: "contain" }} />
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
