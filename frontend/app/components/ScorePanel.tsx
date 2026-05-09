"use client";

import Image from "next/image";
import { TeamState, Possession } from "../types";

interface Props {
  team: TeamState;
  side: "home" | "visitor";
  possession: Possession;
  size?: "full" | "compact" | "scorebug";
  relayUrl?: string;
}

export function ScorePanel({ team, side, possession, size = "full", relayUrl }: Props) {
  const color = team.color || (side === "home" ? "#F59E0B" : "#818CF8");
  const hasPossession = possession === side || possession === "both";
  const isCompact  = size === "compact";
  const isScorebug = size === "scorebug";

  const logoSrc = team.logoUrl
    ? team.logoUrl.startsWith("/logos/")
      ? `${relayUrl ?? ""}${team.logoUrl}`
      : team.logoUrl
    : null;

  if (isScorebug) {
    return (
      <div className="flex items-center gap-2">
        {side === "visitor" && (
          <span className="score-digit" style={{ fontSize: "1.8rem", color, lineHeight: 1 }}>{team.score}</span>
        )}
        <div className="flex flex-col items-center" style={{ minWidth: 60 }}>
          {logoSrc ? (
            <Image src={logoSrc} alt={team.name} width={28} height={28} style={{ objectFit: "contain" }} />
          ) : (
            <div
              className="rounded-sm flex items-center justify-center text-xs font-black"
              style={{ width: 28, height: 28, background: `${color}22`, border: `1px solid ${color}55`, color }}
            >
              {(team.name || side).slice(0, 3).toUpperCase()}
            </div>
          )}
          <span className="text-xs font-bold truncate mt-0.5" style={{ color: "var(--text-secondary)", maxWidth: 64 }}>
            {team.name || side.toUpperCase()}
          </span>
        </div>
        {side === "home" && (
          <span className="score-digit" style={{ fontSize: "1.8rem", color, lineHeight: 1 }}>{team.score}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center" style={{ minWidth: isCompact ? 120 : 200 }}>
      {/* Team colour strip */}
      <div
        className="w-full mb-3 rounded-sm"
        style={{ height: 4, background: color, boxShadow: `0 0 12px ${color}66` }}
      />

      {/* Logo */}
      {logoSrc && !isCompact && (
        <div className="mb-3" style={{ width: 64, height: 64, position: "relative" }}>
          <Image
            src={logoSrc}
            alt={team.name}
            width={64}
            height={64}
            style={{ objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(0,0,0,0.5))" }}
          />
        </div>
      )}

      {/* Team name */}
      <p
        className="uppercase font-bold tracking-widest text-center truncate w-full"
        style={{ fontSize: isCompact ? "0.65rem" : "0.85rem", color: "var(--text-secondary)", letterSpacing: "0.15em" }}
      >
        {team.name || (side === "home" ? "HOME" : "VISITOR")}
      </p>

      {/* Score */}
      <p
        className="score-digit"
        style={{ fontSize: isCompact ? "3.5rem" : "7rem", color, textShadow: `0 0 40px ${color}44` }}
      >
        {team.score}
      </p>

      {/* Possession indicator */}
      {!isCompact && (
        <div className="mt-1" style={{ opacity: hasPossession ? 1 : 0, transition: "opacity 200ms" }}>
          <div
            className="rounded-full px-3 py-0.5 text-xs font-bold tracking-widest uppercase"
            style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}
          >
            {possession === "both" ? "●" : side === "home" ? "▶ BALL" : "BALL ◀"}
          </div>
        </div>
      )}

      {/* Faults + timeouts */}
      {!isCompact && (
        <div className="flex gap-4 mt-3 text-xs" style={{ color: "var(--text-dim)" }}>
          {team.faults > 0 && (
            <span><span style={{ color: "var(--danger)" }}>{team.faults}</span> FLS</span>
          )}
          {team.timeouts > 0 && (
            <span><span style={{ color: "var(--accent)" }}>{team.timeouts}</span> TOs</span>
          )}
        </div>
      )}
    </div>
  );
}
