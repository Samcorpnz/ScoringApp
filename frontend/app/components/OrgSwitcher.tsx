"use client";

import { useSession } from "next-auth/react";

// Only renders when the user belongs to more than one org — most accounts
// have exactly one, so this stays invisible for the common case. Switching
// re-verifies the membership server-side (POST /api/session/switch-org)
// before updating the JWT via useSession().update(), rather than trusting
// the membership list already cached in the token.
export function OrgSwitcher() {
  const { data: session, update } = useSession();
  const memberships = session?.user?.memberships ?? [];

  if (memberships.length < 2) return null;

  async function switchOrg(orgId: string) {
    if (orgId === session?.user?.activeOrgId) return;
    const res = await fetch("/api/session/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    if (!res.ok) return;
    await update({ activeOrgId: orgId });
    window.location.reload();
  }

  return (
    <select
      className="rounded-lg px-2 py-1.5 text-xs font-bold"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
      value={session?.user?.activeOrgId ?? ""}
      onChange={e => switchOrg(e.target.value)}
    >
      {memberships.map(m => (
        <option key={m.orgId} value={m.orgId}>{m.orgName}</option>
      ))}
    </select>
  );
}
