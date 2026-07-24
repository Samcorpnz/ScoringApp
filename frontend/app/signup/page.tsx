"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldErrors(name: string, orgName: string, email: string, password: string) {
  return {
    name: name.trim() ? "" : "Name is required",
    orgName: orgName.trim() ? "" : "Organization name is required",
    email: !email ? "Email is required" : EMAIL_RE.test(email) ? "" : "Enter a valid email address",
    password: !password ? "Password is required" : password.length >= 8 ? "" : "Must be at least 8 characters",
  };
}

export default function SignupPage() {
  const router = useRouter();

  const [name,     setName]     = useState("");
  const [orgName,  setOrgName]  = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [touched,  setTouched]  = useState<Record<string, boolean>>({});

  const errors = fieldErrors(name, orgName, email, password);
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, orgName: true, email: true, password: true });
    if (Object.values(errors).some(Boolean)) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, orgName, email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Signup failed");
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error("Account created — please sign in.");
      router.push("/setup");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !Object.values(errors).some(Boolean) && !loading;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--accent)" }}>
            SAMCORP
          </p>
          <h1 className="text-3xl font-black tracking-tight">
            Score<span style={{ color: "var(--accent)" }}>Hub</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Create your account and organization
          </p>
          <div
            className="mx-auto mt-4"
            style={{ width: 32, height: 2, background: "var(--accent)", boxShadow: "0 0 10px var(--accent-glow)" }}
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-8 space-y-5"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 0 40px rgba(0,0,0,0.4)" }}
        >
          <Field
            label="Your name" type="text" value={name} onChange={setName}
            autoFocus autoComplete="name"
            error={touched.name ? errors.name : ""} onBlur={() => touch("name")}
          />
          <Field
            label="Organization name" type="text" value={orgName} onChange={setOrgName}
            autoComplete="organization"
            error={touched.orgName ? errors.orgName : ""} onBlur={() => touch("orgName")}
          />
          <Field
            label="Email" type="email" value={email} onChange={setEmail}
            autoComplete="email"
            error={touched.email ? errors.email : ""} onBlur={() => touch("email")}
          />
          <Field
            label="Password" type="password" value={password} onChange={setPassword}
            autoComplete="new-password"
            error={touched.password ? errors.password : ""} onBlur={() => touch("password")}
            hint="At least 8 characters"
          />

          {error && (
            <p
              className="text-sm rounded-lg px-3 py-2 font-semibold"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl py-3 text-sm font-black tracking-widest uppercase transition-opacity"
            style={{
              background: "var(--accent-dim)",
              border: "1px solid var(--border-accent)",
              color: "var(--accent)",
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-dim)" }}>
          Already have an account? <a href="/login" style={{ color: "var(--accent)" }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}

function Field({
  label, type, value, onChange, autoFocus, autoComplete, error, hint, onBlur,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  error?: string;
  hint?: string;
  onBlur?: () => void;
}) {
  const borderColor = error ? "var(--danger)" : "var(--border)";
  return (
    <div>
      <label
        className="block text-xs font-bold tracking-widest uppercase mb-2"
        style={{ color: "var(--text-dim)" }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          e.target.style.borderColor = borderColor;
          onBlur?.();
        }}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        required
        aria-invalid={!!error}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all"
        style={{
          background: "var(--bg-elevated)",
          border: `1px solid ${borderColor}`,
          color: "var(--text-primary)",
          outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--border-accent)")}
      />
      {error ? (
        <p className="mt-1.5 text-xs font-semibold" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-dim)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
