"use client";

import { useState, FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          org: data.get("org"),
          message: data.get("message"),
          company_website: data.get("company_website"),
        }),
      });

      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setErrorMessage(result.error || "Something went wrong — try again or email hello@scorehub.co.nz.");
        setStatus("error");
        return;
      }

      form.reset();
      setStatus("success");
    } catch {
      setErrorMessage("Something went wrong — try again or email hello@scorehub.co.nz.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="form-status success" role="status">
        Thanks — we&apos;ll be in touch shortly.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem", maxWidth: "480px" }}>
      <div>
        <label htmlFor="contact-name" className="field-label">
          Name
        </label>
        <input id="contact-name" name="name" type="text" required maxLength={200} className="field-input" />
      </div>
      <div>
        <label htmlFor="contact-email" className="field-label">
          Email
        </label>
        <input id="contact-email" name="email" type="email" required maxLength={320} className="field-input" />
      </div>
      <div>
        <label htmlFor="contact-org" className="field-label">
          Organisation
        </label>
        <input id="contact-org" name="org" type="text" maxLength={200} className="field-input" />
      </div>
      <div>
        <label htmlFor="contact-message" className="field-label">
          What are you looking to score?
        </label>
        <textarea id="contact-message" name="message" required maxLength={4000} rows={4} className="field-input" />
      </div>
      <div className="field-honeypot" aria-hidden="true">
        <label htmlFor="contact-company-website">Leave this field blank</label>
        <input id="contact-company-website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {status === "error" && (
        <p className="form-status error" role="alert">
          {errorMessage}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={status === "submitting"} style={{ justifySelf: "start" }}>
        {status === "submitting" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
