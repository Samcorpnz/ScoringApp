interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  CONTACT_TO_EMAIL?: string;
}

// Bounded quantifiers cap backtracking cost even though the classes overlap.
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,63}$/;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handleContact(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const name = String(body.name ?? "").trim().slice(0, 200);
  const email = String(body.email ?? "").trim().slice(0, 320);
  const org = String(body.org ?? "").trim().slice(0, 200);
  const message = String(body.message ?? "").trim().slice(0, 4000);
  const honeypot = String(body.company_website ?? "").trim();

  // Honeypot field is hidden from real users via CSS; bots that fill every
  // field trip it. Report success so they don't retry with different data.
  if (honeypot) {
    return json({ ok: true }, 200);
  }

  if (!name || !EMAIL_RE.test(email) || !message) {
    return json({ error: "Please fill in your name, a valid email, and a message." }, 400);
  }

  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN || !env.CONTACT_TO_EMAIL) {
    return json({ error: "The contact form isn't set up yet — email hello@scorehub.co.nz directly." }, 503);
  }

  const form = new URLSearchParams();
  form.set("from", `ScoreHub Website <noreply@${env.MAILGUN_DOMAIN}>`);
  form.set("to", env.CONTACT_TO_EMAIL);
  form.set("h:Reply-To", email);
  form.set("subject", `New demo request from ${name}${org ? ` (${org})` : ""}`);
  form.set("text", `Name: ${name}\nEmail: ${email}\nOrganisation: ${org || "—"}\n\n${message}`);

  const mgResponse = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!mgResponse.ok) {
    return json({ error: "Couldn't send right now — email hello@scorehub.co.nz directly." }, 502);
  }

  return json({ ok: true }, 200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed." }, 405);
      }
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
