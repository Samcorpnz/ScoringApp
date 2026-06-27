"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, SmallBtn } from "../components/primitives";

export default function AccountPage() {
  const { data: session } = useSession();

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <Card title="Organization">
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {session?.user?.name ?? "—"}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
          Role: {session?.user?.role ?? "—"}
        </p>
      </Card>

      <DisplayNameCard initialName={session?.user?.name ?? ""} />
      <PasswordCard />
      <EmailCard currentEmail={session?.user?.email ?? ""} />

      <Card title="Billing">
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          View your current plan, upgrade, or manage payment details.
        </p>
        <a
          href="/account/billing"
          className="inline-block rounded-lg px-3 py-1.5 text-xs font-bold"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", textDecoration: "none" }}
        >
          Go to Billing →
        </a>
      </Card>
    </div>
  );
}

function StatusText({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <p className="text-xs mt-2" style={{ color: isError ? "var(--danger)" : "var(--text-secondary)" }}>{message}</p>
  );
}

function DisplayNameCard({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  async function handleSave() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/account/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "couldn't update name");
      setStatus({ message: "Name updated.", isError: false });
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Display Name">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <SmallBtn label={busy ? "Saving…" : "Save"} onClick={handleSave} primary />
      </div>
      {status && <StatusText message={status.message} isError={status.isError} />}
    </Card>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  async function handleUpdate() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "couldn't update password");
      setCurrentPassword("");
      setNewPassword("");
      setStatus({ message: "Password updated.", isError: false });
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Password">
      <div className="space-y-2">
        <input
          type="password"
          placeholder="Current password"
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="New password (min. 8 characters)"
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
        <SmallBtn label={busy ? "Updating…" : "Update Password"} onClick={handleUpdate} primary />
      </div>
      {status && <StatusText message={status.message} isError={status.isError} />}
    </Card>
  );
}

function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/account/email")
      .then(r => r.json())
      .then(data => setPending(data?.pending ?? null))
      .catch(() => {});
  }, []);

  async function handleSend() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "couldn't request email change");
      setPending(data.newEmail);
      setShowForm(false);
      setCurrentPassword("");
    } catch (e) {
      setStatus({ message: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Email Address">
      <p className="text-sm" style={{ color: "var(--text-primary)" }}>{currentEmail}</p>

      {pending && (
        <StatusText message={`A verification link was sent to ${pending} — click it to confirm the change.`} />
      )}

      {!pending && !showForm && (
        <div className="mt-3">
          <SmallBtn label="Change email" onClick={() => setShowForm(true)} />
        </div>
      )}

      {!pending && showForm && (
        <div className="space-y-2 mt-3">
          <input
            type="email"
            placeholder="New email address"
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Current password"
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
          <SmallBtn label={busy ? "Sending…" : "Send verification link"} onClick={handleSend} primary />
        </div>
      )}

      {status && <StatusText message={status.message} isError={status.isError} />}
    </Card>
  );
}
