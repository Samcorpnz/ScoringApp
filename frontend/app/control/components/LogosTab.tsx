"use client";

import { MatchState, TeamState } from "../../types";
import { RELAY_URL } from "../lib/relay";
import { LogoUploadCard, SectionLabel } from "./primitives";

export function LogosTab({ state, push, controlToken }: { readonly state: MatchState; readonly push: (p: Partial<MatchState>) => void; readonly controlToken: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <LogoUploader team="home" teamState={state.home} push={push} state={state} controlToken={controlToken} />
      <LogoUploader team="visitor" teamState={state.visitor} push={push} state={state} controlToken={controlToken} />
    </div>
  );
}

function LogoUploader({ team, teamState, push, state, controlToken }: {
  readonly team: "home" | "visitor";
  readonly teamState: TeamState;
  readonly push: (p: Partial<MatchState>) => void;
  readonly state: MatchState;
  readonly controlToken: string;
}) {
  const color = teamState.color || (team === "home" ? "#F59E0B" : "#818CF8");

  let logoSrc: string | null = null;
  if (teamState.logoUrl) {
    logoSrc = teamState.logoUrl.startsWith("/logos/") ? `${RELAY_URL}${teamState.logoUrl}` : teamState.logoUrl;
  }

  const handleUpload = async (file: File) => {
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
  };

  const handleRemove = async () => {
    await fetch(`${RELAY_URL}/api/logo/${team}`, {
      method: "DELETE",
      headers: { "x-control-secret": controlToken },
    });
    push({ [team]: { ...teamState, logoUrl: "" } } as Partial<MatchState>);
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

      <LogoUploadCard
        testId={`logo-${team}`}
        logoSrc={logoSrc}
        alt={teamState.name}
        activeBorderColor={color + "55"}
        onUpload={handleUpload}
        onRemove={handleRemove}
      />
    </div>
  );
}
